/* Urbanova Districts page behaviour: copy buttons, UTC clock,
   contract address fill from city/config.js, build calculator,
   reveal on scroll. Every lookup is null-guarded. */
(function () {
  function $(id) { return document.getElementById(id); }
  var CFG = window.URBANOVA_CONFIG || {};

  var ADDRS = {
    nft: CFG.CONTRACT,
    token: CFG.TOKEN,
    claim: CFG.CLAIM,
    registry: CFG.AGENT_ID_REGISTRY,
    wallet: CFG.PROJECT_WALLET
  };
  Object.keys(ADDRS).forEach(function (key) {
    var val = ADDRS[key];
    if (!val) return;
    document.querySelectorAll('[data-addr="' + key + '"]').forEach(function (el) {
      el.textContent = val;
    });
    if (/^0x[0-9a-fA-F]{40}$/.test(val)) {
      document.querySelectorAll('[data-addr-link="' + key + '"]').forEach(function (el) {
        el.setAttribute("href", "https://bscscan.com/address/" + val);
      });
    }
  });

  function wireCopy(btnId, srcId, label) {
    var btn = $(btnId), src = $(srcId);
    if (!btn || !src) return;
    btn.addEventListener("click", function () {
      var t = src.textContent;
      try {
        if (navigator.clipboard) navigator.clipboard.writeText(t);
        else {
          var ta = document.createElement("textarea");
          ta.value = t; document.body.appendChild(ta); ta.select();
          document.execCommand("copy"); ta.remove();
        }
      } catch (err) { /* clipboard unavailable */ }
      btn.textContent = "Copied";
      setTimeout(function () { btn.textContent = label; }, 1600);
    });
  }
  wireCopy("copy-prompt", "agent-prompt", "Copy prompt");
  wireCopy("copy-prompt-claim", "claim-prompt", "Copy prompt");
  wireCopy("copy-token", "token-addr", "Copy address");

  /* Swap buttons: prefilled with a $URBN address only when a real one
     exists; inert while no pool and no address are live. */
  document.querySelectorAll("[data-swap]").forEach(function (a) {
    var base = a.getAttribute("data-swap");
    if (base && /^0x[0-9a-fA-F]{40}$/.test(CFG.TOKEN || "")) {
      a.setAttribute("href", base + CFG.TOKEN);
    } else {
      a.setAttribute("href", "#");
      a.setAttribute("aria-disabled", "true");
    }
  });

  /* Build calculator (index only) */
  var range = $("calc-range"), cN = $("calc-n"), cRows = $("calc-rows"),
      cTotal = $("calc-total"), cNote = $("calc-note");
  function priceOf(plotNo) {
    if (plotNo <= 1) return 0;
    if (plotNo <= 5) return 0.0002;
    return 0.0004;
  }
  function renderCalc() {
    if (!range || !cN) return;
    var n = parseInt(range.value, 10) || 1;
    cN.textContent = n;
    var parts = [], total = 0;
    for (var i = 1; i <= n; i++) {
      var p = priceOf(i);
      total += p;
      parts.push(p === 0 ? "FREE" : p.toFixed(4));
    }
    if (cRows) cRows.textContent = parts.join(" + ");
    if (cTotal) cTotal.textContent = total.toFixed(4) + " BNB";
    if (cNote) cNote.textContent = n >= 10
      ? "Ten plots is a wallet's full claim on one district. Tomorrow's district resets the allowance."
      : "Your first plot of each district is free with an Agent ID. Paid amounts forward to the project wallet in the same transaction.";
  }
  if (range) { range.addEventListener("input", renderCalc); renderCalc(); }

  /* Live UTC clock */
  var clock = $("utc-clock");
  if (clock) {
    var DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    var MONS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    var pad = function (n) { return (n < 10 ? "0" : "") + n; };
    var tickClock = function () {
      var d = new Date();
      clock.textContent = DAYS[d.getUTCDay()] + " " + pad(d.getUTCDate()) + " " + MONS[d.getUTCMonth()] + " " + d.getUTCFullYear() +
        " \u00b7 " + pad(d.getUTCHours()) + ":" + pad(d.getUTCMinutes()) + ":" + pad(d.getUTCSeconds()) + " UTC";
    };
    tickClock();
    setInterval(tickClock, 1000);
  }

  if ("IntersectionObserver" in window) {
    var rvEls = document.querySelectorAll(".sec, .facts-band, .class-card, .arch-card, .ladder, .console, .calc, .doc > h2, .doc > h3, .tiers, .prompt-box, .swap-card, .tok-bars");
    var rvIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("in"); rvIO.unobserve(e.target); }
      });
    }, { threshold: 0.08, rootMargin: "0px 0px -4% 0px" });
    rvEls.forEach(function (el) { el.classList.add("rv"); rvIO.observe(el); });
  }
})();

/* Nav shadow once the page scrolls */
(function () {
  function onScroll() { document.body.classList.toggle("scrolled", window.scrollY > 8); }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
})();
