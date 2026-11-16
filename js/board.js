/* Urbanova Districts live board.
   Races public BSC RPC endpoints for UrbanovaPlots and UrbanovaClaim
   state. Pre-genesis state renders honestly as "District Nº 1 -
   Genesis not yet open". Feeds the animated city plate through
   window.URBANOVA_CITY_STATE. Every DOM write is null-guarded.
   Selectors are from the deployed, verified ABIs. */
(function () {
  var CFG = window.URBANOVA_CONFIG || {};
  var NFT = CFG.CONTRACT || "";
  var CLAIM = CFG.CLAIM || "";
  var RPCS = CFG.RPCS || [];

  var SEL = {
    genesisOpen: "0x14349d0c",
    currentDistrict: "0x89b98b0d",
    totalPlots: "0x52158f35",
    plotsInDistrict: "0xb470ca7a",
    participantsOf: "0xe200c857",
    districtEnd: "0x09ee9d88",
    verdictOf: "0xbcaa6cf7",
    totalClaimed: "0xd54ad2a1",
    claimOpen: "0x4b8bcb58",
    poolBalance: "0x96365d44"
  };
  var VERDICTS = ["Pending", "Vacant", "Block", "Metropolis"];

  function isAddr(a) { return /^0x[0-9a-fA-F]{40}$/.test(a || ""); }
  function $(id) { return document.getElementById(id); }
  function fmt(n) { return n.toLocaleString("en-US"); }
  function setText(id, txt) { var el = $(id); if (el) el.textContent = txt; }

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var tweens = {};
  function setNum(id, to) {
    var el = $(id);
    if (!el) return;
    if (reduceMotion) { el.textContent = fmt(to); return; }
    var from = parseInt((el.textContent || "").replace(/[^0-9]/g, ""), 10);
    if (isNaN(from)) from = 0;
    if (tweens[id]) cancelAnimationFrame(tweens[id]);
    var t0 = null;
    function step(ts) {
      if (!t0) t0 = ts;
      var p = Math.min(1, (ts - t0) / 650);
      var e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(Math.round(from + (to - from) * e));
      if (p < 1) tweens[id] = requestAnimationFrame(step);
    }
    tweens[id] = requestAnimationFrame(step);
  }

  function padArg(n) { var h = n.toString(16); while (h.length < 64) h = "0" + h; return h; }
  function wordToInt(hex) { return parseInt(hex, 16); }

  function rpcBatch(to, calls) {
    return new Promise(function (resolve) {
      var settled = false;
      var pending = RPCS.length;
      if (!pending) { resolve(null); return; }
      RPCS.forEach(function (url) {
        var ctl = ("AbortController" in window) ? new AbortController() : null;
        var timer = ctl ? setTimeout(function () { ctl.abort(); }, 4000) : null;
        var body = calls.map(function (c) {
          return { jsonrpc: "2.0", id: c.id, method: "eth_call", params: [{ to: to, data: c.data }, "latest"] };
        });
        fetch(url, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body), signal: ctl ? ctl.signal : undefined
        }).then(function (r) { return r.json(); }).then(function (j) {
          if (timer) clearTimeout(timer);
          if (settled || !j || !Array.isArray(j)) return;
          var out = {}, ok = true;
          calls.forEach(function (c) {
            var hit = null;
            for (var i = 0; i < j.length; i++) if (j[i].id === c.id) hit = j[i];
            if (!hit || !hit.result || hit.result === "0x") ok = false;
            else out[c.id] = hit.result;
          });
          if (ok) { settled = true; resolve(out); }
        }).catch(function () { if (timer) clearTimeout(timer); })
          .finally(function () { pending -= 1; if (!settled && pending === 0) resolve(null); });
      });
    });
  }

  /* ---------- verdict projection ---------- */
  function verdictOf(builders) {
    if (builders > 100) return "Metropolis";
    if (builders >= 25) return "Block";
    return "Vacant";
  }
  function applyVerdict(builders) {
    var pct = Math.min(100, (builders / 300) * 100);
    var bar = $("f-bar"); if (bar) bar.style.width = pct + "%";
    var needle = $("g-needle"); if (needle) needle.style.left = pct + "%";
    setText("g-part", fmt(builders));
    setText("f-proj", "Projected verdict · " + verdictOf(builders));
    setText("stage-verdict", "Verdict · " + verdictOf(builders));
    setText("f-note", builders > 100
      ? fmt(builders) + " unique builders. Past 100 a district stands as Metropolis, and extra builders deepen its claim day crowd."
      : fmt(builders) + " unique builders so far. " + (builders < 25
        ? (25 - builders) + " more unique builders lift today past Vacant into Block."
        : (101 - builders) + " more unique builders raise today into Metropolis."));
  }

  /* ---------- countdowns ---------- */
  var sealTs = 0;
  function p2(n) { return (n < 10 ? "0" : "") + n; }
  function hms(left) {
    if (left <= 0) return "00:00:00";
    return p2(Math.floor(left / 3600)) + ":" + p2(Math.floor((left % 3600) / 60)) + ":" + p2(left % 60);
  }
  function nextClaimOpenTs(now) {
    var d = new Date(now * 1000);
    var t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 9, 0, 0) / 1000;
    if (now >= t) t += 86400;
    return t;
  }
  function tick() {
    var now = Math.floor(Date.now() / 1000);
    var sealTxt = !sealTs ? "Not opened" : (now >= sealTs ? "Sealed" : hms(sealTs - now));
    setText("b-seal", sealTxt);
    setText("mb-seal", sealTs ? sealTxt : "Standby");
    setText("g-count", sealTs ? sealTxt : "--:--:--");
    setText("c-open", hms(nextClaimOpenTs(now) - now));
  }
  setInterval(tick, 1000);

  /* ---------- district board ---------- */
  function genesisMode(total) {
    sealTs = 0;
    window.URBANOVA_CITY_STATE = { sealed: [], running: { n: 1, plots: 0, builders: 0 } };
    setText("h-status", "Genesis not yet open");
    setText("b-dist", "N\u00ba 1 \u00b7 Genesis");
    setText("mb-dist", "N\u00ba 1 \u00b7 Genesis");
    setText("stage-dist", "District Nº 1");
    setNum("b-plots", 0); setNum("b-builders", 0);
    setText("b-seal", "Not opened");
    setText("b-status", "Standby");
    setText("mb-seal", "Standby");
    setText("b-note", "Genesis has not opened yet. District Nº 1 opens by hand, and its window runs to the next 00:00 UTC. Every later district runs a plain UTC day, then seals for good.");
    applyVerdict(0);
    setText("f-proj", "Projected verdict \u00b7 Awaiting first district");
    setText("stage-verdict", "Verdict \u00b7 Pending");
    setText("f-note", "Verdict follows unique builders on a day: under 25 stays Vacant, 25 to 100 stands as Block, over 100 rises as Metropolis.");
    if (typeof total === "number" && total > 0) setNum("g-total", total);
  }

  function applyDistrict(dist, plots, builders, endTs, total, claimed) {
    var now = Math.floor(Date.now() / 1000);
    setText("b-dist", "N\u00ba " + fmt(dist));
    setText("mb-dist", "N\u00ba " + fmt(dist) + " \u00b7 Building");
    setText("stage-dist", "District Nº " + fmt(dist));
    setNum("b-plots", plots);
    setNum("b-builders", builders);
    setNum("g-total", total);
    applyVerdict(builders);
    if (endTs && now < endTs) {
      sealTs = endTs; tick();
      setText("h-status", "District building");
      setText("b-status", "Building");
      setText("b-note", "District Nº " + fmt(dist) + " is building. Plots raised today take a verdict from how many unique builders show up, and a rare few turn Nova on their own seed.");
    } else {
      sealTs = 0;
      setText("b-seal", "Sealed"); setText("mb-seal", "Sealed");
      setText("h-status", "Sealed"); setText("b-status", "Sealed");
      setText("b-note", "District Nº " + fmt(dist) + " is sealed for good. A fresh district starts at 00:00 UTC. Claims for a sealed district open at 09:00 UTC on its seal day.");
    }
    // ledger: sealed unclaimed = total - running plots - claimed
    setNum("g-unclaimed", Math.max(0, total - plots - claimed));
    setNum("g-claimed", claimed);
  }

  function renderArchive(cards) {
    var row = $("arch-row");
    if (!row) return;
    if (!cards.length) {
      row.innerHTML = '<p class="arch-empty">No district has sealed yet. District Nº 1 seals at its first 00:00 UTC, and its card lands here with final plots, builders and verdict.</p>';
      return;
    }
    row.innerHTML = cards.map(function (c) {
      var vcls = c.verdict === 3 ? "metro" : c.verdict === 2 ? "block" : "";
      var claim = c.verdict === 3 ? "60,000" : c.verdict === 2 ? "12,500" : "2,500";
      return '<article class="arch-card"><div class="arch-top"><span class="arch-no">District Nº ' + fmt(c.n) + '</span>' +
        '<span class="arch-verdict ' + vcls + '">' + VERDICTS[c.verdict] + '</span></div>' +
        '<div class="arch-nums"><div><b>' + fmt(c.plots) + '</b><span>Plots</span></div>' +
        '<div><b>' + fmt(c.builders) + '</b><span>Builders</span></div>' +
        '<div><b>' + claim + '</b><span>$URBN per plot</span></div></div></article>';
    }).join("");
  }

  function raceDistrict(claimed) {
    if (!isAddr(NFT)) { genesisMode(0); renderArchive([]); return; }
    rpcBatch(NFT, [
      { id: 1, data: SEL.genesisOpen },
      { id: 2, data: SEL.currentDistrict },
      { id: 3, data: SEL.totalPlots }
    ]).then(function (r) {
      if (!r) return;
      var genesis = wordToInt(r[1]) === 1;
      var dist = wordToInt(r[2]);
      var total = wordToInt(r[3]);
      if (!genesis || dist < 1) { genesisMode(total); renderArchive([]); return; }
      rpcBatch(NFT, [
        { id: 1, data: SEL.plotsInDistrict + padArg(dist) },
        { id: 2, data: SEL.participantsOf + padArg(dist) },
        { id: 3, data: SEL.districtEnd + padArg(dist) }
      ]).then(function (r2) {
        if (!r2) { genesisMode(total); return; }
        var plots = wordToInt(r2[1]), builders = wordToInt(r2[2]), endTs = wordToInt(r2[3]);
        applyDistrict(dist, plots, builders, endTs, total, claimed || 0);
        // archive + city feed: up to 12 most recent sealed districts
        var first = Math.max(1, dist - 12);
        var sealedNs = [];
        for (var n = first; n < dist; n++) sealedNs.push(n);
        if (!sealedNs.length) {
          window.URBANOVA_CITY_STATE = { sealed: [], running: { n: dist, plots: plots, builders: builders } };
          renderArchive([]);
          return;
        }
        var calls = [];
        sealedNs.forEach(function (n, i) {
          calls.push({ id: 10 + i * 3, data: SEL.plotsInDistrict + padArg(n) });
          calls.push({ id: 11 + i * 3, data: SEL.participantsOf + padArg(n) });
          calls.push({ id: 12 + i * 3, data: SEL.verdictOf + padArg(n) });
        });
        rpcBatch(NFT, calls).then(function (r3) {
          if (!r3) return;
          var sealed = sealedNs.map(function (n, i) {
            return { n: n, plots: wordToInt(r3[10 + i * 3]), builders: wordToInt(r3[11 + i * 3]), verdict: wordToInt(r3[12 + i * 3]) };
          });
          window.URBANOVA_CITY_STATE = { sealed: sealed, running: { n: dist, plots: plots, builders: builders } };
          renderArchive(sealed.slice(-3).reverse());
        });
      });
    });
  }

  /* ---------- claim board ---------- */
  function fmtPool(weiHex) {
    var v = parseInt(weiHex, 16) / 1e18;
    if (v >= 1e9) return (v / 1e9).toFixed(2).replace(/\.?0+$/, "") + "B";
    if (v >= 1e6) return (v / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
    return fmt(Math.round(v));
  }
  function applyClaim(claimed, open, poolHex) {
    setNum("c-claimed", claimed);
    var el = $("c-pool"); if (el) el.textContent = fmtPool(poolHex);
    setText("c-status", open ? "OPEN" : "SOON");
    setText("c-note", open
      ? "Claims are open. A sealed district joins each daily opening at 09:00 UTC. Send your Binance agent a claim prompt below, one call per plot."
      : "Claims are not open yet. Plots of sealed districts become claimable once claims open, at 09:00 UTC on each seal day. Watch this board.");
  }
  var lastClaimed = 0;
  function raceClaim() {
    if (!isAddr(CLAIM)) {
      setText("c-status", "SOON");
      setText("c-note", "Claims are not open yet. Plots of sealed districts become claimable once claims open, at 09:00 UTC on each seal day. Watch this board.");
      raceDistrict(0);
      return;
    }
    rpcBatch(CLAIM, [
      { id: 1, data: SEL.totalClaimed },
      { id: 2, data: SEL.claimOpen },
      { id: 3, data: SEL.poolBalance }
    ]).then(function (r) {
      if (r) { lastClaimed = wordToInt(r[1]); applyClaim(lastClaimed, wordToInt(r[2]) === 1, r[3]); }
      raceDistrict(lastClaimed);
    });
  }

  tick();
  raceClaim();
  setInterval(raceClaim, 30000);
})();
