# TOM 与皮皮共享虚拟宠物实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用 TOM 和皮皮的真实照片重建两只非像素、拟真的 3D 宠物，并新增可持久化、共享养成的 `/pets` 页面。

**Architecture:** 照片重建与自动绑定作为离线资产管线运行，网站最终只加载本地优化后的 GLB。宠物状态由服务端按时间惰性结算并存入 SQLite，前端 Three.js 场景只负责渲染动画和提交互动动作。

**Tech Stack:** Node.js 24、Node 内置 SQLite、原生 HTTP、Three.js r169、GLTFLoader、TripoSR、Mesh2Motion、Playwright、Python `unittest`

**Spec:** `docs/superpowers/specs/2026-11-13-virtual-pets-design.md`

## Global Constraints

- TOM：冷调蓝灰短密毛、圆脸、琥珀金色眼睛、粗尾、深灰褐色肉垫。
- 皮皮：浅黄褐色粗硬蓬松毛、奶油色口鼻/眉毛/胸腹/爪尖、黑色鼻头、深棕黑眼睛、一高一低垂耳。
- 禁止像素宠物、表情符号宠物或用纯程序几何代替照片重建外观。
- 原始生活照不得进入 `public/`，不得公开或上传第三方服务。
- 静态模型多角度预览必须先经用户确认，之后才能整合 `/pets` 页面。
- 网站运行时不新增外部 CDN；模型、纹理、GLB 和 GLTFLoader 全部本地部署。
- 共享状态保存在 `data/site.db`，刷新和重启后不丢失。
- 宠物不会死亡或永久走失。
- 页面和互动复用相册密码会话。
- 手机端 390×844 无横向溢出；WebGL 失败时使用高分辨率转台图降级。
- 所有外部下载（Python 依赖、GitHub 代码、PyTorch、模型权重、缓存和临时构建环境）优先放在 D 盘；D 盘不可写时按用户授权退回项目 `work/pet3d/`。
- 项目当前没有 Git 仓库；不要擅自初始化 Git，使用测试通过和预览文件作为检查点。

## Review Focus

- 照片中的门框、地毯、人物或家具被 TripoSR 误识别为宠物身体：模型验收必须检查最大连通体和包围盒，并拒绝带明显附加块的结果。
- 自动绑定在耳朵、口鼻、尾巴和腿部产生严重拉伸：每个动作片段必须经过四向转台和关键帧截图检查。
- 两位用户快速重复提交互动造成状态刷高或重复事件：服务端必须按宠物执行 5 秒冷却。
- 未解锁用户直接请求 `/pets` 或 `/api/pets` 读取状态：页面与 API 都必须复用相册鉴权。
- GLB 下载失败、显存不足或 WebGL 不可用时页面空白：必须显示对应的静态转台图并保留状态查看能力。

---

### Task 1: 照片工作区与本地重建环境

**Files:**
- Create: `tools/pet3d/README.md`
- Create: `tools/pet3d/requirements.txt`
- Create: `tools/pet3d/photo-manifest.json`
- Create: `tools/pet3d/prepare_sources.py`
- Create: `tools/pet3d/validate_model.py`
- Create: `tools/pet3d/tests/test_validate_model.py`
- Create: `work/pet3d/source/tom/`
- Create: `work/pet3d/source/pipi/`
- Create: `work/pet3d/output/`

**Interfaces:**
- Consumes: 用户提供的 TOM 与皮皮照片。
- Produces: `validate_model(path, species) -> ModelReport` 与 CLI `validate_model.py --model <path> --species cat|dog`。`ModelReport` 包含 `triangle_count`、`has_texture`、`largest_component_ratio`、`bounds`；CLI 退出码 0 表示验证通过，非 0 返回具体拒绝原因。

- [ ] **Step 1: 建立照片清单并复制私密源文件**

把 TOM 的正面、侧面、趴卧、爪部照片和皮皮的站立、侧面、笑脸、湿毛、蜷睡、爪部、磨牙棒照片复制到 `work/pet3d/source/{tom,pipi}/`。`photo-manifest.json` 记录文件名、用途和最终模型不得公开源图。

- [ ] **Step 2: 写模型验证失败测试**

在 `tools/pet3d/tests/test_validate_model.py` 写两个测试：

