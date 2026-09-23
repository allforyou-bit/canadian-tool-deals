/**
 * @OnlyCurrentDoc
 *
 * Lead capture web app for the quote form (Google Apps Script).
 *
 * What it does
 *   1. Receives the quote-form JSON that components/QuoteTool.tsx POSTs to NEXT_PUBLIC_LEAD_ENDPOINT.
 *      The site sends it with fetch mode "no-cors" and Content-Type text/plain, so the body arrives
 *      as a plain string in e.postData.contents and the browser never sees our reply.
 *   2. Drops the request if the honeypot field "website" is filled in (a bot filled a hidden field).
 *   3. If the Script Property TURNSTILE_SECRET is set, checks the Cloudflare Turnstile token with
 *      Cloudflare's siteverify endpoint. Failed checks go to a "Rejected" tab, not to "Leads",
 *      and no email is sent.
 *   4. Appends one row to the "Leads" tab (the header row is created if missing).
 *   5. Emails the owner (Script Property OWNER_EMAIL) a plain-text summary with MailApp.
 *
 * The payload shape is defined in lib/lead.ts (LeadPayload). Keep LEAD_FIELDS below in sync with it.
 *
 * Setup: see integrations/google-apps-script/README.md (Korean, step by step).
 *
 * Script Properties (Project Settings → Script Properties):
 *   OWNER_EMAIL       required  where lead notifications go
 *   TURNSTILE_SECRET  optional  Cloudflare Turnstile SECRET key. Set it only together with
 *                               NEXT_PUBLIC_TURNSTILE_SITE_KEY on the site, never one without the other.
 *   BRAND             optional  name used in notification emails (default below)
 *
 * NOT VERIFIED: Apps Script quotas (emails per day, URL fetch calls, execution time, simultaneous
 * executions) were not checked in the business research. Read Google's current quota page before
 * relying on this for volume. If MailApp hits a quota the row is still saved and the failure is
 * written to the "notifyResult" column.
 *
 * Privacy: the sheet holds personal information (names, phone numbers, addresses). Keep it private.
 * Nothing personal is written to the execution log.
 */

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

const SHEET_NAME = 'Leads';
const REJECTED_SHEET_NAME = 'Rejected';

/** Keep submissions that failed the Turnstile check in the "Rejected" tab so a real customer is not lost silently. */
const KEEP_TURNSTILE_REJECTS = true;

/** Used in notification emails when the BRAND Script Property is not set. Matches config/business.ts defaults. */
const DEFAULT_BRAND = 'Neighbourhood Home Care / 우리동네 홈케어';

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/** Size guards (our own limits, not a Google or Cloudflare rule). */
const MAX_BODY_CHARS = 60000;
const MAX_SHORT_CHARS = 1000;
const MAX_LONG_CHARS = 5000;
const LONG_FIELDS = ['selections', 'notes', 'marketingConsentText', 'turnstileToken'];

/**
 * Every field of LeadPayload in lib/lead.ts, in the same order. The sheet gets one column per field.
 * If you add a field to lib/lead.ts, add it here too; the next submission adds the new column at the end.
 */
const LEAD_FIELDS = [
  'v',
  'submittedAt',
  'lang',
  'page',
  'service',
  'selections',
  'estimateLow',
  'estimateHigh',
  'name',
  'phone',
  'email',
  'address',
  'preferredDates',
  'notes',
  'marketingOptIn',
  'marketingConsentText',
  'turnstileToken',
  'website',
];

const NUMBER_FIELDS = ['v', 'estimateLow', 'estimateHigh'];

/**
 * Sheet columns: server receive time first, then every payload field, then server-side results.
 *   serverReceivedAt  when this script received the request (spreadsheet time zone)
 *   turnstileResult   "verified (...)", "not checked (...)", "error, stored unverified: ..." or "failed: ..."
 *   receiveDelaySec   seconds from submittedAt (customer's device clock) to serverReceivedAt; used for the
 *                     20-submission latency test. Only as accurate as the customer's clock.
 *   notifyResult      whether the owner email was sent
 *
 * CASL consent evidence = marketingOptIn + marketingConsentText (the exact wording shown next to the
 * checkbox) + submittedAt/serverReceivedAt + page + lang. Do not edit or delete these cells: under CASL the
 * sender has to prove consent (s.13, decision memo F11).
 */
