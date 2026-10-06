// Presentation only; booking submission remains in app.js.
(function () {
  var film = document.getElementById('brand-film');
  if (!film) return;
  var toggle = document.getElementById('film-toggle');
  var sound = document.getElementById('film-sound');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  toggle.hidden = false;
  sound.hidden = false;
  function sync() {
    toggle.textContent = film.paused ? '영상 재생하기' : '영상 멈추기';
    sound.textContent = film.muted ? '소리 켜고 처음부터 보기 ↗' : '소리 끄기';
  }
  function play() { var p = film.play(); if (p) p.catch(sync); }
  toggle.addEventListener('click', function () { if (film.paused) play(); else film.pause(); });
  sound.addEventListener('click', function () {
    if (film.muted) { film.muted = false; film.currentTime = 0; play(); }
    else film.muted = true;
    sync();
  });
  ['play', 'pause', 'volumechange'].forEach(function (event) { film.addEventListener(event, sync); });
  function respectMotion() { if (reduced.matches) { film.autoplay = false; film.pause(); } }
  reduced.addEventListener('change', respectMotion);
  respectMotion(); sync();
})();

// Motion is decorative. Booking and reading order remain independent of it.
(function () {
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var hero = document.querySelector('.hero');
  var filmWrap = document.querySelector('.hero-film');
  var motionButton = document.getElementById('page-motion');
  if (!hero || !filmWrap || !motionButton) return;
  var userPaused = false, pending = false;
  var headings = document.querySelectorAll('main > section:not(.price-reservation) h2');
  headings.forEach(function (h) { h.classList.add('reveal-heading'); });
  if ('IntersectionObserver' in window) {
    document.documentElement.classList.add('motion-ready');
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
      });
    }, { threshold: 0.12 });
    headings.forEach(function (h) { observer.observe(h); });
  }
  function paused() { return userPaused || reduced.matches; }
  function update() {
    pending = false;
    if (paused() || window.innerWidth < 701) { filmWrap.style.transform = ''; return; }
    var top = hero.getBoundingClientRect().top;
    var y = Math.max(-18, Math.min(18, -top * 0.045));
    filmWrap.style.transform = 'translate3d(0,' + y + 'px,0)';
  }
  function sync() {
    document.documentElement.classList.toggle('motion-paused', paused());
    motionButton.textContent = paused() ? '화면 움직임 켜기' : '화면 움직임 멈추기';
    motionButton.setAttribute('aria-pressed', String(paused()));
    update();
  }
  motionButton.hidden = false;
  motionButton.addEventListener('click', function () { userPaused = !userPaused; sync(); });
  reduced.addEventListener('change', sync);
  window.addEventListener('scroll', function () {
    if (!pending) { pending = true; window.requestAnimationFrame(update); }
  }, { passive: true });
  window.addEventListener('resize', update);
  document.querySelectorAll('.hero-ctas .btn').forEach(function (button) {
    button.addEventListener('pointermove', function (event) {
      if (paused() || event.pointerType !== 'mouse') return;
      var rect = button.getBoundingClientRect();
      var x = (event.clientX - rect.left - rect.width / 2) * 0.08;
      var y = (event.clientY - rect.top - rect.height / 2) * 0.08;
      button.style.transform = 'translate(' + x + 'px,' + y + 'px)';
    });
    button.addEventListener('pointerleave', function () { button.style.transform = ''; });
  });
  sync();
})();