- `test_missing_glb_is_rejected`：不存在的文件应抛出 `ModelValidationError("model file not found")`。
- `test_cat_bounds_must_fit_quadruped_profile`：包围盒最大轴小于 0.1 或长宽比大于 4.0 时应抛出 `ModelValidationError("implausible quadruped bounds")`。

- [ ] **Step 3: 运行测试确认失败**

Run: `C:\Users\user\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe -m unittest tools.pet3d.tests.test_validate_model -v`

Expected: FAIL，因为 `validate_model` 尚不存在。

- [ ] **Step 4: 实现验证器和准备脚本**

`validate_model.py` 使用 `trimesh` 检查 GLB、纹理、网格数量和包围盒；`prepare_sources.py` 只做本地裁切、透明背景和参考图整理。`requirements.txt` 固定 TripoSR 运行依赖，不进入网站 `package.json`。

- [ ] **Step 5: 建立隔离环境**

优先在 D 盘创建 Python 虚拟环境；当前沙箱拒绝 D 盘写入时，使用 `work/pet3d/venv`，并把模型权重存入 `work/pet3d/models/`。按 TripoSR 官方说明安装与 RTX 5060 兼容的 PyTorch/CUDA。

- [ ] **Step 6: 重跑测试确认通过**

Run: 同 Step 3  
Expected: 2 tests PASS。

- [ ] **Step 7: 检查私密资源边界**

Run: `Get-ChildItem public -Recurse -File | Select-String -Pattern 'work\\pet3d|source\\tom|source\\pipi'`

Expected: 无输出。

---

### Task 2: TOM 静态照片重建

**Files:**
- Create: `tools/pet3d/infer_triposr.py`
- Create: `tools/pet3d/tests/test_tom_model.py`
- Create: `work/pet3d/output/tom.glb`
- Create: `work/pet3d/output/tom-meta.json`

**Interfaces:**
- Consumes: `work/pet3d/source/tom/` 中经过裁切的正面和侧面主参考图。
- Produces: 单只 TOM 静态 GLB，含 2K 基础色纹理；`tom-meta.json` 记录源图、三角形数、纹理尺寸和验证结果。

- [ ] **Step 1: 写 TOM 模型验收测试**

`test_tom_model.py` 断言：

```python
model = validate_model("work/pet3d/output/tom.glb", "cat")
self.assertGreaterEqual(model.triangle_count, 20_000)
self.assertLessEqual(model.triangle_count, 250_000)
self.assertTrue(model.has_texture)
self.assertGreaterEqual(model.largest_component_ratio, 0.82)
```

- [ ] **Step 2: 运行测试确认失败**

Run: `python -m unittest tools.pet3d.tests.test_tom_model -v`

Expected: FAIL，因为 `tom.glb` 尚不存在。

- [ ] **Step 3: 实现 TripoSR 本地推理封装**

`infer_triposr.py` 以 `VAST-AI-Research/TripoSR` 的 MIT 版本为依赖，提供参数：

```text
--source <image>
--output <glb>
--bake-texture
--texture-resolution 2048
--foreground-ratio 0.85
```

生成结果不得经过外部 API。

- [ ] **Step 4: 生成并清理 TOM 网格**

优先使用无遮挡正面与侧面图。删除照片背景误识别出的块，保留耳朵、粗尾和四足；对关键区域重新烘焙蓝灰毛色和琥珀眼色。

- [ ] **Step 5: 重跑模型测试确认通过**

Run: 同 Step 2  
Expected: PASS。

- [ ] **Step 6: 检查 TOM 必须保留的视觉特征**

导出正、侧、俯临时截图，确认圆脸、灰短毛、金色眼睛、粗尾和深色肉垫。若肤色或轮廓明显偏离，回到 Step 4 调整参考图与纹理，不进入皮皮任务。

---

### Task 3: 皮皮静态照片重建

**Files:**
- Create: `tools/pet3d/tests/test_pipi_model.py`
- Create: `work/pet3d/output/pipi.glb`
- Create: `work/pet3d/output/pipi-meta.json`