const HEADERS = ['serverReceivedAt'].concat(LEAD_FIELDS, ['turnstileResult', 'receiveDelaySec', 'notifyResult']);

const SERVICE_LABELS = {
  cleaning: '청소 / Cleaning',
  gutters: '홈통 청소 / Gutter cleaning',
  snow: '제설 / Snow clearing',
  other: '기타 / Other',
};

// ---------------------------------------------------------------------------
// Web app entry points
// ---------------------------------------------------------------------------

/** Health check: open the /exec URL in a browser and you should see "ok". */
function doGet() {
  return ContentService.createTextOutput('ok').setMimeType(ContentService.MimeType.TEXT);
}

/**
 * Quote form submissions. The site cannot read this reply (no-cors), but it helps when testing with curl.
 */
function doPost(e) {
  let raw;
  try {
    const body = e && e.postData && typeof e.postData.contents === 'string' ? e.postData.contents : '';
    if (!body) return reply_({ ok: false, error: 'empty-body' });
    if (body.length > MAX_BODY_CHARS) return reply_({ ok: false, error: 'too-large' });
    raw = JSON.parse(body);
  } catch (err) {
    return reply_({ ok: false, error: 'bad-json' });
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return reply_({ ok: false, error: 'bad-json' });
  }
  try {
    return reply_(handleLead_(raw, { skipTurnstile: false }));
  } catch (err) {
    console.error('doPost failed: ' + (err && err.message ? err.message : err));
    return reply_({ ok: false, error: 'server-error' });
  }
}

// ---------------------------------------------------------------------------
// Editor helper
// ---------------------------------------------------------------------------

/**
 * Run this once from the Apps Script editor (select "testSetup" → Run). It:
 *   - asks you to approve the permissions (this sheet, send email, call Cloudflare),
 *   - creates the "Leads" tab and its header row,
 *   - writes one TEST row and sends one test email to OWNER_EMAIL.
 * The Turnstile check is skipped for this editor test only. Delete the TEST row afterwards.
 */
function testSetup() {
  if (!prop_('OWNER_EMAIL')) {
    throw new Error('Set the Script Property OWNER_EMAIL first (Project Settings → Script Properties).');
  }
  const sample = {
    v: 1,
    submittedAt: new Date().toISOString(),
    lang: 'ko',
    page: '/editor-test',
    service: 'other',
    selections: 'TEST from the Apps Script editor. Delete this row.',
    estimateLow: null,
    estimateHigh: null,
    name: 'TEST (delete me)',
    phone: '',
    email: '',
    address: '',
    preferredDates: '',
    notes: 'Sent by testSetup().',
    marketingOptIn: false,
    marketingConsentText: '',
    turnstileToken: '',
    website: '',
  };
  const result = handleLead_(sample, { skipTurnstile: true });
  console.log('testSetup result: ' + JSON.stringify(result));
}

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

function handleLead_(raw, opts) {
  const p = normalizePayload_(raw);

  // 1. Honeypot: the "website" field is hidden from people, so only bots fill it in. Store nothing.
  if (p.website.trim() !== '') {
    console.warn('Rejected: honeypot field filled');
    return { ok: false, error: 'rejected' };
  }

  // 2. A lead with no way to reach the person is useless.
  if (!p.name.trim() && !p.phone.trim() && !p.email.trim()) {
    console.warn('Rejected: no name, phone or email');
    return { ok: false, error: 'missing-contact' };
  }

  // 3. Turnstile (only when TURNSTILE_SECRET is set).
  const ts = opts && opts.skipTurnstile
    ? { pass: true, result: 'not checked (editor test)' }
    : checkTurnstile_(p.turnstileToken);

  const now = new Date();
  const record = buildRecord_(p, now, ts.result);

  if (!ts.pass) {
    if (KEEP_TURNSTILE_REJECTS) {
      record.notifyResult = 'not sent (rejected)';
      writeRow_(REJECTED_SHEET_NAME, record);
    }
    console.warn('Rejected: Turnstile ' + ts.result);
    return { ok: false, error: 'turnstile' };
  }

  // 4. Save first, email second: a mail failure must never lose the lead.
  record.notifyResult = 'pending';
  const written = writeRow_(SHEET_NAME, record);

  // 5. Tell the owner.
  const flags = [];
  if (p.v !== 1) flags.push('payload version ' + p.v + ' (this script expects 1: check lib/lead.ts)');
  if (ts.result.indexOf('error') === 0) flags.push('Turnstile check could not run: ' + ts.result);
  const notify = notifyOwner_(p, record, written, flags);
  if (written.row) setCell_(written, 'notifyResult', notify);

  return { ok: true };
}

