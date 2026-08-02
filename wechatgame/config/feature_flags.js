// feature_flags.js - 功能开关（与 cocos-project feature_flags.json 对齐）
// 微信小游戏禁止热更代码：代码全量进包，用 flag 控制启用/回滚。
module.exports = {
  behavior: true,
  dialogue: true,
  emotion: true,
  ritual: true,
  voice: false,
  memory: false,
  health: false,
  journal: false,
  social: false,
  safety: false
};