**Interfaces:**
- Consumes: `work/pet3d/source/pipi/` 中的站立、侧面、笑脸、湿毛、爪部和蜷睡照片。
- Produces: 单只皮皮静态 GLB，含 2K 基础色纹理；`pipi-meta.json` 记录生成和验证数据。

- [ ] **Step 1: 写皮皮模型验收测试**

`test_pipi_model.py` 使用与 TOM 相同的三角形与纹理约束，并额外断言 `model.largest_component_ratio >= 0.82`。

- [ ] **Step 2: 运行测试确认失败**

Run: `python -m unittest tools.pet3d.tests.test_pipi_model -v`

Expected: FAIL，因为 `pipi.glb` 尚不存在。

- [ ] **Step 3: 生成并清理皮皮网格**

以站立全身照确定体型，以正面笑脸图确定口鼻和眼睛，以爪部与湿毛图确定局部材质。去除门框、椅腿、红色地毯和人物残片。

- [ ] **Step 4: 重跑测试确认通过**

Run: 同 Step 2  
Expected: PASS。

- [ ] **Step 5: 检查皮皮必须保留的视觉特征**

确认金黄色粗硬毛、奶油色口鼻/眉毛/胸口/爪尖、黑色鼻头、深棕黑眼睛和一高一低垂耳。若结果像柴犬、金毛或光滑短毛犬，回到 Step 3 调整参考权重和纹理。

---

### Task 4: 静态模型转台与用户外观检查点

**Files:**
- Create: `tools/pet3d/render_turntable.mjs`
- Create: `work/pet3d/preview.html`
- Create: `C:\Users\user\Documents\Codex\2026-11-13\ga\outputs\tom-turntable.png`
- Create: `C:\Users\user\Documents\Codex\2026-11-13\ga\outputs\pipi-turntable.png`

**Interfaces:**
- Consumes: `work/pet3d/output/tom.glb`、`work/pet3d/output/pipi.glb`。
- Produces: 两张四向转台图和可拖动双宠 GLB 预览页。

- [ ] **Step 1: 写渲染脚本**

`render_turntable.mjs` 使用本地 Three.js 与 GLTFLoader，在 Edge headless 中渲染 0°、90°、180°、270° 四个角度，统一暖纸色背景、柔和主光和可见地面阴影。

- [ ] **Step 2: 生成预览**

Run: `node tools/pet3d/render_turntable.mjs`

Expected: 两张 PNG 出现在 `outputs/`，每张包含四个角度的 TOM 或皮皮。

- [ ] **Step 3: 自动检查预览**

断言两个 GLB 均成功加载、控制台无错误、截图宽高均为 1600×900、模型像素包围盒占画面高度 45%–75%。

- [ ] **Step 4: 展示给用户并等待确认**

在对话中展示 `tom-turntable.png`、`pipi-turntable.png` 和可拖动预览地址。明确询问外观是否需要修改。

**STOP:** 没有得到用户对外观的明确确认，不执行 Task 5–10。

---

### Task 5: 骨骼绑定与动作制作

**Files:**
- Create: `public/vendor/GLTFLoader.js`
- Create: `tools/pet3d/validate_rig.mjs`
- Create: `public/pets/models/tom.glb`
- Create: `public/pets/models/pipi.glb`
- Create: `public/pets/attribution.md`

**Interfaces:**
- Consumes: 用户确认后的静态 GLB。
- Produces: 含植根、皮肤和九个动画片段的最终 GLB；`validate_rig.mjs <glb>` 检查骨架和片段。

- [ ] **Step 1: 写骨架验证测试**

`validate_rig.mjs` 在缺少 skin 或任一 `Idle`、`Walk`、`Eat`、`Bath`、`Sleep`、`Ball`、`Teaser`、`Affection`、`TailWag` 时以非 0 退出。

- [ ] **Step 2: 运行验证确认失败**

Run: `node tools/pet3d/validate_rig.mjs work/pet3d/output/tom.glb`

Expected: FAIL，因为静态模型没有骨骼。

- [ ] **Step 3: 使用 Mesh2Motion 自动绑定**

在本地 Mesh2Motion 应用中分别为猫、狗选择四足骨架，按实际照片比例调整脊骨、颈、头、耳、尾和四肢关节，导出带皮肤的 GLB。

- [ ] **Step 4: 制作并重定向九类动作**

