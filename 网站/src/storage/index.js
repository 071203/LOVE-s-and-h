import config from '../config.js';
import * as local from './local.js';
import * as cos from './cos.js';
import * as oss from './oss.js';
import * as r2 from './r2.js';

/**
 * 存储驱动统一出口：根据 STORAGE_DRIVER 选择实现。
 * 接口约定：
 *   put(key, buffer, contentType) -> 公开 URL
 *   remove(key)
 *   url(key)
 *   name
 */

const drivers = { local, cos, oss, r2 };

const driver = drivers[config.storageDriver];
if (!driver) {
  throw new Error(
    `不支持的存储驱动：${config.storageDriver}（可选 local / cos / oss / r2）`
  );
}

export default driver;

