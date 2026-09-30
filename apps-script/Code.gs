// 딜루프랩스 상담 예약 수신 — Google 스프레드시트 > 확장 프로그램 > Apps Script 에 붙여넣고
// 배포 > 새 배포 > 유형 "웹 앱" / 실행: 나 / 액세스: 모든 사용자 로 배포한다.
// 메일 발송(MailApp)은 넣지 않는다 — 민감 권한이라 구글이 '앱 차단'한다. 알림은 시트의 '알림 규칙'으로 받는다.
/** @OnlyCurrentDoc */
const SHEET_NAME = '예약';
const HEAD = ['접수시각', '이름', '상호명', '휴대폰', '업종', '사업장 지역', '운영 채널', '가장 필요한 도움',
  '희망 날짜', '희망 시간대', '기타 문의', '개인정보 동의', '접수 경로', '처리 상태'];

function doPost(e) {
  const p = e.parameter || {};
  if (p.company_website) return ok_();                       // 스팸 봇 함정 칸
  if (!p.name || !p.shop || !p.phone || p.privacy_consent !== '동의함') return ok_();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
    if (sh.getLastRow() === 0) { sh.appendRow(HEAD); sh.setFrozenRows(1); }
    const clean = v => { v = String(v || '').slice(0, 1000); return /^[=+\-@]/.test(v) ? "'" + v : v; };
    const channels = ((e.parameters && e.parameters.channels) || []).join(', ');
    const row = [p.name, p.shop, p.phone, p.industry, p.region, channels, p.need,
      p.date, p.time, p.message, p.privacy_consent, p.source].map(clean);
    sh.appendRow([new Date()].concat(row, ['신규']));
    sh.getRange(sh.getLastRow(), 4).setNumberFormat('@').setValue(clean(p.phone));
  } finally {
    lock.releaseLock();
  }
  return ok_();
}

function doGet() { return ok_(); }
function ok_() { return ContentService.createTextOutput('ok'); }
