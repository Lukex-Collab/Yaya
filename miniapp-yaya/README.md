# 牙牙（yaya）微信小程序

> AI 守护玩偶 — 微信小程序前端

## 快速开始

### 1. 环境准备
- [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
- 微信小程序 AppID（在 mp.weixin.qq.com 注册）
- 云开发环境 ID（在微信开发者工具中开通云开发）

### 2. 配置
1. 修改 `project.config.json` 中的 `appid` 为你的 AppID
2. 修改 `utils/constants.js` 中的 `CLOUD_ENV_ID` 为你的云开发环境 ID
3. 在云开发控制台 → 设置 → 环境变量 中添加 `DEEPSEEK_API_KEY`

### 3. 安装依赖
```bash
cd miniapp-yaya
npm install
```
然后在微信开发者工具中：工具 → 构建 npm

### 4. 部署云函数
在微信开发者工具中，右键 `cloudfunctions/` 下的每个云函数文件夹 → 上传并部署

### 5. 初始化数据库
在云开发控制台 → 数据库中创建以下集合：
- `messages` — 对话记录
- `memories` — 记忆库
- `core_facts` — 核心事实
- `journals` — 日记
- `period_records` — 经期记录
- `body_notes` — 身体状态
- `push_settings` — 推送设置
- `push_logs` — 推送记录
- `safety_logs` — 安全日志
- `user_achievements` — 用户成就
- `women_calendar` — 女子日历

### 6. 运行
在微信开发者工具中打开项目，点击编译预览。

## 项目结构
```
miniapp-yaya/
├── pages/           # 10个页面
│   ├── home/        # 主页（牙牙形象+语音按钮+安全盾牌）
│   ├── chat/        # AI 对话（SSE流式+快捷提问）
│   ├── journal/     # 手账（3个Tab：牙牙日记/我的记录/健康追踪）
│   ├── profile/     # 我的（档案+设置+成长等级）
│   ├── health/      # 健康（经期追踪+身体打卡+美丽记录）
│   ├── safety/      # 守护中心（门窗状态+告警记录）
│   ├── achievement/ # 成就墙（12个里程碑）
│   ├── memory/      # 记忆管理（增删改查+锁定）
│   ├── emotion/     # 情绪图谱（趋势+规律+急救）
│   └── journal-detail/ # 日记详情
├── services/        # 业务逻辑层
│   ├── chat.js      # AI 对话（DeepSeek SSE）
│   ├── memory.js    # 记忆系统（四层记忆+衰减）
│   ├── journal.js   # 手账（AI生成+情绪统计）
│   └── api.js       # 通用CRUD封装
├── utils/           # 常量和Prompt模板
├── cloudfunctions/  # 云函数（aiChat + pushSchedule）
├── components/      # 组件目录（待实现）
└── styles/          # 主题样式
```

## 技术栈
- 框架：微信原生 + TDesign Miniprogram
- 后端：CloudBase 云开发（免服务器）
- AI：DeepSeek Chat API（通过云函数）
- 数据库：CloudBase 文档型数据库
