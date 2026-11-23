import crypto from 'node:crypto';
import config from '../config.js';

const EMPTY_SHA256 =
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

function sha256Hex(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function hmac(key, value) {
  return crypto.createHmac('sha256', key).update(value).digest();
}

function rfc3986(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function amzTimestamp(date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

function canonicalUri(url) {
  return (
    '/' +
    url.pathname
      .split('/')
      .map((segment) => rfc3986(decodeURIComponent(segment)))
      .join('/')
  ).replace(/^\/+/, '/');
}

function canonicalQuery(url) {
  return [...url.searchParams.entries()]
    .map(([key, value]) => [rfc3986(key), rfc3986(value)])
    .sort(([aKey, aValue], [bKey, bValue]) =>
      aKey === bKey ? aValue.localeCompare(bValue) : aKey.localeCompare(bKey)
    )
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
}

function normalizeHeaders(headers, url, amzDate, payloadHash) {
  const normalized = {};
  for (const [name, value] of Object.entries(headers || {})) {
    normalized[name.toLowerCase()] = String(value).trim().replace(/\s+/g, ' ');
  }
  normalized.host = url.host;
  normalized['x-amz-date'] = normalized['x-amz-date'] || amzDate;
  normalized['x-amz-content-sha256'] =
    normalized['x-amz-content-sha256'] || payloadHash;
  return normalized;
}

export function signAwsV4({
  method,
  url: rawUrl,
  headers = {},
  payloadHash = EMPTY_SHA256,
  accessKeyId,
  secretAccessKey,
  region = 'auto',
  service = 's3',
  timestamp = new Date(),
}) {
  const url = typeof rawUrl === 'string' ? new URL(rawUrl) : rawUrl;
  const amzDate = amzTimestamp(timestamp);
  const date = amzDate.slice(0, 8);
  const signed = normalizeHeaders(headers, url, amzDate, payloadHash);
  const names = Object.keys(signed).sort();
  const signedHeaders = names.join(';');
  const canonicalHeaders = names
    .map((name) => `${name}:${signed[name]}\n`)
    .join('');
  const canonicalRequest = [
    String(method).toUpperCase(),
    canonicalUri(url),
    canonicalQuery(url),
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');
  const credentialScope = `${date}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');
  const signingKey = hmac(
    hmac(hmac(hmac(`AWS4${secretAccessKey}`, date), region), service),
    'aws4_request'
  );
  const signature = crypto
    .createHmac('sha256', signingKey)
    .update(stringToSign)
    .digest('hex');

  return {
    amzDate,
    canonicalRequest,
    signature,
    signedHeaders,
    headers: signed,
    authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

function cleanKey(rawKey) {
  const key = String(rawKey || '').replace(/^\/+/, '');
  const segments = key.split('/');
  if (!key || segments.some((segment) => !segment || segment === '..' || segment === '.')) {
    throw new Error('INVALID_STORAGE_KEY');
  }
  return key;
}

function encodeKey(key) {
  return cleanKey(key).split('/').map(rfc3986).join('/');
}

function requireValue(value, message) {
  if (!value) throw new Error(message);
  return value;
}

export function createR2Driver(options = {}) {
  const accountId = options.accountId ?? config.r2.accountId;
  const accessKeyId = options.accessKeyId ?? config.r2.accessKeyId;
  const secretAccessKey = options.secretAccessKey ?? config.r2.secretAccessKey;
  const bucket = options.bucket ?? config.r2.bucket;
  const publicBaseUrl = String(options.publicBaseUrl ?? config.r2.publicBaseUrl ?? '').replace(
    /\/+$/,
    ''
  );
  const fetchImpl = options.fetchImpl || fetch;
  const now = options.now || (() => new Date());

  function assertConfig() {
    requireValue(accountId, '缺少 R2_ACCOUNT_ID');
    requireValue(accessKeyId, '缺少 R2_ACCESS_KEY_ID');
    requireValue(secretAccessKey, '缺少 R2_SECRET_ACCESS_KEY');
    requireValue(bucket, '缺少 R2_BUCKET');
  }

  function endpoint(key) {
    assertConfig();
    return `https://${accountId}.r2.cloudflarestorage.com/${rfc3986(bucket)}/${encodeKey(key)}`;
  }

  function url(key) {
    assertConfig();
    const encoded = encodeKey(key);
    return publicBaseUrl ? `${publicBaseUrl}/${encoded}` : `/media/${encoded}`;
  }

  async function request(method, key, buffer, contentType, extraHeaders = {}) {
    const target = endpoint(key);
    const payloadHash = buffer ? sha256Hex(buffer) : EMPTY_SHA256;
    const timestamp = now();
    const baseHeaders = {
      ...extraHeaders,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzTimestamp(timestamp),
    };
    if (contentType) baseHeaders['Content-Type'] = contentType;
    const signed = signAwsV4({
      method,
      url: target,
      headers: baseHeaders,
      payloadHash,
      accessKeyId,
      secretAccessKey,
      region: 'auto',
      service: 's3',
      timestamp,
    });
    const headers = {
      ...baseHeaders,
      Authorization: signed.authorization,
    };
    const response = await fetchImpl(target, {
      method,
      headers,
      body: method === 'DELETE' ? undefined : buffer,
    });
    if (!response.ok && !(method === 'DELETE' && response.status === 404)) {
      throw new Error(`R2 ${method} 失败：${response.status} ${await response.text()}`);
    }
    return response;
  }

  return {
    name: 'r2',
    url,
    async get(key, range = '') {
      const requestHeaders = range ? { Range: range } : {};
      const response = await request('GET', key, undefined, null, requestHeaders);
      return {
        body: Buffer.from(await response.arrayBuffer()),
        contentType:
          response.headers.get('content-type') || 'application/octet-stream',
        contentRange: response.headers.get('content-range') || '',
        status: response.status,
      };
    },
    async put(key, buffer, contentType = 'application/octet-stream') {
      await request('PUT', key, buffer, contentType);
      return url(key);
    },
    async remove(key) {
      await request('DELETE', key);
    },
  };
}

const defaultDriver = createR2Driver();

export const put = defaultDriver.put;
export const remove = defaultDriver.remove;
export const url = defaultDriver.url;
export const get = defaultDriver.get;
export const name = defaultDriver.name;
