// models/index.js - 物种模型注册表（键 = content/species.js 的 id）
// 数据来自 cocos-project/assets/resources/models/pets/*.glb（用户真实 STL 减面导出）
module.exports = {
  linghu: require('./linghu'),
  xiongmao: require('./xiongmao'),
  yaya: require('./yaya'),
  maotouying: require('./maotouying'),
  zhangyu: require('./zhangyu'),
  pixiu: require('./pixiu'),
  jingyu: require('./jingyu')
};
