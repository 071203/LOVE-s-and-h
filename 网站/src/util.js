import crypto from 'node:crypto';

/**
 * 通用工具函数集合。
 */

/** 生成随机字符串（用于文件名 / 口令等）。 */
export function randomId(bytes = 8) {
  return crypto.randomBytes(bytes).toString('hex');
}

/** 将任意文本安全转为 slug（用于存储路径）。 */
export function slugify(text) {
  return String(text || '')
    .normalize('NFKD')
    .replace(/[^\w\u4e00-\u9fa5-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
    .toLowerCase();
}

/** 从文件名安全提取扩展名，无法识别时返回空字符串。 */
export function extOf(name = '') {
  const m = /\.([a-zA-Z0-9]{1,8})$/.exec(name);
  return m ? m[1].toLowerCase() : '';
}

/** 判断 MIME 是否为图片。 */
export function isImage(mime = '') {
  return mime.startsWith('image/');
}

/** 判断 MIME 是否为音频。 */
export function isAudio(mime = '') {
  return mime.startsWith('audio/') || mime === 'application/octet-stream';
}

/** 判断扩展名是否为音频（配合 application/octet-stream 兜底）。 */
export function isAudioExt(ext = '') {
  return ['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg', 'webm', 'opus'].includes(ext);
}

/** 转义 HTML 特殊字符，防止注入。 */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 简单防注入：用于作为 HTML attribute 时二次兜底。 */
export function attr(value) {
  return escapeHtml(value);
}

/** 仅放行安全的 CSS 颜色值，防止在 style 属性中注入。 */
export function sanitizeColor(value) {
  const v = String(value || '').trim();
  if (/^#[0-9a-fA-F]{3,8}$/.test(v)) return v;
  if (/^rgba?\([\d\s.,%]+\)$/.test(v)) return v;
  const named = new Set([
    'white', 'black', 'transparent', 'red', 'pink', 'rose', 'coral',
    'orange', 'gold', 'yellow', 'green', 'teal', 'cyan', 'skyblue',
    'blue', 'navy', 'purple', 'magenta', 'brown', 'gray', 'grey',
  ]);
  if (named.has(v.toLowerCase())) return v;
  return '';
}

/** 读取请求体为 Buffer（支持流式拼接）。 */
export function readBody(req, limit = 64 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('BODY_TOO_LARGE'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/** 解析 JSON 请求体。 */
export async function readJson(req, limit = 1024 * 1024) {
  const buf = await readBody(req, limit);
  if (!buf.length) return {};
  return JSON.parse(buf.toString('utf8'));
}

/** 把对象安全序列化为 JSON。 */
export function json(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
  return true;
}

/** 输出纯文本。 */
export function text(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Content-Length': Buffer.byteLength(body) });
  res.end(res.req && res.req.method === 'HEAD' ? undefined : body);
}

/** 输出 HTML。 */
export function html(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(res.req && res.req.method === 'HEAD' ? undefined : body);
}

/** 解析 URL 查询字符串。 */
export function parseQuery(url) {
  const idx = url.indexOf('?');
  const query = idx === -1 ? '' : url.slice(idx + 1);
  const params = new URLSearchParams(query);
  const out = {};
  for (const [k, v] of params) out[k] = v;
  return out;
}

/** 格式化字节数。 */
export function formatBytes(n) {
  const num = Number(n) || 0;
  if (num < 1024) return `${num} B`;
  const units = ['KB', 'MB', 'GB'];
  let i = -1;
  let v = num;
  do {
    v /= 1024;
    i += 1;
  } while (v >= 1024 && i < units.length - 1);
  return `${v.toFixed(1)} ${units[i]}`;
}

/** 生成简单的时间字符串。 */
export function nowIso() {
  return new Date().toISOString();
}

/** 两个日期（YYYY-MM-DD）之间的天数差。 */
export function diffDays(from, to = new Date()) {
  const a = new Date(`${from}T00:00:00`);
  const b = new Date(to);
  b.setHours(0, 0, 0, 0);
  if (Number.isNaN(a.getTime())) return 0;
  return Math.floor((b - a) / 86400000);
}

/** 格式化日期为「2026年5月20日」。 */
export function formatDateCn(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

/** HMAC-SHA256 十六进制。 */
export function hmacSha256(secret, data) {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

/** Base64URL 编码。 */
export function base64Url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Base64URL 解码。 */
export function base64UrlDecode(input) {
  let s = input.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Buffer.from(s, 'base64');
}

/**
 * 签名的登录 Cookie 工具。
 * token = base64url(JSON payload) + "." + hmac
 */
export function signToken(payload, secret) {
  const data = base64Url(JSON.stringify(payload));
  return `${data}.${hmacSha256(secret, data)}`;
}

export function verifyToken(token, secret, ttlSeconds = 0) {
  if (!token || typeof token !== 'string') return null;
  const dot = token.lastIndexOf('.');
  if (dot === -1) return null;
  const data = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expect = hmacSha256(secret, data);
  const a = Buffer.from(sig, 'hex');
  const b = Buffer.from(expect, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(base64UrlDecode(data).toString('utf8'));
    if (ttlSeconds > 0 && payload.exp && payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