/** Coerce the incoming object to exactly the LeadPayload fields with safe types. Unknown keys are ignored. */
function normalizePayload_(raw) {
  const p = {};
  LEAD_FIELDS.forEach(function (k) {
    const val = raw[k];
    if (NUMBER_FIELDS.indexOf(k) !== -1) {
      p[k] = typeof val === 'number' && isFinite(val) ? val : null;
    } else if (k === 'marketingOptIn') {
      // Only a real boolean true counts as express consent. Anything else is "no".
      p[k] = val === true;
    } else {
      const limit = LONG_FIELDS.indexOf(k) !== -1 ? MAX_LONG_CHARS : MAX_SHORT_CHARS;
      p[k] = val === undefined || val === null ? '' : String(val).slice(0, limit);
    }
  });
  return p;
}

/** One sheet row as { header: value }. */
function buildRecord_(p, now, turnstileResult) {
  const record = { serverReceivedAt: now };
  LEAD_FIELDS.forEach(function (k) {
    record[k] = p[k];
  });
  // The token is single-use and worthless once checked, and it is long. Keep only a short prefix
  // so the column still shows whether a token was sent.
  record.turnstileToken = p.turnstileToken
    ? p.turnstileToken.slice(0, 12) + '… (' + p.turnstileToken.length + ' chars)'
    : '';
  record.turnstileResult = turnstileResult;
  const sent = Date.parse(p.submittedAt);
  record.receiveDelaySec = isNaN(sent) ? '' : Math.round((now.getTime() - sent) / 100) / 10;
  record.notifyResult = '';
  return record;
}

// ---------------------------------------------------------------------------
// Cloudflare Turnstile
// ---------------------------------------------------------------------------

/**
 * Returns { pass, result }.
 *   No TURNSTILE_SECRET        → pass (not checked).
 *   Secret set, no token       → fail (a scripted POST without a token is blocked).
 *   Cloudflare says success    → pass.
 *   Cloudflare says failure    → fail, except errors that mean OUR setup is wrong or Cloudflare had a
 *                                problem: then the lead is kept and flagged, so a typo in the secret
 *                                cannot silently discard every real customer.
 * Error-code names follow Cloudflare's siteverify documentation (not re-checked in the business research).
 */
function checkTurnstile_(token) {
  const secret = prop_('TURNSTILE_SECRET');
  if (!secret) return { pass: true, result: 'not checked (no TURNSTILE_SECRET)' };
  if (!token) return { pass: false, result: 'failed: no token' };

  let res;
  try {
    res = UrlFetchApp.fetch(SITEVERIFY_URL, {
      method: 'post',
      payload: { secret: secret, response: token }, // sent as a form body
      muteHttpExceptions: true,
    });
  } catch (err) {
    return { pass: true, result: 'error, stored unverified: ' + (err && err.message ? err.message : err) };
  }

  let data = null;
  try {
    data = JSON.parse(res.getContentText());
  } catch (err) {
    data = null;
  }
  if (!data || typeof data.success !== 'boolean') {
    return { pass: true, result: 'error, stored unverified: HTTP ' + res.getResponseCode() };
  }
  if (data.success === true) {
    return { pass: true, result: 'verified' + (data.hostname ? ' (' + data.hostname + ')' : '') };
  }

  const codes = Array.isArray(data['error-codes']) ? data['error-codes'] : [];
  const ourProblem = ['missing-input-secret', 'invalid-input-secret', 'internal-error'];
  if (codes.some(function (c) { return ourProblem.indexOf(c) !== -1; })) {
    return { pass: true, result: 'error, stored unverified: ' + codes.join(', ') + ' (check TURNSTILE_SECRET)' };
  }
  return { pass: false, result: 'failed: ' + (codes.join(', ') || 'unknown') };
}