以 Quaternius CC0 猫狗动作作参考。TOM 的 `Teaser` 包含蹲伏、注视和扑抓；皮皮不再播放逗猫动作。洗澡动作允许毛发粗糙度临时降低并恢复。

- [ ] **Step 5: 验证骨架和全部片段**

Run: `node tools/pet3d/validate_rig.mjs public/pets/models/tom.glb`

Run: `node tools/pet3d/validate_rig.mjs public/pets/models/pipi.glb`

Expected: 两者均 PASS。

- [ ] **Step 6: 制作动作预览并检查变形**

为九类动作生成关键帧截图，确认耳朵、尾巴、嘴部、四肢和项圈没有严重穿插。失败的动作必须修复后才能进入页面任务。

---

### Task 6: 宠物状态引擎与 SQLite 持久化

**Files:**
- Create: `src/pet-sim.js`
- Create: `src/pet-store.js`
- Create: `tests/pet-sim.test.js`
- Create: `tests/pet-store.test.js`
- Modify: `src/config.js`
- Modify: `src/db.js`

**Interfaces:**
- Consumes: 数据库实例和当前时间。
- Produces:
  - `settlePet(pet, now) -> {satiety, cleanliness, energy, affection, sleeping_since, last_simulated_at}`
  - `applyPetAction(pet, action, now) -> {pet, summary}`
  - `growthStage(adoptionDate, now) -> {key, label, sizeScale}`
  - `createPetStore(database) -> {listPets, getPet, savePet, recordEvent, listEvents, lastActionAt}`

- [ ] **Step 1: 写状态引擎失败测试**

`tests/pet-sim.test.js` 使用固定时间：

```js
assert.equal(settlePet(petAt100, twoHoursLater).satiety, 97.6);
assert.equal(settlePet(petAt100, twoHoursLater).cleanliness, 98.8);
assert.equal(applyPetAction(cat, "teaser", now).pet.affection, 76);
assert.throws(() => applyPetAction(dog, "teaser", now), /not allowed/);
assert.equal(growthStage("2026-10-01", new Date("2026-11-15T00:00:00Z")).key, "family");
```

另写休息状态测试，断言睡眠期间精力每小时增加 6，其他数值仍按规则衰减。

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/pet-sim.test.js`

Expected: FAIL，因为 `src/pet-sim.js` 不存在。

- [ ] **Step 3: 实现纯状态引擎**

饱和/清洁/精力/亲密度全部 clamp 到 `[0,100]`。猫允许 `feed,bath,sleep,ball,teaser`，狗允许 `feed,bath,sleep,ball`。成长阶段固定为 `new`、`familiar`、`secure`、`family`。

- [ ] **Step 4: 运行状态测试确认通过**

Run: 同 Step 2  
Expected: PASS。

- [ ] **Step 5: 写存储失败测试**

`tests/pet-store.test.js` 使用 `new DatabaseSync(':memory:')` 创建 store，断言默认生成 TOM 与皮皮、状态保存后重新读取一致、事件按时间倒序返回、未知 slug 返回 `null`。

- [ ] **Step 6: 运行存储测试确认失败**

Run: `node --test tests/pet-store.test.js`

Expected: FAIL，因为 `createPetStore` 不存在。

- [ ] **Step 7: 实现 store 并接入 db.js**

新增 `pets` 与 `pet_events` 表；`src/db.js` 导出单例 `petStore`。修改 `config.js` 支持 `DATA_DIR` 环境变量，默认仍为项目 `data/`，供隔离测试使用。

- [ ] **Step 8: 运行存储测试确认通过**

Run: 同 Step 6  
Expected: PASS。

- [ ] **Step 9: 运行全部状态测试**

Run: `node --test tests/pet-sim.test.js tests/pet-store.test.js`

Expected: 全部 PASS。

---

### Task 7: 宠物 API 与鉴权

**Files:**
- Create: `src/pet-api.js`
- Create: `tests/pet-api.test.js`
- Modify: `src/api.js`
- Modify: `src/auth.js` only if a reusable album guard is needed

**Interfaces:**
- Consumes: `createPetStore()`、`isAlbumAuthed(req)`。
- Produces:
  - `GET /api/pets -> {ok:true,data:{pets,events}}`
  - `POST /api/pets/:slug/action` with `{action}`
  - `POST /api/pets/:slug/wake`
  - `export async function handlePetApi(req,res,pathname,query,{store,now}) -> boolean`

- [ ] **Step 1: 写 API 失败测试**

在 `tests/pet-api.test.js` 用内存 store 和本地 `http.createServer` 测试：

- 未认证 GET 返回 401。
- 认证 GET 返回两只宠物。
- `feed` 更新饱腹并新增事件。
- `teaser` 对皮皮返回 400。
- 5 秒内第二次动作返回 429。
- 重启等价的新 HTTP 实例读取同一内存 store 后状态不变。

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/pet-api.test.js`

