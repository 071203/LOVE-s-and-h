import crypto from 'node:crypto';
import config from '../config.js';

/**
 * 阿里云 OSS 对象存储驱动。
 * 仅使用 Node 内置 crypto 实现签名，无需安装官方 SDK。
 */

function md5base64(buf) {
  return crypto.createHash('md5').update(buf).digest('base64');
}

function host() {
  const { bucket, region, endpoint } = config.oss;
  if (!bucket || (!region && !endpoint)) {
    throw new Error('缺少 OSS 配置：请设置 OSS_BUCKET 与 OSS_REGION/OSS_ENDPOINT');
  }
  const ep = endpoint || `oss-${region}.aliyuncs.com`;
  return `${bucket}.${ep}`;
}

function gmtDate() {
  return new Date().toUTCString();
}

function sign(method, key, contentType, contentMd5, date) {
  const { accessKeyId, accessKeySecret } = config.oss;
  if (!accessKeyId || !accessKeySecret) {
    throw new Error('缺少 OSS 密钥：请设置 OSS_ACCESS_KEY_ID 与 OSS_ACCESS_KEY_SECRET');
  }
  const resource = `/${config.oss.bucket}/${key}`;
  const stringToSign = `${method}\n${contentMd5 || ''}\n${contentType || ''}\n${date}\n${resource}`;
  const signature = crypto
    .createHmac('sha1', accessKeySecret)
    .update(stringToSign)
    .digest('base64');
  return `OSS ${accessKeyId}:${signature}`;
}

export function url(key) {
  return `https://${host()}/${key}`;
}

export async function put(key, buffer, contentType) {
  const ct = contentType || 'application/octet-stream';
  const date = gmtDate();
  const cm = md5base64(buffer);
  const authorization = sign('PUT', key, ct, cm, date);
  const res = await fetch(url(key), {
    method: 'PUT',
    headers: {
      'Content-Type': ct,
      'Content-MD5': cm,
      Date: date,
      Authorization: authorization,
    },
    body: buffer,
  });
  if (!res.ok) {
    throw new Error(`OSS 上传失败：${res.status} ${await res.text()}`);
  }
  return url(key);
}

export async function remove(key) {
  const date = gmtDate();
  const authorization = sign('DELETE', key, null, null, date);
  const res = await fetch(url(key), {
    method: 'DELETE',
    headers: { Date: date, Authorization: authorization },
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`OSS 删除失败：${res.status} ${await res.text()}`);
  }
}

export const name = 'oss';