// ---------------------------------------------------------------------------
// Sheet
// ---------------------------------------------------------------------------

function getSheet_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error('No spreadsheet. Create this script from the Google Sheet (Extensions → Apps Script).');
  }
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

/**
 * Makes sure row 1 holds the headers. Creates it on an empty tab; on an existing tab it only appends
 * missing headers at the end, so columns the owner added (e.g. "contacted", "unsubscribed") are kept.
 * Returns the header list in sheet order.
 */
function ensureHeaders_(sheet) {
  if (sheet.getLastRow() === 0) {
    const range = sheet.getRange(1, 1, 1, HEADERS.length);
    range.setValues([HEADERS]);
    range.setFontWeight('bold');
    sheet.setFrozenRows(1);
    return HEADERS.slice();
  }
  let headers = sheet
    .getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1))
    .getValues()[0]
    .map(function (h) { return String(h).trim(); });
  while (headers.length && headers[headers.length - 1] === '') headers.pop();
  const missing = HEADERS.filter(function (h) { return headers.indexOf(h) === -1; });
  if (missing.length) {
    const range = sheet.getRange(1, headers.length + 1, 1, missing.length);
    range.setValues([missing]);
    range.setFontWeight('bold');
    headers = headers.concat(missing);
  }
  return headers;
}

/** Appends the record under a script lock so two submissions at once cannot clash. */
function writeRow_(sheetName, record) {
  const lock = LockService.getScriptLock();
  const locked = lock.tryLock(20000);
  try {
    const sheet = getSheet_(sheetName);
    const headers = ensureHeaders_(sheet);
    const row = headers.map(function (h) {
      return Object.prototype.hasOwnProperty.call(record, h) ? cellValue_(record[h]) : '';
    });
    sheet.appendRow(row);
    // Without the lock another row may have landed after ours, so only remember the row number when locked.
    return { sheet: sheet, headers: headers, row: locked ? sheet.getLastRow() : 0 };
  } finally {
    if (locked) lock.releaseLock();
  }
}

function setCell_(written, header, value) {
  const col = written.headers.indexOf(header);
  if (col === -1) return;
  written.sheet.getRange(written.row, col + 1).setValue(cellValue_(value));
}

/**
 * Text is stored with a leading apostrophe so Sheets keeps it exactly as typed: a phone number like
 * "+1 416…" or a note starting with "=" stays text instead of becoming a formula or a number.
 * The apostrophe is not shown in the cell.
 */
function cellValue_(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v === '' ? '' : "'" + v;
  return v; // numbers, booleans, Date
}

// ---------------------------------------------------------------------------
// Owner email
// ---------------------------------------------------------------------------

function notifyOwner_(p, record, written, flags) {
  const to = prop_('OWNER_EMAIL');
  if (!to) return 'skipped: OWNER_EMAIL not set';
  try {
    const brand = prop_('BRAND') || DEFAULT_BRAND;
    const service = SERVICE_LABELS[p.service] || p.service || '?';
    const subject =
      (flags.length ? '[확인 CHECK] ' : '') +
      '[' + brand + '] 견적 요청 / Quote request: ' + service + ' — ' + oneLine_(p.name || p.phone || p.email);
    const body = emailBody_(p, record, written, brand, service, flags);
    const options = { name: brand };
    if (looksLikeEmail_(p.email)) options.replyTo = p.email; // "Reply" goes straight to the customer
    MailApp.sendEmail(to, subject, body, options);
    return 'sent ' + fmtTime_(new Date());
  } catch (err) {
    return 'failed: ' + (err && err.message ? err.message : err);
  }
}

