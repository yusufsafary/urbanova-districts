/* Urbanova Districts claim checker.
   Read-only helper for the Claim section: a visitor types a plot
   number, the page reads UrbanovaPlots and UrbanovaClaim state by
   racing the public RPC endpoints from city/config.js, and reports
   class, claim amount and status, including the daily 11:30 UTC
   claim opening. Nothing is signed and no wallet connects; a copy
   button prepares a ready prompt for the visitor's own agent.
   Every DOM write is null-guarded. Selectors are from the verified ABIs. */
(function () {
  var CFG = window.URBANOVA_CONFIG || {};
  var NFT = CFG.CONTRACT || "";
  var CLAIM = CFG.CLAIM || "";
  var RPCS = CFG.RPCS || [];

  var SEL_NFT = {
    districtOf: "0xd80ed09a",
    isSealed: "0x2c1758c1",
    classOf: "0x4324aa21",
    ownerOf: "0x6352211e"
  };
  var SEL_CLAIM = {
    claimedById: "0x4c80ee12",
    claimAmount: "0x23b221a0",
    claimOpen: "0x4b8bcb58",
    claimableNow: "0x2cc1cc81",
    claimOpensAt: "0xd0eec3d0",
    feeFor: "0xad6f49a3"
  };
  var CLASSES = ["Vacant", "Block", "Metropolis", "Nova", "Pending"];

  function $(id) { return document.getElementById(id); }
  function fmt(n) { return n.toLocaleString("en-US"); }
  function padArg(n) { var h = n.toString(16); while (h.length < 64) h = "0" + h; return h; }
  function isAddr(a) { return /^0x[0-9a-fA-F]{40}$/.test(a || ""); }

  function rpcBatch(to, calls) {
    return new Promise(function (resolve) {
      var settled = false;
      var pending = RPCS.length;
      if (!pending || !isAddr(to)) { resolve(null); return; }
      RPCS.forEach(function (url) {
        var ctl = ("AbortController" in window) ? new AbortController() : null;
        var timer = ctl ? setTimeout(function () { ctl.abort(); }, 5000) : null;
        var body = calls.map(function (c, i) {
          return { jsonrpc: "2.0", id: i, method: "eth_call", params: [{ to: to, data: c.data }, "latest"] };
        });
        fetch(url, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body), signal: ctl ? ctl.signal : undefined
        }).then(function (r) { return r.json(); }).then(function (j) {
          if (timer) clearTimeout(timer);
          if (settled || !j || !Array.isArray(j)) { if (--pending === 0 && !settled) resolve(null); return; }
          var out = {}, answered = 0;
          calls.forEach(function (c, i) {
            var hit = null;
            for (var k = 0; k < j.length; k++) { if (j[k].id === i) { hit = j[k]; break; } }
            if (hit) { answered++; out[c.key] = (typeof hit.result === "string") ? hit.result : null; }
          });
          if (answered === calls.length) { settled = true; resolve(out); }
          else if (--pending === 0 && !settled) resolve(null);
        }).catch(function () {
          if (timer) clearTimeout(timer);
          if (--pending === 0 && !settled) resolve(null);
        });
      });
    });
  }

  function toInt(hex) { return hex ? parseInt(hex, 16) : NaN; }
  function toBig(hex) { if (!hex) return null; try { return BigInt(hex); } catch (e) { return null; } }
  function fmtTok(big) { return big === null ? "?" : fmt(Number(big / 1000000000000000000n)); }
  function fmtFee(big) {
    if (big === null) return "?";
    return (Number(big) / 1e18).toFixed(6).replace(/0+$/, "").replace(/\.$/, ".0") + " BNB";
  }
  function fmtTime(ts) {
    var d = new Date(ts * 1000);
    var p2 = function (n) { return (n < 10 ? "0" : "") + n; };
    return p2(d.getUTCHours()) + ":" + p2(d.getUTCMinutes()) + " UTC";
  }

  var last = null;

  function setResult(txt) { var el = $("ck-result"); if (el) el.textContent = txt; }

  function check() {
    var input = $("ck-id");
    var btn = $("ck-go");
    var id = input ? parseInt(input.value, 10) : NaN;
    if (!id || id < 1) { setResult("Enter a valid plot number first."); last = null; return; }
    if (!isAddr(NFT) || !isAddr(CLAIM)) {
      setResult("Contracts are not live yet. Plot " + id + " can be checked here once deployment lands.");
      last = null; return;
    }
    if (btn) { btn.disabled = true; btn.textContent = "Reading\u2026"; }
    setResult("Reading plot " + id + " on-chain\u2026");
    last = null;

    rpcBatch(NFT, [
      { key: "dist", data: SEL_NFT.districtOf + padArg(id) },
      { key: "cls", data: SEL_NFT.classOf + padArg(id) },
      { key: "own", data: SEL_NFT.ownerOf + padArg(id) }
    ]).then(function (a) {
      if (!a || !a.own) {
        setResult("Plot " + id + " has not been raised yet, or the read failed. Check the number and try again.");
        return null;
      }
      var dist = toInt(a.dist);
      var cls = toInt(a.cls);
      return rpcBatch(NFT, [
        { key: "sealed", data: SEL_NFT.isSealed + padArg(dist) }
      ]).then(function (b) {
        return rpcBatch(CLAIM, [
          { key: "done", data: SEL_CLAIM.claimedById + padArg(id) },
          { key: "amt", data: SEL_CLAIM.claimAmount + padArg(id) },
          { key: "open", data: SEL_CLAIM.claimOpen },
          { key: "able", data: SEL_CLAIM.claimableNow + padArg(id) },
          { key: "opens", data: SEL_CLAIM.claimOpensAt + padArg(dist) },
          { key: "fee", data: SEL_CLAIM.feeFor + padArg(id) }
        ]).then(function (c) {
          return { dist: dist, cls: cls, sealed: b ? toInt(b.sealed) : NaN, c: c };
        });
      });
    }).then(function (r) {
      if (btn) { btn.disabled = false; btn.textContent = "Check plot"; }
      if (!r) return;
      var clsName = CLASSES[r.cls] || "Pending";
      var amtText = r.c ? fmtTok(toBig(r.c.amt)) : "?";
      var base = "Plot Nº " + id + " \u00b7 District " + r.dist + " \u00b7 Class " + clsName + ". ";
      if (!r.sealed && !(r.c && toInt(r.c.able) === 1)) {
        last = { id: id, claimable: false };
        setResult(base + "Its district is still building and seals at 00:00 UTC. Claims for it open at 11:30 UTC on its final day.");
        return;
      }
      if (!r.c) { setResult(base + "Sealed, but the claim read failed. Try again in a moment."); return; }
      var done = toInt(r.c.done) === 1;
      var open = toInt(r.c.open) === 1;
      var able = toInt(r.c.able) === 1;
      var opensTs = toInt(r.c.opens);
      var feeText = fmtFee(toBig(r.c.fee));
      if (done) {
        last = { id: id, claimable: false };
        setResult(base + "Already claimed. A plot claims once, and it stays in its owner's wallet.");
        return;
      }
      if (!open) {
        last = { id: id, claimable: false };
        setResult(base + "Sealed and ready, but claims are paused right now. Amount held for it: " + amtText + " $URBN.");
        return;
      }
      if (!able) {
        last = { id: id, claimable: false };
        setResult(base + "Sealed. Its claim window opens at " + fmtTime(opensTs) + " today. Amount: " + amtText + " $URBN, claim fee " + feeText + ".");
        return;
      }
      last = { id: id, claimable: true, amountText: amtText, clsName: clsName, feeText: feeText };
      setResult(base + "Claimable now: " + amtText + " $URBN, claim fee " + feeText + ". Copy the claim prompt below and hand it to your agent.");
    }).catch(function () {
      if (btn) { btn.disabled = false; btn.textContent = "Check plot"; }
      setResult("The read failed. Try again in a moment.");
    });
  }

  function copyText(txt, btn) {
    function done() {
      if (!btn) return;
      var old = btn.textContent;
      btn.textContent = "Copied";
      setTimeout(function () { btn.textContent = old; }, 1600);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(done).catch(function () { fallback(); });
    } else { fallback(); }
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = txt;
      ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); done(); } catch (e) { /* clipboard unavailable */ }
      document.body.removeChild(ta);
    }
  }

  function copyPrompt() {
    var btn = $("ck-copy");
    var txt;
    if (last && last.claimable) {
      txt = "Read https://urbanova.app/skill.md and claim $URBN for my Urbanova plot Nº " + last.id + " on BNB Chain (chain id 56).\n\n" +
        "Facts already checked on this page: plot Nº " + last.id + ", class " + last.clsName + ", claimable " + last.amountText + " $URBN, claim window open, not yet claimed, claim fee " + last.feeText + ".\n\n" +
        "Rules from the skill file:\n" +
        "1. Contract addresses live in https://urbanova.app/city/config.js (URBANOVA_CONFIG). Abort if any address is empty or a zero address.\n" +
        "2. Confirm claimOpen() is 1 on the claim contract, claimedById(" + last.id + ") is 0, claimableNow(" + last.id + ") is 1, and claimAmount(" + last.id + ") matches " + last.amountText + " $URBN. Abort if anything differs.\n" +
        "3. Call claim(" + last.id + ") attaching exactly feeFor(" + last.id + ") in BNB.\n" +
        "4. Show me a preview before signing, wait for my confirmation, then report the transaction hash and the $URBN amount.";
    } else {
      var pre = $("claim-prompt");
      txt = pre ? pre.textContent : "Read https://urbanova.app/skill.md and claim $URBN for my Urbanova plots on BNB Chain (chain id 56).";
    }
    copyText(txt, btn);
  }

  var go = $("ck-go");
  var cp = $("ck-copy");
  var input = $("ck-id");
  if (go) go.addEventListener("click", check);
  if (cp) cp.addEventListener("click", copyPrompt);
  if (input) input.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); check(); } });
})();
