// 딜루프랩스 상담 예약 수신 — Google 스프레드시트 > 확장 프로그램 > Apps Script 에 붙여넣고
// 배포 > 새 배포 > 유형 "웹 앱" / 실행: 나 / 액세스: 모든 사용자 로 배포한다.
// MailApp 사용 없음. 저장 완료 후 SOLAPI로 대표님에게 접수 사실만 알린다.
// 인증 정보는 Apps Script 스크립트 속성에만 저장한다.
/** @OnlyCurrentDoc */
const SHEET_NAME = '예약';
const HEAD = ['접수시각', '이름', '상호명', '휴대폰', '업종', '사업장 지역', '운영 채널', '가장 필요한 도움',
  '희망 날짜', '희망 시간대', '기타 문의', '개인정보 동의', '접수 경로', '처리 상태'];

function doPost(e) {
  const p = e.parameter || {};
  if (p.company_website) return ok_();                       // 스팸 봇 함정 칸
  if (!p.name || !p.shop || !p.phone || p.privacy_consent !== '동의함') return ok_();
  let savedRow;
  let spreadsheet;
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    spreadsheet = ss;
    const sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
    if (sh.getLastRow() === 0) { sh.appendRow(HEAD); sh.setFrozenRows(1); }
    const clean = v => { v = String(v || '').slice(0, 1000); return /^[=+\-@]/.test(v) ? "'" + v : v; };
    const channels = ((e.parameters && e.parameters.channels) || []).join(', ');
    const row = [p.name, p.shop, p.phone, p.industry, p.region, channels, p.need,
      p.date, p.time, p.message, p.privacy_consent, p.source].map(clean);
    sh.appendRow([new Date()].concat(row, ['신규']));
    savedRow = sh.getLastRow();
    sh.getRange(savedRow, 4).setNumberFormat('@').setValue(clean(p.phone));
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
  // 문자 오류가 이미 저장된 상담의 접수를 실패로 바꾸지 않도록 분리한다.
  try {
    const result = notifyOwnerSms_();
    logOwnerSms_(spreadsheet, savedRow, result);
  } catch (error) {
    // 인증 정보/고객 입력을 실행 로그에 출력하지 않는다.
    console.error('Owner SMS notification failed after reservation was saved.');
  }
  return ok_();
}

function doGet() { return ok_(); }
function ok_() { return ContentService.createTextOutput('ok'); }

// 고객 연락처나 문의 내용은 문자 업체에 보내지 않는다.
// 발송 대상은 서버 설정의 대표님 번호로 고정한다.
const OWNER_SMS_TO = '01027415806';

function notifyOwnerSms_() {
  const config = PropertiesService.getScriptProperties().getProperties();
  if (config.OWNER_SMS_ENABLED !== 'true') return { status: '비활성', group: '' };
  if (!config.SOLAPI_API_KEY || !config.SOLAPI_API_SECRET || !config.SOLAPI_SENDER) {
    return { status: '설정 누락', group: '' };
  }
  const date = new Date().toISOString();
  const salt = Utilities.getUuid().replace(/-/g, '');
  const signature = Utilities.computeHmacSha256Signature(date + salt, config.SOLAPI_API_SECRET)
    .map(function (b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('');
  const text = '[딜루프] 새 상담 접수\n' + Utilities.formatDate(new Date(), 'Asia/Seoul', 'MM/dd HH:mm')
    + '\n상담 시트를 확인해주세요.';
  let response;
  try {
    // 응답 유실 시 중복 문자가 생길 수 있어 자동 재발송하지 않는다.
    response = UrlFetchApp.fetch('https://api.solapi.com/messages/v4/send-many/detail', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { Authorization: 'HMAC-SHA256 apiKey=' + config.SOLAPI_API_KEY
        + ', date=' + date + ', salt=' + salt + ', signature=' + signature },
      payload: JSON.stringify({ messages: [{ to: OWNER_SMS_TO,
        from: config.SOLAPI_SENDER.replace(/\D/g, ''), text: text, type: 'SMS' }],
        allowDuplicates: false, showMessageList: true })
    });
  } catch (error) {
    const message = String(error && error.message || '');
    const permission = /permission|authorization|권한|승인/i.test(message);
    return { status: permission ? '권한 승인 필요' : '결과 미확인', group: '' };
  }
  const code = response.getResponseCode();
  if (code >= 400 && code < 500) return { status: '발송 거절 (' + code + ')', group: '' };
  if (code < 200 || code >= 300) return { status: '결과 미확인 (' + code + ')', group: '' };
  let body;
  try { body = JSON.parse(response.getContentText()); }
  catch (error) { return { status: '결과 미확인', group: '' }; }
  const group = body.groupInfo && body.groupInfo.groupId || '';
  if (body.failedMessageList && body.failedMessageList.length) return { status: '발송 거절', group: group };
  const item = body.messageList && body.messageList[0];
  if (item && /^2/.test(String(item.statusCode))) return { status: '발송 접수', group: group };
  return { status: '결과 미확인', group: group };
}

function logOwnerSms_(ss, row, result) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = ss.getSheetByName('문자알림 로그') || ss.insertSheet('문자알림 로그');
    if (sh.getLastRow() === 0) {
      sh.appendRow(['시각', '예약 행', '결과', '발송 그룹']);
      sh.setFrozenRows(1);
    }
    sh.appendRow([new Date(), row, result.status, result.group]);
    sh.hideSheet();
  } finally { lock.releaseLock(); }
}

// 편집기에서 실행하는 연결 테스트. 상담 내역은 만들지 않는다.
function testOwnerSms() {
  const result = notifyOwnerSms_();
  console.log('Owner SMS test: ' + result.status);
}

// 외부 발송 없이 Google의 외부 연결 권한을 확인한다.
function checkOwnerSmsPermission() {
  try {
    UrlFetchApp.getRequest('https://api.solapi.com/messages/v4/send-many/detail', { method: 'post' });
    console.log('Owner SMS external-service permission: available');
  } catch (error) {
    console.log('Owner SMS external-service permission: approval required');
  }
}
