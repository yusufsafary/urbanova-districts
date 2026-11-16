/* Urbanova Districts: living city plate.
   A procedural isometric city drawn on canvas. One tile per district:
   sealed districts stand lit in amber with building heights fed by
   live chain reads (window.URBANOVA_CITY_STATE, set by board.js),
   a running district pulses while it grows, future districts stay
   pale outlines on cream paper. Light follows a real UTC day cycle:
   dawn warms a plate, day keeps it bright, dusk deepens amber, night
   drops a plate to an ink survey sheet with lit windows and stars.
   A rhythm slider in explore.js can preview any hour through
   API.setLight. Motion is real procedural animation, pauses
   offscreen and honors prefers-reduced-motion. */
(function () {
  var canvas = document.getElementById("city-canvas");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");
  var W = 1160, H = 740;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var highlightN = null, selectedN = null, lastTiles = [];
  var growth = { t0: -1, delta: 0 };

  var COLS = 6, ROWS = 4, TILES = COLS * ROWS;
  var TW = 176, TH = 88;              // tile diamond size
  var OX = W / 2 - 88, OY = 128;      // plate origin (top vertex of grid)
  var INK = "#2a1d15";
  var GTOP = "#ffde96", GLEFT = "#f4a66e", GRIGHT = "#d67c34";

  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }
  function iso(gx, gy) { return [OX + (gx - gy) * TW / 2, OY + (gx + gy) * TH / 2]; }
  function tileOrigin(col, row) { return iso(col, row); }
  function lerp(a, b, f) { return a + (b - a) * f; }
  function css(c) { return "rgb(" + Math.round(c[0]) + "," + Math.round(c[1]) + "," + Math.round(c[2]) + ")"; }
  function mixc(a, b, f) { return [lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(a[2], b[2], f)]; }
  function easeIO(p) { return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }
  function easeOut(p) { return 1 - Math.pow(1 - p, 3); }

  /* ---------- day-cycle light ---------- */
  var KEYS = [
    { h: 0,    bg: [35, 30, 54],    gs: [62, 53, 86],   gr: [74, 63, 100],  gf: [46, 40, 68],   top: [232, 165, 98],  left: [176, 106, 60],  right: [126, 74, 42],  label: [247, 233, 210], frame: [110, 96, 140], dark: 1 },
    { h: 5,    bg: [35, 30, 54],    gs: [62, 53, 86],   gr: [74, 63, 100],  gf: [46, 40, 68],   top: [232, 165, 98],  left: [176, 106, 60],  right: [126, 74, 42],  label: [247, 233, 210], frame: [110, 96, 140], dark: 1 },
    { h: 7,    bg: [243, 217, 194], gs: [243, 227, 198], gr: [248, 236, 212], gf: [244, 232, 208], top: [247, 196, 137], left: [229, 138, 78],  right: [201, 109, 52], label: [42, 29, 21],    frame: [216, 189, 143], dark: 0.45 },
    { h: 10,   bg: [247, 234, 211], gs: [243, 227, 198], gr: [248, 236, 212], gf: [244, 232, 208], top: [247, 196, 137], left: [229, 138, 78],  right: [201, 109, 52], label: [42, 29, 21],    frame: [216, 189, 143], dark: 0 },
    { h: 16.5, bg: [247, 234, 211], gs: [243, 227, 198], gr: [248, 236, 212], gf: [244, 232, 208], top: [247, 196, 137], left: [229, 138, 78],  right: [201, 109, 52], label: [42, 29, 21],    frame: [216, 189, 143], dark: 0 },
    { h: 18.5, bg: [238, 195, 154], gs: [240, 214, 178], gr: [246, 222, 192], gf: [238, 210, 170], top: [242, 169, 94],  left: [217, 122, 62],  right: [168, 84, 42],  label: [42, 29, 21],    frame: [206, 164, 116], dark: 0.38 },
    { h: 20,   bg: [35, 30, 54],    gs: [62, 53, 86],   gr: [74, 63, 100],  gf: [46, 40, 68],   top: [232, 165, 98],  left: [176, 106, 60],  right: [126, 74, 42],  label: [247, 233, 210], frame: [110, 96, 140], dark: 1 },
    { h: 24,   bg: [35, 30, 54],    gs: [62, 53, 86],   gr: [74, 63, 100],  gf: [46, 40, 68],   top: [232, 165, 98],  left: [176, 106, 60],  right: [126, 74, 42],  label: [247, 233, 210], frame: [110, 96, 140], dark: 1 }
  ];
  var lightOverride = null;
  function hourNow() {
    if (lightOverride !== null) return lightOverride;
    var d = new Date();
    return d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
  }
  var L = null;
  function computeLight() {
    var h = hourNow() % 24;
    var a = KEYS[0], b = KEYS[KEYS.length - 1];
    for (var i = 0; i < KEYS.length - 1; i++) {
      if (h >= KEYS[i].h && h <= KEYS[i + 1].h) { a = KEYS[i]; b = KEYS[i + 1]; break; }
    }
    var f = (b.h - a.h) > 0 ? (h - a.h) / (b.h - a.h) : 0;
    L = {
      bg: mixc(a.bg, b.bg, f), gs: mixc(a.gs, b.gs, f), gr: mixc(a.gr, b.gr, f), gf: mixc(a.gf, b.gf, f),
      top: mixc(a.top, b.top, f), left: mixc(a.left, b.left, f), right: mixc(a.right, b.right, f),
      label: mixc(a.label, b.label, f), frame: mixc(a.frame, b.frame, f),
      dark: lerp(a.dark, b.dark, f)
    };
  }

  /* ---------- camera + fly mode ---------- */
  var cam = { cx: W / 2, cy: H / 2, z: 1 };
  var camAnim = null, flyOn = false, flyPts = [], flyIdx = 0, flyWaitUntil = 0;
  function camTo(to, dur, done) {
    camAnim = { from: { cx: cam.cx, cy: cam.cy, z: cam.z }, to: to, t0: performance.now(), dur: Math.max(1, dur), done: done || null };
  }
  function flyStateEvent() {
    try { window.dispatchEvent(new CustomEvent("urbanova:fly-state", { detail: { flying: flyOn } })); } catch (e) { /* older browser */ }
  }
  function tileCenter(i) {
    var o = tileOrigin(i % COLS, Math.floor(i / COLS));
    return { x: o[0], y: o[1] + TH / 2 - 8 };
  }
  function flyStart() {
    if (reduce || flyOn) return;
    var tiles = lastTiles, pts = [];
    var order = [];
    tiles.forEach(function (tl, i) { if (tl.kind === "running") order.push(i); });
    tiles.forEach(function (tl, i) { if (tl.verdict === 3) order.push(i); });
    tiles.forEach(function (tl, i) { if (tl.kind === "sealed" && order.length < 4) order.push(i); });
    if (!order.length) tiles.forEach(function (tl, i) { if (i % 5 === 0) order.push(i); });
    order.slice(0, 4).forEach(function (i) {
      var c = tileCenter(i);
      pts.push({ cx: c.x, cy: c.y, z: 1.85 });
    });
    pts.push({ cx: W / 2, cy: H / 2, z: 1 });
    if (!pts.length) return;
    flyPts = pts; flyIdx = 0; flyOn = true; flyWaitUntil = 0;
    flyStateEvent();
  }
  function flyStop() {
    if (!flyOn && !camAnim) return;
    flyOn = false;
    camTo({ cx: W / 2, cy: H / 2, z: 1 }, 700, null);
    flyStateEvent();
  }
  function stepCamera(nowMs) {
    if (camAnim) {
      var p = Math.min(1, (nowMs - camAnim.t0) / camAnim.dur);
      var e = easeIO(p);
      cam.cx = lerp(camAnim.from.cx, camAnim.to.cx, e);
      cam.cy = lerp(camAnim.from.cy, camAnim.to.cy, e);
      cam.z = lerp(camAnim.from.z, camAnim.to.z, e);
      if (p >= 1) { var d = camAnim.done; camAnim = null; if (d) d(); }
      return;
    }
    if (flyOn && nowMs >= flyWaitUntil) {
      var target = flyPts[flyIdx % flyPts.length];
      flyIdx++;
      camTo(target, 2300, function () { flyWaitUntil = performance.now() + 1500; });
    }
  }

  function box(cx, cy, w, d, h, top, left, right, winP, rand) {
    var hw = w * TW / 2, hd = d * TH / 2;
    var x0 = cx, y0 = cy - hd, x1 = cx + hw, y1 = cy, x2 = cx, y2 = cy + hd, x3 = cx - hw, y3 = cy;
    ctx.beginPath(); ctx.moveTo(x3, y3); ctx.lineTo(x2, y2); ctx.lineTo(x2, y2 - h); ctx.lineTo(x3, y3 - h); ctx.closePath();
    ctx.fillStyle = left; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x2, y2 - h); ctx.lineTo(x1, y1 - h); ctx.closePath();
    ctx.fillStyle = right; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x0, y0 - h); ctx.lineTo(x1, y1 - h); ctx.lineTo(x2, y2 - h); ctx.lineTo(x3, y3 - h); ctx.closePath();
    ctx.fillStyle = top; ctx.fill(); ctx.stroke();
    if (winP > 0.02 && h > 26) {
      ctx.fillStyle = "rgba(255,240,214," + (0.5 + 0.5 * L.dark).toFixed(2) + ")";
      var rows = Math.max(1, Math.floor(h / 22));
      for (var i = 0; i < rows; i++) {
        for (var j = 0; j < 2; j++) {
          if (rand() > winP) continue;
          var t = (j + 0.5) / 2, s = (i + 0.5) / rows;
          var px = x1 + (x2 - x1) * t, py = (y1 + (y2 - y1) * t) - h * (1 - s);
          ctx.fillRect(px - 2, py - 2.6, 4, 5);
        }
      }
    }
  }

  function crane(x, y, t, ph) {
    var sway = Math.sin(t / 2400 + ph) * 0.16;
    var mastH = 64, jibL = 54;
    var tx = x, ty = y - mastH;
    var ang = -0.42 + sway;
    var jx = tx + Math.cos(ang) * jibL, jy = ty + Math.sin(ang) * jibL * 0.45;
    var bx = tx - Math.cos(ang) * 20, by = ty - Math.sin(ang) * 20 * 0.45;
    ctx.save();
    ctx.strokeStyle = INK; ctx.lineWidth = 2.6; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(jx, jy); ctx.stroke();
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(tx, ty - 11); ctx.lineTo(jx, jy); ctx.stroke();
    var cable = 20 + 7 * Math.sin(t / 1500 + ph);
    ctx.beginPath(); ctx.moveTo(jx, jy); ctx.lineTo(jx, jy + cable); ctx.stroke();
    ctx.fillStyle = "#c96d34";
    ctx.fillRect(jx - 4.5, jy + cable, 9, 11);
    ctx.fillStyle = INK;
    ctx.fillRect(x - 10, y - 3, 20, 5);
    ctx.restore();
  }

  var runPos = null, novaPos = [];
  function drawTile(col, row, info, t) {
    var o = tileOrigin(col, row);
    var cx = o[0], cy = o[1] + TH / 2;
    var p = [iso(col, row), iso(col + 1, row), iso(col + 1, row + 1), iso(col, row + 1)];
    ctx.beginPath();
    ctx.moveTo(p[0][0], p[0][1]); ctx.lineTo(p[1][0], p[1][1]); ctx.lineTo(p[2][0], p[2][1]); ctx.lineTo(p[3][0], p[3][1]);
    ctx.closePath();
    if (info.kind === "sealed") { ctx.fillStyle = css(L.gs); }
    else if (info.kind === "running") { ctx.fillStyle = css(L.gr); }
    else { ctx.fillStyle = css(L.gf); }
    ctx.fill();
    ctx.strokeStyle = info.kind === "future" ? css(L.frame) : INK;
    ctx.lineWidth = info.kind === "future" ? 1.2 : 1.8;
    ctx.stroke();

    var rand = rng(info.n * 7919 + 13);
    if (info.kind === "future") {
      ctx.strokeStyle = "rgba(211,186,147,.8)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx - TW / 4, cy); ctx.lineTo(cx + TW / 4, cy); ctx.stroke();
      return;
    }
    var density = info.kind === "running" ? 0.55 : 1;
    var base = info.verdict === 3 ? 64 : info.verdict === 2 ? 40 : 20;
    var scale = Math.min(1.6, 0.45 + (info.plots || 0) / 220);
    var cells = [[-0.42, -0.1], [0.05, -0.34], [0.42, -0.05], [-0.15, 0.18], [0.3, 0.3], [-0.48, 0.32], [0.02, 0.02]];
    var nb = Math.max(2, Math.round(cells.length * density * Math.min(1, 0.35 + (info.plots || 0) / 160)));
    var chosen = cells.slice(0, Math.min(nb, cells.length)).sort(function (a, b) { return (a[0] + a[1]) - (b[0] + b[1]); });
    var winP = info.kind === "sealed" ? 0.18 + 0.75 * L.dark : 0.08 + 0.5 * L.dark;
    for (var i = 0; i < chosen.length; i++) {
      var c = chosen[i];
      var bx = cx + c[0] * TW * 0.82, by = cy + c[1] * TH * 0.82;
      var h = (base * (0.55 + rand() * 0.9)) * scale;
      if (info.kind === "running") h *= 0.55 + 0.1 * Math.sin(t / 900 + i);
      var gold = info.verdict === 3 && i === 3;
      box(bx, by, 0.34, 0.34, h, gold ? GTOP : css(L.top), gold ? GLEFT : css(L.left), gold ? GRIGHT : css(L.right), winP, rand);
    }
    if (info.kind === "running") {
      runPos = { cx: cx, cy: cy };
      if (!reduce) {
        crane(cx - TW * 0.16, cy + 4, t, info.n * 1.3);
        if ((info.plots || 0) >= 40) crane(cx + TW * 0.3, cy + TH * 0.18, t, info.n * 2.1 + 2);
      }
      if (growth.t0 > 0) {
        var gp = (t - growth.t0) / 1150;
        if (gp >= 0 && gp <= 1) {
          var ge = 1 - Math.pow(1 - gp, 3);
          var gh = Math.max(2, base * scale * 1.2 * ge);
          box(cx + 0.58 * TW * 0.82, cy + 0.46 * TH * 0.82, 0.34, 0.34, gh, GTOP, GLEFT, GRIGHT, 0.9, rand);
        }
      }
    }
    if (info.verdict === 3) novaPos.push({ cx: cx, cy: cy - 54, n: info.n });
    if (info.n === selectedN || info.n === highlightN) {
      ctx.beginPath();
      ctx.moveTo(p[0][0], p[0][1]); ctx.lineTo(p[1][0], p[1][1]); ctx.lineTo(p[2][0], p[2][1]); ctx.lineTo(p[3][0], p[3][1]);
      ctx.closePath();
      if (info.n === selectedN) {
        ctx.fillStyle = "rgba(244,166,110,.16)"; ctx.fill();
        ctx.strokeStyle = "#c96d34"; ctx.lineWidth = 3;
      } else {
        ctx.strokeStyle = L.dark > 0.5 ? "rgba(247,233,210,.6)" : "rgba(42,29,21,.55)"; ctx.lineWidth = 2;
      }
      ctx.stroke();
    }
    if (info.kind === "running") {
      var pulse = 0.5 + 0.5 * Math.sin(t / 620);
      ctx.save();
      ctx.globalAlpha = 0.16 + 0.13 * pulse;
      ctx.fillStyle = "#f4a66e";
      ctx.beginPath(); ctx.ellipse(cx, cy - 16, TW * 0.52, TH * 0.62, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.fillStyle = css(L.label);
      ctx.font = "700 15px 'Space Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText("Nº " + info.n, cx, cy + TH * 0.78);
    } else if (info.kind === "sealed") {
      ctx.fillStyle = css(L.label);
      ctx.globalAlpha = 0.75;
      ctx.font = "700 12.5px 'Space Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText("Nº " + info.n, cx, cy + TH * 0.78);
      ctx.globalAlpha = 1;
    }
  }

  function state() {
    var s = window.URBANOVA_CITY_STATE || {};
    var tiles = [];
    var sealed = s.sealed || [];
    var running = s.running || null;
    var startN = sealed.length ? sealed[0].n : (running ? running.n : 1);
    var endN = running ? running.n : (sealed.length ? sealed[sealed.length - 1].n + 1 : 1);
    startN = Math.max(1, endN - TILES + 1);
    var byN = {};
    sealed.forEach(function (d) { byN[d.n] = d; });
    for (var n = startN; n < startN + TILES; n++) {
      if (running && n === running.n) tiles.push({ n: n, kind: "running", plots: running.plots, verdict: 0 });
      else if (byN[n]) tiles.push({ n: n, kind: "sealed", plots: byN[n].plots, verdict: byN[n].verdict });
      else if (n < endN) tiles.push({ n: n, kind: "sealed", plots: 0, verdict: 1 });
      else tiles.push({ n: n, kind: "future" });
    }
    return tiles;
  }

  /* atmosphere: stars, clouds, dust motes */
  var starR = rng(4242);
  var stars = [];
  for (var si = 0; si < 70; si++) stars.push({ x: starR() * W, y: starR() * H * 0.7, ph: starR() * 6.28 });
  var clouds = [
    { bx: 120, y: 64, s: 1.1, sp: 0.006 },
    { bx: 620, y: 38, s: 0.8, sp: 0.009 },
    { bx: 940, y: 92, s: 1.3, sp: 0.005 }
  ];
  var moteR = rng(777);
  var motes = [];
  for (var mi = 0; mi < 22; mi++) motes.push({ x: moteR() * W, y: 120 + moteR() * (H - 200), ph: moteR() * 6.28, sp: 0.5 + moteR() });

  var particles = [];
  function draw(t) {
    computeLight();
    stepCamera(t || performance.now());
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = css(L.bg); ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(cam.z, cam.z);
    ctx.translate(-cam.cx, -cam.cy);
    ctx.strokeStyle = css(L.frame); ctx.lineWidth = 2; ctx.strokeRect(14, 14, W - 28, H - 28);
    if (L.dark > 0.05 && !reduce) {
      stars.forEach(function (st, i) {
        ctx.save();
        ctx.globalAlpha = L.dark * (0.3 + 0.3 * (0.5 + 0.5 * Math.sin(t / 900 + st.ph)));
        ctx.fillStyle = "#f7e9d2";
        ctx.fillRect(st.x, st.y, 2, 2);
        ctx.restore();
      });
    }
    var tiles = state();
    lastTiles = tiles;
    runPos = null; novaPos = [];
    var cellsPos = tiles.map(function (tl, i) { return { tl: tl, col: i % COLS, row: Math.floor(i / COLS) }; });
    var ordered = cellsPos.slice().sort(function (a, b) { return (a.row + a.col) - (b.row + b.col); });
    var pos = {};
    cellsPos.forEach(function (cp) { pos[cp.tl.n] = [cp.col, cp.row]; });
    ordered.forEach(function (cp) { drawTile(cp.col, cp.row, cp.tl, t); });

    /* cinematic growth: golden shockwave + flash over a running tile */
    if (growth.t0 > 0 && runPos && !reduce) {
      var gp2 = (t - growth.t0) / 1400;
      if (gp2 >= 0 && gp2 <= 1) {
        var ge2 = easeOut(gp2);
        ctx.save();
        ctx.globalAlpha = (1 - gp2) * 0.55;
        ctx.strokeStyle = "#e8a53c"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(runPos.cx, runPos.cy, TW * 0.95 * ge2, TH * 0.95 * ge2, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = (1 - gp2) * 0.3;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(runPos.cx, runPos.cy, TW * 0.6 * ge2, TH * 0.6 * ge2, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
        if (gp2 < 0.45) {
          var fg = ctx.createRadialGradient(runPos.cx, runPos.cy - 20, 4, runPos.cx, runPos.cy - 20, 130);
          fg.addColorStop(0, "rgba(255,222,150," + (0.4 * (1 - gp2 / 0.45)).toFixed(2) + ")");
          fg.addColorStop(1, "rgba(255,222,150,0)");
          ctx.fillStyle = fg;
          ctx.fillRect(runPos.cx - 140, runPos.cy - 160, 280, 280);
        }
        for (var bi = 0; bi < 10; bi++) {
          var bang = bi * Math.PI / 5 + 0.3;
          var bd = ge2 * 74;
          ctx.save();
          ctx.globalAlpha = (1 - gp2) * 0.8;
          ctx.fillStyle = "#ffca7a";
          ctx.beginPath(); ctx.arc(runPos.cx + Math.cos(bang) * bd, runPos.cy - 18 + Math.sin(bang) * bd * 0.5, 2.4, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
      }
    }

    /* clouds drifting over a plate rim */
    if (!reduce) {
      ctx.save();
      ctx.fillStyle = "#ffffff";
      clouds.forEach(function (cl) {
        var cxp = ((cl.bx + t * cl.sp) % (W + 380)) - 190;
        ctx.globalAlpha = 0.16 - 0.09 * L.dark;
        ctx.beginPath();
        ctx.ellipse(cxp, cl.y, 86 * cl.s, 17 * cl.s, 0, 0, Math.PI * 2);
        ctx.ellipse(cxp + 44 * cl.s, cl.y + 5, 56 * cl.s, 13 * cl.s, 0, 0, Math.PI * 2);
        ctx.ellipse(cxp - 48 * cl.s, cl.y + 6, 50 * cl.s, 12 * cl.s, 0, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    }

    /* dust motes / fireflies */
    if (!reduce) {
      motes.forEach(function (m) {
        var mx = (m.x + t * 0.008 * m.sp) % W;
        var my = m.y + Math.sin(t / 1400 + m.ph) * 6;
        ctx.save();
        ctx.globalAlpha = 0.08 + 0.22 * L.dark + 0.05 * (0.5 + 0.5 * Math.sin(t / 800 + m.ph));
        ctx.fillStyle = L.dark > 0.4 ? "#ffca7a" : "#c96d34";
        ctx.beginPath(); ctx.arc(mx, my, 1.7, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      });
    }

    /* nova twinkles on metropolis tiles */
    if (!reduce) {
      novaPos.forEach(function (np) {
        var tw = 0.5 + 0.5 * Math.sin(t / 620 + np.n * 1.7);
        var ln = 9 + 5 * tw;
        ctx.save();
        ctx.globalAlpha = 0.35 + 0.55 * tw;
        ctx.strokeStyle = "#ffd76a"; ctx.lineWidth = 2; ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(np.cx - ln, np.cy); ctx.lineTo(np.cx + ln, np.cy);
        ctx.moveTo(np.cx, np.cy - ln); ctx.lineTo(np.cx, np.cy + ln);
        ctx.stroke();
        ctx.restore();
      });
    }

    /* sparks over a hottest tile */
    var hot = tiles.filter(function (tl) { return tl.verdict === 3 || tl.kind === "running"; });
    if (hot.length && !reduce) {
      var hp = pos[hot[hot.length - 1].n];
      var o = tileOrigin(hp[0], hp[1]);
      var cx = o[0], cy = o[1] + TH / 2 - 40;
      if (particles.length < 26 && Math.random() < 0.5) {
        particles.push({ x: cx + (Math.random() - 0.5) * 90, y: cy + Math.random() * 26, vy: -(0.25 + Math.random() * 0.5), life: 1 });
      }
      particles = particles.filter(function (pt) { return pt.life > 0; });
      particles.forEach(function (pt) {
        pt.y += pt.vy; pt.life -= 0.008;
        ctx.save(); ctx.globalAlpha = Math.max(0, pt.life) * 0.85;
        ctx.fillStyle = "#e58a4e";
        ctx.beginPath(); ctx.arc(pt.x, pt.y, 2.4, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      });
      var pulse = 0.6 + 0.4 * Math.sin(t / 480);
      ctx.save(); ctx.globalAlpha = 0.5 * pulse;
      ctx.strokeStyle = "#c96d34"; ctx.lineWidth = 2.4;
      for (var k = 0; k < 8; k++) {
        var ang = k * Math.PI / 4 + 0.4, ln2 = 20 + 8 * pulse;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ang) * 10, cy + Math.sin(ang) * 10);
        ctx.lineTo(cx + Math.cos(ang) * ln2, cy + Math.sin(ang) * ln2);
        ctx.stroke();
      }
      ctx.restore();
      ctx.fillStyle = "#ffde96";
      ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.stroke();
    }
    ctx.restore();
  }

  /* Interaction API for explore.js: hit testing in canvas coords,
     hover/selected highlight, tile centers, growth moments, light
     preview, fly camera, screen mapping. */
  window.URBANOVA_CITY_API = {
    tiles: function () {
      return lastTiles.map(function (tl, i) { return { n: tl.n, kind: tl.kind, plots: tl.plots || 0, verdict: tl.verdict || 0, col: i % COLS, row: Math.floor(i / COLS) }; });
    },
    pick: function (x, y) {
      var wx = cam.cx + (x - W / 2) / cam.z, wy = cam.cy + (y - H / 2) / cam.z;
      var u = (wx - OX) / (TW / 2), v = (wy - OY) / (TH / 2);
      var gx = (u + v) / 2, gy = (v - u) / 2;
      var col = Math.floor(gx), row = Math.floor(gy);
      if (col < 0 || row < 0 || col >= COLS || row >= ROWS) return null;
      var tl = lastTiles[row * COLS + col];
      if (!tl) return null;
      return { n: tl.n, kind: tl.kind, col: col, row: row };
    },
    center: function (n) {
      for (var i = 0; i < lastTiles.length; i++) {
        if (lastTiles[i].n === n) {
          var o = tileOrigin(i % COLS, Math.floor(i / COLS));
          return { x: o[0], y: o[1] + TH / 2 };
        }
      }
      return null;
    },
    toScreen: function (p) {
      return { x: (p.x - cam.cx) * cam.z + W / 2, y: (p.y - cam.cy) * cam.z + H / 2 };
    },
    setHighlight: function (n) { highlightN = n; if (reduce) draw(1200); },
    setSelected: function (n) { selectedN = n; if (reduce) draw(1200); },
    setLight: function (hourOrNull) {
      lightOverride = (hourOrNull === null || hourOrNull === undefined) ? null : ((hourOrNull % 24) + 24) % 24;
      if (reduce) draw(1200);
    },
    flyStart: flyStart,
    flyStop: flyStop,
    flying: function () { return flyOn; },
    grow: function (delta) {
      growth = { t0: performance.now(), delta: delta };
      try { window.dispatchEvent(new CustomEvent("urbanova:plot-growth", { detail: { delta: delta } })); } catch (e) { /* older browser */ }
    }
  };

  canvas.addEventListener("pointerdown", function () { if (flyOn) flyStop(); });
  canvas.addEventListener("wheel", function () { if (flyOn) flyStop(); }, { passive: true });

  var running = false, visible = true;
  function loop(t) {
    if (!running) return;
    if (visible) draw(t || 0);
    requestAnimationFrame(loop);
  }
  function start() {
    if (reduce) { draw(1200); return; }
    if (!running) { running = true; requestAnimationFrame(loop); }
  }
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (e) { visible = e[0].isIntersecting; }, { threshold: 0.05 }).observe(canvas);
  }
  document.addEventListener("visibilitychange", function () { visible = !document.hidden; });
  start();
})();
