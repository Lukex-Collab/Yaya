# 牙牙动画参考 — 视频分析报告

> 分析时间: 2026-08-02 | 三个竖屏视频, 720x1280, 24fps, ~10秒

---

## 一、无聊 (Bored) — 待机 / 打发时间

**视频来源**: `，竖屏，听好了只有竖屏。就只要这一个场景，不要移动镜.mp4`

### 运动特征
| 指标 | 数值 | 含义 |
|---|---|---|
| 运动类型 | 持续运动 | 无静止帧，始终在动 |
| 运动强度 | 82% 轻微 / 13% 静止 / 5% 剧烈 | 轻柔、不费力 |
| 身体部位 | 下身 80% / 上身 20% | 主要是腿/脚在动 |
| 左右分布 | 左 60% / 右 40% | 左腿主导 |
| 运动节奏 | 10次爆发, 每次 ~0.9秒 | 有节奏的轻晃 |
| 运动密度 | 几乎每帧都在变 | 平滑连续 |

### 推测动作
角色坐着，身体微微晃动，**左腿轻轻摆动/点脚**——典型的"等人/无聊/发呆"的肢体语言。上身相对静止，只有呼吸带来的微弱起伏。

### CSS 实现方案
```css
.yaya[data-mood="bored"] {
  animation: bored-sway 4s ease-in-out infinite;
}
/* 下身（腿）做小幅摆动，身体整体微晃 */
@keyframes bored-sway {
  0%, 100% { transform: rotate(-2deg) translateY(0); }
  25%      { transform: rotate(-0.5deg) translateY(-1px); }
  50%      { transform: rotate(2deg) translateY(0); }
  75%      { transform: rotate(0.5deg) translateY(-1px); }
}
/* 腿单独做更快的摆动 */
.yaya[data-mood="bored"] .leg.l {
  animation: leg-swing 1.4s ease-in-out infinite;
}
@keyframes leg-swing {
  0%, 100% { transform: rotate(-8deg); }
  50%      { transform: rotate(5deg); }
}
```

---

## 二、被挠痒痒 (Tickled) — 被挠得咯咯笑

**视频来源**: `，竖屏。就只要这一个场景，不要移动镜头，只有角色有动 (1).mp4`

### 运动特征
| 指标 | 数值 | 含义 |
|---|---|---|
| 运动类型 | 持续剧烈运动 | 三个视频中最活跃 |
| 运动强度 | 56% 剧烈 / 31% 轻微 / 12% 静止 | 高频大幅度运动 |
| 身体部位 | 下身 88% / 上身 12% | 腿疯狂踢蹬 |
| 左右分布 | 左 46% / 右 54% | 全身均衡扭动 |
| 运动节奏 | 7次爆发, 每次 ~1.25秒 | 较长的运动爆段 |
| 运动密度 | 剧烈运动段持续时间最长 | 笑到停不下来 |

### 推测动作
角色**全身扭动/挣扎/蹬腿**——笑到身体失控的感觉。腿部高频踢蹬是最显著特征（88%下身运动），身体左右交替扭动。

### CSS 实现方案
```css
.yaya[data-mood="tickled"] {
  animation: tickle-shake 0.5s ease-in-out infinite;
}
@keyframes tickle-shake {
  0%, 100% { transform: rotate(-4deg) translateX(-2px); }
  25%      { transform: rotate(2deg) translateX(3px) translateY(-1px); }
  50%      { transform: rotate(5deg) translateX(-1px); }
  75%      { transform: rotate(-2deg) translateX(2px) translateY(-2px); }
}
/* 腿快速踢蹬 */
.yaya[data-mood="tickled"] .leg.l {
  animation: leg-kick-left 0.35s ease-in-out infinite;
}
.yaya[data-mood="tickled"] .leg.r {
  animation: leg-kick-right 0.4s ease-in-out infinite;
}
@keyframes leg-kick-left {
  0%, 100% { transform: rotate(-15deg); }
  50%      { transform: rotate(8deg) translateY(-3px); }
}
@keyframes leg-kick-right {
  0%, 100% { transform: rotate(15deg); }
  50%      { transform: rotate(-5deg) translateY(-2px); }
}
/* 脸微表情：嘴巴张大/眼睛眯起来（笑的反应）*/
.yaya[data-mood="tickled"] .mouth {
  width: 18px; height: 10px;
  border-radius: 0 0 14px 14px;
  background: #D05852;
}
.yaya[data-mood="tickled"] .eye {
  transform: scaleY(0.3);
  animation: none;
}
```

