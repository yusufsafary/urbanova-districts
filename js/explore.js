/* Urbanova Districts interactive layer.
   Plate tilt (desktop), tile tooltip + selection on the living city
   canvas, district file drawer, live growth pulse chip, and a
   day-rhythm claim clock. Reads live state from board.js through
   window.URBANOVA_BOARD_STATE and draws through city.js API.
   Honors prefers-reduced-motion; all lookups null-guarded. */
(function () {
  function $(id) { return document.getElementById(id); }
  function fmt(n) { return (n || 0).toLocaleString("en-US"); }
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var VERDICTS = ["Pending", "Vacant", "Block", "Metropolis"];
  var RATES = { 1: "2,500", 2: "12,500", 3: "60,000" };
  var ART = { 1: "img/class-vacant.png?v=1", 2: "img/class-block.png?v=1", 3: "img/class-metropolis.png?v=1" };
  var CFG = window.URBANOVA_CONFIG || {};
  var NFT = CFG.CONTRACT || "";
  var SEL_DISTRICT_END = "0x09ee9d88";

  function verdictIdx(builders) { return builders > 100 ? 3 : builders >= 25 ? 2 : 1; }
  function boardState() { return window.URBANOVA_BOARD_STATE || { sealed: [], running: null, sealTs: 0, genesis: false }; }
  function findDistrict(n) {
    var bs = boardState();
    if (bs.running && bs.running.n === n) return { n: n, kind: "running", plots: bs.running.plots, builders: bs.running.builders };
    for (var i = 0; i < (bs.sealed || []).length; i++) {
      if (bs.sealed[i].n === n) return { n: n, kind: "sealed", plots: bs.sealed[i].plots, builders: bs.sealed[i].builders, verdict: bs.sealed[i].verdict };
    }
    return null;
  }

  var stage = $("stage"), frame = $("stage-frame"), canvas = $("city-canvas");
  var tip = $("tile-tip"), chip = $("growth-chip");
  if (!stage || !canvas) return;
  var API = window.URBANOVA_CITY_API || null;

  /* ---------- plate tilt (desktop, subtle, max ~4deg) ---------- */
  if (finePointer && !reduce && frame) {
    var tX = 0, tY = 0, cX = 0, cY = 0, tiltOn = false, tiltRaf = null;
    function tiltLoop() {
      cX += (tX - cX) * 0.09; cY += (tY - cY) * 0.09;
      frame.style.transform = "rotateX(" + cY.toFixed(2) + "deg) rotateY(" + cX.toFixed(2) + "deg)";
      if (tiltOn || Math.abs(cX) > 0.02 || Math.abs(cY) > 0.02) tiltRaf = requestAnimationFrame(tiltLoop);
      else { tiltRaf = null; frame.style.transform = ""; }
    }
    function tiltKick() { if (!tiltRaf) tiltRaf = requestAnimationFrame(tiltLoop); }
    stage.addEventListener("pointermove", function (e) {
      var r = stage.getBoundingClientRect();
      tX = ((e.clientX - r.left) / r.width - 0.5) * 8;
      tY = -((e.clientY - r.top) / r.height - 0.5) * 8;
      tiltOn = true; tiltKick();
    });
    stage.addEventListener("pointerleave", function () { tX = 0; tY = 0; tiltOn = false; tiltKick(); });
  }

  /* ---------- tile tooltip + selection ---------- */
  var selectedN = null;
  var lastTouch = false, openTs = 0;
  function tipHTML(tl) {
    var d = findDistrict(tl.n);
    if (tl.kind === "running") {
      var v = d ? VERDICTS[verdictIdx(d.builders)] : "Vacant";
      return "<b>District Nº " + tl.n + " · Building</b><span>Projected " + v + " · " + fmt(d ? d.plots : tl.plots) + " plots · " + fmt(d ? d.builders : 0) + " builders</span>";
    }
    if (tl.kind === "sealed") {
      var vv = d && d.verdict ? d.verdict : 1;
      return "<b>District Nº " + tl.n + " · " + VERDICTS[vv] + "</b><span>" + fmt(d ? d.plots : tl.plots) + " plots · " + fmt(d ? d.builders : 0) + " builders · claims " + RATES[vv] + " $URBN</span>";
    }
    return "<b>District Nº " + tl.n + " · Upcoming</b><span>A future plate · one district a day</span>";
  }
  function canvasPos(e) {
    var r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (1160 / r.width), y: (e.clientY - r.top) * (740 / r.height), r: r };
  }
  function showTip(e, tl) {
    if (!tip) return;
    var sr = stage.getBoundingClientRect();
    tip.innerHTML = tipHTML(tl);
    tip.style.left = (e.clientX - sr.left) + "px";
    tip.style.top = (e.clientY - sr.top) + "px";
    tip.classList.add("on");
  }
  function hideTip() { if (tip) tip.classList.remove("on"); }
  function select(n) {
    selectedN = n;
    if (API) API.setSelected(n);
  }
  canvas.addEventListener("pointermove", function (e) {
    if (!API || e.pointerType === "touch") return;
    var p = canvasPos(e);
    var tl = API.pick(p.x, p.y);
    if (tl) { API.setHighlight(tl.n); showTip(e, tl); canvas.style.cursor = tl.kind === "future" ? "default" : "pointer"; }
    else { API.setHighlight(null); hideTip(); }
  });
  canvas.addEventListener("pointerleave", function () { if (API) API.setHighlight(null); if (!lastTouch) hideTip(); });
  canvas.addEventListener("pointerdown", function (e) {
    if (!API) return;
    lastTouch = e.pointerType === "touch";
    var p = canvasPos(e);
    var tl = API.pick(p.x, p.y);
    if (!tl) { select(null); hideTip(); return; }
    if (e.pointerType === "touch") {
      if (selectedN === tl.n) { if (tl.kind !== "future") openDrawer(tl.n); }
      else { select(tl.n); showTip(e, tl); }
    } else {
      select(tl.n);
      if (tl.kind !== "future") openDrawer(tl.n);
    }
  });

  /* ---------- archive cards open a district file ---------- */
  var archRow = $("arch-row");
  if (archRow) {
    archRow.addEventListener("click", function (e) {
      var card = e.target.closest ? e.target.closest("[data-district]") : null;
      if (card) openDrawer(parseInt(card.getAttribute("data-district"), 10));
    });
    archRow.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      var card = e.target.closest ? e.target.closest("[data-district]") : null;
      if (card) { e.preventDefault(); openDrawer(parseInt(card.getAttribute("data-district"), 10)); }
    });
  }

  /* ---------- district drawer ---------- */
  var wrap = $("drawer-wrap"), dwCountTimer = null, dwCtx = null, endCache = {}, lastFocus = null;
  function padArg(n) { var h = n.toString(16); while (h.length < 64) h = "0" + h; return h; }
  function fetchDistrictEnd(n) {
    if (endCache[n]) return Promise.resolve(endCache[n]);
    return new Promise(function (resolve) {
      var rpcs = CFG.RPCS || [], done = false, pending = rpcs.length;
      if (!pending || !/^0x[0-9a-fA-F]{40}$/.test(NFT)) { resolve(0); return; }
      rpcs.forEach(function (url) {
        var ctl = ("AbortController" in window) ? new AbortController() : null;
        var timer = ctl ? setTimeout(function () { ctl.abort(); }, 4000) : null;
        fetch(url, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to: NFT, data: SEL_DISTRICT_END + padArg(n) }, "latest"] }),
          signal: ctl ? ctl.signal : undefined
        }).then(function (r) { return r.json(); }).then(function (j) {
          if (timer) clearTimeout(timer);
          if (done) return;
          if (j && j.result && j.result !== "0x") { done = true; endCache[n] = parseInt(j.result, 16); resolve(endCache[n]); }
        }).catch(function () { if (timer) clearTimeout(timer); })
          .finally(function () { pending -= 1; if (!done && pending === 0) resolve(0); });
      });
    });
  }
  var MONS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  function p2(x) { return (x < 10 ? "0" : "") + x; }
  function fmtTs(ts) {
    if (!ts) return "—";
    var d = new Date(ts * 1000);
    return p2(d.getUTCDate()) + " " + MONS[d.getUTCMonth()] + " " + d.getUTCFullYear() + " · " + p2(d.getUTCHours()) + ":" + p2(d.getUTCMinutes()) + " UTC";
  }
  function fmtDay(ts) {
    if (!ts) return "—";
    var d = new Date(ts * 1000);
    return p2(d.getUTCDate()) + " " + MONS[d.getUTCMonth()] + " " + d.getUTCFullYear();
  }
  function hms(left) {
    if (left <= 0) return "00:00:00";
    return p2(Math.floor(left / 3600)) + ":" + p2(Math.floor((left % 3600) / 60)) + ":" + p2(left % 60);
  }
  function setDw(id, txt) { var el = $(id); if (el) el.textContent = txt; }

  function tickDrawer() {
    if (!dwCtx) return;
    var now = Math.floor(Date.now() / 1000);
    if (dwCtx.kind === "running") {
      setDw("dw-count", dwCtx.endTs ? (now >= dwCtx.endTs ? "Sealing…" : "Seals in " + hms(dwCtx.endTs - now)) : "—");
    } else {
      var open = dwCtx.endTs ? dwCtx.endTs - 45000 : 0;
      setDw("dw-count", open ? (now >= open ? "Claims open now" : "Claims in " + hms(open - now)) : "—");
    }
  }
  function openDrawer(n) {
    var d = findDistrict(n);
    if (!wrap) wrap = $("drawer-wrap");
    if (!d || !wrap) return;
    var bs = boardState();
    var vidx = d.kind === "sealed" ? (d.verdict || 1) : verdictIdx(d.builders);
    dwCtx = { n: n, kind: d.kind, endTs: d.kind === "running" ? (bs.sealTs || 0) : 0 };
    setDw("dw-title", "District Nº " + fmt(n));
    setDw("dw-verdict", d.kind === "sealed" ? VERDICTS[vidx] + " · Sealed" : "Building · Projected " + VERDICTS[vidx]);
    setDw("dw-plots", fmt(d.plots));
    setDw("dw-builders", fmt(d.builders));
    setDw("dw-state", d.kind === "sealed" ? "Sealed" : (bs.genesis ? "Building" : "Genesis standby"));
    setDw("dw-rate", RATES[vidx] + " $URBN");
    var art = $("dw-art"); if (art) art.src = ART[vidx];
    setDw("dw-artcap", "Plate sample · " + VERDICTS[vidx] + " class art");
    setDw("dw-note", d.kind === "sealed"
      ? "Sealed for good. Every plot of District Nº " + fmt(n) + " claims once at a final verdict rate, from 11:30 UTC on its final day. A plot whose own seed lands at 970 or higher modulo 1000 turns Nova and claims 250,000 $URBN."
      : "District Nº " + fmt(n) + " is building now. Verdict follows unique builders at seal time, and a plot seed at 970 or higher modulo 1000 turns Nova and claims 250,000 $URBN.");
    if (d.kind === "running") {
      setDw("dw-day", fmtDay(dwCtx.endTs));
      setDw("dw-seal", dwCtx.endTs ? fmtTs(dwCtx.endTs) : "Opens by hand · Genesis");
      setDw("dw-open", dwCtx.endTs ? fmtTs(dwCtx.endTs - 45000) : "11:30 UTC on final day");
      tickDrawer();
    } else {
      setDw("dw-day", "…"); setDw("dw-seal", "…"); setDw("dw-open", "…"); setDw("dw-count", "…");
      fetchDistrictEnd(n).then(function (endTs) {
        if (!dwCtx || dwCtx.n !== n) return;
        dwCtx.endTs = endTs;
        setDw("dw-day", fmtDay(endTs));
        setDw("dw-seal", fmtTs(endTs));
        setDw("dw-open", endTs ? fmtTs(endTs - 45000) : "11:30 UTC on final day");
        tickDrawer();
      });
    }
    openTs = Date.now();
    lastFocus = document.activeElement;
    wrap.classList.add("open");
    wrap.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    if (dwCountTimer) clearInterval(dwCountTimer);
    dwCountTimer = setInterval(tickDrawer, 1000);
    var closeBtn = $("drawer-close"); if (closeBtn) closeBtn.focus();
  }
  function closeDrawer() {
    if (!wrap) wrap = $("drawer-wrap");
    if (!wrap) return;
    wrap.classList.remove("open");
    wrap.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    if (dwCountTimer) { clearInterval(dwCountTimer); dwCountTimer = null; }
    dwCtx = null;
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus({ preventScroll: true }); } catch (e) { /* noop */ } lastFocus = null; }
  }
  var closeBtn = $("drawer-close"), bg = $("drawer-bg");
  if (closeBtn) closeBtn.addEventListener("click", closeDrawer);
  if (bg) bg.addEventListener("click", function () { if (Date.now() - openTs > 400) closeDrawer(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeDrawer(); });

  /* ---------- growth pulse chip ---------- */
  window.addEventListener("urbanova:plot-growth", function (e) {
    if (!chip || !API) return;
    var delta = (e.detail && e.detail.delta) || 1;
    var bs = boardState();
    var c = bs.running ? API.center(bs.running.n) : null;
    if (c && API.toScreen) c = API.toScreen(c);
    var sr = stage.getBoundingClientRect(), cr = canvas.getBoundingClientRect();
    var x = sr.width / 2, y = sr.height * 0.3;
    if (c) {
      x = (cr.left - sr.left) + (c.x / 1160) * cr.width;
      y = (cr.top - sr.top) + (c.y / 740) * cr.height;
    }
    chip.textContent = "+" + delta + (delta === 1 ? " Plot" : " Plots");
    chip.style.left = x + "px";
    chip.style.top = y + "px";
    chip.classList.remove("show");
    void chip.offsetWidth;
    chip.classList.add("show");
  });

  /* ---------- day-rhythm claim clock + light preview ---------- */
  var dcFill = $("dc-fill"), dcNeedle = $("dc-needle"), dcPhase = $("dc-phase"),
      dcNow = $("dc-now"), dcTrack = $("dc-track"), dcTip = $("dc-tip");
  var dcSlider = $("dc-slider"), dcScrubT = $("dc-scrub-t"), dcLiveBtn = $("dc-live");
  var dcPreview = null; // seconds into a day while previewing, else null
  var dcIdleTimer = null;
  function phaseOf(sec) { return sec < 41400 ? "Building · claims pending" : "Claims open"; }
  function renderClock(sec, live) {
    var pct = (sec / 86400) * 100;
    if (dcFill) dcFill.style.width = pct + "%";
    if (dcNeedle) dcNeedle.style.left = pct + "%";
    if (dcPhase) {
      if (sec < 41400) dcPhase.innerHTML = "A district is building. <b>Claims for it open at 11:30 UTC</b>, in " + hms(41400 - sec) + ". Its plots keep rising until the 00:00 UTC seal.";
      else dcPhase.innerHTML = "<b>Claims open now</b> for the running district and every sealed district. A running district seals at 00:00 UTC, in " + hms(86400 - sec) + ".";
    }
    if (dcScrubT) {
      dcScrubT.textContent = live
        ? "Live clock"
        : "Preview · " + p2(Math.floor(sec / 3600)) + ":" + p2(Math.floor((sec % 3600) / 60)) + " UTC · " + phaseOf(sec);
    }
  }
  function tickClock() {
    var now = new Date();
    var sec = now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds();
    if (dcNow) dcNow.textContent = "Now · " + p2(now.getUTCHours()) + ":" + p2(now.getUTCMinutes()) + " UTC";
    if (dcPreview === null) renderClock(sec, true);
  }
  function endPreview() {
    dcPreview = null;
    if (dcIdleTimer) { clearTimeout(dcIdleTimer); dcIdleTimer = null; }
    if (API && API.setLight) API.setLight(null);
    if (dcLiveBtn) dcLiveBtn.hidden = true;
    tickClock();
  }
  if (dcTrack) {
    tickClock();
    setInterval(tickClock, 1000);
    dcTrack.addEventListener("pointermove", function (e) {
      if (!dcTip) return;
      var r = dcTrack.getBoundingClientRect();
      var f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      var sec = Math.floor(f * 86400);
      dcTip.innerHTML = p2(Math.floor(sec / 3600)) + ":" + p2(Math.floor((sec % 3600) / 60)) + " UTC · <span>" + phaseOf(sec) + "</span>";
      dcTip.style.left = (f * 100) + "%";
      dcTip.classList.add("on");
    });
    dcTrack.addEventListener("pointerleave", function () { if (dcTip) dcTip.classList.remove("on"); });
  }
  if (dcSlider) {
    var armSlider = function () {
      if (dcPreview === null) {
        var now = new Date();
        dcSlider.value = now.getUTCHours() * 60 + now.getUTCMinutes();
      }
    };
    dcSlider.addEventListener("pointerdown", armSlider);
    dcSlider.addEventListener("focus", armSlider);
    dcSlider.addEventListener("input", function () {
      var min = parseInt(dcSlider.value, 10) || 0;
      dcPreview = min * 60;
      if (API && API.setLight) API.setLight(min / 60);
      if (dcLiveBtn) dcLiveBtn.hidden = false;
      renderClock(dcPreview, false);
      if (dcIdleTimer) clearTimeout(dcIdleTimer);
      dcIdleTimer = setTimeout(endPreview, 12000);
    });
  }
  if (dcLiveBtn) dcLiveBtn.addEventListener("click", endPreview);

  /* ---------- fly mode: cinematic camera over a plate ---------- */
  var flyBtn = $("fly-btn");
  if (flyBtn && API && API.flyStart) {
    flyBtn.addEventListener("click", function () {
      if (API.flying()) API.flyStop();
      else API.flyStart();
    });
    window.addEventListener("urbanova:fly-state", function (e) {
      var on = !!(e.detail && e.detail.flying);
      flyBtn.textContent = on ? "Stop flight" : "Fly over the city";
      flyBtn.setAttribute("aria-pressed", on ? "true" : "false");
      flyBtn.classList.toggle("on", on);
    });
    if (reduce) flyBtn.hidden = true;
  }

  /* ---------- cursor glow in a hero (desktop, fine pointer) ---------- */
  var glow = $("hero-glow");
  if (glow && finePointer && !reduce) {
    var gx = 0, gy = 0, tx2 = 0, ty2 = 0, glowRaf = null, glowOn = false;
    function glowLoop() {
      gx += (tx2 - gx) * 0.12; gy += (ty2 - gy) * 0.12;
      glow.style.transform = "translate3d(" + gx.toFixed(1) + "px," + gy.toFixed(1) + "px,0) translate(-50%,-50%)";
      if (glowOn || Math.abs(tx2 - gx) > 0.4 || Math.abs(ty2 - gy) > 0.4) glowRaf = requestAnimationFrame(glowLoop);
      else glowRaf = null;
    }
    function glowKick() { if (!glowRaf) glowRaf = requestAnimationFrame(glowLoop); }
    stage.addEventListener("pointermove", function (e) {
      var r = stage.getBoundingClientRect();
      tx2 = e.clientX - r.left; ty2 = e.clientY - r.top;
      glowOn = true; glowKick();
    });
    stage.addEventListener("pointerleave", function () { glowOn = false; glowKick(); });
  }

  /* ---------- claim calculator ---------- */
  var ccRange = $("cc-range"), ccN = $("cc-n"), ccRows = $("cc-rows"),
      ccTotal = $("cc-total"), ccNote = $("cc-note"), ccBtns = document.querySelectorAll(".cc-cls");
  if (ccRange && ccTotal && ccBtns.length) {
    var CC_RATES = { 1: 2500, 2: 12500, 3: 60000, 4: 250000 };
    var CC_NAMES = { 1: "Vacant", 2: "Block", 3: "Metropolis", 4: "Nova" };
    var ccCls = 2, ccShown = 0, ccRaf = null;
    function ccTween(to) {
      if (reduce) { ccShown = to; ccTotal.textContent = fmt(to) + " $URBN"; return; }
      var from = ccShown, t0 = null;
      if (ccRaf) cancelAnimationFrame(ccRaf);
      function step(ts) {
        if (!t0) t0 = ts;
        var p = Math.min(1, (ts - t0) / 450);
        var e = 1 - Math.pow(1 - p, 3);
        ccShown = Math.round(from + (to - from) * e);
        ccTotal.textContent = fmt(ccShown) + " $URBN";
        if (p < 1) ccRaf = requestAnimationFrame(step);
      }
      ccRaf = requestAnimationFrame(step);
    }
    function renderCC() {
      var n = parseInt(ccRange.value, 10) || 1;
      if (ccN) ccN.textContent = n;
      if (ccRows) ccRows.textContent = n + (n === 1 ? " plot" : " plots") + " × " + fmt(CC_RATES[ccCls]) + " $URBN · " + CC_NAMES[ccCls];
      if (ccNote) ccNote.textContent = ccCls === 4
        ? "A Nova plot claims on its own seed, whatever a district verdict. Each claim also carries a fee in BNB, forwarded in a same transaction; a Nova plot pays double."
        : "A rate follows a final district verdict at seal time. Each claim also carries a fee in BNB, forwarded to a project wallet in a same transaction.";
      ccTween(n * CC_RATES[ccCls]);
    }
    ccBtns.forEach(function (b) {
      b.addEventListener("click", function () {
        ccCls = parseInt(b.getAttribute("data-cls"), 10) || 2;
        ccBtns.forEach(function (x) {
          var on = x === b;
          x.classList.toggle("on", on);
          x.setAttribute("aria-pressed", on ? "true" : "false");
        });
        renderCC();
      });
    });
    ccRange.addEventListener("input", renderCC);
    renderCC();
  }

  /* ---------- live activity feed (derived from board reads) ---------- */
  var feedList = $("feed-list");
  if (feedList) {
    var feedSeen = null;
    function utcHM() {
      var d = new Date();
      return p2(d.getUTCHours()) + ":" + p2(d.getUTCMinutes()) + " UTC";
    }
    function feedAdd(text) {
      var wait = feedList.querySelector(".lf-wait");
      if (wait) wait.remove();
      var li = document.createElement("li");
      li.innerHTML = "<time>" + utcHM() + "</time><span></span>";
      li.querySelector("span").textContent = text;
      feedList.insertBefore(li, feedList.firstChild);
      while (feedList.children.length > 5) feedList.removeChild(feedList.lastChild);
    }
    function feedPoll() {
      var bs = boardState();
      if (!bs || !bs.running) return;
      var snap = {
        n: bs.running.n, plots: bs.running.plots, builders: bs.running.builders,
        total: bs.total || 0, sealed: (bs.sealed || []).length,
        lastSealed: bs.sealed && bs.sealed.length ? bs.sealed[bs.sealed.length - 1] : null
      };
      if (!feedSeen) {
        if (snap.lastSealed) feedAdd("District Nº " + snap.lastSealed.n + " sealed · " + VERDICTS[snap.lastSealed.verdict || 1] + " · " + fmt(snap.lastSealed.plots) + " plots");
        feedAdd("District Nº " + snap.n + " building · " + fmt(snap.plots) + " plots · " + fmt(snap.builders) + " builders");
        feedSeen = snap;
        return;
      }
      if (snap.sealed > feedSeen.sealed && snap.lastSealed) {
        feedAdd("District Nº " + snap.lastSealed.n + " sealed · " + VERDICTS[snap.lastSealed.verdict || 1] + " · claims open 11:30 UTC");
      } else if (snap.n === feedSeen.n && snap.plots > feedSeen.plots) {
        var dPlots = snap.plots - feedSeen.plots;
        feedAdd(dPlots === 1 ? "A plot was raised · District Nº " + snap.n + " at " + fmt(snap.plots) + " plots" : dPlots + " plots raised · District Nº " + snap.n + " at " + fmt(snap.plots) + " plots");
      }
      if (snap.n === feedSeen.n) {
        [25, 101].forEach(function (th) {
          if (feedSeen.builders < th && snap.builders >= th) {
            feedAdd("District Nº " + snap.n + " passed " + (th === 25 ? "25" : "100") + " builders · " + (th === 25 ? "Block" : "Metropolis") + " pace");
          }
        });
      }
      feedSeen = snap;
    }
    setInterval(feedPoll, 2500);
    feedPoll();
  }
})();
