import fs from 'node:fs';
import path from 'node:path';
import config from '../config.js';

/**
 * 本地存储驱动：文件永久保存在服务器磁盘。
 * 对外 URL 为 /uploads/<key>，由服务端静态路由提供读取。
 */

function resolvePath(key) {
  // 防御目录穿越：只允许相对 key。
  const safe = path.normalize(String(key)).replace(/^(\.\.[/\\])+/, '');
  const full = path.join(config.uploadDir, safe);
  if (!full.startsWith(config.uploadDir)) {
    throw new Error('INVALID_STORAGE_KEY');
  }
  return full;
}

export async function put(key, buffer) {
  const full = resolvePath(key);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, buffer);
  return `/uploads/${String(key).split(path.sep).join('/')}`;
}

export async function remove(key) {
  const full = resolvePath(key);
  if (fs.existsSync(full)) fs.unlinkSync(full);
}

export function url(key) {
  return `/uploads/${String(key).split(path.sep).join('/')}`;
}

export function isLocal() {
  return true;
}

export const name = 'local';

