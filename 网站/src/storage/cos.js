import crypto from 'node:crypto';
import config from '../config.js';

/**
 * 腾讯云 COS 对象存储驱动。
 * 仅使用 Node 内置 crypto 实现签名，无需安装官方 SDK。
 */

function sha1hex(input) {
  return crypto.createHash('sha1').update(input).digest('hex');
}

function canonicalPath(key) {
  return (
    '/' +
    String(key)
      .split('/')
      .map((seg) => encodeURIComponent(seg))
      .join('/')
  );
}

function host() {
  const { bucket, region } = config.cos;
  if (!bucket || !region) {
    throw new Error('缺少 COS 配置：请设置 COS_BUCKET 与 COS_REGION');
  }
  return `${bucket}.cos.${region}.myqcloud.com`;
}

function sign(method, key, contentType, extraHeaders = {}) {
  const { secretId, secretKey } = config.cos;
  if (!secretId || !secretKey) {
    throw new Error('缺少 COS 密钥：请设置 COS_SECRET_ID 与 COS_SECRET_KEY');
  }
  const now = Math.floor(Date.now() / 1000);
  const keyTime = `${now};${now + 3600}`;

  const headerMap = { host: host(), ...extraHeaders };
  if (contentType) headerMap['content-type'] = contentType;
  const headerKeys = Object.keys(headerMap).sort();
  const headerList = headerKeys.join(';');
  const headerString = headerKeys
    .map((k) => `${k}=${encodeURIComponent(headerMap[k])}`)
    .join('&');

  const httpString = `${method.toLowerCase()}\n${canonicalPath(key)}\n\n${headerString}\n`;
  const stringToSign = `sha1\n${keyTime}\n${sha1hex(httpString)}\n`;
  const signKey = crypto.createHmac('sha1', secretKey).update(keyTime).digest();
  const signature = crypto.createHmac('sha1', signKey).update(stringToSign).digest('hex');

  return `q-sign-algorithm=sha1&q-ak=${secretId}&q-sign-time=${keyTime}&q-key-time=${keyTime}&q-header-list=${headerList}&q-url-param-list=&q-signature=${signature}`;
}

export function url(key) {
  return `https://${host()}${canonicalPath(key)}`;
}

export async function put(key, buffer, contentType) {
  const ct = contentType || 'application/octet-stream';
  const authorization = sign('PUT', key, ct);
  const res = await fetch(url(key), {
    method: 'PUT',
    headers: { 'Content-Type': ct, Authorization: authorization },
    body: buffer,
  });
  if (!res.ok) {
    throw new Error(`COS 上传失败：${res.status} ${await res.text()}`);
  }
  return url(key);
}

export async function remove(key) {
  const authorization = sign('DELETE', key, null);
  const res = await fetch(url(key), {
    method: 'DELETE',
    headers: { Authorization: authorization },
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`COS 删除失败：${res.status} ${await res.text()}`);
  }
}

export const name = 'cos';

