// смэш — demo video playback.
//   • Desktop with motion allowed: the framed hero clips autoplay while
//     they're on screen and pause once scrolled away (saves CPU/battery).
//   • Touch devices, or visitors who prefer reduced motion: the clips stay
//     on their poster behind a play button and start only on tap — that
//     respects the motion preference and avoids burning mobile data.

(function () {
  function playSafe(v) {
    var p = v.play();
    if (p && typeof p.catch === "function") p.catch(function () {});
  }

  function initAutoplay() {
    var videos = document.querySelectorAll("video[data-autoplay]");
    if (!videos.length) return;

    var reduce = window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var coarse = window.matchMedia &&
      window.matchMedia("(hover: none), (pointer: coarse)").matches;

    // Tap-to-play: keep the poster up until the visitor opts in.
    if (reduce || coarse) {
      videos.forEach(function (v) {
        var wrap = v.closest(".browser, .device") || v.parentElement;
        if (!wrap) return;
        wrap.classList.add("tap-to-play");
        wrap.addEventListener("click", function () {
          if (v.paused) { playSafe(v); wrap.classList.add("is-playing"); }
          else { v.pause(); wrap.classList.remove("is-playing"); }
        });
      });
      return;
    }

    // Motion is welcome: autoplay while visible, pause when off screen.
    if (!("IntersectionObserver" in window)) {
      videos.forEach(playSafe);
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var v = entry.target;
        if (entry.isIntersecting) playSafe(v);
        else if (!v.paused) v.pause();
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
        playSafe(v);
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

  function boot() { initAutoplay(); initHoverVideos(); }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
