(function () {
  "use strict";

  var API_BASE = "https://smeshapi.site";
  var STORAGE_KEY = "smeshCheckoutSessionV1";
  var SESSION_TOKEN_RE = /^[A-Za-z0-9_-]{50}$/;
  var POLL_INTERVAL_MS = 2000;

  var root = document.querySelector("[data-checkout-root]");
  if (!root) return;

  var statusBox = document.querySelector("[data-page-status]");
  var statusText = document.querySelector("[data-page-status-text]");
  var planName = document.querySelector("[data-plan-name]");
  var planPrice = document.querySelector("[data-plan-price]");
  var planDuration = document.querySelector("[data-plan-duration]");
  var promoForm = document.querySelector("[data-promo-form]");
  var promoInput = promoForm && promoForm.querySelector("[name=promo_code]");
  var promoSubmit = document.querySelector("[data-promo-submit]");
  var promoMessage = document.querySelector("[data-promo-message]");
  var promoBadge = document.querySelector("[data-promo-badge]");
  var changePlanLink = document.querySelector(".checkout-change-plan");
  var telegramLink = document.querySelector("[data-telegram-link]");
  var telegramStatus = document.querySelector("[data-telegram-status]");
  var telegramStatusText = document.querySelector("[data-telegram-status-text]");
  var retryButton = document.querySelector("[data-session-retry]");
  var paymentForm = document.querySelector("[data-payment-form]");
  var emailInput = paymentForm && paymentForm.querySelector("[name=email]");
  var termsInput = paymentForm && paymentForm.querySelector("[name=accepted_terms]");
  var payButton = document.querySelector("[data-pay-button]");
  var payButtonText = document.querySelector("[data-pay-button-text]");
  var paymentMessage = document.querySelector("[data-payment-message]");

  var session = null;
  var selectedPlan = selectedPlanFromPage();
  var telegramBound = false;
  var telegramLinkOpened = false;
  var creatingSession = false;
  var creatingPayment = false;
  var pollTimer = null;

  function readStoredSession() {
    try {
      var parsed = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null");
      if (!parsed || !SESSION_TOKEN_RE.test(String(parsed.token || ""))) return null;
      if (!parsed.plan || !["month", "school"].includes(parsed.plan.code)) return null;
      return parsed;
    } catch (_) {
      return null;
    }
  }

  function selectedPlanFromPage() {
    var requested = new URLSearchParams(location.search).get("plan");
    if (requested === "month" || requested === "school") return requested;
    var stored = readStoredSession();
    return stored && stored.plan ? stored.plan.code : "month";
  }

  function storeSession(value) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
        token: value.token,
        order_id: value.order_id,
        expires_at: value.expires_at,
        telegram_url: value.telegram_url,
        plan: value.plan,
        telegram_opened: value.telegram_opened === true
      }));
    } catch (_) {
      // Checkout still works in privacy modes where sessionStorage is blocked.
    }
  }

  function clearStoredSession() {
    try { sessionStorage.removeItem(STORAGE_KEY); } catch (_) {}
  }

  function validSession(value) {
    return !!(
      value && value.ok !== false && SESSION_TOKEN_RE.test(String(value.token || "")) &&
      /^\d+$/.test(String(value.order_id || "")) &&
      value.plan && (value.plan.code === "month" || value.plan.code === "school") &&
      Number.isSafeInteger(Number(value.plan.price_kopecks)) &&
      Number(value.plan.price_kopecks) > 0 &&
      Number.isSafeInteger(Number(value.plan.duration_days)) &&
      Number(value.plan.duration_days) > 0 &&
      Number.isFinite(Date.parse(value.expires_at || "")) &&
      validTelegramUrl(value.telegram_url, value.token)
    );
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

  async function api(path, body) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 12000);
    try {
      var response = await fetch(API_BASE + path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
        credentials: "omit",
        referrerPolicy: "no-referrer",
        signal: controller.signal
      });
      var data = null;
      try { data = await response.json(); } catch (_) {}
      if (!response.ok || !data || data.ok !== true) {
        var error = new Error(data && data.reason ? data.reason : "request_failed");
        error.reason = data && data.reason ? data.reason : "request_failed";
        error.status = response.status;
        throw error;
      }
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

  function duration(days) {
    if (Number(days) === 30) return "30 дней";
    if (Number(days) === 273) return "9 месяцев";
    return String(days) + " дн.";
  }

  function showPageStatus(message, tone) {
    statusBox.hidden = false;
    statusBox.classList.toggle("checkout-alert--error", tone === "error");
    statusBox.classList.toggle("checkout-alert--success", tone === "success");
    statusText.textContent = message;
    var spinner = statusBox.querySelector(".checkout-mini-spinner");
    if (spinner) spinner.hidden = tone !== "loading";
  }

  function hidePageStatus() {
    statusBox.hidden = true;
  }

  function showFieldMessage(element, message, tone) {
    if (!element) return;
    element.textContent = message || "";
    element.dataset.tone = tone || "";
  }

  function renderPlan(plan) {
    planName.textContent = plan.code === "school" ? "Учебный период" : "30 дней";
    planPrice.textContent = rubles(plan.price_kopecks);
    planDuration.textContent = duration(plan.duration_days);
    promoBadge.hidden = !plan.promo_applied;
    promoForm.hidden = plan.code !== "month";
    if (plan.promo_applied) {
      promoInput.value = "";
      promoInput.placeholder = "Промокод применён";
      showFieldMessage(
        promoMessage,
        telegramLinkOpened
          ? "Промокод применён и зафиксирован для этого заказа."
          : "Промокод применён. Итоговая цена подтверждена сервером.",
        "success"
      );
    } else {
      promoInput.placeholder = "Введите промокод";
      showFieldMessage(
        promoMessage,
        telegramLinkOpened ? "Тариф и цена зафиксированы для этого заказа." : "",
        ""
      );
    }
  }

  function setTelegramState(tone, message) {
    telegramStatus.dataset.tone = tone;
    telegramStatusText.textContent = message;
  }

  function setTelegramLink(enabled) {
    if (enabled && session && validTelegramUrl(session.telegram_url, session.token)) {
      telegramLink.href = session.telegram_url;
      telegramLink.removeAttribute("aria-disabled");
      telegramLink.removeAttribute("tabindex");
    } else {
      telegramLink.removeAttribute("href");
      telegramLink.setAttribute("aria-disabled", "true");
      telegramLink.setAttribute("tabindex", "-1");
    }
  }

  function updatePayButton() {
    var formReady = !!(
      emailInput && emailInput.validity.valid && termsInput && termsInput.checked
    );
    payButton.disabled = !telegramBound || !formReady || creatingPayment;
    if (creatingPayment) payButtonText.textContent = "Открываем Robokassa…";
    else if (!telegramBound) payButtonText.textContent = "Сначала подключите Telegram";
    else if (!formReady) payButtonText.textContent = "Заполните email и примите условия";
    else payButtonText.textContent = "Перейти к оплате";
  }

  function lockPromo(locked) {
    if (!promoInput || !promoSubmit) return;
    promoInput.disabled = locked;
    promoSubmit.disabled = locked || creatingSession;
  }

  function lockCheckoutChoice(locked) {
    lockPromo(locked);
    if (!changePlanLink) return;
    if (locked) {
      changePlanLink.removeAttribute("href");
      changePlanLink.setAttribute("aria-disabled", "true");
      changePlanLink.setAttribute("tabindex", "-1");
      changePlanLink.title = "Тариф зафиксирован после открытия Telegram";
    } else {
      changePlanLink.href = "/pricing/";
      changePlanLink.removeAttribute("aria-disabled");
      changePlanLink.removeAttribute("tabindex");
      changePlanLink.removeAttribute("title");
    }
  }

  function stopPolling() {
    if (pollTimer) clearTimeout(pollTimer);
    pollTimer = null;
  }

  function schedulePoll(delay) {
    stopPolling();
    pollTimer = setTimeout(pollStatus, delay == null ? POLL_INTERVAL_MS : delay);
  }

  async function createSession(promoCode) {
    if (creatingSession) return;
    creatingSession = true;
    stopPolling();
    telegramBound = false;
    telegramLinkOpened = false;
    setTelegramLink(false);
    lockCheckoutChoice(true);
    retryButton.hidden = true;
    updatePayButton();
    showPageStatus("Подготавливаем безопасный заказ…", "loading");
    setTelegramState("waiting", "Создаём одноразовую ссылку на бота.");
    try {
      var payload = { plan: selectedPlan };
      if (promoCode) payload.promo_code = promoCode;
      var created = await api("/checkout/session", payload);
      if (!validSession(created)) throw new Error("bad_session_response");
      created.telegram_opened = false;
      session = created;
      storeSession(created);
      renderPlan(created.plan);
      setTelegramLink(true);
      setTelegramState("waiting", "Откройте бота и нажмите Start. Мы ждём подтверждение подключения.");
      hidePageStatus();
      lockCheckoutChoice(false);
      root.setAttribute("aria-busy", "false");
      schedulePoll(500);
    } catch (error) {
      session = null;
      clearStoredSession();
      retryButton.hidden = false;
      showPageStatus(sessionErrorMessage(error), "error");
      setTelegramState("error", "Ссылка на бота пока недоступна.");
      root.setAttribute("aria-busy", "false");
    } finally {
      creatingSession = false;
      if (session) lockCheckoutChoice(telegramBound || telegramLinkOpened);
    }
  }

  function sessionErrorMessage(error) {
    if (error && error.reason === "rate_limited") {
      return "Слишком много попыток оформления. Подождите и попробуйте позже.";
    }
    if (error && (error.reason === "bad_promo" || error.reason === "promo_not_applicable")) {
      return "Промокод не найден или не подходит к этому тарифу.";
    }
    if (error && error.reason === "checkout_config") {
      return "Оплата временно недоступна. Мы уже занимаемся настройкой.";
    }
    return "Не удалось подготовить заказ. Проверьте интернет и попробуйте ещё раз.";
  }

  async function pollStatus() {
    if (!session || !SESSION_TOKEN_RE.test(session.token)) return;
    var polledToken = session.token;
    try {
      var result = await api("/checkout/status", { token: polledToken });
      // A promo submission creates a new order while an older status request
      // may still be in flight. Never let that stale response unlock the new one.
      if (!session || session.token !== polledToken) return;
      if (returningFromCancellation) {
        returningFromCancellation = false;
        hidePageStatus();
      }
      if (result.plan) renderPlan(result.plan);
      if (result.state === "waiting_telegram") {
        telegramBound = false;
        setTelegramLink(true);
        lockCheckoutChoice(telegramLinkOpened);
        setTelegramState(
          "waiting",
          telegramLinkOpened
            ? "Ссылка открыта. Нажмите Start в Telegram; тариф и цена уже зафиксированы."
            : "Ждём, когда вы нажмёте Start в Telegram."
        );
        updatePayButton();
        schedulePoll();
        return;
      }
      if (result.state === "telegram_bound" || result.state === "payment_ready") {
        telegramBound = true;
        telegramLinkOpened = true;
        session.telegram_opened = true;
        storeSession(session);
        setTelegramLink(false);
        lockCheckoutChoice(true);
        setTelegramState("connected", "Telegram подключён. Ключ будет отправлен именно в этот чат.");
        showFieldMessage(paymentMessage, "", "");
        updatePayButton();
        schedulePoll(5000);
        return;
      }
      if (["paid", "fulfilled", "delivered", "review"].includes(result.state)) {
        location.replace("/checkout/success/");
        return;
      }
      if (result.state === "expired") {
        stopPolling();
        telegramBound = false;
        setTelegramLink(false);
        lockCheckoutChoice(true);
        retryButton.hidden = false;
        setTelegramState("error", "Этот заказ больше недоступен. Не оплачивайте его повторно.");
        showPageStatus("По этому заказу нельзя продолжить оформление. Если деньги списались, не платите повторно и напишите в поддержку.", "error");
        updatePayButton();
        return;
      }
      schedulePoll();
    } catch (error) {
      if (!session || session.token !== polledToken) return;
      if (error.reason === "bad_checkout_token" || error.reason === "checkout_expired") {
        telegramBound = false;
        session = null;
        clearStoredSession();
        retryButton.hidden = false;
        setTelegramLink(false);
        setTelegramState("error", "Ссылка устарела. Начните оформление заново.");
        showPageStatus("Заказ больше недоступен.", "error");
        updatePayButton();
        return;
      }
      setTelegramState("waiting", "Не удалось проверить подключение. Повторяем…");
      schedulePoll(4000);
    }
  }

  function validPaymentResponse(value) {
    if (!value || value.ok !== true || value.payment_url !== "https://auth.robokassa.ru/Merchant/Index.aspx") {
      return false;
    }
    if (!value.fields || typeof value.fields !== "object" || Array.isArray(value.fields)) return false;
    var required = ["MerchantLogin", "OutSum", "InvId", "SignatureValue", "Shp_order_id"];
    return required.every(function (key) { return String(value.fields[key] || "").length > 0; }) &&
      String(value.fields.InvId) === String(session.order_id) &&
      String(value.fields.Shp_order_id) === String(session.order_id);
  }

  function submitProviderForm(payment) {
    var form = document.createElement("form");
    form.method = "POST";
    form.action = payment.payment_url;
    form.acceptCharset = "UTF-8";
    form.hidden = true;
    Object.keys(payment.fields).forEach(function (name) {
      if (!/^[A-Za-z][A-Za-z0-9_]{0,64}$/.test(name)) return;
      var input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = String(payment.fields[name]);
      form.appendChild(input);
    });
    document.body.appendChild(form);
    // Avoid DOM clobbering if a provider field is ever named "submit".
    HTMLFormElement.prototype.submit.call(form);
  }

  promoForm.addEventListener("submit", function (event) {
    event.preventDefault();
    if (!promoInput || promoInput.disabled) return;
    var code = promoInput.value.trim().toUpperCase();
    if (!code) {
      showFieldMessage(promoMessage, "Введите промокод.", "error");
      promoInput.focus();
      return;
    }
    showFieldMessage(promoMessage, "Проверяем код…", "");
    createSession(code).catch(function () {});
  });

  telegramLink.addEventListener("click", function (event) {
    if (telegramLink.getAttribute("aria-disabled") === "true") {
      event.preventDefault();
      return;
    }
    telegramLinkOpened = true;
    if (session) {
      session.telegram_opened = true;
      storeSession(session);
    }
    lockCheckoutChoice(true);
    renderPlan(session.plan);
    setTelegramState("waiting", "Ссылка открыта. Нажмите Start в Telegram и вернитесь сюда; тариф и цена уже зафиксированы.");
    schedulePoll(700);
  });

  retryButton.addEventListener("click", function () {
    clearStoredSession();
    session = null;
    telegramLinkOpened = false;
    createSession("").catch(function () {});
  });

  [emailInput, termsInput].forEach(function (element) {
    element.addEventListener("input", updatePayButton);
    element.addEventListener("change", updatePayButton);
  });

  paymentForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    showFieldMessage(paymentMessage, "", "");
    if (!telegramBound || !session) {
      showFieldMessage(paymentMessage, "Сначала подключите Telegram.", "error");
      return;
    }
    if (!paymentForm.reportValidity()) return;
    if (creatingPayment) return;
    creatingPayment = true;
    updatePayButton();
    showFieldMessage(paymentMessage, "Создаём защищённый переход в Robokassa…", "");
    try {
      var payment = await api("/checkout/payment", {
        token: session.token,
        email: emailInput.value.trim(),
        accepted_terms: termsInput.checked === true
      });
      if (!validPaymentResponse(payment)) throw new Error("bad_payment_response");
      storeSession(session);
      submitProviderForm(payment);
    } catch (error) {
      creatingPayment = false;
      updatePayButton();
      var message = error.reason === "checkout_already_started"
        ? "Оплата уже была создана с другим email. Введите тот же адрес или начните заказ заново."
        : error.reason === "checkout_expired"
          ? "Время оформления истекло. Создайте новый заказ."
          : "Не удалось открыть оплату. Деньги не списаны — попробуйте ещё раз.";
      showFieldMessage(paymentMessage, message, "error");
      if (error.reason === "checkout_expired") retryButton.hidden = false;
    }
  });

  var stored = readStoredSession();
  var returningFromCancellation = new URLSearchParams(location.search).get("payment") === "cancelled";
  if (returningFromCancellation) {
    showPageStatus("Вы вернулись со страницы оплаты. Проверяем итоговый статус на сервере…", "loading");
  }
  if (stored && stored.plan.code === selectedPlan && validSession(stored) &&
      Date.parse(stored.expires_at) > Date.now()) {
    session = stored;
    telegramLinkOpened = stored.telegram_opened === true;
    renderPlan(stored.plan);
    setTelegramLink(true);
    lockCheckoutChoice(telegramLinkOpened);
    root.setAttribute("aria-busy", "false");
    if (!returningFromCancellation) hidePageStatus();
    setTelegramState("waiting", "Проверяем подключение Telegram…");
    schedulePoll(100);
  } else {
    clearStoredSession();
    createSession("").catch(function () {});
  }
  updatePayButton();
})();
