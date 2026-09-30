(function () {
  // 예약 저장소: Google 스프레드시트 (Apps Script 웹앱 — apps-script/Code.gs)
  var ENDPOINT = '__ENDPOINT__';
  var form = document.getElementById('booking');
  if (!form) return;
  var done = document.querySelector('.done');
  var errBox = form.querySelector('.f-error');
  var btn = form.querySelector('button[type=submit]');

  // 희망 날짜: 오늘 이후만
  var d = form.querySelector('input[name=date]');
  var t = new Date();
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  d.min = t.getFullYear() + '-' + pad(t.getMonth() + 1) + '-' + pad(t.getDate());

  // 휴대폰 번호 자동 하이픈
  var phone = form.querySelector('input[name=phone]');
  phone.addEventListener('input', function () {
    var v = phone.value.replace(/\D/g, '').slice(0, 11);
    if (v.length > 7) v = v.slice(0, 3) + '-' + v.slice(3, v.length - 4) + '-' + v.slice(-4);
    else if (v.length > 3) v = v.slice(0, 3) + '-' + v.slice(3);
    phone.value = v;
  });

  // '없음'은 다른 채널과 함께 고를 수 없다
  var boxes = form.querySelectorAll('input[name=channels]');
  boxes.forEach(function (b) {
    b.addEventListener('change', function () {
      if (!b.checked) return;
      boxes.forEach(function (o) {
        if (o !== b && (b.hasAttribute('data-none') || o.hasAttribute('data-none'))) o.checked = false;
      });
    });
  });

  function mark(el, bad) {
    var wrap = el.closest('.f') || el.closest('.consent');
    if (wrap) wrap.classList.toggle('invalid', bad);
  }

  function validate() {
    var first = null, msg = '';
    form.querySelectorAll('[required]').forEach(function (el) {
      var bad = el.type === 'checkbox' ? !el.checked : !el.value.trim();
      if (el.name === 'phone' && !bad && !/^01[016789]-?\d{3,4}-?\d{4}$/.test(el.value)) {
        bad = true; if (!msg) msg = '휴대폰 번호를 다시 확인해주세요.';
      }
      if (el.name === 'date' && !bad && el.value < d.min) {
        bad = true; if (!msg) msg = '희망 날짜는 오늘 이후로 선택해주세요.';
      }
      mark(el, bad);
      if (bad && !first) first = el;
    });
    if (first) {
      var consent = form.querySelector('[name=privacy_consent]');
      if (!msg) msg = first === consent ? '개인정보 수집·이용에 동의해주세요.' : '필수 항목(*)을 모두 입력해주세요.';
      errBox.textContent = msg; errBox.hidden = false;
      first.focus({ preventScroll: false });
      return false;
    }
    errBox.hidden = true;
    return true;
  }

  form.addEventListener('input', function (e) { if (e.target.closest('.invalid')) mark(e.target, false); });
  form.addEventListener('change', function (e) { if (e.target.closest('.invalid')) mark(e.target, false); });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validate()) return;
    btn.disabled = true; btn.textContent = '접수 중…';
    var fd = new FormData(form);
    fd.append('source', location.hostname);
    // Apps Script 는 CORS 응답을 주지 않는다 → no-cors 로 보내고, 네트워크 오류만 실패로 본다
    fetch(ENDPOINT, { method: 'POST', mode: 'no-cors', body: new URLSearchParams(fd) })
      .then(function () {
        form.hidden = true; done.hidden = false; done.focus();
      })
      .catch(function () {
        btn.disabled = false; btn.textContent = '상담 예약하기';
        errBox.textContent = '전송하지 못했습니다. 잠시 후 다시 시도하시거나 010-2741-5806으로 연락주세요.';
        errBox.hidden = false;
      });
  });

  // 모바일 하단 고정 버튼: 예약 섹션이 보이면 숨김
  var mcta = document.querySelector('.m-cta');
  var book = document.getElementById('book');
  if (mcta && 'IntersectionObserver' in window) {
    var hero = document.querySelector('.hero');
    var state = { hero: true, book: false };
    var upd = function () { mcta.classList.toggle('hide', state.hero || state.book); };
    new IntersectionObserver(function (es) { es.forEach(function (x) { state[x.target === book ? 'book' : 'hero'] = x.isIntersecting; }); upd(); }).observe(book);
    new IntersectionObserver(function (es) { es.forEach(function (x) { state.hero = x.isIntersecting; }); upd(); }, { threshold: 0.35 }).observe(hero);
    upd();
  }
})();