function emailBody_(p, record, written, brand, service, flags) {
  const est = p.estimateLow !== null
    ? '$' + p.estimateLow + '–$' + p.estimateHigh + ' (계산기 추정치, 세금 전, 현장 확인 전 / calculator estimate before tax, not confirmed on site)'
    : '없음 / no estimate';
  const lines = [];
  lines.push(brand + ' — 새 견적 요청 / New quote request');
  lines.push('');
  if (flags.length) {
    lines.push('확인 필요 / Check:');
    flags.forEach(function (f) { lines.push('  - ' + f); });
    lines.push('');
  }
  lines.push('서비스 / Service: ' + service);
  lines.push('예상 금액 / Estimate: ' + est);
  lines.push('선택 내용 / Selections:');
  lines.push(indent_(p.selections || '-'));
  lines.push('');
  lines.push('이름 / Name: ' + (p.name || '-'));
  lines.push('전화 / Phone: ' + (p.phone || '-'));
  lines.push('이메일 / Email: ' + (p.email || '-'));
  lines.push('주소 / Address: ' + (p.address || '-'));
  lines.push('희망 날짜 / Preferred dates: ' + (p.preferredDates || '-'));
  lines.push('메모 / Notes:');
  lines.push(indent_(p.notes || '-'));
  lines.push('');
  lines.push('언어 / Language: ' + (p.lang === 'ko' ? 'ko (한국어로 답장 / reply in Korean)' : p.lang === 'en' ? 'en (reply in English)' : p.lang || '-'));
  lines.push('페이지 / Page: ' + (p.page || '-'));
  lines.push('제출 시각(고객 기기) / Submitted (customer device): ' + (p.submittedAt || '-'));
  lines.push('수신 시각(서버) / Received (server): ' + fmtTime_(record.serverReceivedAt));
  lines.push('지연 / Delay: ' + (record.receiveDelaySec === '' ? '-' : record.receiveDelaySec + ' s'));
  lines.push('Turnstile: ' + record.turnstileResult);
  lines.push('');
  lines.push('마케팅 수신 동의 / Marketing consent:');
  if (p.marketingOptIn) {
    lines.push('  예 — 명시적 동의가 시트에 기록되었습니다. / YES — express consent recorded in the sheet.');
    lines.push('  고객에게 보인 문구 / Wording shown: "' + oneLine_(p.marketingConsentText) + '"');
  } else {
    lines.push('  아니요 — 명시적 동의 없음. 이 문의에 답장하고 견적을 보내는 것은 괜찮습니다.');
    lines.push('  홍보 메시지는 문의일로부터 6개월간의 묵시적 동의만 적용됩니다 (CASL s.10(10), 결정 메모 F11).');
    lines.push('  NO — no express consent. You may reply to this inquiry and send the quote. For promotions, only');
    lines.push('  the 6-month implied consent from this inquiry applies (CASL s.10(10), decision memo F11).');
  }
  lines.push('');
  lines.push('답장 전 확인 / Before you reply:');
  lines.push('  - 문자·이메일마다 ' + brand + ', 우편 주소, 전화·이메일·웹 연락처, 수신거부 문구를 넣으세요');
  lines.push('    (문자: "Reply STOP to opt out"). CASL, 결정 메모 F11–F13.');
  lines.push('    Every SMS/email needs the business name, mailing address, a phone/email/web contact and an');
  lines.push('    unsubscribe line. CASL, decision memo F11–F13.');
  lines.push('  - 결정 메모의 목표: 1시간 안에 답장. / Decision-memo target: reply within 1 hour.');
  lines.push('  - 개인정보입니다. 시트를 공유하지 마세요. / This is personal information. Do not share the sheet.');
  lines.push('');
  try {
    lines.push('시트 / Sheet: ' + written.sheet.getParent().getUrl() + '#gid=' + written.sheet.getSheetId() +
      (written.row ? ' (row ' + written.row + ')' : ''));
  } catch (err) {
    // the link is a convenience only
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function prop_(name) {
  const v = PropertiesService.getScriptProperties().getProperty(name);
  return v ? String(v).trim() : '';
}

function reply_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function fmtTime_(d) {
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss z');
}

function oneLine_(s) {
  return String(s || '').replace(/\s+/g, ' ').trim().slice(0, 200);
}

function indent_(s) {
  return String(s)
    .split(/\r?\n/)
    .map(function (line) { return '  ' + line; })
    .join('\n');
}

function looksLikeEmail_(s) {
  return /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(String(s || '').trim());
}
