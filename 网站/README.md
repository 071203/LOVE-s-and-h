# 小时光 · 情侣纪念网站

一个原创设计的情侣专属纪念网站：倒计时、共享相册、共享音乐、自定义背景，
数据与上传文件全部持久化保存，上线后支持搜索引擎收录。

> 本项目为从零原创实现，UI、交互、页面结构与目录组织均为自行设计，
> 未直接复制任何开源成品代码。参考了 SharedMoments / I_Love_Day / Immich
> 的产品思路（共享相册、纪念日、媒体收藏），但做了差异化重构。

## 功能特性

- **双向倒计时**：未来日期显示剩余天数与时分秒；过去日期自动切换为「已经过去」的正数计时。支持多个倒计时与自定义主题色。
- **共享相册**：双方都可以上传照片，图片永久保存；相册页独立访问密码保护。
- **3D 照片星云**：相册照片按心形轨迹分布在空间中，可拖拽旋转、滚轮/双指缩放、点击查看大图。
- **可旋转立体透明爱心**：首页使用本地 Three.js 程序生成圆润爱心几何体，带透明折射、六通道色散、菲涅耳边光、拖动惯性、自动漂浮与 WebGL 静态降级。
- **时间线**：按日期记录一起经历的事件，并可为每个事件上传当天照片。
- **共享音乐**：支持本地音频上传、网易云/QQ 音乐链接导入，以及网易云在线搜索、Apple Music 备用试听和加入歌单。全站默认把方大同《特别的人》作为悬浮背景音乐，页面打开时尝试自动播放；浏览器因自动播放策略拦截时，可点击右下角播放器继续。
- **共同养宠**：`/pets` 3D 宠物房间使用 Mesh2Motion 的 CC0 蓝灰猫与黄色犬模型，脸部、眼睛和口鼻清晰可辨；场景包含双人沙发、猫爬架、狗窝、浴盆、食盆与玩具篮。支持“近看宠物 / 看全房间”镜头切换、鼠标视差、漂浮爱心、点击选宠、再次点击亲近、喂食、洗澡、睡觉、玩球和逗猫棒互动。状态保存在 SQLite，并由相册密码保护。
- **左侧固定导航**：桌面端原创竖排导航，移动端自动切换为底部标签栏。
- **每页自定义背景**：纯色或上传照片作为背景，背景图永久保存。
- **后台文案编辑**：首页、相册、音乐、管理后台的标题与说明都可在线修改，保存后立即生效。
- **iOS 玻璃质感**：悬浮玻璃导航、磨砂卡片、细腻高光与柔和景深，桌面与手机端统一。
- **GSAP 动效系统**：入场时间线、ScrollTrigger 滚动编排、磁吸按钮、数字增长、时间线绘制，以及以双心轨迹、环绕光带和轻雾展开为核心的浅色「心动扩散」连续页面转场。转场中鼠标会带出珠光尾迹与微型爱心，并让双心场景产生柔和视差。
- **Quiet Luxury 视觉**：暖纸色、编辑式大标题、非对称首页、细线分隔和克制的玻璃磨砂层。
- **原创浪漫特效**：爱心飘落 Canvas 特效、所有操作按钮统一的浅色珠光液态金属材质，以及跟随点击位置绽放的页面过渡动画。
- **SEO 优化**：每页独立 `title` / `description` / `keywords` / `canonical` / Open Graph，
  图片带 `alt`，自动生成 `robots.txt` 与 `sitemap.xml`。
- **零外部运行时依赖**：后端仅使用 Node.js 内置模块，无需 `npm install` 即可运行。

## 技术架构

```text
浏览器 ──► Node.js HTTP 服务（内置模块）
              ├── 页面渲染：服务端模板字符串，SEO 友好
              ├── 数据存储：Node 内置 SQLite（node:sqlite）
              └── 文件存储：可插拔驱动
                    ├── local  本地磁盘（默认，永久保存）
                    ├── cos    腾讯云对象存储 COS
                    └── oss    阿里云对象存储 OSS
```

