const crypto = require('crypto');

const HOST = 'visual.volcengineapi.com';
const REGION = 'cn-north-1';
const SERVICE = 'cv';

// Fixed order matching the official Go demo: host, x-date, x-content-sha256, content-type
const SIGNED_HEADER_NAMES = ['host', 'x-date', 'x-content-sha256', 'content-type'];

function hmac(key, data) {
  return crypto.createHmac('sha256', key).update(data).digest();
}

function sha256Hex(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function getSigningKey(secretKey, date) {
  const kDate    = hmac(secretKey, date);
  const kRegion  = hmac(kDate, REGION);
  const kService = hmac(kRegion, SERVICE);
  return hmac(kService, 'request');
}

function formatDate(d) {
  const pad = (n) => String(n).padStart(2, '0');
  const date =
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate());
  const time =
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds());
  return { date, xDate: `${date}T${time}Z` };
}

function buildCanonicalQuery(query) {
  return Object.keys(query)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(query[k])}`)
    .join('&');
}

function signRequest({ accessKey, secretKey, query, body }) {
  const now = new Date();
  const { date, xDate } = formatDate(now);
  const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
  const payloadHash = sha256Hex(bodyStr);

  // Header values in the fixed order required by the API
  const headerValues = {
    'host':             HOST,
    'x-date':           xDate,
    'x-content-sha256': payloadHash,
    'content-type':     'application/json',
  };

  const canonicalHeaders =
    SIGNED_HEADER_NAMES.map((k) => `${k}:${headerValues[k]}`).join('\n') + '\n';
  const signedHeaders = SIGNED_HEADER_NAMES.join(';');

  const canonicalRequest = [
    'POST',
    '/',
    buildCanonicalQuery(query),
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const credentialScope = `${date}/${REGION}/${SERVICE}/request`;
  const stringToSign = [
    'HMAC-SHA256',
    xDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const signingKey = getSigningKey(secretKey, date);
  const signature = crypto
    .createHmac('sha256', signingKey)
    .update(stringToSign)
    .digest('hex');

  const authorization =
    `HMAC-SHA256 Credential=${accessKey}/${credentialScope}` +
    `, SignedHeaders=${signedHeaders}` +
    `, Signature=${signature}`;

  return {
    // Host is used only for signing; the HTTP client sets it automatically
    headers: {
      'Content-Type':     'application/json',
      'X-Date':           xDate,
      'X-Content-Sha256': payloadHash,
      'Authorization':    authorization,
    },
    body: bodyStr,
  };
}

module.exports = { signRequest, HOST };
