import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(__dirname, '..');

/**
 * 极简 .env 解析器：仅处理 KEY=VALUE，忽略空行与 # 注释。
 * 不依赖 dotenv，保证项目零外部运行时依赖。
 */
function loadEnvFile(filePath) {
  const result = {};
  if (!fs.existsSync(filePath)) return result;
  const text = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    // 去掉成对引号
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

const envFile = loadEnvFile(path.join(ROOT_DIR, '.env'));
const env = { ...envFile, ...process.env };
const inferredPublicUrl =
  env.VERCEL_PROJECT_PRODUCTION_URL || env.VERCEL_URL
    ? `https://${(env.VERCEL_PROJECT_PRODUCTION_URL || env.VERCEL_URL).replace(/^https?:\/\//, '')}`
    : '';

function toInt(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

const config = {
  port: toInt(env.PORT, 3000),
  siteUrl: (env.SITE_URL || inferredPublicUrl || 'http://localhost:3000').replace(/\/+$/, ''),
  sessionSecret:
    env.SESSION_SECRET ||
    crypto.randomBytes(32).toString('hex'), // 未配置时每次启动随机生成
  maxUploadMb: toInt(env.MAX_UPLOAD_MB, 30),
  maxUploadBytes: toInt(env.MAX_UPLOAD_MB, 30) * 1024 * 1024,
  storageDriver: (
    env.STORAGE_DRIVER ||
    (env.R2_ACCOUNT_ID &&
    env.R2_ACCESS_KEY_ID &&
    env.R2_SECRET_ACCESS_KEY &&
    env.R2_BUCKET
      ? 'r2'
      : 'local')
  ).toLowerCase(),
  uploadDir: path.resolve(ROOT_DIR, env.UPLOAD_DIR || 'data/uploads'),
  // Cloudflare R2（S3 兼容）
  r2: {
    accountId: env.R2_ACCOUNT_ID || '',
    accessKeyId: env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: env.R2_SECRET_ACCESS_KEY || '',
    bucket: env.R2_BUCKET || '',
    publicBaseUrl: (env.R2_PUBLIC_BASE_URL || '').replace(/\/+$/, ''),
  },
  // 腾讯云 COS
  cos: {
    secretId: env.COS_SECRET_ID || '',
    secretKey: env.COS_SECRET_KEY || '',
    bucket: env.COS_BUCKET || '',
    region: env.COS_REGION || '',
  },
  // 阿里云 OSS
  oss: {
    accessKeyId: env.OSS_ACCESS_KEY_ID || '',
    accessKeySecret: env.OSS_ACCESS_KEY_SECRET || '',
    bucket: env.OSS_BUCKET || '',
    region: env.OSS_REGION || '',
    endpoint: env.OSS_ENDPOINT || '',
  },
  dataDir: path.resolve(
    ROOT_DIR,
    env.DATA_DIR || env.RAILWAY_VOLUME_MOUNT_PATH || 'data'
  ),
};

export default config;