- 运行环境：Node.js **>= 22.5.0**（依赖内置的 `node:sqlite`）。
- 前端动画：GSAP 3.13 + ScrollTrigger + Three.js r169，本地文件位于 `public/vendor/`，不依赖外部 CDN。
- 3D 宠物：TOM 与皮皮使用 Mesh2Motion 官方仓库中的 CC0 `cat.glb` / `dog.glb` 变体，TOM 的毛色离线调整为蓝灰；浏览器端只加载轻量 GLB，并使用程序化表演层完成互动动作。
- 数据库：`data/site.db`（SQLite，WAL 模式）。
- 登录鉴权：HMAC 签名的 HttpOnly Cookie，服务重启不失效。

## 目录结构

```text
.
├── server.js                # 项目入口
├── package.json
├── .env.example             # 环境变量模板
├── .gitignore
├── README.md
├── public/                  # 前端静态资源
│   ├── css/style.css        # 原创样式
│   ├── css/pets.css         # 3D 宠物房间与养成界面
│   ├── js/app.js            # 前端交互与 GSAP 动效编排
│   ├── js/pet-room.js       # Three.js 宠物场景与互动动画
│   ├── js/pets-page.js      # 宠物状态面板与 API 交互
│   ├── pets/models/         # 本地 TOM / 皮皮 GLB
│   ├── pets/fallback/       # WebGL 失败时的高分辨率转台图
│   ├── vendor/              # 本地 GSAP、ScrollTrigger 与 Three.js
│   └── favicon.svg
└── src/                     # 后端源码（中文注释）
    ├── server.js            # HTTP 服务、静态资源、路由分发
    ├── config.js            # 配置读取（.env + 环境变量）
    ├── db.js                # SQLite 数据层与建表
    ├── auth.js              # 登录鉴权
    ├── pages.js             # 页面路由（含 robots.txt / sitemap.xml）
    ├── api.js               # API 路由（读写 / 上传）
    ├── pet-sim.js           # 宠物时间结算、动作与成长规则
    ├── pet-store.js         # 宠物 SQLite 存储
    ├── pet-api.js           # 宠物鉴权 API
    ├── util.js              # 工具函数
    ├── views.js             # 服务端模板渲染
    └── storage/             # 文件存储驱动
        ├── index.js
        ├── local.js
        ├── cos.js
        └── oss.js
```

## 本地运行

1. 确认本机已安装 Node.js 22.5 或更高版本：

   ```bash
   node -v   # 建议 >= v22.5.0
   ```

2. 复制环境变量模板（可选，不复制也能以默认配置运行）：

   ```bash
   cp .env.example .env
   ```

3. 启动服务：

   ```bash
   node server.js
   # 或开发模式（文件变更自动重启）
   node --watch server.js
   ```

4. 浏览器访问：

   ```text
   http://localhost:3000
   ```

首次启动会自动创建 `data/` 目录、初始化数据库与默认数据。

## 默认密码

| 用途 | 默认值 |
| ---- | ------ |
| 相册查看密码 | `love2024` |
| 管理员密码 | `5201314` |

> 上线前务必在「管理后台 → 设置」中修改这两个密码。

## 修改页面文案

进入「管理后台 → 文案」，可以分别修改首页、相册、音乐、管理后台的：

- 顶部小标题（眉标）
- 页面标题与副标题
- 倒计时区块标题与说明
- 锁屏标题、说明与解锁按钮文字
- 空状态提示与上传按钮文字
- 时间线标题、说明与空状态文字

修改后点击「保存文案」，前台刷新即可看到效果。文案保存在 SQLite 的
`settings` 表中（`copy.` 前缀），重启服务不会丢失。

## 管理时间线

1. 进入「管理后台 → 时间线」。
2. 填写日期、事件标题和当天发生的事，点击「添加事件」。
3. 在事件下方点击「添加当天照片」，可一次选择多张图片。
4. 前台「时间线」页面会按日期倒序展示事件与照片。时间线与相册共用访问密码。

