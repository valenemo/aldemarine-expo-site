/* ALDEMARINE Marine Supply request assistant (button mode).
   Loaded on marine-supply.html only. No auto-open, no tracking.
   Sends to the engine when window.ALDEMARINE_ENGINE_URL is set; otherwise it only
   prepares an e-mail (nothing is sent by the page). */
(function () {
  "use strict";
  var MAIL = "frontdesk@aldemarine.vnemo.co";
  var STATE_KEY = "aldemarine-assistant-state", BASKET_KEY = "aldemarine-supply-rfq";
  var NEEDS = [
    ["parts", "Запчасть по номеру или описанию", "A spare part by number or description"],
    ["consumables", "Расходники и фильтры", "Consumables and filters"],
    ["unknown", "Не знаю, что именно нужно", "I am not sure what exactly I need"],
    ["other", "Другое судовое снабжение", "Other marine supplies"]
  ];
  var URGENCY = [["standard", "Стандартно", "Standard"], ["urgent", "Срочно", "Urgent"], ["emergency", "Экстренно", "Emergency"]];
  var state = load();
  var root, panel, launcher, lastFocus;

  function load() {
    try { var s = JSON.parse(sessionStorage.getItem(STATE_KEY) || "null"); if (s && s.v === 1) return s; } catch (e) { /* ignore */ }
    return { v: 1, step: 0, need: "", vessel: "", imo: "", port: "", date: "", urgency: "standard", items: [{ description: "", brand: "", part_number: "", qty: 1 }], name: "", company: "", email: "", phone: "", consent: false, result: null };
  }
  function save() { try { sessionStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ } }
  function lang() { return document.documentElement.getAttribute("data-lang-active") === "en" ? "en" : "ru"; }
  function t(ru, en) { return lang() === "en" ? en : ru; }
  function esc(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]; }); }
  function basket() { try { var b = JSON.parse(sessionStorage.getItem(BASKET_KEY) || "[]"); return Array.isArray(b) ? b : []; } catch (e) { return []; } }

  var STEPS = 5;
  function title() { return [t("Что вам нужно?", "What do you need?"), t("Судно и порт", "Vessel and port"), t("Позиции", "Items"), t("Контакт", "Your contact"), t("Проверка и отправка", "Review and send")][state.step]; }

  function body() {
    if (state.result) return resultHtml();
    var s = state.step, h = "";
    if (s === 0) {
      h += '<p class="sa-hint">' + esc(t("Выберите вариант, остальное уточним по шагам. Это предварительный запрос, не заказ.", "Pick one and we will clarify the rest step by step. This is a preliminary request, not an order.")) + "</p>";
      h += '<div class="sa-choices">' + NEEDS.map(function (n) { return '<button type="button" class="sa-choice' + (state.need === n[0] ? " on" : "") + '" data-need="' + n[0] + '">' + esc(t(n[1], n[2])) + "</button>"; }).join("") + "</div>";
    } else if (s === 1) {
      h += field("vessel", t("Название судна", "Vessel name"), "text") + field("imo", "IMO", "text", 'inputmode="numeric" maxlength="7"') + field("port", t("Порт доставки", "Delivery port"), "text") + field("date", t("Требуемая дата", "Required date"), "date");
      h += '<div class="sa-label">' + esc(t("Срочность", "Urgency")) + '</div><div class="sa-choices row">' + URGENCY.map(function (u) { return '<button type="button" class="sa-choice small' + (state.urgency === u[0] ? " on" : "") + '" data-urgency="' + u[0] + '">' + esc(t(u[1], u[2])) + "</button>"; }).join("") + "</div>";
    } else if (s === 2) {
      var b = basket();
      if (b.length) h += '<button type="button" class="sa-link" data-use-basket="1">' + esc(t("Взять позиции из «Мой запрос» (" + b.length + ")", "Use items from “My request” (" + b.length + ")")) + "</button>";
      h += state.items.map(function (it, i) {
        return '<fieldset class="sa-item"><legend>' + esc(t("Позиция ", "Item ")) + (i + 1) + "</legend>" +
          itemField(i, "description", t("Описание", "Description"), it.description) + itemField(i, "brand", t("Производитель / OEM", "Make / OEM"), it.brand) + itemField(i, "part_number", "Part number", it.part_number) + itemField(i, "qty", t("Количество", "Quantity"), it.qty, 'type="number" min="1"') +
          (state.items.length > 1 ? '<button type="button" class="sa-link" data-remove="' + i + '">' + esc(t("Удалить позицию", "Remove item")) + "</button>" : "") + "</fieldset>";
      }).join("") + '<button type="button" class="sa-link" data-add="1">+ ' + esc(t("Добавить позицию", "Add another item")) + "</button>";
    } else if (s === 3) {
      h += field("name", t("Ваше имя", "Your name"), "text") + field("company", t("Компания", "Company"), "text") + field("email", "Email", "email") + field("phone", t("Телефон (необязательно)", "Phone (optional)"), "tel");
    } else {
      h += summaryHtml() + '<label class="sa-consent"><input type="checkbox" id="sa-consent"' + (state.consent ? " checked" : "") + '> <span>' + esc(t("Я понимаю, что это предварительный запрос, а не заказ и не подтверждение наличия, цены или срока.", "I understand this is a preliminary request, not an order or confirmation of availability, price or lead time.")) + "</span></label>";
    }
    h += '<p class="sa-err" id="sa-err" role="alert"></p>';
    h += '<div class="sa-actions">' + (s > 0 ? '<button type="button" class="sa-btn ghost" data-back="1">' + esc(t("Назад", "Back")) + "</button>" : "<span></span>") +
      (s > 0 ? '<button type="button" class="sa-btn" data-next="1">' + esc(s === STEPS - 1 ? sendLabel() : t("Далее", "Next")) + "</button>" : "") + "</div>";
    return h;
  }
  function sendLabel() { return window.ALDEMARINE_ENGINE_URL ? t("Отправить запрос", "Send request") : t("Подготовить письмо", "Prepare e-mail"); }
  function field(k, label, type, extra) { return '<label class="sa-field"><span>' + esc(label) + '</span><input id="sa-' + k + '" data-key="' + k + '" type="' + type + '" value="' + esc(state[k]) + '" autocomplete="off" ' + (extra || "") + "></label>"; }
  function itemField(i, k, label, val, extra) { return '<label class="sa-field"><span>' + esc(label) + '</span><input data-item="' + i + '" data-ikey="' + k + '" ' + (extra || 'type="text"') + ' value="' + esc(val) + '" autocomplete="off"></label>'; }
  function summaryHtml() {
    var rows = state.items.filter(usable).map(function (it) { return "<li>" + esc(it.qty + " × " + it.description + (it.brand ? " (" + it.brand + ")" : "") + (it.part_number ? " P/N " + it.part_number : "")) + "</li>"; }).join("");
    return '<dl class="sa-sum"><dt>' + esc(t("Судно", "Vessel")) + "</dt><dd>" + esc(state.vessel + (state.imo ? " · IMO " + state.imo : "")) + "</dd><dt>" + esc(t("Порт и дата", "Port and date")) + "</dt><dd>" + esc(state.port + (state.date ? " · " + state.date : "") + " · " + urgencyName()) + "</dd><dt>" + esc(t("Позиции", "Items")) + "</dt><dd><ul>" + rows + "</ul></dd><dt>" + esc(t("Контакт", "Contact")) + "</dt><dd>" + esc(state.name + ", " + state.company + ", " + state.email) + "</dd></dl>";
  }
  function urgencyName() { var u = URGENCY.filter(function (x) { return x[0] === state.urgency; })[0]; return u ? t(u[1], u[2]) : ""; }
  function usable(it) { return (it.description || "").trim() || (it.part_number || "").trim(); }

  function validate() {
    var s = state.step;
    if (s === 0 && !state.need) return t("Выберите вариант.", "Please pick an option.");
    if (s === 1) {
      if (!state.vessel.trim()) return t("Укажите название судна.", "Enter the vessel name.");
      if (state.imo && !/^\d{7}$/.test(state.imo)) return t("IMO состоит из 7 цифр.", "IMO has 7 digits.");
      if (!state.port.trim()) return t("Укажите порт доставки.", "Enter the delivery port.");
    }
    if (s === 2 && !state.items.some(usable)) return t("Добавьте хотя бы одну позицию.", "Add at least one item.");
    if (s === 3) {
      if (!state.name.trim() || !state.company.trim()) return t("Укажите имя и компанию.", "Enter your name and company.");
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(state.email)) return t("Проверьте адрес email.", "Check the e-mail address.");
    }
    if (s === 4 && !state.consent) return t("Подтвердите условие запроса.", "Please confirm the request condition.");
    return "";
  }
  function payload() {
    return { service: "supply", data: { source: "assistant", language: lang(), need: state.need,
      client: { name: state.name.trim(), company: state.company.trim(), email: state.email.trim(), phone: state.phone.trim() },
      vessel: { name: state.vessel.trim(), imo: state.imo.trim(), port: state.port.trim(), required_date: state.date, urgency: state.urgency },
      items: state.items.filter(usable).map(function (i) { return { description: i.description.trim(), brand: i.brand.trim(), part_number: i.part_number.trim(), qty: Number(i.qty) || 1 }; }) } };
  }
  function mailtoHref() {
    var p = payload().data, lines = ["ALDEMARINE — " + t("предварительный запрос", "preliminary request"), "", "Vessel: " + p.vessel.name + (p.vessel.imo ? " (IMO " + p.vessel.imo + ")" : ""), "Port: " + p.vessel.port, "Required date: " + (p.vessel.required_date || "-"), "Urgency: " + p.vessel.urgency, "", "Items:"];
    p.items.forEach(function (i, n) { lines.push((n + 1) + ". " + i.qty + " x " + i.description + (i.brand ? " / " + i.brand : "") + (i.part_number ? " / P/N " + i.part_number : "")); });
    lines.push("", "Contact: " + p.client.name + ", " + p.client.company + ", " + p.client.email + (p.client.phone ? ", " + p.client.phone : ""));
    return "mailto:" + MAIL + "?subject=" + encodeURIComponent("ALDEMARINE RFQ — " + p.vessel.name) + "&body=" + encodeURIComponent(lines.join("\n"));
  }
  function resultHtml() {
    var r = state.result;
    if (r.kind === "sent") return '<p class="sa-ok">' + esc(t("Запрос принят. Номер: ", "Request received. Reference: ")) + "<b>" + esc(r.job) + "</b></p><p class=\"sa-hint\">" + esc(t("Мы пришлём стандартный RFQ на ваш email для подтверждения.", "We will e-mail you a standard RFQ to confirm.")) + '</p><div class="sa-actions"><button type="button" class="sa-btn ghost" data-restart="1">' + esc(t("Новый запрос", "New request")) + "</button></div>";
    return '<p class="sa-ok">' + esc(t("Письмо подготовлено, но ещё не отправлено.", "The e-mail is prepared but not yet sent.")) + '</p><p class="sa-hint">' + esc(t("Нажмите, чтобы открыть его в вашей почте, и отправьте сами.", "Click to open it in your mail app and send it yourself.")) + '</p><div class="sa-actions"><a class="sa-btn" href="' + esc(mailtoHref()) + '">' + esc(t("Открыть письмо", "Open e-mail")) + '</a><button type="button" class="sa-btn ghost" data-restart="1">' + esc(t("Новый запрос", "New request")) + "</button></div>";
  }

  function send() {
    var base = String(window.ALDEMARINE_ENGINE_URL || "").replace(/\/$/, "");
    if (!base) { state.result = { kind: "mail" }; save(); render(); return; }
    var btn = panel.querySelector("[data-next]"); if (btn) { btn.disabled = true; btn.textContent = t("Отправляем…", "Sending…"); }
    var job;
    fetch(base + "/api/rfq", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload()) })
      .then(function (r) { if (!r.ok) throw new Error("create"); return r.json(); })
      .then(function (j) { job = j.job_number; return fetch(base + "/api/rfq/" + encodeURIComponent(job) + "/submit", { method: "POST" }); })
      .then(function (r) { if (!r.ok) throw new Error("submit"); state.result = { kind: "sent", job: job }; save(); render(); })
      .catch(function () { state.result = { kind: "mail" }; save(); render(); setErr(t("Сервер недоступен, поэтому мы подготовили письмо.", "The server is unavailable, so we prepared an e-mail instead.")); });
  }
  function setErr(m) { var e = panel.querySelector("#sa-err"); if (e) e.textContent = m; }

  function render() {
    var main = panel.querySelector(".sa-main");
    panel.querySelector(".sa-title").textContent = state.result ? t("Готово", "Done") : title();
    panel.querySelector(".sa-step").textContent = state.result ? "" : (state.step + 1) + " / " + STEPS;
    panel.querySelector(".sa-close").setAttribute("aria-label", t("Закрыть", "Close"));
    launcher.textContent = t("Помощник по запросу", "Request assistant");
    main.innerHTML = body();
  }
  function open() { lastFocus = document.activeElement; panel.hidden = false; launcher.setAttribute("aria-expanded", "true"); render(); var f = panel.querySelector("input,button.sa-choice,.sa-btn"); (f || panel).focus(); }
  function close() { panel.hidden = true; launcher.setAttribute("aria-expanded", "false"); (lastFocus && lastFocus.focus ? lastFocus : launcher).focus(); }

  function build() {
    root = document.createElement("div"); root.className = "sa-root";
    root.innerHTML = '<button type="button" class="sa-launcher" aria-expanded="false" aria-controls="sa-panel"></button>' +
      '<div class="sa-panel" id="sa-panel" role="dialog" aria-modal="false" aria-labelledby="sa-title" tabindex="-1" hidden><div class="sa-head"><div><div class="sa-step"></div><h2 class="sa-title" id="sa-title"></h2></div><button type="button" class="sa-close">×</button></div><div class="sa-main"></div></div>';
    document.body.appendChild(root);
    panel = root.querySelector(".sa-panel"); launcher = root.querySelector(".sa-launcher");
    launcher.addEventListener("click", function () { panel.hidden ? open() : close(); });
    root.querySelector(".sa-close").addEventListener("click", close);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !panel.hidden) close(); });
    panel.addEventListener("input", function (e) {
      var k = e.target.getAttribute("data-key"), ii = e.target.getAttribute("data-item");
      if (k) state[k] = e.target.value;
      else if (ii !== null && ii !== undefined && e.target.getAttribute("data-ikey")) state.items[Number(ii)][e.target.getAttribute("data-ikey")] = e.target.value;
      else if (e.target.id === "sa-consent") state.consent = e.target.checked;
      save();
    });
    panel.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      if (b.dataset.need) { state.need = b.dataset.need; state.step = 1; save(); render(); focusFirst(); }
      else if (b.dataset.urgency) { state.urgency = b.dataset.urgency; save(); render(); }
      else if (b.dataset.add) { state.items.push({ description: "", brand: "", part_number: "", qty: 1 }); save(); render(); }
      else if (b.dataset.remove) { state.items.splice(Number(b.dataset.remove), 1); save(); render(); }
      else if (b.dataset.useBasket) { state.items = basket().map(function (r) { return { description: r.name || "", brand: r.oem || "", part_number: r.partNumber || "", qty: Number(r.quantity) || 1 }; }); if (!state.items.length) state.items = [{ description: "", brand: "", part_number: "", qty: 1 }]; save(); render(); }
      else if (b.dataset.back) { state.step = Math.max(0, state.step - 1); save(); render(); focusFirst(); }
      else if (b.dataset.restart) { sessionStorage.removeItem(STATE_KEY); state = load(); render(); focusFirst(); }
      else if (b.dataset.next) {
        var m = validate(); if (m) { setErr(m); return; }
        if (state.step === STEPS - 1) send(); else { state.step += 1; save(); render(); focusFirst(); }
      }
    });
    new MutationObserver(function () { if (!panel.hidden) render(); else launcher.textContent = t("Помощник по запросу", "Request assistant"); })
      .observe(document.documentElement, { attributes: true, attributeFilter: ["data-lang-active"] });
    launcher.textContent = t("Помощник по запросу", "Request assistant");
  }
  function focusFirst() { var f = panel.querySelector("input,.sa-choice"); if (f) f.focus(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build); else build();
})();
