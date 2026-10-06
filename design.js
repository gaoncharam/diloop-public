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
