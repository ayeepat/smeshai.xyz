// смэш — install page browser picker. Each browser is a tab with its own
// store link and instructions. Without JS the Edge panel (the one that's
// live) stays visible, so the page still works.

(function () {
  function init() {
    var tablist = document.querySelector(".store-tabs");
    if (!tablist) return;
    var tabs = Array.prototype.slice.call(tablist.querySelectorAll(".store-tab"));
    var panels = Array.prototype.slice.call(document.querySelectorAll(".store-panel"));

    function select(tab, focus) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.classList.toggle("is-active", on);
        t.setAttribute("aria-selected", on ? "true" : "false");
        t.tabIndex = on ? 0 : -1;
      });
      panels.forEach(function (p) {
        p.hidden = p.id !== tab.getAttribute("aria-controls");
      });
      if (focus) tab.focus();
    }

    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () { select(tab, false); });
    });

    // Standard tablist keyboard behaviour: arrows move and select.
    tablist.addEventListener("keydown", function (e) {
      var i = tabs.indexOf(document.activeElement);
      if (i === -1) return;
      var next = null;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        next = tabs[(i + 1) % tabs.length];
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        next = tabs[(i - 1 + tabs.length) % tabs.length];
      } else if (e.key === "Home") {
        next = tabs[0];
      } else if (e.key === "End") {
        next = tabs[tabs.length - 1];
      }
      if (next) { e.preventDefault(); select(next, true); }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
