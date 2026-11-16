/* Urbanova Districts: living city plate.
   A procedural isometric city drawn on canvas. One tile per district:
   sealed districts stand lit in amber with building heights fed by
   live chain reads (window.URBANOVA_CITY_STATE, set by board.js),
   a running district pulses while it grows, future districts stay
   pale outlines on cream paper. Motion is real procedural animation,
   pauses offscreen and honors prefers-reduced-motion. */
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
  var OX = W / 2 - 88, OY = 128;      // plate origin (top vertex of grid), offset so a 6x4 plate centers
  var CREAM = "#f7ead3", PAPER_LINE = "#e7d3ae", INK = "#2a1d15";
  var TOP = "#f7c489", LEFT = "#e58a4e", RIGHT = "#c96d34";
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

  function box(cx, cy, w, d, h, top, left, right, lit, rand) {
    // footprint centered at iso point (cx, cy) on tile ground
    var hw = w * TW / 2, hd = d * TH / 2;
    var x0 = cx, y0 = cy - hd, x1 = cx + hw, y1 = cy, x2 = cx, y2 = cy + hd, x3 = cx - hw, y3 = cy;
    ctx.beginPath(); ctx.moveTo(x3, y3); ctx.lineTo(x2, y2); ctx.lineTo(x2, y2 - h); ctx.lineTo(x3, y3 - h); ctx.closePath();
    ctx.fillStyle = left; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x2, y2 - h); ctx.lineTo(x1, y1 - h); ctx.closePath();
    ctx.fillStyle = right; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x0, y0 - h); ctx.lineTo(x1, y1 - h); ctx.lineTo(x2, y2 - h); ctx.lineTo(x3, y3 - h); ctx.closePath();
    ctx.fillStyle = top; ctx.fill(); ctx.stroke();
    if (lit && h > 26) {
      ctx.fillStyle = "rgba(255,240,214,.95)";
      var rows = Math.max(1, Math.floor(h / 22));
      for (var i = 0; i < rows; i++) {
        for (var j = 0; j < 2; j++) {
          if (rand() < 0.5) continue;
          var t = (j + 0.5) / 2, s = (i + 0.5) / rows;
          var px = x1 + (x2 - x1) * t, py = (y1 + (y2 - y1) * t) - h * (1 - s);
          ctx.fillRect(px - 2, py - 2.6, 4, 5);
        }
      }
    }
  }

  function drawTile(col, row, info, t) {
    var o = tileOrigin(col, row);
    var cx = o[0], cy = o[1] + TH / 2;
    // ground diamond
    var p = [iso(col, row), iso(col + 1, row), iso(col + 1, row + 1), iso(col, row + 1)];
    ctx.beginPath();
    ctx.moveTo(p[0][0], p[0][1]); ctx.lineTo(p[1][0], p[1][1]); ctx.lineTo(p[2][0], p[2][1]); ctx.lineTo(p[3][0], p[3][1]);
    ctx.closePath();
    if (info.kind === "sealed") { ctx.fillStyle = "#f3e3c6"; }
    else if (info.kind === "running") { ctx.fillStyle = "#f8ecd4"; }
    else { ctx.fillStyle = "#f4e8d0"; }
    ctx.fill();
    ctx.strokeStyle = info.kind === "future" ? PAPER_LINE : INK;
    ctx.lineWidth = info.kind === "future" ? 1.2 : 1.8;
    ctx.stroke();

    var rand = rng(info.n * 7919 + 13);
    if (info.kind === "future") {
      // faint foundation cross
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
    for (var i = 0; i < chosen.length; i++) {
      var c = chosen[i];
      var bx = cx + c[0] * TW * 0.82, by = cy + c[1] * TH * 0.82;
      var h = (base * (0.55 + rand() * 0.9)) * scale;
      if (info.kind === "running") h *= 0.55 + 0.1 * Math.sin(t / 900 + i);
      var gold = info.verdict === 3 && i === 3;
      box(bx, by, 0.34, 0.34, h, gold ? GTOP : TOP, gold ? GLEFT : LEFT, gold ? GRIGHT : RIGHT, info.kind === "sealed", rand);
    }
    if (info.kind === "running" && growth.t0 > 0) {
      var gp = (t - growth.t0) / 1150;
      if (gp >= 0 && gp <= 1) {
        var ge = 1 - Math.pow(1 - gp, 3);
        var gh = Math.max(2, base * scale * 1.2 * ge);
        box(cx + 0.58 * TW * 0.82, cy + 0.46 * TH * 0.82, 0.34, 0.34, gh, GTOP, GLEFT, GRIGHT, true, rand);
      }
    }
    if (info.n === selectedN || info.n === highlightN) {
      ctx.beginPath();
      ctx.moveTo(p[0][0], p[0][1]); ctx.lineTo(p[1][0], p[1][1]); ctx.lineTo(p[2][0], p[2][1]); ctx.lineTo(p[3][0], p[3][1]);
      ctx.closePath();
      if (info.n === selectedN) {
        ctx.fillStyle = "rgba(244,166,110,.16)"; ctx.fill();
        ctx.strokeStyle = "#c96d34"; ctx.lineWidth = 3;
      } else {
        ctx.strokeStyle = "rgba(42,29,21,.55)"; ctx.lineWidth = 2;
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
      ctx.fillStyle = INK;
      ctx.font = "700 15px 'Space Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText("Nº " + info.n, cx, cy + TH * 0.78);
    } else if (info.kind === "sealed") {
      ctx.fillStyle = "rgba(42,29,21,.62)";
      ctx.font = "700 12.5px 'Space Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText("Nº " + info.n, cx, cy + TH * 0.78);
    }
  }

  function state() {
    var s = window.URBANOVA_CITY_STATE || {};
    var tiles = [];
    var sealed = s.sealed || [];         // [{n, plots, verdict}] oldest first
    var running = s.running || null;     // {n, plots, builders}
    var startN = sealed.length ? sealed[0].n : (running ? running.n : 1);
    // window of TILES districts ending at the running one
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

  var particles = [];
  function draw(t) {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = CREAM; ctx.fillRect(0, 0, W, H);
    // paper frame
    ctx.strokeStyle = "#d8bd8f"; ctx.lineWidth = 2; ctx.strokeRect(14, 14, W - 28, H - 28);
    var tiles = state();
    lastTiles = tiles;
    // draw back to front: row+col ascending
    var cellsPos = tiles.map(function (tl, i) { return { tl: tl, col: i % COLS, row: Math.floor(i / COLS) }; });
    var ordered = cellsPos.slice().sort(function (a, b) { return (a.row + a.col) - (b.row + b.col); });
    var pos = {};
    cellsPos.forEach(function (cp) { pos[cp.tl.n] = [cp.col, cp.row]; });
    ordered.forEach(function (cp) {
      drawTile(cp.col, cp.row, cp.tl, t);
    });
    // nova sparks over a metropolis or running tile
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
        var ang = k * Math.PI / 4 + 0.4, ln = 20 + 8 * pulse;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ang) * 10, cy + Math.sin(ang) * 10);
        ctx.lineTo(cx + Math.cos(ang) * ln, cy + Math.sin(ang) * ln);
        ctx.stroke();
      }
      ctx.restore();
      ctx.fillStyle = "#ffde96";
      ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.stroke();
    }
  }

  /* Interaction API for explore.js: hit testing in canvas coords,
     hover/selected highlight, tile centers, growth moments. */
  window.URBANOVA_CITY_API = {
    tiles: function () {
      return lastTiles.map(function (tl, i) { return { n: tl.n, kind: tl.kind, plots: tl.plots || 0, verdict: tl.verdict || 0, col: i % COLS, row: Math.floor(i / COLS) }; });
    },
    pick: function (x, y) {
      var u = (x - OX) / (TW / 2), v = (y - OY) / (TH / 2);
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
    setHighlight: function (n) { highlightN = n; if (reduce) draw(1200); },
    setSelected: function (n) { selectedN = n; if (reduce) draw(1200); },
    grow: function (delta) {
      growth = { t0: performance.now(), delta: delta };
      try { window.dispatchEvent(new CustomEvent("urbanova:plot-growth", { detail: { delta: delta } })); } catch (e) { /* older browser */ }
    }
  };

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
