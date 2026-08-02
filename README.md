# 灵伴世界（LingPal World）· 3D 世界开发仓库

**AI 宠物 × 3D 探索世界 × 实体盲盒**——买一只实体宠物，它在你的 3D 世界里活过来，会听你说话，也对你说心里话。

本仓库独立存放 3D 世界的开发代码：`cocos-project`（Cocos Creator 3D 正式工程）与 `wechatgame`（微信小游戏可玩原型），与主项目 Yaya 分离存储，互不干扰。

## 示意图

世界布局与探索规划参考图（2026-08-02 生成）：1 个中心枢纽 + 6 个外围区域的有机开放世界，区域间以路径网络连接，整体呈"花瓣/星形"拓扑。

![世界布局参考示意图 1](images/world-reference-1.png)

![世界布局参考示意图 2](images/world-reference-2.png)

## 仓库结构

```
├─ cocos-project/   # Cocos Creator 3.8.5 3D 世界工程（正式版，TypeScript）
├─ wechatgame/      # 微信小游戏可玩原型（零依赖原生 WebGL）
└─ images/          # 世界布局与探索规划参考示意图
```

## 世界设定：7 大区域

世界采用配置驱动的分块布局（22 × 22 chunks，每 chunk 16 × 16 米），围绕中心枢纽展开 6 个生态主题区域：

| 区域 ID | 名称 | 主题 |
|---|---|---|
| HUB | 灵屿村 | 中心村庄（玩家小屋、喷泉、邮筒、路灯） |
| Z-N | 云杉林 | 针叶林（云杉、蘑菇巨石） |
| Z-E | 花语原 | 花海草原（风车、彩色花田） |
| Z-W | 暮光谷 | 峡谷岩壁（岩壁、发光水晶洞） |
| Z-SE | 萤火沼 | 湿地（芦苇、月光石） |
| Z-S | 月影丘 | 山丘（巨石、帐篷） |
| Z-NW | 星砂滩 | 海岸（椰子树、灯塔） |

每个区域带独立的环境色、雾色与雾密度（`world_layout.json`），进出区域时平滑过渡。

## Cocos Creator 3D 工程（正式版）

**技术栈**：Cocos Creator 3.8.5 + TypeScript，配置驱动、插件式模块架构。

**核心系统**

- **分块世界**：`ChunkManager` 按相机位置动态加载/卸载 chunk（LRU 上限 25），`NavigationGrid` 提供 8 方向 A\* 寻路（含斜角阻挡检测）
- **相机**：2.5D 等距视角（俯仰 35°、方位 45°），平滑跟随 + 双指捏合/滚轮缩放（`CameraRig`）
- **事件与模块**：`EventBus` 全局事件总线 + `FeatureRegistry` 插件式功能模块注册；`feature_flags.json` 控制行为/对话/语音/情绪/记忆/仪式/健康/手账/社交/安全模块的开关（当前"世界先行"，功能模块全部关闭，按需开启）
- **性能自适应**：`PerfGrader` 按帧率分 HIGH/MID/LOW 三档降级；`PlatformAdapter` 做平台适配；`ObjectPool` 对象池复用；`AssetService` 资源加载（预留 CDN 远程资源位）

**玩家 / 宠物 / UI**

- `PlayerController`：虚拟摇杆移动，走/跑 3 / 5 m/s
- `PetFollower`：宠物平滑跟随（2 m 距离），骨骼动画
- `VirtualJoystick`、`MiniMap`、`LoadingScreen`：摇杆、小地图与加载界面
- `ZoneManager` / `ZoneTransition`：区域管理与 2 秒淡入淡出过渡

**宠物（首发 7 种，GLB 模型，源自真实 STL 减面导出）**

| ID | 名称 | 模型文件 |
|---|---|---|
| linghu | 灵狐 | models/pets/linghu.glb |
| xiongmao | 熊猫 | models/pets/xiongmao.glb |
| yaya | 牙牙 | models/pets/yaya.glb |
| maotouying | 猫头鹰 | models/pets/maotouying.glb |
| zhangyu | 章鱼 | models/pets/zhangyu.glb |
| pixiu | 貔貅 | models/pets/pixiu.glb |
| jingyu | 鲸鱼 | models/pets/jingyu.glb |

物种属性（稀有度、性格标签、栖息区域、基础动画、语音画像）统一配置在 `species_templates.json`。

**工程工具**：`tools/check_bundle_size.ps1` 做微信包体 CI 检查（主包 ≤ 4 MB、总包 ≤ 20 MB）。

## 微信小游戏原型（wechatgame）

**定位**：零依赖原生 WebGL 的可玩原型，验证探索手感与 7 区域拓扑，运行方式为微信开发者工具直接导入 `wechatgame` 目录。

**已实现**

- 程序化圆形岛：中心灵屿村 + 6 个扇形区域 + 海岸水面，顶点色 + Lambert 光照 + 距离雾（`js/world.js`）
- 2.5D 等距相机：平滑跟随、双指捏合/滚轮缩放、边界钳制（`js/camera.js`）
- 虚拟摇杆移动（双击切换跑步）、点按地面 A\* 寻路（`js/nav.js`）
- 小地图与探索记录、帧率采样三档性能降级
- 宠物跟随 + 随机嗅探等轻量行为（`js/features/behavior.js`）

**功能模块（flag 控制，可插拔）**

| 模块 | 说明 |
|---|---|
| behavior | 宠物行为状态机（跟随/闲逛/嗅探/睡觉/探索），trait 参数化 |
| dialogue | 预制台词 + 气泡 UI，条件选句引擎驱动 |
| emotion | 情绪状态机，输出情绪等级供对话/行为读取 |
| interact | 点击交互，转为对话请求 |
| memory | 结构化记忆槽位 + wx 本地持久化 |
| journal | 事件手账，每日自动生成小记 |
| ritual | 每日首次问候 + 早晚安调度 |
| voice | 语音骨架：录音/播报，ASR 指令解析（外部密钥就绪后启用） |

**内容数据**：`content/` 存放 7 物种元数据、预制台词包、条件选句引擎与数据校验器；`config/` 的功能开关与 Cocos 端 `feature_flags.json` 对齐；`js/bindclient.js` 支持扫码/NFC 实体卡绑定（服务端验签，客户端仅转发）。

## 当前状态与路线

- **世界先行**：核心世界引擎、探索闭环与 7 区域拓扑已在两端跑通；AI 功能模块通过 flag 逐步开启
- Cocos Creator 为正式工程，wechatgame 为快速验证原型；两端的常量、事件命名与数据结构设计对齐，逻辑可平滑迁移
- 规划文档（产品策划 v1-v4、技术实施/引擎方案、世界布局与探索规划）位于主工作区，未包含在本仓库
