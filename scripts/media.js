// смэш — play looping demo videos only while they're on screen.
// Keeps the page light: offscreen clips pause instead of burning CPU/battery.

(function () {
  function init() {
    var videos = document.querySelectorAll("video[autoplay]");
    if (!videos.length) return;

    if (!("IntersectionObserver" in window)) return; // native autoplay handles it

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var v = entry.target;
        if (entry.isIntersecting) {
          var p = v.play();
          if (p && typeof p.catch === "function") p.catch(function () {});
        } else if (!v.paused) {
          v.pause();
        }
      });
    }, { rootMargin: "200px 0px", threshold: 0.15 });

    videos.forEach(function (v) { io.observe(v); });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
