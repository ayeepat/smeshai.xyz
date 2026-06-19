// смэш — site theme toggle. Mirrors the extension's behaviour: respects
// system preference until the user explicitly picks one, then persists.

(function () {
  const KEY = "smesh-site-theme";
  const root = document.documentElement;

  function apply(theme) {
    if (theme === "light" || theme === "dark") {
      root.setAttribute("data-theme", theme);
    } else {
      root.removeAttribute("data-theme");
    }
  }

  let stored = null;
  try { stored = localStorage.getItem(KEY); } catch (_) {}
  if (stored) apply(stored);

  document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("themeBtn");
    if (!btn) return;

    function effective() {
      const explicit = root.getAttribute("data-theme");
      if (explicit) return explicit;
      return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }

    btn.addEventListener("click", () => {
      const next = effective() === "dark" ? "light" : "dark";
      apply(next);
      try { localStorage.setItem(KEY, next); } catch (_) {}
    });
  });
})();
