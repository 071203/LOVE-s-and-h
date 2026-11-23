# Railway + Cloudflare R2 部署说明

本项目是完整的动态网站：

- 页面由 `src/server.js`、`src/pages.js`、`src/views.js` 动态渲染。
- 照片、背景、音乐元数据、时间线留言和纪念日存放在 SQLite。
- 图片文件通过 `STORAGE_DRIVER=r2` 上传到 Cloudflare R2。
- 页面样式、布局、文案、转场与交互代码均保持不变。

## 1. Cloudflare R2

在 Cloudflare Dashboard 创建 Bucket，例如 `couple-assets`。

图片读取支持两种方式：

1. 推荐：保持 Bucket 私有，不填写 `R2_PUBLIC_BASE_URL`。网站会通过
   服务端签名的 `/media/...` 路由读取图片，相册图片继续受密码会话保护。
2. 开启 R2.dev 或绑定自定义域名，并把公开地址填入 `R2_PUBLIC_BASE_URL`。

在 **Manage R2 API Tokens** 创建 Object Read & Write Token，记录：

```text
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
R2_PUBLIC_BASE_URL=
```

留空时上传记录中的 URL 形如：

```text
/media/photos/xxxxxxxx.jpg
```

如果填写了公开域名，`R2_PUBLIC_BASE_URL` 末尾不要添加 `/`，URL 形如：

```text
https://你的R2公开域名/photos/xxxxxxxx.jpg
```

## 2. Railway 数据库持久化

项目使用 Node 内置 SQLite，不需要额外数据库账号。为避免 Railway 重新部署后
数据库丢失，必须给 Web Service 添加一个 Volume：

```text
Mount path: /data
```

然后在 Railway Variables 设置：

```text
DATA_DIR=/data
```

如果 Railway 自动提供 `RAILWAY_VOLUME_MOUNT_PATH`，项目也会自动使用该目录。

SQLite 数据文件会保存为：

```text
/data/site.db
```

相册图片本体保存在 Cloudflare R2，不占用 Railway 磁盘。

## 3. Railway 环境变量

在 Railway 项目的 **Variables** 中填入：

```text
PORT=3000
SITE_URL=https://你的Railway域名
SESSION_SECRET=请填写一段至少32位的随机字符串
DATA_DIR=/data
STORAGE_DRIVER=r2
MAX_UPLOAD_MB=30

R2_ACCOUNT_ID=你的账户ID
R2_ACCESS_KEY_ID=你的AccessKey
R2_SECRET_ACCESS_KEY=你的SecretKey
R2_BUCKET=你的Bucket名称
R2_PUBLIC_BASE_URL=
```

如果完整填写了 R2 配置，也可以不设置 `STORAGE_DRIVER`，项目会自动选择 R2。
`R2_PUBLIC_BASE_URL` 可以留空，不影响上传和预览。

## 4. 部署

将项目推送到 GitHub 后，在 Railway 选择 **Deploy from GitHub Repo**。

Railway 会读取根目录的：

```text
railway.json
nixpacks.toml
Procfile
```

启动命令为：

```text
node server.js
```

部署完成后：

1. 在 Railway Service 的 Networking 中生成 HTTPS 域名。
2. 将 `SITE_URL` 设置为该 HTTPS 地址并重新部署。
3. 在项目根目录生成静态 sitemap：

```bash
SITE_URL=https://你的域名 npm run seo:sitemap
```

网站也会通过 `/sitemap.xml` 动态提供 sitemap，通过 `/robots.txt` 提供抓取规则。

## 5. 功能验证

依次检查：

```text
/
/album
/timeline
/music
/pets
/admin
/robots.txt
/sitemap.xml
```

在管理后台：

1. 上传一张相册照片，刷新后确认仍存在。
2. 在时间线添加一条带照片的留言，确认文字和 R2 图片均能长期读取。
3. 修改纪念日与倒计时，重新打开网站确认数据仍在。

## 6. 搜索引擎收录

上线后确认：

```text
https://你的域名/sitemap.xml
https://你的域名/robots.txt
```

再到以下平台提交站点和 sitemap：

- Google Search Console: `https://search.google.com/search-console`
- 百度搜索资源平台: `https://ziyuan.baidu.com`

平台所有权验证必须使用你自己的 Google、百度或 Railway 账号完成，网站代码本身无法代替账号授权。
