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

  // Hover-to-play cards: clips load only on hover (preload="none"), and a
  // pill hint nudges the user that hovering starts the demo. On touch
  // devices a tap toggles play/pause instead.
  function initHoverVideos() {
    var media = document.querySelectorAll(".card-media--hover");
    if (!media.length) return;

    var hasHover = window.matchMedia &&
      window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    media.forEach(function (wrap) {
      var v = wrap.querySelector("video");
      if (!v) return;

      function play() {
        var p = v.play();
        if (p && typeof p.catch === "function") p.catch(function () {});
        wrap.classList.add("is-playing");
      }
      function stop() {
        v.pause();
        try { v.currentTime = 0; } catch (e) {}
        wrap.classList.remove("is-playing");
      }

      if (hasHover) {
        wrap.addEventListener("mouseenter", play);
        wrap.addEventListener("mouseleave", stop);
        wrap.addEventListener("focusin", play);
        wrap.addEventListener("focusout", stop);
      } else {
        // touch / no-hover: tap to toggle
        wrap.addEventListener("click", function () {
          if (v.paused) play(); else stop();
        });
      }
    });
  }

  function boot() { init(); initHoverVideos(); }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