---

## 三、被摸头 (Head Pat) — 享受 / 安心

**视频来源**: `，竖屏。就只要这一个场景，不要移动镜头，只有角色有动.mp4`

### 运动特征
| 指标 | 数值 | 含义 |
|---|---|---|
| 运动类型 | 持续轻柔运动 | 最温和的动画 |
| 运动强度 | 78% 轻微 / 13% 剧烈 / 8% 静止 | 温柔、放松 |
| 身体部位 | 上身 31% / 下身 69% | 上身参与度最高（头+身体反应） |
| 左右分布 | 左 58% / 右 42% | 微微偏左 |
| 运动节奏 | 仅 3 次长期爆发, 每次 ~3秒 | 缓慢、绵长 |
| 运动密度 | 最长单段持续 3 秒运动 | 持续沉浸 |

### 推测动作
角色**微微低头/偏头**，身体随着"被摸"的节奏**轻轻左右晃动**——像小猫被摸头时眯眼、往手心蹭的感觉。上身参与度高（31%）说明头部/颈部有明显反应。运动段很长（3秒+）说明是**沉浸式享受**，不是快速反应。

### CSS 实现方案
```css
.yaya[data-mood="headpat"] {
  animation: headpat-sway 3s ease-in-out infinite;
}
@keyframes headpat-sway {
  0%, 100% { transform: translateY(0) rotate(-1deg); }
  30%      { transform: translateY(-4px) rotate(0deg); }   /* 被摸到，身体微抬 */
  60%      { transform: translateY(-2px) rotate(2deg); }   /* 往手心蹭 */
  85%      { transform: translateY(-4px) rotate(-1deg); }  /* 再次被摸 */
}
/* 整体身体缩小一点——往手心方向缩 */
.yaya[data-mood="headpat"] {
  transform-origin: center 30%;
}
/* 眼睛半闭 */
.yaya[data-mood="headpat"] .eye {
  transform: scaleY(0.3);
  animation: none;
}
/* 嘴巴微笑弧度更大 */
.yaya[data-mood="headpat"] .mouth {
  width: 12px; height: 7px;
}
/* 脸红加重 */
.yaya[data-mood="headpat"] .blush {
  background: rgba(255,107,107,.35);
  transform: scale(1.2);
}
```

---

## 四、现有原型动画对照

| 动画 | v3.0 现有 | 视频参考 | 需要改吗 |
|---|---|---|---|
| idle (待机呼吸) | breathe 3.6s 缩放 | 无聊 ≈ 腿部轻摆 | **重新做**: idle 应该是腿动+微晃，不只是呼吸缩放 |
| listen (聆听) | tilt 1.6s 歪头 | — 无视频参考 | 保持不变 |
| think (思考) | roll 1.3s 转眼珠 | — 无视频参考 | 保持不变 |
| **bored (无聊)** | 无 | ✅ 有视频 | **新增** |
| **tickled (被挠)** | 无 | ✅ 有视频 | **新增** |
| **headpat (被摸头)** | 无 | ✅ 有视频 | **新增** |
| sleep (睡觉) | 慢呼吸 + 闭眼 | — 无视频参考 | 保持 |

---

## 五、实现计划

1. **重写 `idle` 动画**: 从单纯"缩放呼吸"改为"身体微晃 + 左腿轻摆"——和视频"无聊"状态一致
2. **新增 `bored` mood**: 比 idle 更强的腿部摆动，表达不耐烦
3. **新增 `tickled` mood**: 高频全身抖 + 腿踢蹬 + 闭眼张嘴笑
4. **新增 `headpat` mood**: 缓慢摇摆 + 眯眼 + 身体微缩 + 脸红加重
5. **交互触发映射**:
   - 长按牙牙 → tickled（被挠）
   - 点击牙牙 → headpat（被摸头）  
   - 长时间无交互 → bored（无聊，替代idle）
