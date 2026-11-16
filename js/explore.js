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
  var wrap = $("drawer-wrap"), dwCountTimer = null, dwCtx = null, endCache = {};
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
      var open = dwCtx.endTs ? dwCtx.endTs + 32400 : 0;
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
      ? "Sealed for good. Every plot of District Nº " + fmt(n) + " claims once at a final verdict rate, from 09:00 UTC on seal day. A plot whose own seed lands at 970 or higher modulo 1000 turns Nova and claims 250,000 $URBN."
      : "District Nº " + fmt(n) + " is building now. Verdict follows unique builders at seal time, and a plot seed at 970 or higher modulo 1000 turns Nova and claims 250,000 $URBN.");
    if (d.kind === "running") {
      setDw("dw-day", fmtDay(dwCtx.endTs));
      setDw("dw-seal", dwCtx.endTs ? fmtTs(dwCtx.endTs) : "Opens by hand · Genesis");
      setDw("dw-open", dwCtx.endTs ? fmtTs(dwCtx.endTs + 32400) : "09:00 UTC on seal day");
      tickDrawer();
    } else {
      setDw("dw-day", "…"); setDw("dw-seal", "…"); setDw("dw-open", "…"); setDw("dw-count", "…");
      fetchDistrictEnd(n).then(function (endTs) {
        if (!dwCtx || dwCtx.n !== n) return;
        dwCtx.endTs = endTs;
        setDw("dw-day", fmtDay(endTs));
        setDw("dw-seal", fmtTs(endTs));
        setDw("dw-open", endTs ? fmtTs(endTs + 32400) : "09:00 UTC on seal day");
        tickDrawer();
      });
    }
    openTs = Date.now();
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

  /* ---------- day-rhythm claim clock ---------- */
  var dcFill = $("dc-fill"), dcNeedle = $("dc-needle"), dcPhase = $("dc-phase"),
      dcNow = $("dc-now"), dcTrack = $("dc-track"), dcTip = $("dc-tip");
  function phaseOf(sec) { return sec < 32400 ? "Sealed · claims pending" : "Claims open"; }
  function tickClock() {
    var now = new Date();
    var sec = now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds();
    var pct = (sec / 86400) * 100;
    if (dcFill) dcFill.style.width = pct + "%";
    if (dcNeedle) dcNeedle.style.left = pct + "%";
    if (dcNow) dcNow.textContent = "Now · " + p2(now.getUTCHours()) + ":" + p2(now.getUTCMinutes()) + " UTC";
    if (dcPhase) {
      if (sec < 32400) dcPhase.innerHTML = "A district sealed at 00:00 UTC. <b>Claims for it open at 09:00 UTC</b>, in " + hms(32400 - sec) + ". A running district keeps building all day.";
      else dcPhase.innerHTML = "<b>Claims open now</b> for every sealed district. A running district seals at 00:00 UTC, in " + hms(86400 - sec) + ".";
    }
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
})();
