import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [checkoutHtml, successHtml, checkoutJs, successJs, legacyWidgets, pricingHtml, css] = await Promise.all([
  read("checkout/index.html"),
  read("checkout/success/index.html"),
  read("scripts/checkout.js"),
  read("scripts/checkout-success.js"),
  read("scripts/payment-widgets.js"),
  read("pricing/index.html"),
  read("styles/site.css")
]);

for (const [name, source] of Object.entries({ checkoutHtml, checkoutJs, legacyWidgets })) {
  assert.equal(source.includes("XYZ654"), false, `${name} must not publish a promo code`);
}

assert.match(checkoutHtml, /name="promo_code"/, "checkout must keep the promo input");
assert.equal(
  /Саклаков|Даниил|Денисович/.test(checkoutHtml + successHtml),
  false,
  "checkout-facing pages must use the service identity, not the operator's personal name"
);
assert.match(checkoutJs, /payload\.promo_code\s*=\s*promoCode/,
  "checkout must send entered promo codes to the server");
assert.match(checkoutJs, /telegram_opened:\s*value\.telegram_opened === true/, "Telegram-open state must survive a reload");
assert.match(checkoutJs, /lockCheckoutChoice\(telegramLinkOpened\)/, "status polling must preserve the Telegram mutation lock");
assert.match(successJs, /sessionStorage\.removeItem\(STORAGE_KEY\)/, "terminal success must clear the checkout session");

assert.doesNotMatch(legacyWidgets, /EncodedInvoiceId|auth\.robokassa|merchant\/Invoice|PaymentForm/i,
  "legacy widget stub must not expose provider invoice links");
assert.doesNotMatch(pricingHtml, /payment-widgets\.js|EncodedInvoiceId|auth\.robokassa/i,
  "pricing must not execute legacy payment widgets");
assert.doesNotMatch(checkoutJs, /Оплата отменена|деньги по нему не подтверждены/,
  "client-controlled return state must not assert a financial outcome");

for (const declaration of [
  ".checkout-alert a { color: var(--accent-press)",
  ".checkout-input::placeholder { color: var(--secondary)",
  ".checkout-result-state[data-tone=\"attention\"] { background: var(--note-1); color: var(--text)",
  ".checkout-result-help a { color: var(--accent-press)"
]) {
  assert.ok(css.includes(declaration), `missing checkout contrast rule: ${declaration}`);
}

console.log("checkout static regressions passed");
