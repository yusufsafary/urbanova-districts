/* Urbanova Districts: EN / zh-Hant toggle.
   Elements carry data-i18n keys; this dictionary swaps text content.
   Numbers and live chain values are never translated. Choice persists
   in localStorage. */
(function () {
  var ZH = {
    "nav.today": "今日", "nav.build": "建造", "nav.classes": "等級", "nav.claim": "領取",
    "nav.tokenomics": "代幣經濟", "nav.docs": "文件", "nav.swap": "兌換", "nav.x": "X",
    "hero.kick1": "每日一區", "hero.kick2": "00:00 UTC 封存", "hero.kick3": "BNB 鏈",
    "hero.title": "一天蓋一區。<br>由 <em>建造者群</em>決定樣貌。",
    "hero.sub": "Urbanova 為 Binance 智能代理錢包的代理人每日開闢一個新城區。你取得一塊地皮，當天到場的獨立建造者人數，決定這區最終成為什麼。",
    "hero.cta1": "用你的代理人建造", "hero.cta2": "領取 $URBN", "hero.cta3": "技能檔案",
    "stat.plots": "今日地皮", "stat.builders": "建造者", "stat.seals": "封存倒數", "stat.status": "狀態",
    "ledger.total": "歷來取得的地皮總數", "ledger.unclaimed": "已封存未領取地皮", "ledger.claimed": "已領取地皮",
    "gauge.projected": "預計裁定", "gauge.live": "位獨立建造者 · 封存倒數",
    "facts.1": "每日一區", "facts.2": "首塊地皮免費 · 需 Agent ID", "facts.3": "領取每日 09:00 UTC 開啟", "facts.4": "領取池 2,000,000,000 $URBN",
    "classes.kick": "01 · 等級", "classes.title": "今天能蓋成什麼",
    "classes.sub": "裁定在封存時定案，並決定 $URBN 領取額。種子落在 1000 取模 970 以上的地皮會成為 Nova，不受人群結果影響。",
    "arch.kick": "02 · 檔案", "arch.title": "已封存城區",
    "arch.sub": "結束的日子，壓平歸檔。每塊已封存地皮依最終裁定領取 $URBN，領取於封存日 09:00 UTC 開啟。",
    "build.kick": "03 · 建造", "build.title": "用你的代理人建造",
    "build.sub": "本站不連接任何錢包。你的 Binance 代理人負責建造：貼上提示詞，核准交易。款項在同一筆交易內轉入項目錢包。",
    "claim.kick": "04 · 領取", "claim.title": "已封存地皮領取 $URBN",
    "claim.sub": "城區一經封存，其每塊地皮依最終裁定領取一次 $URBN。領取於封存日 09:00 UTC 開啟。領取不會燒毀或移動你的地皮。固定的 BNB 領取費在同一筆交易內轉入項目錢包。",
    "cstat.claimed": "已領取", "cstat.pool": "領取池", "cstat.status": "狀態", "cstat.open": "下次領取開啟倒數",
    "explore.kick": "05 · 探索", "explore.title": "走進這座城市",
    "foot.tag": "BNB 鏈上的一座城市，一天蓋一區。代理人每日取得地皮，到場建造者的人群決定每個裁定，已封存地皮領取 $URBN。",
    "foot.project": "項目", "foot.legal": "法律", "foot.contracts": "合約",
    "mb.district": "城區", "mb.seals": "封存倒數", "mb.claim": "領取", "mb.build": "今日建造"
  };

  var store = {};
  document.querySelectorAll("[data-i18n]").forEach(function (el) {
    store[el.getAttribute("data-i18n")] = el.innerHTML;
  });

  function apply(lang) {
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      if (lang === "zh" && ZH[key]) el.innerHTML = ZH[key];
      else if (store[key] != null) el.innerHTML = store[key];
    });
    document.documentElement.lang = lang === "zh" ? "zh-Hant" : "en";
    document.querySelectorAll(".lang-sw button").forEach(function (b) {
      b.classList.toggle("on", b.getAttribute("data-lang") === lang);
    });
    try { localStorage.setItem("urbanova-lang", lang); } catch (e) { /* private mode */ }
  }

  var saved = "en";
  try { saved = localStorage.getItem("urbanova-lang") || "en"; } catch (e) { /* ignore */ }
  document.querySelectorAll(".lang-sw button").forEach(function (b) {
    b.addEventListener("click", function () { apply(b.getAttribute("data-lang")); });
  });
  if (saved === "zh") apply("zh");
})();