Expected: FAIL，因为路由不存在。

- [ ] **Step 3: 实现 handler**

所有接口先调用相册鉴权；slug 只允许 `tom|pipi`；动作只使用白名单；`lastActionAt` 与当前时间差小于 5000ms 时返回 429，不更新状态。

- [ ] **Step 4: 接入主 API 分发**

在 `handleApi` 中调用 `handlePetApi`，放在相册相关 API 附近。失败不得落入 404。

- [ ] **Step 5: 运行 API 测试确认通过**

Run: 同 Step 2  
Expected: 全部 PASS。

- [ ] **Step 6: 回归鉴权测试**

Run: `node --test tests/pet-api.test.js tests/pet-store.test.js tests/pet-sim.test.js`

Expected: 全部 PASS。

---

### Task 8: `/pets` 路由、锁屏和导航

**Files:**
- Create: `tests/views-pets.test.js`
- Modify: `src/views.js`
- Modify: `src/pages.js`
- Modify: `src/pages.js:94-132`
- Modify: `src/views.js:52-82`

**Interfaces:**
- Consumes: `isAlbumAuthed(req)`、`petStore.listPets()`、`petStore.listEvents()`、`resolveBg("pets")`。
- Produces: `petsPage({settings,bg,unlocked,pets,events,copy})` 和 `/pets` 路由。

- [ ] **Step 1: 写视图失败测试**

