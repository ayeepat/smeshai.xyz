(function () {
  var toggle = document.querySelector('.nav-toggle');
  var menu = document.querySelector('.mobile-menu');
  if (!toggle || !menu) return;

  function setOpen(open) {
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    menu.setAttribute('data-open', open ? 'true' : 'false');
    document.body.classList.toggle('menu-open', open);
  }

  toggle.addEventListener('click', function () {
    var open = toggle.getAttribute('aria-expanded') === 'true';
    setOpen(!open);
  });

  menu.addEventListener('click', function (e) {
    var link = e.target.closest('a');
    if (link) setOpen(false);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      setOpen(false);
      toggle.focus();
    }
  });

  // Close menu if viewport grows past the mobile breakpoint.
  var mq = window.matchMedia('(min-width: 881px)');
  function onChange(e) { if (e.matches) setOpen(false); }
  if (mq.addEventListener) mq.addEventListener('change', onChange);
  else if (mq.addListener) mq.addListener(onChange);
})();
