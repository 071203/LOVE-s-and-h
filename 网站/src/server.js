import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import config, { ROOT_DIR } from './config.js';
import { handlePages } from './pages.js';
import { handleApi } from './api.js';
import { isAlbumAuthed } from './auth.js';
import storage from './storage/index.js';
import { text } from './util.js';

/**
 * HTTP 服务入口：负责静态资源、页面路由与 API 的分发。
 */

const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.glb': 'model/gltf-binary',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.flac': 'audio/flac',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.webm': 'audio/webm',
  '.txt': 'text/plain; charset=utf-8',
};

function mimeOf(filePath) {
  return MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function resolveStatic(root, urlPath) {
  // 去掉查询串后的路径，并防止目录穿越。
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const normalized = path.normalize(decoded).replace(/^([/\\])+/, '');
  const full = path.join(root, normalized);
  if (!full.startsWith(root)) return null;
  return full;
}

function parseRange(rangeHeader, size) {
  if (!rangeHeader) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!m) return { start: 0, end: size - 1 };
  let start = m[1] === '' ? undefined : Number(m[1]);
  let end = m[2] === '' ? undefined : Number(m[2]);
  if (start === undefined) {
    start = Math.max(size - end, 0);
    end = size - 1;
  } else if (end === undefined) {
    end = size - 1;
  }
  if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= size) {
    return { invalid: true };
  }
  end = Math.min(end, size - 1);
  return { start, end };
}

function serveFile(res, filePath, cacheControl) {
  return new Promise((resolve) => {
    fs.stat(filePath, (err, stat) => {
      if (err || !stat.isFile()) return resolve(false);
      const type = mimeOf(filePath);
      const isHead = res.req && res.req.method === 'HEAD';

      const range = parseRange(res.req.headers.range, stat.size);
      if (range && range.invalid) {
        res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` });
        res.end();
        return resolve(true);
      }

      const headers = {
        'Content-Type': type,
        'Cache-Control': cacheControl,
        'Accept-Ranges': 'bytes',
      };

      if (range) {
        const { start, end } = range;
        headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`;
        headers['Content-Length'] = end - start + 1;
        res.writeHead(206, headers);
        if (isHead) return res.end(), resolve(true);
        const stream = fs.createReadStream(filePath, { start, end });
        stream.pipe(res);
        stream.on('end', () => resolve(true));
        stream.on('error', () => resolve(true));
      } else {
        headers['Content-Length'] = stat.size;
        res.writeHead(200, headers);
        if (isHead) return res.end(), resolve(true);
        const stream = fs.createReadStream(filePath);
        stream.pipe(res);
        stream.on('end', () => resolve(true));
        stream.on('error', () => resolve(true));
      }
    });
  });
}

async function serveStatic(req, res, pathname) {
  // 公开静态资源
  if (
    pathname.startsWith('/css/') ||
    pathname.startsWith('/js/') ||
    pathname.startsWith('/vendor/') ||
    pathname.startsWith('/pets/') ||
    pathname === '/favicon.svg'
  ) {
    const filePath = resolveStatic(PUBLIC_DIR, pathname);
    if (filePath && (await serveFile(res, filePath, 'public, max-age=0, must-revalidate'))) {
      return true;
    }
  }
  // 本地存储的上传文件（仅 local 驱动时走这里）
  if (pathname.startsWith('/uploads/') && config.storageDriver === 'local') {
    const filePath = resolveStatic(config.uploadDir, pathname.replace(/^\/uploads\//, ''));
    if (filePath && (await serveFile(res, filePath, 'public, max-age=31536000, immutable'))) {
      return true;
    }
  }
  return false;
}

async function serveR2Media(req, res, pathname) {
  if (!pathname.startsWith('/media/') || typeof storage.get !== 'function') {
    return false;
  }
  let key;
  try {
    key = decodeURIComponent(pathname.slice('/media/'.length));
  } catch {
    text(res, 400, '400 · 无效的媒体路径');
    return true;
  }
  if (
    (key.startsWith('photos/') || key.startsWith('timeline/')) &&
    !isAlbumAuthed(req)
  ) {
    text(res, 401, '401 · 需要相册密码');
    return true;
  }

  try {
    const object = await storage.get(key, req.headers.range || '');
    const headers = {
      'Content-Type': object.contentType,
      'Content-Length': object.body.length,
      'Cache-Control':
        key.startsWith('photos/') || key.startsWith('timeline/')
          ? 'private, max-age=86400, immutable'
          : 'public, max-age=31536000, immutable',
      'Accept-Ranges': 'bytes',
    };
    if (object.contentRange) headers['Content-Range'] = object.contentRange;
    res.writeHead(object.status || 200, headers);
    res.end(req.method === 'HEAD' ? undefined : object.body);
  } catch (error) {
    if (String(error?.message || '').includes('404')) {
      text(res, 404, '404 · 图片不存在');
    } else {
      console.error('[r2-media]', error);
      text(res, 502, '502 · 图片读取失败');
    }
  }
  return true;
}

const server = http.createServer(async (req, res) => {
  const reqUrl = req.url || '/';
  const pathname = reqUrl.split('?')[0];
  const query = Object.fromEntries(new URLSearchParams(reqUrl.split('?')[1] || '').entries());

  try {
    // 静态资源优先
    if (await serveStatic(req, res, pathname)) return;
    if (await serveR2Media(req, res, pathname)) return;

    // API 路由
    if (pathname.startsWith('/api/')) {
      await handleApi(req, res, pathname, query);
      return;
    }

    // 页面路由
    if (handlePages(req, res, pathname)) return;

    text(res, 404, '404 · 页面不存在');
  } catch (err) {
    console.error('[server]', err);
    if (!res.headersSent) text(res, 500, '500 · 服务器错误');
    else res.end();
  }
});

// 确保上传目录存在
fs.mkdirSync(config.uploadDir, { recursive: true });

server.listen(config.port, () => {
  console.log('');
  console.log('  ❤  小时光 · 情侣纪念网站已启动');
  console.log(`     本机访问：http://localhost:${config.port}`);
  console.log(`     存储驱动：${config.storageDriver}`);
  console.log(`     管理后台：http://localhost:${config.port}/admin`);
  console.log('');
});

export default server;