`tests/views-pets.test.js` 断言锁定状态包含相册密码表单，解锁状态包含 `data-pet-room`、TOM 与皮皮名称、五个动作按钮和事件区域。

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/views-pets.test.js`

Expected: FAIL，因为 `petsPage` 不存在。

- [ ] **Step 3: 实现页面模板**

新增 `petsPage`。复用相册锁屏交互。`shell` 增加可选 `extraStyles`，仅在宠物页加载 `/css/pets.css`。新增 `data-page="pets"` 和 `data-pet-room`。

- [ ] **Step 4: 添加导航与路由**

桌面侧栏与手机栏在音乐后加入「宠物」入口；图标使用原创四足爪印路径。`/pets` 未解锁时渲染锁屏，解锁后才查询状态。`robots.txt` 增加 `Disallow: /pets`。

- [ ] **Step 5: 运行视图测试确认通过**

Run: 同 Step 2  
Expected: PASS。

- [ ] **Step 6: 启动服务检查路由**

Run: `node server.js`

Expected 日志后请求 `/pets`、`/robots.txt`，分别得到 200，未认证页面显示密码框且响应中没有宠物数值。

---

### Task 9: 3D 宠物房间与互动界面

**Files:**
- Create: `public/css/pets.css`
- Create: `public/js/pet-room.js`
- Create: `public/js/pets-page.js`
- Create: `public/pets/fallback/tom.webp`
- Create: `public/pets/fallback/pipi.webp`
- Modify: `public/js/app.js`
- Test: `tests/e2e/pets.mjs`

**Interfaces:**
- Consumes: `GET /api/pets`、`POST /api/pets/:slug/action`、`POST /api/pets/:slug/wake`。
- Produces: `initPetRoom(root, {initialState, onAction})`；页面按 `body[data-page="pets"]` 动态加载。

- [ ] **Step 1: 写浏览器失败测试**

`tests/e2e/pets.mjs` 解锁测试站后断言：

- 两个 GLB 请求成功。
- TOM 和皮皮均可通过点击选择。
- 点击“喂食”后，饱腹数值增加且事件列表出现新记录。
- 点击皮皮的“逗猫棒”时按钮不存在。
- 390×844 下场景和操作区可见，`scrollWidth <= innerWidth + 1`。

- [ ] **Step 2: 运行测试确认失败**

Run: `node tests/e2e/pets.mjs`

Expected: FAIL，因为 `[data-pet-room]` 尚未渲染 3D 内容。

- [ ] **Step 3: 实现 Three.js 房间**

加载两只 GLB，创建暖木地板、地毯、猫爬架、狗窝、食盆、浴盆和玩具。摄像机默认落在双宠全景，支持拖动围绕房间旋转。点击模型切换活动宠物。

- [ ] **Step 4: 实现动画状态机**

使用 `AnimationMixer` 的 `Idle/Walk/Eat/Bath/Sleep/Ball/Teaser/Affection/TailWag`。动作期间禁用按钮；完成后回到 `Idle`。睡眠状态跨页面刷新保留。

- [ ] **Step 5: 实现状态卡和事件**

显示饱腹、清洁、精力、亲密度和成长阶段。采用乐观更新，API 失败时回滚并显示 toast。按钮在请求和动画期间禁用。

- [ ] **Step 6: 实现降级**

GLTFLoader 失败或 WebGL 不可用时，隐藏 canvas 并显示 TOM/PIPI 的 `webp` 转台静态图；状态卡和事件仍工作。减少动态关闭粒子、漂浮和主动动画。

- [ ] **Step 7: 接入 boot**

`app.js` 在 `page === 'pets'` 时动态导入 `pets-page.js`，不在其他页面加载宠物 GLB。

- [ ] **Step 8: 运行浏览器测试确认通过**

Run: 同 Step 2  
Expected: PASS，控制台无错误。

- [ ] **Step 9: 优化模型和显存**

检查两只 GLB 合计不超过 20MB，纹理不超过 2048×2048，DPR 不超过 1.75。页面不可见时暂停 `requestAnimationFrame`。

---

### Task 10: 全量回归、文档与最终预览

**Files:**
- Modify: `README.md`
- Modify: `.env.example` only if `DATA_DIR` should be documented for isolated environments
- Create: `C:\Users\user\Documents\Codex\2026-11-13\ga\outputs\pets-desktop.png`
- Create: `C:\Users\user\Documents\Codex\2026-11-13\ga\outputs\pets-mobile.png`
- Create: `C:\Users\user\Documents\Codex\2026-11-13\ga\outputs\pets-action-feed.png`

**Interfaces:**
- Consumes: 前九个任务的完整实现。
- Produces: 可运行、可回退、文档完整的共享宠物页面。

- [ ] **Step 1: 跑状态、存储、API 和视图测试**

Run: `node --test tests/pet-sim.test.js tests/pet-store.test.js tests/pet-api.test.js tests/views-pets.test.js`

Expected: 全部 PASS。

- [ ] **Step 2: 跑现有项目回归**

Run:

```text
node work/test-glass-heart.mjs
node work/test-pointer-romance.mjs
node work/test-love-transition.mjs
node work/test-pearl-buttons.mjs
node work/verify-final.mjs
```

Expected: 全部 PASS。

- [ ] **Step 3: 跑宠物端到端测试**

Run: `node tests/e2e/pets.mjs`

Expected: PASS。

- [ ] **Step 4: 验证服务重启持久化**

以固定 `DATA_DIR=work/pet3d/test-data` 和固定 `SESSION_SECRET` 启动测试服务，执行喂食与洗澡，记录状态；停止并重启服务后重新读取。

Expected: 状态、成长阶段和事件保持，冷却不因重启绕过 5 秒限制。

- [ ] **Step 5: 更新 README**

添加 `/pets` 功能、相册密码保护、互动规则、成长规则、模型来源、离线重建说明和 TripoSR/Mesh2Motion/Quaternius 许可。

- [ ] **Step 6: 生成最终预览**

截取桌面 1440×1000、手机 390×844 和一次互动后的事件区域。检查文字不遮挡宠物、按钮可读、无横向滚动、控制台无错误。

- [ ] **Step 7: 最终人工验收**

展示两张宠物静态模型转台、桌面页面、手机页面和动作截图。只有用户确认整体效果后才视为完成。