## 添加音乐

进入「管理后台 → 音乐」，有三种来源：

- **本地文件**：上传 MP3、WAV、M4A、AAC、FLAC、OGG 等音频，文件永久保存在本地或云存储。
- **网易云音乐**：粘贴歌曲分享链接，可选择自动读取歌名/歌手，页面提供官方播放器入口。
- **QQ 音乐**：粘贴歌曲分享链接，保存官方歌曲地址，点击卡片前往 QQ 音乐播放。

网易云与 QQ 音乐没有面向个人网站的稳定音频直传接口，因此本项目不会抓取或转存
第三方平台的音频文件，只保存官方分享链接和公开元数据。请确保使用的音乐拥有合法版权。

### 在线音乐搜索

音乐页面顶部提供两个搜索源：

- **网易云音乐（默认）**：搜索中文歌曲、歌手和专辑，使用网易云官方嵌入播放器。
- **Apple Music（备用）**：同时搜索台湾、美国、香港曲库，播放官方 30 秒试听。

点击「加入歌单」后：

- 网易云歌曲保存歌曲 ID、标题、歌手和官方链接，播放时加载网易云官方播放器。
- Apple Music 歌曲保存官方试听地址，并保留完整歌曲页面入口。

本项目不会抓取或转存网易云、Apple Music 的音频文件。网易云官方播放器是否提供
完整播放取决于歌曲版权和登录状态；第三方网站无法保证所有歌曲都免费完整播放。
部署服务器分别需要能够访问 `music.163.com` 和 `itunes.apple.com`。

## 共同养宠

访问 `/pets`，使用相册密码解锁后即可进入共享宠物房间。TOM 和皮皮共用同一份服务端状态：

- 饱腹、清洁、精力与亲密度会随现实时间变化。
- 支持喂食、洗澡、睡觉/叫醒、玩球；TOM 额外支持逗猫棒。
- 点击宠物选择照顾对象，再次点击当前宠物会播放亲近反应。
- 双宠选择卡会实时提示“有点饿了”“想洗个澡”等当前需要，方便双方快速接手照顾。
- 每次互动写入共享照顾记录，5 秒内重复点击同一宠物会被服务端拦截。
- 成长阶段从「来到身边」逐步到「长久家人」，体型只做约 4% 的克制变化。
- 桌面端可拖动旋转视角，手机端支持触摸拖动；WebGL 或 GLB 加载失败时自动显示本地转台图。

原始宠物生活照只保存在 `work/pet3d/source/`，不属于公开网站资源。网站只发布验证后的 GLB、烘焙纹理和转台预览图。模型生成与验证命令见 `tools/pet3d/README.md`，第三方许可见 `public/pets/attribution.md`。

## 视觉风格说明

界面采用原创的 iOS 玻璃拟态体系：半透明磨砂层、1px 高光描边、悬浮式导航、
分层阴影与细腻颗粒。设计语言参考了 ReactBits、UIverse、Aceternity UI 等社区的
玻璃/动效审美方向，但**没有引入其代码或依赖**，所有组件均为本项目自行实现，
以保持零外部运行时依赖与原创性。

## 云存储配置教程

默认使用 `local` 驱动，文件永久保存在服务器 `data/uploads/` 目录。
Railway 部署推荐使用 Cloudflare R2；填入完整的 `R2_*` 配置后会自动切换到 R2。

### 通用步骤

在 `.env` 中设置 `STORAGE_DRIVER=r2`、`cos` 或 `oss`，
并填写对应密钥，然后重启服务。

### Cloudflare R2（推荐）

1. 在 Cloudflare R2 创建 Bucket。Bucket 可以保持私有。
2. 创建带 Object Read & Write 权限的 R2 API Token。
3. 填写 `.env`：

   ```dotenv
   STORAGE_DRIVER=r2
   R2_ACCOUNT_ID=你的账户ID
   R2_ACCESS_KEY_ID=你的AccessKey
   R2_SECRET_ACCESS_KEY=你的SecretKey
   R2_BUCKET=你的Bucket名
   # 可选；留空时使用网站签名的 /media/... 代理读取
   R2_PUBLIC_BASE_URL=
   ```

