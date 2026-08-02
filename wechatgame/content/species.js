// species.js - 首发 7 物种元数据（与 cocos-project species_templates.json 对齐）
// traits 为性格标签，供行为/台词选择的 trait_vector 参数化使用。
module.exports = [
  { id: 'linghu',     name: '灵狐',   color: [0.95, 0.72, 0.42], traits: ['curious', 'playful', 'clever'],       animations: ['idle', 'walk', 'sit', 'sleep', 'happy_spin'], habitats: ['HUB', 'Z-E', 'Z-N'] },
  { id: 'xiongmao',   name: '熊猫',   color: [0.95, 0.95, 0.92], traits: ['lazy', 'gentle', 'foodie'],           animations: ['idle', 'walk', 'sit', 'sleep', 'roll'],       habitats: ['HUB', 'Z-N', 'Z-S'] },
  { id: 'yaya',       name: '牙牙',   color: [0.85, 0.55, 0.75], traits: ['brave', 'energetic', 'loyal'],        animations: ['idle', 'walk', 'sit', 'sleep', 'pounce'],     habitats: ['HUB', 'Z-W', 'Z-S'] },
  { id: 'maotouying', name: '猫头鹰', color: [0.65, 0.55, 0.40], traits: ['wise', 'quiet', 'observant'],         animations: ['idle', 'walk', 'perch', 'sleep', 'head_turn'], habitats: ['HUB', 'Z-N', 'Z-S'] },
  { id: 'zhangyu',    name: '章鱼',   color: [0.80, 0.45, 0.60], traits: ['creative', 'mischievous', 'affectionate'], animations: ['idle', 'walk', 'sit', 'sleep', 'wave_tentacle'], habitats: ['HUB', 'Z-SE', 'Z-NW'] },
  { id: 'pixiu',      name: '貔貅',   color: [0.85, 0.70, 0.30], traits: ['proud', 'protective', 'mysterious'],  animations: ['idle', 'walk', 'sit', 'sleep', 'roar'],        habitats: ['HUB', 'Z-W', 'Z-E'] },
  { id: 'jingyu',     name: '鲸鱼',   color: [0.40, 0.55, 0.80], traits: ['calm', 'dreamy', 'gentle_giant'],     animations: ['idle', 'walk', 'float', 'sleep', 'sing'],      habitats: ['HUB', 'Z-NW', 'Z-SE'] }
];
