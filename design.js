// Visual enhancements only. Booking and submission stay in app.js.
(function () {
  var header = document.querySelector('.top');
  var hero = document.querySelector('.hero');
  if (header && hero && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      header.classList.toggle('over-photo', entries[0].isIntersecting);
    }, { rootMargin: '-72px 0px 0px 0px', threshold: 0 }).observe(hero);
  }
})();
