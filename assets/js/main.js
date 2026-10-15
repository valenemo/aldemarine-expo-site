/* ALDEMARINE website — shared behaviour (no external dependencies) */
(function () {
  "use strict";

  // Mark JS as available (CSS uses html:not(.js) so the mobile menu is never hidden without JS).
  document.documentElement.classList.add("js");

  // ---------- RU/EN language toggle ----------
  // Visibility is driven entirely by CSS off one attribute on <html> (data-lang-active), see the
  // "lang toggle visibility" block in style.css. This function sets that attribute, reflects the
  // active state on the language buttons, and swaps the few strings that CSS cannot reach:
  // <title>, meta description, aria-labels and <option> text.
  var LANG_STORAGE_KEY = "aldemarineLang";

  function setLang(lang, persist) {
    if (lang !== "ru" && lang !== "en") lang = "ru";
    var html = document.documentElement;
    html.setAttribute("data-lang-active", lang);
    html.lang = lang;
    document.querySelectorAll("[data-set-lang]").forEach(function (btn) {
      var on = btn.dataset.setLang === lang;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
    var title = html.getAttribute("data-title-" + lang);
    if (title) document.title = title;
    var description = html.getAttribute("data-description-" + lang);
    var metaDesc = document.querySelector('meta[name="description"]');
    if (description && metaDesc) metaDesc.setAttribute("content", description);
    // aria-label / option text that live outside the data-lang spans
    document.querySelectorAll("[data-label-ru]").forEach(function (el) {
      el.setAttribute("aria-label", el.getAttribute("data-label-" + lang));
    });
    document.querySelectorAll("option[data-ru]").forEach(function (o) {
      o.textContent = o.getAttribute("data-" + lang);
    });
    document.querySelectorAll("[data-ph-ru]").forEach(function (el) {
      el.setAttribute("placeholder", el.getAttribute("data-ph-" + lang));
    });
    if (persist !== false) {
      try { window.localStorage.setItem(LANG_STORAGE_KEY, lang); } catch (e) { /* storage unavailable */ }
    }
  }

  window.aldemarineRefreshLang = function () { setLang(document.documentElement.getAttribute("data-lang-active") || "ru", false); };

  function initialLang() {
    // Priority: ?lang= in the URL > language remembered from a previous visit > Russian.
    try {
      var fromUrl = new URLSearchParams(window.location.search).get("lang");
      if (fromUrl === "ru" || fromUrl === "en") return fromUrl;
    } catch (e) { /* ignore */ }
    try {
      var stored = window.localStorage.getItem(LANG_STORAGE_KEY);
      if (stored === "ru" || stored === "en") return stored;
    } catch (e) { /* ignore */ }
    return "ru";
  }

  function initLang() {
    var buttons = document.querySelectorAll("[data-set-lang]");
    if (!buttons.length) return;
    buttons.forEach(function (b) {
      b.addEventListener("click", function () { setLang(b.dataset.setLang); });
    });
    setLang(initialLang(), false);
  }

  // ---------- Mobile navigation (button, keyboard accessible) ----------
  function initNav() {
    var toggle = document.querySelector(".nav-toggle");
    var header = document.querySelector(".site-header");
    if (!toggle || !header) return;
    function set(open) {
      header.classList.toggle("nav-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    }
    toggle.addEventListener("click", function () {
      set(!header.classList.contains("nav-open"));
    });
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape" && header.classList.contains("nav-open")) {
        set(false);
        toggle.focus();
      }
    });
  }

  // ---------- Services dropdown (touch / keyboard; hover and focus handled in CSS) ----------
  function initSubnav() {
    var subs = document.querySelectorAll(".has-sub");
    subs.forEach(function (li) {
      var btn = li.querySelector(".sub-toggle");
      if (!btn) return;
      function set(open) { li.classList.toggle("open", open); btn.setAttribute("aria-expanded", open ? "true" : "false"); }
      btn.addEventListener("click", function (ev) { ev.stopPropagation(); set(!li.classList.contains("open")); });
      document.addEventListener("click", function (ev) { if (!li.contains(ev.target)) set(false); });
      document.addEventListener("keydown", function (ev) { if (ev.key === "Escape" && li.classList.contains("open")) { set(false); btn.focus(); } });
    });
  }

  // ---------- RFQ tabs (ARIA tabs pattern) ----------
  var RFQ_HASH_TO_PANEL = {
    supply: "panel-supply",
    survey: "panel-survey",
    mws: "panel-mws",
    class: "panel-class",
    project: "panel-project",
    software: "panel-software",
    partner: "panel-partner"
  };

  function activateRfqPanel(panelId, moveFocus) {
    var tabs = document.querySelectorAll(".rfq-tab");
    var panels = document.querySelectorAll(".rfq-panel");
    if (!tabs.length || !panels.length) return;
    tabs.forEach(function (t) {
      var on = t.dataset.panel === panelId;
      t.classList.toggle("active", on);
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.setAttribute("tabindex", on ? "0" : "-1");
      if (on && moveFocus) t.focus();
    });
    panels.forEach(function (p) {
      p.classList.toggle("active", p.id === panelId);
    });
  }

  function initRfqTabs() {
    var tabs = Array.prototype.slice.call(document.querySelectorAll(".rfq-tab"));
    if (!tabs.length) return;
    tabs.forEach(function (tab, i) {
      tab.addEventListener("click", function () { activateRfqPanel(tab.dataset.panel); });
      tab.addEventListener("keydown", function (ev) {
        var next = null;
        if (ev.key === "ArrowRight") next = tabs[(i + 1) % tabs.length];
        else if (ev.key === "ArrowLeft") next = tabs[(i - 1 + tabs.length) % tabs.length];
        else if (ev.key === "Home") next = tabs[0];
        else if (ev.key === "End") next = tabs[tabs.length - 1];
        if (next) { ev.preventDefault(); activateRfqPanel(next.dataset.panel, true); }
      });
    });
    function fromHash() {
      var hash = (window.location.hash || "").replace("#", "");
      if (hash && RFQ_HASH_TO_PANEL[hash]) activateRfqPanel(RFQ_HASH_TO_PANEL[hash]);
      else activateRfqPanel("panel-supply");
    }
    fromHash();
    window.addEventListener("hashchange", fromHash);
  }

  // ---------- Audience pre-selection (?audience=shipowner etc.) ----------
  function initAudience() {
    var selects = document.querySelectorAll('select[name="audience"]');
    if (!selects.length) return;
    var value = "";
    try { value = new URLSearchParams(window.location.search).get("audience") || ""; } catch (e) { /* ignore */ }
    if (!value) return;
    selects.forEach(function (s) {
      var ok = Array.prototype.some.call(s.options, function (o) { return o.value === value; });
      if (ok) s.value = value;
    });
  }

  // ---------- Forms ----------
  // All forms: the site transmits nothing; the request is prepared in the browser and the visitor
  // sends it by email / WhatsApp or copies the text.
  var FORM_NAMES = { "contact": "Contact message", "marine-supply": "Marine Supply RFQ", "marine-survey": "Marine survey", "mws": "MWS", "class-registry": "Class & registry documentation", "project": "Project / general request", "custom-software": "Custom maritime software", "partner": "Supplier / partner" };
  var REQ_MAIL = "frontdesk@aldemarine.vnemo.co", REQ_WA = "77012256692";
  function requestText(form, name) {
    var lines = ["ALDEMARINE website request — " + name, ""];
    form.querySelectorAll(".field").forEach(function (f) {
      var ctl = f.querySelector("input,select,textarea");
      if (!ctl || ctl.type === "file" || ctl.type === "hidden") return;
      var val = ctl.tagName === "SELECT" ? (ctl.value ? ctl.options[ctl.selectedIndex].text : "") : ctl.value;
      if (!val || !val.trim()) return;
      var lab = f.querySelector("label");
      var text = lab ? lab.innerText.replace(/\s*\*\s*$/, "").trim() : ctl.name;
      lines.push(text + ": " + val.trim());
    });
    lines.push("", "Prepared in the browser; not an order.");
    return lines.join("\n");
  }
  function prepareRequest(form, out) {
    var name = FORM_NAMES[form.getAttribute("data-aldemarine-form")] || "request";
    var text = requestText(form, name);
    var mailBody = text.length > 1700 ? text.slice(0, 1700) + "\n[…] (full text: use the Copy button on the site)" : text;
    var mail = out.querySelector('[data-act="mail"]'), wa = out.querySelector('[data-act="wa"]'), cp = out.querySelector('[data-act="copy"]');
    if (mail) mail.href = "mailto:" + REQ_MAIL + "?subject=" + encodeURIComponent("ALDEMARINE — " + name) + "&body=" + encodeURIComponent(mailBody);
    if (wa) wa.href = "https://wa.me/" + REQ_WA + "?text=" + encodeURIComponent(text.length > 1500 ? text.slice(0, 1500) + " […]" : text);
    if (cp) cp.onclick = function () {
      var done = function () { cp.setAttribute("data-copied", "1"); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () {});
    };
  }
  function initForms() {
    document.querySelectorAll("form[data-aldemarine-form]").forEach(function (form) {
      form.setAttribute("novalidate", "novalidate");
      var kind = form.getAttribute("data-aldemarine-form");
      var ok = form.querySelector(".form-msg.ok");
      var err = form.querySelector(".form-msg.error");
      form.addEventListener("submit", function (ev) {
        if (ok) ok.classList.remove("show");
        if (err) err.classList.remove("show");
        var missing = [];
        form.querySelectorAll("[required]").forEach(function (field) {
          var empty = !field.value || !field.value.trim();
          field.setAttribute("aria-invalid", empty ? "true" : "false");
          if (empty) missing.push(field);
        });
        if (missing.length) {
          ev.preventDefault();
          if (err) err.classList.add("show");
          missing[0].focus();
          return;
        }
        ev.preventDefault();
        if (ok) {
          prepareRequest(form, ok);
          ok.classList.add("show");
          if (window.aldemarineRefreshLang) window.aldemarineRefreshLang();
          ok.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      });
    });
  }

  // ---------- Public Marine Supply catalogue + browser-only RFQ basket ----------
  // Nothing is sent, uploaded or stored on a server. The request list lives in
  // sessionStorage (current tab only) and the RFQ summary is created as a local JSON download.
  function initMarineSupplyCatalog() {
    var data = window.ALDEMARINE_SUPPLY_CATALOG;
    var grid = document.getElementById("supply-catalog-grid");
    if (!data || !grid) return;
    var KEY = "aldemarine-supply-rfq", CTX_KEY = "aldemarine-supply-context", SEQ_KEY = "aldemarine-supply-seq";
    var PAGE = 24, limit = PAGE;
    var PACKAGE_FILTERS = { "package-1": { cat: "zone-7" }, "package-2": { q: "filter" }, "package-3": { cat: "zone-9" }, "package-4": { cat: "zone-14" }, "package-5": {} };
    var el = function (id) { return document.getElementById(id); };
    var search = el("supply-search"), filter = el("supply-category-filter"), count = el("supply-result-count");
    var packageRoot = el("supply-packages"), basketRoot = el("supply-request-items"), basketCount = el("supply-request-count");
    var moreBtn = el("supply-more"), mobileBar = el("supply-mobile-bar"), mobileCount = el("supply-mobile-count");
    var basket = [];
    try { basket = JSON.parse(sessionStorage.getItem(KEY) || "[]"); } catch (e) { basket = []; }
    if (!Array.isArray(basket)) basket = [];

    function esc(value) {
      return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]; });
    }
    function bi(ru, en) { return '<span data-lang="ru">' + esc(ru) + '</span><span data-lang="en">' + esc(en) + '</span>'; }
    function lang() { return document.documentElement.getAttribute("data-lang-active") === "en" ? "en" : "ru"; }
    function say(ru, en) { var s = el("supply-status"); if (s) s.textContent = lang() === "en" ? en : ru; }
    function alertSay(ru, en) { var a = el("supply-alert"); if (a) { a.textContent = ""; setTimeout(function () { a.textContent = lang() === "en" ? en : ru; }, 30); } }
    function refreshLang() { if (window.aldemarineRefreshLang) window.aldemarineRefreshLang(); }
    function saveBasket() { try { sessionStorage.setItem(KEY, JSON.stringify(basket)); } catch (e) { /* session storage may be unavailable */ } }
    function val(id) { var f = el(id); return f ? f.value.trim() : ""; }
    function totalQty() { return basket.reduce(function (sum, row) { return sum + Number(row.quantity || 1); }, 0); }

    var items = [];
    data.categories.forEach(function (category) {
      category.families.forEach(function (family) { family.items.forEach(function (item) { items.push({ category: category, family: family, item: item }); }); });
      var option = document.createElement("option"); option.value = category.id; option.textContent = category.name; filter.appendChild(option);
    });

    // ----- packages -----
    function renderPackages() {
      packageRoot.innerHTML = data.packages.map(function (p) {
        return '<article class="catalog-package"><h3>' + esc(p.name) + '</h3><p>' + esc(p.publicCopy) + '</p>' +
          '<details><summary>' + bi("Что не входит", "Not included") + '</summary><p>' + esc(p.exclusions) + '</p></details>' +
          '<p class="catalog-rfq-hint"><b>' + bi("Для запроса:", "For the request:") + '</b> ' + esc(p.rfqHint) + '</p>' +
          '<button class="btn btn-small btn-outline" type="button" data-package-id="' + esc(p.id) + '">' + bi("Подобрать позиции", "Browse items") + '</button></article>';
      }).join("");
      refreshLang();
    }
    packageRoot.addEventListener("click", function (ev) {
      var button = ev.target.closest("[data-package-id]"); if (!button) return;
      var rule = PACKAGE_FILTERS[button.dataset.packageId] || {};
      filter.value = rule.cat || ""; search.value = rule.q || ""; limit = PAGE; renderItems();
      var target = el("supply-catalog-grid"); if (target && target.scrollIntoView) target.scrollIntoView({ block: "start" });
      var first = grid.querySelector("[data-add-item]"); if (first) first.focus({ preventScroll: true });
    });

    // ----- catalogue grid -----
    function matches(entry) {
      var needle = (search.value || "").toLowerCase().trim();
      if (filter.value && entry.category.id !== filter.value) return false;
      if (!needle) return true;
      return [entry.category.name, entry.family.name, entry.item.name, entry.item.type, entry.item.specification].join(" ").toLowerCase().indexOf(needle) !== -1;
    }
    function inBasket(id) { return basket.some(function (row) { return row.id === id; }); }
    function cardHtml(entry) {
      var i = entry.item, added = inBasket(i.id);
      return '<article class="catalog-card"><div class="catalog-card-top"><span class="status-chip">' + bi("Нужен RFQ", "RFQ required") + '</span><span class="catalog-type">' + esc(i.type) + '</span></div>' +
        '<h3 id="card-' + esc(i.id) + '">' + esc(i.name) + '</h3><p class="catalog-family">' + esc(entry.category.name) + ' · ' + esc(entry.family.name) + '</p>' +
        '<dl><div><dt>' + bi("Спецификация", "Specification") + '</dt><dd>' + esc(i.specification) + '</dd></div>' +
        '<div><dt>' + bi("Типовой интервал обслуживания", "Typical service interval") + '</dt><dd>' + esc(i.trigger) + '</dd></div></dl>' +
        '<div class="catalog-actions"><button class="btn btn-small btn-accent' + (added ? ' is-added' : '') + '" type="button" data-add-item="' + esc(i.id) + '" aria-describedby="card-' + esc(i.id) + '">' + (added ? bi("Добавлено · ещё +1", "Added · add one more") : bi("Добавить в RFQ", "Add to RFQ")) + '</button></div></article>';
    }
    var shownCount = 0;
    function renderItems(focusIndex) {
      var all = items.filter(matches), shown = all.slice(0, limit); shownCount = shown.length;
      count.innerHTML = bi("Показано " + shown.length + " из " + all.length + " (всего " + items.length + ")", "Showing " + shown.length + " of " + all.length + " (total " + items.length + ")");
      grid.innerHTML = shown.length ? shown.map(cardHtml).join("") : '<p class="catalog-empty">' + bi("Ничего не найдено. Попробуйте другой термин на английском или отправьте общий запрос через форму RFQ.", "No items found. Try another term or send a general request through the RFQ form.") + '</p>';
      moreBtn.hidden = shown.length >= all.length;
      refreshLang();
      if (typeof focusIndex === "number") { var btns = grid.querySelectorAll("[data-add-item]"); if (btns[focusIndex]) btns[focusIndex].focus(); }
    }
    grid.addEventListener("click", function (ev) {
      var button = ev.target.closest("[data-add-item]"); if (!button) return;
      var found = items.find(function (entry) { return entry.item.id === button.dataset.addItem; }); if (!found) return;
      var existing = basket.find(function (row) { return row.id === found.item.id; });
      if (existing) existing.quantity += 1;
      else basket.push({ id: found.item.id, name: found.item.name, family: found.family.name, category: found.category.name, specification: found.item.specification, quantity: 1, oem: "", model: "", partNumber: "", notes: "" });
      saveBasket(); renderBasket();
      button.classList.add("is-added"); button.innerHTML = bi("Добавлено · ещё +1", "Added · add one more"); refreshLang();
      say("Добавлено: " + found.item.name + ". Всего в запросе: " + totalQty() + ".", "Added: " + found.item.name + ". Total in request: " + totalQty() + ".");
    });
    moreBtn.addEventListener("click", function () { var from = shownCount; limit += PAGE; renderItems(from); });
    search.addEventListener("input", function () { limit = PAGE; renderItems(); });
    filter.addEventListener("change", function () { limit = PAGE; renderItems(); });

    // ----- request list ("My request") -----
    var FIELDS = [["oem", "Производитель / OEM", "Make / OEM"], ["model", "Модель", "Model"], ["partNumber", "Part number", "Part number"], ["notes", "Технические заметки", "Technical notes"]];
    function rowHtml(row, index) {
      var details = FIELDS.map(function (f) {
        return '<label><span>' + bi(f[1], f[2]) + '</span><input type="text" data-field="' + f[0] + '" data-index="' + index + '" value="' + esc(row[f[0]]) + '" autocomplete="off"></label>';
      }).join("");
      return '<li><div class="request-line"><div><b>' + esc(row.name) + '</b><small>' + esc(row.category) + '</small></div>' +
        '<div class="request-qty"><button type="button" data-qty="minus" data-index="' + index + '" data-label-ru="Уменьшить количество: ' + esc(row.name) + '" data-label-en="Decrease quantity: ' + esc(row.name) + '">−</button><span aria-live="off">' + esc(row.quantity) + '</span><button type="button" data-qty="plus" data-index="' + index + '" data-label-ru="Увеличить количество: ' + esc(row.name) + '" data-label-en="Increase quantity: ' + esc(row.name) + '">+</button>' +
        '<button type="button" class="request-remove" data-remove-index="' + index + '" data-label-ru="Удалить позицию: ' + esc(row.name) + '" data-label-en="Remove item: ' + esc(row.name) + '">×</button></div></div>' +
        '<details class="request-details" data-index="' + index + '"' + (row.open ? " open" : "") + '><summary>' + bi("Данные позиции: OEM, модель, part number", "Item details: OEM, model, part number") + '</summary>' + details + '</details></li>';
    }
    function renderBasket(focus) {
      var qty = totalQty();
      basketCount.textContent = qty; mobileCount.textContent = qty; mobileBar.hidden = !basket.length;
      basketRoot.innerHTML = basket.length ? basket.map(rowHtml).join("") : '<li class="request-empty">' + bi("Пока ничего не добавлено. Выберите позиции в каталоге.", "Nothing added yet. Choose items in the catalogue.") + '</li>';
      refreshLang(); updateReview();
      if (focus) {
        var t = focus.remove ? (basketRoot.querySelector('[data-remove-index="' + Math.min(focus.index, basket.length - 1) + '"]') || el("supply-request-title")) : basketRoot.querySelector('[data-qty="' + focus.qty + '"][data-index="' + focus.index + '"]');
        if (t) t.focus();
      }
    }
    basketRoot.addEventListener("click", function (ev) {
      var q = ev.target.closest("[data-qty]"), r = ev.target.closest("[data-remove-index]");
      if (q) {
        var i = Number(q.dataset.index), row = basket[i]; if (!row) return;
        row.quantity = Math.max(1, Number(row.quantity || 1) + (q.dataset.qty === "plus" ? 1 : -1));
        saveBasket(); renderBasket({ qty: q.dataset.qty, index: i }); say("Количество: " + row.quantity, "Quantity: " + row.quantity);
      } else if (r) {
        var j = Number(r.dataset.removeIndex), removed = basket[j]; if (!removed) return;
        basket.splice(j, 1); saveBasket(); renderBasket({ remove: true, index: j }); renderItems_keep();
        say("Удалено: " + removed.name, "Removed: " + removed.name);
      }
    });
    function renderItems_keep() { // refresh "added" state on cards without moving focus
      var focused = document.activeElement; var all = items.filter(matches).slice(0, limit);
      grid.querySelectorAll("[data-add-item]").forEach(function (b, k) { var added = inBasket(b.dataset.addItem); b.classList.toggle("is-added", added); b.innerHTML = added ? bi("Добавлено · ещё +1", "Added · add one more") : bi("Добавить в RFQ", "Add to RFQ"); });
      refreshLang(); if (focused && focused.focus && document.contains(focused)) focused.focus(); return all;
    }
    basketRoot.addEventListener("input", function (ev) {
      var f = ev.target.getAttribute("data-field"); if (!f) return;
      var row = basket[Number(ev.target.dataset.index)]; if (!row) return;
      row[f] = ev.target.value; saveBasket(); updateReview();
    });
    basketRoot.addEventListener("toggle", function (ev) { var d = ev.target; if (d.classList && d.classList.contains("request-details")) { var row = basket[Number(d.dataset.index)]; if (row) { row.open = d.open; saveBasket(); } } }, true);
    el("supply-clear-request").addEventListener("click", function () {
      var had = basket.length; basket = []; saveBasket(); renderBasket(); renderItems_keep();
      say(had ? "Запрос очищен." : "Запрос уже пуст.", had ? "Request cleared." : "Request is already empty."); el("supply-request-title").focus();
    });

    // ----- review -----
    function lineStatus(row) {
      if (!row.oem.trim() && !row.model.trim() && !row.partNumber.trim()) return { key: "product", ru: "Нужно подтвердить изделие", en: "Needs product confirmation" };
      if (!val("supply-vessel") || !val("supply-imo")) return { key: "vessel", ru: "Нужны данные судна", en: "Needs vessel details" };
      return { key: "quote", ru: "Нужна котировка поставщика (RFQ)", en: "Needs supplier quotation" };
    }
    function missing() {
      var m = [];
      if (!val("supply-vessel")) m.push(["Название судна", "Vessel name"]);
      if (!val("supply-imo")) m.push(["IMO", "IMO number"]);
      if (!val("supply-port")) m.push(["Порт доставки", "Delivery port"]);
      if (!val("supply-required-date")) m.push(["Требуемая дата", "Required date"]);
      var noPn = basket.filter(function (r) { return !r.oem.trim() && !r.model.trim() && !r.partNumber.trim(); }).length;
      if (noPn) m.push(["OEM / модель / part number: " + noPn + " поз.", "OEM / model / part number: " + noPn + " item(s)"]);
      if (basket.length) m.push(["Фото шильдика или чертёж (передаются отдельно, файлы здесь не загружаются)", "Nameplate photo or drawing (shared separately; files are not uploaded here)"]);
      return m;
    }
    function updateReview() {
      var box = el("supply-review-summary"); if (!box) return;
      try { sessionStorage.setItem(CTX_KEY, JSON.stringify({ vessel: val("supply-vessel"), imo: val("supply-imo"), port: val("supply-port"), date: val("supply-required-date") })); } catch (e) { /* ignore */ }
      if (!basket.length) { box.innerHTML = '<p class="muted">' + bi("Добавьте позиции из каталога — здесь появится сводка запроса.", "Add items from the catalogue — the request summary appears here.") + '</p>'; refreshLang(); return; }
      var rows = basket.map(function (r) { var st = lineStatus(r); return '<tr><td>' + esc(r.name) + '</td><td>' + esc(r.quantity) + '</td><td><span class="status-chip chip-' + st.key + '">' + bi(st.ru, st.en) + '</span></td></tr>'; }).join("");
      var miss = missing().map(function (m) { return '<li>' + bi(m[0], m[1]) + '</li>'; }).join("");
      box.innerHTML = '<table><caption class="sr-only">' + bi("Сводка запроса", "Request summary") + '</caption><thead><tr><th scope="col">' + bi("Позиция", "Item") + '</th><th scope="col">' + bi("Кол-во", "Qty") + '</th><th scope="col">' + bi("Статус проверки", "Review status") + '</th></tr></thead><tbody>' + rows + '</tbody></table>' +
        (miss ? '<p class="review-missing-title">' + bi("Чего не хватает для проверки:", "Still missing for review:") + '</p><ul>' + miss + '</ul>' : "");
      refreshLang();
    }
    ["supply-vessel", "supply-imo", "supply-port", "supply-required-date", "supply-urgency", "supply-certificates", "supply-comments"].forEach(function (id) { var f = el(id); if (f) { f.addEventListener("input", updateReview); f.addEventListener("change", updateReview); } });
    try { var ctx = JSON.parse(sessionStorage.getItem(CTX_KEY) || "{}"); if (ctx.vessel) el("supply-vessel").value = ctx.vessel; if (ctx.imo) el("supply-imo").value = ctx.imo; if (ctx.port) el("supply-port").value = ctx.port; if (ctx.date) el("supply-required-date").value = ctx.date; } catch (e) { /* ignore */ }

    // ----- local export -----
    el("supply-export-rfq").addEventListener("click", function () {
      var error = el("supply-review-error"), ok = el("supply-review-ok"), consent = el("supply-consent");
      error.classList.remove("show"); ok.classList.remove("show"); consent.removeAttribute("aria-invalid");
      if (!basket.length || !consent.checked) {
        error.classList.add("show"); if (!consent.checked) consent.setAttribute("aria-invalid", "true");
        alertSay("Добавьте хотя бы одну позицию и подтвердите условие запроса.", "Add at least one item and confirm the request condition.");
        (basket.length ? consent : el("supply-catalog-grid").querySelector("[data-add-item]") || consent).focus(); return;
      }
      var stamp = new Date(), seq = 1;
      try { seq = Number(sessionStorage.getItem(SEQ_KEY) || "0") + 1; sessionStorage.setItem(SEQ_KEY, String(seq)); } catch (e) { seq = 1; }
      var id = "RFQ-WEB-" + stamp.toISOString().slice(0, 10).replace(/-/g, "") + "-" + ("00" + seq).slice(-3);
      var lines = basket.map(function (r, k) { var st = lineStatus(r); return { lineId: "L" + (k + 1), catalogueRef: r.id, name: r.name, system: r.category, family: r.family, specification: r.specification, requestedQuantity: r.quantity, oem: r.oem.trim(), model: r.model.trim(), partNumber: r.partNumber.trim(), technicalNotes: r.notes.trim(), reviewStatus: st.en }; });
      var payload = { schema: "aldemarine-rfq-local/2", rfqId: id, createdAt: stamp.toISOString(), language: lang(), status: "preliminary", localOnly: true,
        notice: "This is a preliminary request prepared locally in your browser. It is not a purchase order and does not confirm availability, compatibility, price or delivery. It has not been sent to ALDEMARINE.",
        noticeRu: "Это предварительный запрос, подготовленный локально в вашем браузере. Это не заказ и не подтверждение наличия, совместимости, цены или срока. В ALDEMARINE он не отправлялся.",
        context: { vessel: val("supply-vessel"), imo: val("supply-imo"), deliveryPort: val("supply-port"), requiredDate: val("supply-required-date"), urgency: val("supply-urgency"), requiredCertificates: val("supply-certificates"), technicalNotes: val("supply-comments") },
        items: lines, missingData: missing().map(function (m) { return m[1]; }) };
      var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }), url = URL.createObjectURL(blob), link = document.createElement("a");
      link.href = url; link.download = id + ".json"; document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
      ok.innerHTML = bi("Готово: " + id + ". Предварительный запрос сохранён локально (файл JSON), в ALDEMARINE он не отправлялся.", "Done: " + id + ". The preliminary request was saved locally as a JSON file and was not sent to ALDEMARINE."); refreshLang(); ok.classList.add("show");
      say("RFQ " + id + " сохранён локально.", "RFQ " + id + " saved locally.");
    });

    renderPackages(); renderItems(); renderBasket();
  }

  // ---------- Prefill the Marine Supply RFQ form from the browser-only request list ----------
  function initSupplyPrefill() {
    var form = document.querySelector('form[data-aldemarine-form="marine-supply"]');
    if (!form) return;
    var basket = [], ctx = {};
    try { basket = JSON.parse(sessionStorage.getItem("aldemarine-supply-rfq") || "[]"); ctx = JSON.parse(sessionStorage.getItem("aldemarine-supply-context") || "{}"); } catch (e) { return; }
    if (!Array.isArray(basket) || !basket.length) return;
    function set(name, value) { var f = form.elements[name]; if (f && value && !f.value) f.value = value; }
    var text = basket.map(function (r, k) {
      var bits = [r.oem, r.model, r.partNumber].filter(Boolean).join(" / ");
      return (k + 1) + ". " + r.name + " — qty " + r.quantity + (bits ? " — " + bits : "") + (r.notes ? " — " + r.notes : "");
    }).join("\n");
    set("item_list", text); set("vessel", ctx.vessel); set("imo", ctx.imo); set("port", ctx.port); set("eta", ctx.date);
    var note = document.createElement("p");
    note.className = "prefill-note";
    note.innerHTML = '<span data-lang="ru">Позиции подставлены из вашего запроса в каталоге (только в этом окне браузера). Проверьте и дополните. <a href="marine-supply.html#catalogue">Изменить в каталоге</a></span><span data-lang="en">Items were filled in from your request list in the catalogue (this browser tab only). Please check and complete. <a href="marine-supply.html#catalogue">Edit in the catalogue</a></span>';
    form.insertBefore(note, form.firstChild);
  }

  document.addEventListener("DOMContentLoaded", function () {
    initLang();
    initNav();
    initSubnav();
    initRfqTabs();
    initAudience();
    initForms();
    initMarineSupplyCatalog();
    initSupplyPrefill();
  });
})();
