(function () {
  var ENDPOINT = window.DILOOP_ONBOARDING_ENDPOINT || '';
  var token = new URLSearchParams(location.search).get('t') || '';
  var $ = function (id) { return document.getElementById(id); };
  var busy = false;
  var shownAt = 0;
  var NET_ERROR = '연결이 잠시 끊겼습니다. 화면을 다시 불러왔으니 확인 후 한 번 더 눌러주세요.';

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;   // 서버에서 온 글은 항상 글자로만 넣는다
    return n;
  }

  function fatal(text) {
    $('loading').hidden = true; $('app').hidden = true;
    $('fatal-text').textContent = text; $('fatal').hidden = false;
  }

  function api(body) {
    var opt = body ? { method: 'POST', body: JSON.stringify(body) } : undefined;
    var url = body ? ENDPOINT : ENDPOINT + '?a=ob&t=' + encodeURIComponent(token);
    return fetch(url, opt).then(function (r) { return r.json(); });
  }

  // 화면을 서버의 지금 상태로 다시 그린다 (실패해도 조용히 둔다).
  function refresh() {
    return api().then(function (view) { if (view && view.ok) render(view); }).catch(function () {});
  }

  function send(p, event, extra, button) {
    if (busy) { alert('앞의 요청을 보내는 중입니다. 잠시만 기다려 주세요.'); return Promise.resolve(); }
    busy = true;
    var label = button && button.textContent;
    if (button) { button.disabled = true; button.textContent = '보내는 중…'; }
    // 내가 보던 단계를 함께 보낸다 — 이미 처리된 버튼을 다시 눌러도 서버가 아무것도 바꾸지 않는다.
    var body = { a: 'ob_event', t: token, platform: p.id, event: event, at_state: p.state, at_claimed: p.claimed };
    for (var k in (extra || {})) body[k] = extra[k];
    return api(body).then(function (view) {
      busy = false;
      if (!view.ok) {
        if (button) { button.disabled = false; button.textContent = label; }
        alert(view.error || '처리하지 못했습니다. 잠시 후 다시 눌러주세요.');
        return refresh();
      }
      render(view);
      if (view.stale) alert('화면이 최신 상태로 바뀌었습니다. 확인 후 다시 눌러주세요.');
    }).catch(function () {
      busy = false;
      if (button) { button.disabled = false; button.textContent = label; }
      return refresh().then(function () { alert(NET_ERROR); });
    });
  }

  function copyRow(item) {
    var row = el('div', 'copy');
    var text = el('div');
    text.appendChild(el('small', '', item.label));
    text.appendChild(el('span', '', item.value));
    var b = el('button', 'ghost small', '복사');
    b.type = 'button';
    b.addEventListener('click', function () {
      var done = function () { b.textContent = '복사됨'; setTimeout(function () { b.textContent = '복사'; }, 1500); };
      var manual = function () { prompt('길게 눌러 복사하세요', item.value); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(item.value).then(done, manual);
      } else { manual(); }
    });
    row.appendChild(text); row.appendChild(b);
    return row;
  }

  // 사진은 휴대폰에서 줄여서 보낸다 (긴 변 1600px 에서 시작, 약 250KB 이하가 될 때까지)
  function shrink(file) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        var side = 1600, q = 0.6, out = '';
        for (var i = 0; i < 7; i++) {
          var scale = Math.min(1, side / Math.max(img.width, img.height));
          var c = document.createElement('canvas');
          c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          out = c.toDataURL('image/jpeg', q);
          if (out.length <= 330000) break;
          side = Math.round(side * 0.85); q = Math.max(0.4, q - 0.05);
        }
        URL.revokeObjectURL(img.src);
        out.length <= 350000 ? resolve(out) : reject(new Error('사진이 너무 큽니다. 화면을 캡처한 사진으로 다시 올려주세요.'));
      };
      img.onerror = function () { reject(new Error('사진을 읽지 못했습니다. 다른 사진으로 올려주세요.')); };
      img.src = URL.createObjectURL(file);
    });
  }

  function helpBox(p, compact) {
    var box = el('div', 'help');
    var open = el('button', compact ? 'ghost small' : 'ghost', compact ? '막혔어요' : '막혔어요 · 화면이 달라요');
    open.type = 'button';
    var form = el('div'); form.hidden = true;
    var ta = el('textarea'); ta.placeholder = '어디에서 막혔는지 짧게 적어주세요 (안 적어도 됩니다)'; ta.maxLength = 500;
    var file = el('input'); file.type = 'file'; file.accept = 'image/*';
    var hint = el('p', 'note', '지금 보이는 화면을 캡처해서 올려주시면 가장 빠릅니다. 비밀번호·인증번호가 보이는 화면은 올리지 마세요.');
    var go = el('button', 'dark', '딜루프에 보내기'); go.type = 'button';
    open.addEventListener('click', function () { form.hidden = !form.hidden; });
    go.addEventListener('click', function () {
      var f = file.files && file.files[0];
      go.disabled = true;
      (f ? shrink(f) : Promise.resolve('')).then(function (image) {
        go.disabled = false;
        var extra = { note: ta.value.trim() };
        if (image) extra.image = image;
        return send(p, 'help', extra, go);
      }).catch(function (err) { go.disabled = false; alert(err.message); });
    });
    form.appendChild(ta); form.appendChild(file); form.appendChild(hint); form.appendChild(go);
    box.appendChild(open); box.appendChild(form);
    return box;
  }

  // 안내는 한 번에 한 문장씩 보여 준다. 다른 앱에 다녀와도 보던 자리를 기억한다.
  var stepAt = {};
  function stepper(p) {
    var key = p.id + '/' + p.state + '/' + p.steps.length;
    var i = Math.min(stepAt[key] || 0, p.steps.length - 1);
    var box = el('div', 'stepper');
    var n = el('div', 'n');
    var t = el('div', 't');
    var nav = el('div', 'nav');
    var prev = el('button', 'ghost', '이전'); prev.type = 'button';
    var next = el('button', 'dark', '다음'); next.type = 'button';
    function show() {
      stepAt[key] = i;
      n.textContent = (i + 1) + ' / ' + p.steps.length;
      t.textContent = p.steps[i];
      prev.disabled = i === 0;
      next.disabled = i === p.steps.length - 1;
      next.textContent = i === p.steps.length - 1 ? '마지막입니다' : '다음';
    }
    prev.addEventListener('click', function () { if (i > 0) { i--; show(); } });
    next.addEventListener('click', function () { if (i < p.steps.length - 1) { i++; show(); } });
    nav.appendChild(prev); nav.appendChild(next);
    box.appendChild(n); box.appendChild(t); box.appendChild(nav);
    show();
    return box;
  }

  var DONE_LABEL = { create: '여기까지 했어요', verify: '신청했어요', access: '권한을 줬어요' };

  function nowCard(p) {
    var card = el('div', 'card now');
    card.appendChild(el('span', 'tag', '지금 하실 일 · ' + p.label));
    card.appendChild(el('h2', '', p.action));
    if (p.steps.length === 1) {
      card.appendChild(el('p', 'sub', p.steps[0]));
    } else if (p.steps.length > 1) {
      card.appendChild(stepper(p));
    }
    p.copy.forEach(function (c) { card.appendChild(copyRow(c)); });
    (p.links || []).forEach(function (link) {
      if (!/^https:\/\//.test(link.url)) return;
      var a = el('a', 'btn line', link.label);
      a.href = link.url; a.target = '_blank'; a.rel = 'noopener';
      a.addEventListener('click', function () {
        // '시작'이 기록되면 이 카드가 알고 있는 단계도 맞춰 둔다 — 돌아와서 누른 첫 버튼이 헛돌지 않게.
        api({ a: 'ob_event', t: token, platform: p.id, event: 'start' }).then(function (view) {
          (view && view.ok ? view.platforms : []).forEach(function (q) {
            if (q.id === p.id) { p.state = q.state; p.claimed = q.claimed; }
          });
        }).catch(function () {});
      });
      card.appendChild(a);
    });
    var main = el('button', 'primary', DONE_LABEL[p.kind] || '했어요');
    main.type = 'button';
    main.addEventListener('click', function () { send(p, 'done', null, main); });
    card.appendChild(main);
    card.appendChild(helpBox(p, false));
    return card;
  }

  function listRow(p) {
    var wrapAll = el('div', 'rowbox');
    var row = el('div', 'row');
    var wrap = el('div', 'rowwrap');
    wrap.appendChild(el('b', '', p.label));
    var msg = '';
    var waitingApproval = p.kind === 'verify' && p.claimed && p.state !== 'NEED_HELP';
    if (p.state === 'NEED_HELP') msg = '딜루프가 확인하고 있습니다. 곧 연락드리겠습니다.';
    else if (p.state === 'COMPLETE') msg = '끝났습니다. 감사합니다.';
    else if (waitingApproval) msg = '신청하셨습니다. 결과 안내를 받으시면 눌러주세요.';
    else if (p.kind === 'access' && p.claimed) msg = '딜루프가 권한을 확인하고 있습니다.';
    else if (p.wait) msg = p.action;
    if (msg) wrap.appendChild(el('p', '', msg));
    row.appendChild(wrap);
    if (waitingApproval) {
      var b = el('button', 'dark small', '결과 안내 받았어요');
      b.type = 'button';
      b.addEventListener('click', function () { send(p, 'approved', null, b); });
      row.appendChild(b);
    } else {
      row.appendChild(el('span', 'st ' + p.state, p.state_label));
    }
    wrapAll.appendChild(row);
    // 완료·막힘이 아닌 곳은 어디서든 막힘을 알릴 수 있다 (예: 신청이 반려됨)
    if (p.state !== 'COMPLETE' && p.state !== 'NEED_HELP' && p.state !== 'NOT_STARTED') {
      wrapAll.appendChild(helpBox(p, true));
    }
    return wrapAll;
  }

  function render(view) {
    shownAt = Date.now();
    $('loading').hidden = true; $('fatal').hidden = true; $('app').hidden = false;
    $('hello').textContent = view.name + ' 사장님, 온라인 가게 등록입니다';
    $('bar').style.width = Math.round(view.done / view.total * 100) + '%';
    $('count').textContent = view.total + '곳 중 ' + view.done + '곳 완료';
    var now = $('now'); now.textContent = '';
    var list = $('list'); list.textContent = '';
    var focus = null;
    view.platforms.forEach(function (p) { if (p.is_focus) focus = p; });
    if (focus) {
      now.appendChild(nowCard(focus));
    } else {
      var rest = el('div', 'card');
      rest.appendChild(el('h2', '', view.done === view.total ? '모두 끝났습니다. 감사합니다.' : '지금은 하실 일이 없습니다.'));
      if (view.done !== view.total) rest.appendChild(el('p', 'sub', '결과 안내를 받으시면 아래에서 눌러주세요. 나머지는 딜루프가 진행하고 연락드리겠습니다.'));
      now.appendChild(rest);
    }
    view.platforms.forEach(function (p) { if (!p.is_focus) list.appendChild(listRow(p)); });
    list.hidden = !list.childNodes.length;
    var dates = view.platforms.map(function (p) { return p.last_verified_at; }).filter(Boolean).sort();
    $('version').textContent = (dates.length ? '안내 확인일 ' + dates[dates.length - 1] + ' · ' : '')
      + '화면이 안내와 다르면 "막혔어요"로 알려주세요.';
  }

  // 개발 확인용: 이 컴퓨터에서 연 페이지는 이 컴퓨터의 흉내 서버(dev_server.py)를 쓴다.
  var local = location.hostname === '127.0.0.1';
  if (local) ENDPOINT = location.origin + '/exec';
  if (!local && !/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(ENDPOINT)) {
    return fatal('안내 페이지를 준비하고 있습니다. 딜루프에 문의해 주세요.');
  }
  if (!/^[A-Za-z][\w-]{15,63}$/.test(token)) return fatal('링크가 완전하지 않습니다. 받으신 링크를 다시 눌러주세요.');
  api().then(function (view) {
    if (!view.ok) return fatal(view.error || '링크를 확인할 수 없습니다.');
    render(view);
    window.scrollTo(0, 0);
  }).catch(function () { fatal('연결하지 못했습니다. 잠시 후 다시 열어주세요.'); });

  // 다른 앱(네이버·당근)에 다녀오면 최신 상태로 다시 그린다. 글을 쓰는 중이면 건드리지 않는다.
  function comeBack() {
    if (document.visibilityState !== 'visible' || busy || Date.now() - shownAt < 15000) return;
    var a = document.activeElement;
    if (a && (a.tagName === 'TEXTAREA' || a.tagName === 'INPUT')) return;
    if ($('app').hidden) return;
    refresh();
  }
  document.addEventListener('visibilitychange', comeBack);
  window.addEventListener('pageshow', comeBack);
})();
