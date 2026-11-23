import config from './config.js';
import { signToken, verifyToken } from './util.js';

/**
 * 无状态登录鉴权：使用 HMAC 签名的 Cookie，服务端重启也不会失效。
 */

const COOKIE_ALBUM = 'ut_album';
const COOKIE_ADMIN = 'ut_admin';
const COOKIE_TTL = 60 * 60 * 24 * 30; // 30 天

export function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

function verifyCookie(req, name) {
  const cookies = parseCookies(req);
  const token = cookies[name];
  const payload = verifyToken(token, config.sessionSecret, COOKIE_TTL);
  return payload || null;
}

export function isAlbumAuthed(req) {
  const payload = verifyCookie(req, COOKIE_ALBUM);
  return Boolean(payload && payload.p === 'album');
}

export function isAdminAuthed(req) {
  const payload = verifyCookie(req, COOKIE_ADMIN);
  return Boolean(payload && payload.p === 'admin');
}

function cookieHeader(name, value, maxAge) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

export function setAlbumCookie(res) {
  const token = signToken({ p: 'album', exp: Math.floor(Date.now() / 1000) + COOKIE_TTL }, config.sessionSecret);
  res.setHeader('Set-Cookie', cookieHeader(COOKIE_ALBUM, token, COOKIE_TTL));
}

export function setAdminCookie(res) {
  const token = signToken({ p: 'admin', exp: Math.floor(Date.now() / 1000) + COOKIE_TTL }, config.sessionSecret);
  res.setHeader('Set-Cookie', cookieHeader(COOKIE_ADMIN, token, COOKIE_TTL));
}

export function clearAuthCookie(res, name) {
  res.setHeader('Set-Cookie', `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

