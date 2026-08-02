// state.js - 全局运行时状态（由 game.js 注入，Feature 模块只读引用）
module.exports = {
  player: null,   // {x, z, rot, moving, running}
  pet: null,      // {x, z, rot, state, ai:false}  ai=true 时宠物 AI 由 behavior 模块接管
  world: null,    // world.buildWorld() 的返回值
  cam: null,      // Camera 实例
  W: 0,
  H: 0,
  dpr: 1
};
