// смэш — small interactions for the glass layer:
//   • pixel numerals (step numbers, feature kickers) drawn from a 3×5 font,
//   • a light that follows the cursor across glass cards,
//   • the hero browser leaning toward the pointer.
// All of it is decoration: without JS the plain numbers and flat cards stay.

(function () {
  var DIGITS = {
    "0": "111101101101111", "1": "010110010010111", "2": "111001111100111",
    "3": "111001111001111", "4": "101101111001001", "5": "111100111001111",
    "6": "111100111101111", "7": "111001010010010", "8": "111101111101111",
    "9": "111101111001111"
  };
  var NS = "http://www.w3.org/2000/svg";

  function pixelDigits(str) {
    var svg = document.createElementNS(NS, "svg");
    var w = str.length * 4 - 1;
    svg.setAttribute("viewBox", "0 0 " + w + " 5");
    svg.setAttribute("class", "px-digits");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("shape-rendering", "crispEdges");
    svg.style.aspectRatio = w + " / 5";
    for (var c = 0; c < str.length; c++) {
      var bits = DIGITS[str[c]];
      for (var i = 0; i < 15; i++) {
        if (bits[i] !== "1") continue;
        var r = document.createElementNS(NS, "rect");
        r.setAttribute("x", c * 4 + (i % 3));
        r.setAttribute("y", Math.floor(i / 3));
        r.setAttribute("width", 1);
        r.setAttribute("height", 1);
        svg.appendChild(r);
      }
    }
    return svg;
  }

  function initDigits() {
    // "01 · Тесты" → [pixel 01] Тесты
    document.querySelectorAll(".feature-kicker").forEach(function (el) {
      var m = el.textContent.trim().match(/^(\d+)\s*·\s*(.+)$/);
      if (!m) return;
      el.textContent = "";
      el.setAttribute("aria-label", m[1] + " · " + m[2]);
      el.appendChild(pixelDigits(m[1]));
      var label = document.createElement("span");
      label.textContent = m[2];
      el.appendChild(label);
      el.classList.add("has-px");
    });
    document.querySelectorAll(".step-num, .card-num, .checkout-step-num").forEach(function (el) {
      var txt = el.textContent.trim();
      if (!/^\d+$/.test(txt)) return;
      el.textContent = "";
      el.setAttribute("aria-label", txt);
      el.appendChild(pixelDigits(txt));
      el.classList.add("has-px");
    });
  }

  var fine = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function initSpotlight() {
    if (!fine) return;
    document.querySelectorAll(".card, .tier, .safety-point, .checkout-summary, .store-tab").forEach(function (el) {
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        el.style.setProperty("--mx", (e.clientX - r.left) + "px");
        el.style.setProperty("--my", (e.clientY - r.top) + "px");
      }, { passive: true });
    });
  }

  function initHeroTilt() {
    var hero = document.querySelector(".hero");
    var wrap = hero && hero.querySelector(".hero-media-wrap");
    if (!wrap || !fine || reduce) return;
    hero.addEventListener("pointermove", function (e) {
      var r = wrap.getBoundingClientRect();
      var x = (e.clientX - (r.left + r.width / 2)) / window.innerWidth;
      var y = (e.clientY - (r.top + r.height / 2)) / window.innerHeight;
      wrap.style.setProperty("--ry", (-5 + x * 9).toFixed(2));
      wrap.style.setProperty("--rx", (2 - y * 8).toFixed(2));
      wrap.style.setProperty("--cx", (x * -14).toFixed(1) + "px");
      wrap.style.setProperty("--cy", (y * -10).toFixed(1) + "px");
    }, { passive: true });
    hero.addEventListener("pointerleave", function () {
      ["--ry", "--rx", "--cx", "--cy"].forEach(function (p) { wrap.style.removeProperty(p); });
    });
  }

  function boot() { initDigits(); initSpotlight(); initHeroTilt(); }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
