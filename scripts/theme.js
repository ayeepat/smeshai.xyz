// смэш — site theme toggle. Mirrors the extension's behaviour: respects
// system preference until the user explicitly picks one, then persists.

(function () {
  const KEY = "smesh-site-theme";
  const root = document.documentElement;

  // Scroll-reveal styles apply only when scripting is on, so content is
  // never stuck hidden for no-JS visitors.
  root.classList.add("js");

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

    const mq = matchMedia("(prefers-color-scheme: dark)");

    function effective() {
      const explicit = root.getAttribute("data-theme");
      if (explicit) return explicit;
      return mq.matches ? "dark" : "light";
    }

    function syncLabel() {
      const label = effective() === "dark" ? "Включить светлую тему" : "Включить тёмную тему";
      btn.title = label;
      btn.setAttribute("aria-label", label);
    }
    syncLabel();

    btn.addEventListener("click", () => {
      const next = effective() === "dark" ? "light" : "dark";
      apply(next);
      try { localStorage.setItem(KEY, next); } catch (_) {}
      syncLabel();
    });

    // Keep the label honest if the system theme flips while following it.
    const onSystem = () => { if (!root.getAttribute("data-theme")) syncLabel(); };
    if (mq.addEventListener) mq.addEventListener("change", onSystem);
    else if (mq.addListener) mq.addListener(onSystem);
  });
})();
