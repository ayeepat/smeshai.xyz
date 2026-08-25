(function () {
  "use strict";

  var TEST_PROMO_CODE = "XYZ654";
  var DISCOUNT_INVOICE_ID = "WvqeeRbjkkWMrZGeJuf0_w";
  var DISCOUNT_WIDGET_URL = "https://auth.robokassa.ru/Merchant/PaymentForm/FormSS.if?EncodedInvoiceId=" + DISCOUNT_INVOICE_ID;
  var DISCOUNT_PAYMENT_URL = "https://auth.robokassa.ru/merchant/Invoice/" + DISCOUNT_INVOICE_ID;

  document.querySelectorAll("[data-payment-title]").forEach(function (container) {
    var frame = container.querySelector("iframe");
    if (!frame) return;

    frame.title = container.getAttribute("data-payment-title");
    container.classList.add("has-widget");
  });

  var promoForm = document.querySelector("[data-promo-form]");
  var promoInput = promoForm && promoForm.querySelector(".promo-input");
  var promoSubmit = promoForm && promoForm.querySelector(".promo-submit");
  var promoMessage = promoForm && promoForm.querySelector("[data-promo-message]");
  var monthlyPayment = document.querySelector('[data-payment-title="Оплата доступа к смэш AI на 30 дней"]');
  var monthlyPrice = document.querySelector("[data-monthly-price]");
  var discountPrice = document.querySelector("[data-discount-price]");

  if (!promoForm || !promoInput || !promoSubmit || !promoMessage || !monthlyPayment) return;

  function showPromoError(message) {
    promoForm.classList.remove("is-success");
    promoForm.classList.add("is-error");
    promoInput.setAttribute("aria-invalid", "true");
    promoMessage.textContent = message;
  }

  promoInput.addEventListener("input", function () {
    if (!promoForm.classList.contains("is-error")) return;
    promoForm.classList.remove("is-error");
    promoInput.removeAttribute("aria-invalid");
    promoMessage.textContent = "";
  });

  promoForm.addEventListener("submit", function (event) {
    event.preventDefault();

    var enteredCode = promoInput.value.trim().toUpperCase();
    if (!enteredCode) {
      showPromoError("Введите промокод.");
      promoInput.focus();
      return;
    }

    if (enteredCode !== TEST_PROMO_CODE) {
      showPromoError("Промокод не найден. Проверьте код и попробуйте ещё раз.");
      promoInput.focus();
      return;
    }

    var frame = monthlyPayment.querySelector("iframe");
    var fallback = monthlyPayment.querySelector(".robokassa-payment-fallback");

    if (frame) {
      frame.src = DISCOUNT_WIDGET_URL;
      frame.title = "Оплата доступа к смэш AI на 30 дней по промокоду";
    }

    if (fallback) {
      fallback.href = DISCOUNT_PAYMENT_URL;
      fallback.textContent = "Оплатить 10 ₽";
    }

    if (monthlyPrice && discountPrice) {
      monthlyPrice.classList.add("is-discounted");
      discountPrice.hidden = false;
    }

    promoInput.value = TEST_PROMO_CODE;
    promoInput.readOnly = true;
    promoInput.removeAttribute("aria-invalid");
    promoSubmit.disabled = true;
    promoSubmit.textContent = "Применён";
    promoForm.classList.remove("is-error");
    promoForm.classList.add("is-success");
    promoMessage.textContent = "Промокод применён. Цена за 30 дней — 10 ₽.";
  });
})();
