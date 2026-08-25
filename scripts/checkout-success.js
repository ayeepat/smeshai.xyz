(function () {
  "use strict";

  var API_BASE = "https://smeshapi.site";
  var STORAGE_KEY = "smeshCheckoutSessionV1";
  var SESSION_TOKEN_RE = /^[A-Za-z0-9_-]{50}$/;
  var root = document.querySelector("[data-result-root]");
  if (!root) return;

  var icon = document.querySelector("[data-result-icon]");
  var spinner = document.querySelector("[data-result-spinner]");
  var successIcon = document.querySelector("[data-result-success]");
  var attentionIcon = document.querySelector("[data-result-attention]");
  var kicker = document.querySelector("[data-result-kicker]");
  var title = document.querySelector("[data-result-title]");
  var copy = document.querySelector("[data-result-copy]");
  var stateBox = document.querySelector("[data-result-state]");
  var stateText = document.querySelector("[data-result-state-text]");
  var details = document.querySelector("[data-result-details]");
  var plan = document.querySelector("[data-result-plan]");
  var price = document.querySelector("[data-result-price]");
  var orderRow = document.querySelector("[data-result-order-row]");
  var order = document.querySelector("[data-result-order]");
  var telegram = document.querySelector("[data-result-telegram]");
  var install = document.querySelector("[data-result-install]");
  var retry = document.querySelector("[data-result-retry]");
  var pricing = document.querySelector("[data-result-pricing]");
  var pollTimer = null;
  var pollStartedAt = Date.now();
  var session = readSession();

  function readSession() {
    try {
      var value = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null");
      return value && SESSION_TOKEN_RE.test(String(value.token || "")) ? value : null;
    } catch (_) {
      return null;
    }
  }

  function clearSession() {
    try { sessionStorage.removeItem(STORAGE_KEY); } catch (_) {}
  }

  async function statusRequest() {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 12000);
    try {
      var response = await fetch(API_BASE + "/checkout/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: session.token }),
        cache: "no-store",
        credentials: "omit",
        referrerPolicy: "no-referrer",
        signal: controller.signal
      });
      var data = null;
      try { data = await response.json(); } catch (_) {}
      if (!response.ok || !data || data.ok !== true) throw new Error(data && data.reason || "status_failed");
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  function rubles(kopecks) {
    var value = Number(kopecks) / 100;
    return new Intl.NumberFormat("ru-RU", {
      style: "currency", currency: "RUB", minimumFractionDigits: value % 1 ? 2 : 0,
      maximumFractionDigits: 2
    }).format(value);
  }

  function setIcon(tone) {
    icon.dataset.tone = tone;
    spinner.hidden = tone !== "pending";
    successIcon.hidden = tone !== "success";
    attentionIcon.hidden = tone !== "attention";
  }

  function setState(tone, message) {
    stateBox.dataset.tone = tone;
    stateText.textContent = message;
  }

  function showDetails(value) {
    if (!value || !value.plan) return;
    details.hidden = false;
    plan.textContent = value.plan.code === "school" ? "Учебный период — 9 месяцев" : "Доступ на 30 дней";
    price.textContent = rubles(value.plan.price_kopecks);
    if (/^\d+$/.test(String(value.order_id || ""))) {
      orderRow.hidden = false;
      order.textContent = "№" + value.order_id;
    }
  }

  function validTelegramUrl(raw, token) {
    try {
      var url = new URL(String(raw || ""));
      var start = url.searchParams.get("start") || "";
      return url.protocol === "https:" && url.hostname === "t.me" &&
        !url.port && !url.username && !url.password && !url.hash &&
        url.pathname === "/smeshaibot" && Array.from(url.searchParams.keys()).length === 1 &&
        /^pay_[A-Za-z0-9_-]{50}$/.test(start) && start !== "pay_" + token;
    } catch (_) {
      return false;
    }
  }

  function showTelegram() {
    if (session && validTelegramUrl(session.telegram_url, session.token)) {
      var url = new URL(session.telegram_url);
      telegram.href = url.origin + url.pathname;
      telegram.hidden = false;
    }
  }

  function stopPolling() {
    if (pollTimer) clearTimeout(pollTimer);
    pollTimer = null;
  }

  function schedule(delay) {
    stopPolling();
    pollTimer = setTimeout(checkStatus, delay || 2500);
  }

  function noSession() {
    root.setAttribute("aria-busy", "false");
    setIcon("attention");
    kicker.textContent = "Статус недоступен";
    title.textContent = "Откройте Telegram и проверьте сообщения";
    copy.textContent = "Эта вкладка не содержит защищённый идентификатор заказа. Возврат на сайт не выдаёт доступ автоматически.";
    setState("attention", "Если платёж прошёл, ключ придёт в подключённый чат после серверной проверки.");
    telegram.href = "https://t.me/smeshaibot";
    telegram.hidden = false;
    retry.hidden = true;
    pricing.hidden = false;
  }

  function pending(value) {
    root.setAttribute("aria-busy", "true");
    setIcon("pending");
    kicker.textContent = "Проверка платежа";
    title.textContent = value.state === "paid" ? "Платёж подтверждён" : "Ждём подтверждение от Robokassa";
    copy.textContent = value.state === "paid"
      ? "Сервер уже видит оплату и сейчас выпускает лицензионный ключ."
      : "Возврат с платёжной страницы сам по себе не подтверждает оплату. Проверяем серверное уведомление.";
    setState("pending", value.state === "paid" ? "Готовим ключ…" : "Проверяем статус платежа…");
    showDetails(value);
    showTelegram();
    retry.hidden = true;
    pricing.hidden = true;
    if (Date.now() - pollStartedAt < 2 * 60 * 1000) schedule();
    else {
      root.setAttribute("aria-busy", "false");
      setState("attention", "Проверка занимает дольше обычного. Нажмите, чтобы запросить статус снова.");
      retry.hidden = false;
    }
  }

  function completed(value) {
    stopPolling();
    root.setAttribute("aria-busy", "false");
    setIcon("success");
    kicker.textContent = "Оплата подтверждена";
    title.textContent = value.state === "delivered" ? "Ключ уже в Telegram" : "Ключ выпущен и отправляется";
    copy.textContent = value.state === "delivered"
      ? "Откройте подключённый чат: там есть данные платежа, срок подписки и лицензионный ключ."
      : "Доступ выдан. Если сообщение ещё не появилось, бот повторит доставку автоматически.";
    setState("success", value.state === "delivered" ? "Доставка подтверждена" : "Оплата и выдача доступа подтверждены");
    showDetails(value);
    showTelegram();
    install.hidden = false;
    retry.hidden = value.state === "delivered";
    pricing.hidden = true;
    clearSession();
  }

  function needsReview(value) {
    stopPolling();
    root.setAttribute("aria-busy", "false");
    setIcon("attention");
    kicker.textContent = "Нужна проверка";
    title.textContent = "Платёж проверяет поддержка";
    copy.textContent = "Сервер не может автоматически завершить этот заказ, поэтому доступ пока не изменён.";
    setState("attention", "Не оплачивайте повторно. Напишите в поддержку и укажите номер заказа.");
    showDetails(value);
    showTelegram();
    retry.hidden = false;
    pricing.hidden = true;
  }

  function expired(value) {
    stopPolling();
    root.setAttribute("aria-busy", "false");
    setIcon("attention");
    kicker.textContent = "Заказ закрыт";
    title.textContent = "Этот заказ больше недоступен";
    copy.textContent = "По нему нельзя продолжить оформление. Если деньги списались или вы оформляли возврат, не платите повторно — напишите в поддержку.";
    setState("attention", "Статус доступа по этому заказу сейчас не активен.");
    showDetails(value);
    retry.hidden = false;
    pricing.hidden = false;
  }

  async function checkStatus() {
    if (!session) return noSession();
    try {
      var value = await statusRequest();
      if (value.state === "delivered" || value.state === "fulfilled") return completed(value);
      if (value.state === "review") return needsReview(value);
      if (value.state === "expired") return expired(value);
      return pending(value);
    } catch (_) {
      root.setAttribute("aria-busy", "false");
      setIcon("attention");
      kicker.textContent = "Не удалось проверить";
      title.textContent = "Связь с сервером прервалась";
      copy.textContent = "Это не означает, что платёж не прошёл. Повторите проверку — доступ выдаётся только по серверному подтверждению.";
      setState("attention", "Статус временно недоступен.");
      showTelegram();
      retry.hidden = false;
      pricing.hidden = false;
    }
  }

  retry.addEventListener("click", function () {
    pollStartedAt = Date.now();
    retry.hidden = true;
    checkStatus().catch(function () {});
  });

  if (!session) noSession();
  else checkStatus().catch(function () {});
})();