4. 重启服务。上传文件会通过 S3 Signature V4 写入 R2；未配置公开域名时，
   浏览器通过受保护的 `/media/...` 代理读取。

### 腾讯云 COS

1. 登录 [腾讯云对象存储控制台](https://console.cloud.tencent.com/cos)，创建存储桶。
2. 在「访问管理 → API 密钥管理」创建 `SecretId` / `SecretKey`。
3. 给存储桶开启「公有读私有写」（或对图片对象配置 CDN / 公有读）。
4. 编辑 `.env`：

   ```dotenv
   STORAGE_DRIVER=cos
   COS_SECRET_ID=你的SecretId
   COS_SECRET_KEY=你的SecretKey
   COS_BUCKET=你的存储桶名-1250000000
   COS_REGION=ap-guangzhou
   ```

5. 重启服务。上传文件会直接写入 COS，返回的公开 URL 形如
   `https://<bucket>.cos.<region>.myqcloud.com/...`。

### 阿里云 OSS

1. 登录 [阿里云 OSS 控制台](https://oss.console.aliyun.com/)，创建 Bucket。
2. 在「AccessKey 管理」创建 `AccessKey ID` / `AccessKey Secret`。
3. 将 Bucket 设置为「公共读」。
4. 编辑 `.env`：

   ```dotenv
   STORAGE_DRIVER=oss
   OSS_ACCESS_KEY_ID=你的AccessKeyId
   OSS_ACCESS_KEY_SECRET=你的AccessKeySecret
   OSS_BUCKET=你的Bucket名
   OSS_REGION=cn-hangzhou
   # 可选，留空则自动拼为 oss-<region>.aliyuncs.com
   OSS_ENDPOINT=oss-cn-hangzhou.aliyuncs.com
   ```

5. 重启服务。

> 云存储驱动使用 Node 内置 `crypto` 实现签名（COS 使用 HMAC-SHA1 签名，
> OSS 使用 Authorization 头签名，R2 使用 AWS Signature V4），无需安装官方 SDK。上线前请用真实密钥
> 做一次上传/删除验证。

## 数据库配置说明

- 数据库文件自动生成在 `data/site.db`，无需手动建库建表。
- 首次启动自动执行建表与默认数据初始化。
- 数据表：

  | 表 | 用途 |
  | -- | ---- |
  | `settings` | 站点标题、副标题、两人名字、纪念日、相册密码、管理员密码 |
  | `countdowns` | 多个自定义倒计时 |
  | `photos` | 相册照片元数据 |
  | `tracks` | 音乐元数据 |
  | `backgrounds` | 每页背景配置 |
  | `timeline_events` | 时间线事件（日期、标题、描述） |
  | `timeline_photos` | 时间线事件关联的照片 |
  | `pets` | TOM / 皮皮的四项状态、睡眠、照顾点与成长数据 |
  | `pet_events` | 两个人共享的喂食、洗澡、玩耍和睡觉记录 |

- 如需备份：直接复制 `data/` 整个目录即可（包含数据库与本地存储的上传文件）。
- 如使用云存储，数据库仍保存在本地 `data/site.db`，文件本体在云端。

## Railway 部署

项目根目录已包含 `railway.json`、`nixpacks.toml` 和 `Procfile`。
Railway 使用 Node 22 运行 `node server.js`。

数据库与留言、纪念日、宠物状态存储在 SQLite。部署时给 Railway Service
挂载持久卷并指向 `/data`：

```text
Volume Mount Path: /data
DATA_DIR=/data
```

图片上传使用 Cloudflare R2，不需要把 `data/uploads` 放进持久卷。

完整变量、Bucket 配置和验证步骤见
[`docs/railway-r2-deploy.md`](docs/railway-r2-deploy.md)。

## 上线部署

### 1. 准备环境

在服务器安装 Node.js 22.5+，上传项目文件。

### 2. 配置环境变量

```bash
cp .env.example .env
vim .env
```

至少设置：

```dotenv
PORT=3000
SITE_URL=https://love.example.com
SESSION_SECRET=改成一段足够长的随机字符串
```

`SITE_URL` 必须填写真实域名，否则 `sitemap.xml` 与 `canonical` 地址会不正确。

### 3. 常驻运行

使用 `pm2`（可选，推荐）：

```bash
npm i -g pm2
pm2 start server.js --name love-site
pm2 save && pm2 startup
```

或使用 `systemd` / `nssm`（Windows）等方式保持进程常驻。

### 4. 反向代理（Nginx 示例）

```nginx
server {
    listen 80;
    server_name love.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

使用 `certbot` 为域名申请 HTTPS 证书，并把 `SITE_URL` 改为 `https://` 地址。

## 提交搜索引擎收录操作步骤

1. **确认可公网访问**：域名通过 HTTPS 正常打开，`SITE_URL` 配置正确。
2. **验证 SEO 产物**：

   ```text
   https://love.example.com/robots.txt
   https://love.example.com/sitemap.xml
   ```

3. **Google Search Console**：
   - 访问 [Google Search Console](https://search.google.com/search-console/)，
     用域名或 URL 前缀方式添加资源并完成所有权验证。
   - 左侧「站点地图」提交 `sitemap.xml`。
   - 在「网址检查」中输入首页 URL，点击「请求编入索引」。

4. **必应 Webmaster**：
   - 访问 [Bing Webmaster Tools](https://www.bing.com/webmasters/)，
     添加站点并验证。
   - 提交站点地图，等待抓取。

5. **百度搜索资源平台（国内）**：
   - 访问 [百度搜索资源平台](https://ziyuan.baidu.com/) 添加站点并验证。
   - 提交 `sitemap.xml`，并建议配置「普通收录」。

6. **内链完整**：确保首页、相册、音乐页相互链接（本项目左侧导航已内置），
   便于爬虫发现全部页面。

7. **耐心等待**：收录通常需要数天到数周，持续更新内容有助于加快收录。

## 项目优缺点

### 优点

- 零外部依赖，部署简单，无供应链风险，启动快。
- 数据与文件持久化，刷新、重启均不丢失。
- 文件存储可插拔，本地 / 腾讯云 COS / 阿里云 OSS 一键切换。
- 服务端渲染 + 独立 meta，SEO 友好。
- 原创 UI 与交互，避免同质化情侣网页样式。

### 缺点 / 待改进

- 目前为单进程内存路由，未做集群与水平扩展（对个人纪念站足够）。
- 密码校验为明文比较，虽然通过 HTTPS 与 HttpOnly Cookie 保护，但未做
  bcrypt 哈希、登录限流与 CSRF 防护，高安全场景建议自行增强。
- 未做图片压缩 / 缩略图，原图直存，空间占用与加载速度依赖原图大小。
- 未做 CDN 集成（云存储本身可配合 CDN 使用）。
- 管理后台为轻量实现，功能聚焦核心需求，无用户体系与多管理员。

## 费用说明

- **本地部署**：无额外费用，仅需服务器带宽/存储成本。
- **腾讯云 COS / 阿里云 OSS**：按存储容量、请求次数、下行流量计费；
  个人小规模使用通常每月几元以内，具体以官网计费页为准。
- **域名与 HTTPS**：域名年费 + 免费证书（Let's Encrypt）通常即可满足。

## 注意事项

- 请勿将 `.env` 提交到公开仓库（`.gitignore` 已忽略）。
- 上线前修改默认相册密码与管理员密码。
- 若使用云存储，请务必妥善保管 AccessKey，并遵循「最小权限」原则，
  仅授予目标存储桶的读写权限。
- 上传的音乐请确保拥有合法版权，仅供个人收藏使用。
- 更换 `STORAGE_DRIVER` 后，旧驱动中的文件不会自动迁移，需自行迁移。

## License

MIT
