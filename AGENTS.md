# 灵伴世界（LingPal World）· Web 端

盲盒实体宠物 → 扫码绑定 → 操控宠物在 3D 小世界探索。

## 技术栈
- `web/`：3D 太空浮岛版（Three.js，备选方向，已跑通）
- `web2d/`：**主线**——Phaser 3 七小世界横卷版（CDN 引入，无构建）
- 宠物：STL → `tools/stl_to_glb.py` 减面出 GLB → `tools/render_pet_sprite.py` 预渲染成 2D 精灵（assets/2d/yaya.png）
- 本地运行：`python -m http.server`（详见下方「运行」）

## 目录约定
```
assets/worlds/   .spz 世界场景（v3 格式，用 Spark 渲染）
assets/pets/src/ 带贴图源模型 GLB（70-90MB，仅离线渲染用，不进运行时）
assets/2d/pets/  宠物精灵 PNG（render_pet_sprite.py 批量生成）
assets/2d/worlds/ 世界背景 JPG（shot_world.py 由 spz 预渲染）
assets/qr/       每只宠物的绑定二维码（make_qr 脚本生成）
assets/kits/     第三方 CC0 素材（KayKit，含 LICENSE）
vendor/          第三方包下载暂存
tools/           资产管线脚本（STL→GLB、GLB→精灵、spz→背景、截图验证）
web/             3D 版（备选）+ 渲染页（render_pet/render_world）
web2d/           2D 主线（index.html 游戏 / bind.html 唤醒 / qrcodes.html 盲盒墙 / picker.html 挑背景）
```

## 绑定流程（黑客松演示链路）
手机扫 assets/qr/<pet>.png → bind.html 唤醒仪式（取名）→ index.html?pet=<id> 进入游戏。
QR 指向局域网 IP（172.16.121.192），换网络需重新生成。

## 硬性规则
- 原始 STL（74MB 打印高模）不进 web/、不进 assets/pets/，必须经 tools/ 管线处理
- .spz 场景仅作视觉层；可行走范围用 main.js 中的 CONFIG 边界约束，不做真实碰撞
- 不引入构建工具（webpack/vite），保持双击即跑
- 密钥/token 不进代码、不进 commit

## 运行
```
cd lingpal-world
python server.py        # Flask：静态 + /api/activate /api/save /api/load /api/reset
# 主线 http://localhost:8080/web2d/  （3D 备选 http://localhost:8080/web/）
```
- SECRET 同时写在 server.py 和 tools/make_qr.py，更换需同步；上线前移到环境变量
- 激活记录存 data.db；演示前 `POST /api/reset {"key": SECRET}` 清空
- QR 码重新生成：`python tools/make_qr.py <局域网IP>`（换网络后必做）

## 架构（web2d/）
- `ai.js` 灵魂层：九宠性格（五维 traits）、记忆（localStorage）、气泡/日记/对话生成；`window.YAYA_LLM` 留 LLM 接口
- `play.js` 玩法层：区域互动点、天气、派遣、背包、等级门槛
- `main.js` 驱动：Phaser 场景 + 移动 + UI 接线
- 绑定链路：QR（签名 code）→ bind.html 调 /api/activate → 唤醒仪式 → index.html?pet=

## 验证
改动 web/ 后在浏览器跑一遍：场景加载、宠物移动、边界限制三项正常即通过。
