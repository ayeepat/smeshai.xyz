(function () {
  "use strict";

  document.querySelectorAll("[data-payment-title]").forEach(function (container) {
    var frame = container.querySelector("iframe");
    if (!frame) return;

    frame.title = container.getAttribute("data-payment-title");
    container.classList.add("has-widget");
  });
})();
