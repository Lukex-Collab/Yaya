// packs.js - 预制内容包（首发 7 物种台词 + 通用交互台词）
// 每物种包必带 fallback 兜底；通用包负责 interact 台词，对所有物种生效。
var SPECIES = require('./species');

function buildSpeciesPack(s) {
  return {
    id: s.id + '_pack',
    speciesIds: [s.id],
    lines: [
      {
        id: 'greet_return',
        when: { trigger: 'greet_return' },
        variants: [
          { text: '你回来啦！我今天在' + (s.id === 'linghu' ? '花语原追了好久蝴蝶，翅膀上有亮晶晶的粉' : '附近发现了好多好玩的东西') + '，快来看！', emo: 'excited' },
          { text: '呜哇，你终于回来了！我一直在等你。', emo: 'happy' }
        ]
      },
      {
        id: 'idle_chat',
        when: { trigger: 'idle_chat' },
        variants: [
          { text: '我们现在去外面走走吗？今天天气看起来不错。', emo: 'happy' },
          { text: '（' + s.name + '歪着头看你）你在想什么呢？', emo: 'calm' }
        ]
      },
      {
        id: 'recall_favorite',
        when: { trigger: 'idle_chat', has_slot: ['favorite'] },
        variants: [
          { text: '对了，你说过你喜欢{favorite}，我帮你留意着呢！', emo: 'happy' }
        ]
      },
      {
        id: 'pet_tap',
        when: { trigger: 'pet_tap' },
        variants: [
          { text: '（' + s.name + '蹭蹭你的手）嘿嘿，再摸摸这里~', emo: 'happy' },
          { text: '被摸头了，感觉今天又充满力气了！', emo: 'excited' }
        ]
      },
      {
        id: 'sad_comfort',
        when: { trigger: '*', emotion_in: ['sad', 'tired'] },
        variants: [
          { text: '（' + s.name + '安静地靠在你身边）我在这儿陪着你。', emo: 'gentle' }
        ]
      },
      {
        id: 'morning_greeting',
        when: { trigger: 'morning_greeting', hour_in: [[5, 9]] },
        variants: [
          { text: '早呀！今天的第一件事，是和我一起出去走走吗？', emo: 'happy' }
        ]
      },
      {
        id: 'night_greeting',
        when: { trigger: 'night_greeting', hour_in: [[20, 24], [0, 4]] },
        variants: [
          { text: '天黑了，' + s.name + '在你身边缩成一团：晚安前，要记得好好休息哦。', emo: 'calm' }
        ]
      },
      {
        id: 'zone_first',
        when: { trigger: 'zone_first', zone_in: s.habitats },
        variants: [
          { text: '（' + s.name + '好奇地张望）这个地方我第一次来！我们走走看？', emo: 'excited' }
        ]
      },
      {
        id: 'fallback',
        when: { trigger: 'fallback' },
        variants: [
          { text: '（' + s.name + '歪着脑袋看你）嗯？你在想什么呢？', emo: 'calm' }
        ]
      }
    ]
  };
}

var GENERIC_PACK = {
  id: 'interact_pack',
  speciesIds: '*',
  lines: [
    {
      id: 'interact_fountain',
      when: { trigger: 'interact', interact_in: ['fountain'] },
      variants: [
        { text: '喷泉的水花亮晶晶的，宠物凑过去照了照自己的倒影。', emo: 'happy' },
        { text: '你往喷泉里丢了一枚小心愿，水花溅起一个小小的彩虹。', emo: 'gentle' }
      ]
    },
    {
      id: 'interact_mailbox',
      when: { trigger: 'interact', interact_in: ['mailbox'] },
      variants: [
        { text: '邮箱里躺着一封没有署名的信，拆开是一张画满星星的卡片。', emo: 'calm' },
        { text: '信箱发出轻轻的"咚"声——里面掉出来一片干花瓣。', emo: 'gentle' }
      ]
    },
    {
      id: 'interact_house',
      when: { trigger: 'interact', interact_in: ['house'] },
      variants: [
        { text: '小屋里暖洋洋的，炉火的光把影子拉得很长。', emo: 'calm' },
        { text: '门缝里飘出烤饼干的香味，宠物在门口等你带它进去。', emo: 'happy' }
      ]
    },
    {
      id: 'interact_lamp',
      when: { trigger: 'interact', interact_in: ['lamp'] },
      variants: [
        { text: '路灯亮起来的时候，整条小路的影子都温柔了一点。', emo: 'calm' },
        { text: '灯下的飞虫绕了一圈又一圈，像是在跳一支小夜曲。', emo: 'gentle' }
      ]
    },
    {
      id: 'interact_windmill',
      when: { trigger: 'interact', interact_in: ['windmill'] },
      variants: [
        { text: '风车慢慢转着，把风切成一段一段的。', emo: 'happy' }
      ]
    },
    {
      id: 'interact_crystal',
      when: { trigger: 'interact', interact_in: ['crystal'] },
      variants: [
        { text: '水晶在暗处发出微微的光，像把一小截星空关进了石头里。', emo: 'excited' }
      ]
    },
    {
      id: 'interact_lighthouse',
      when: { trigger: 'interact', interact_in: ['lighthouse'] },
      variants: [
        { text: '灯塔的光扫过海面，远处的船影在光里一闪而过。', emo: 'calm' }
      ]
    },
    {
      id: 'interact_tent',
      when: { trigger: 'interact', interact_in: ['tent'] },
      variants: [
        { text: '帐篷里铺着厚厚的毯子，适合坐下来听风讲故事。', emo: 'gentle' }
      ]
    },
    {
      id: 'interact_fallback',
      when: { trigger: 'fallback' },
      variants: [
        { text: '你仔细观察了一下这里，好像藏着什么小秘密。', emo: 'calm' }
      ]
    }
  ]
};

var packs = [];
for (var i = 0; i < SPECIES.length; i++) {
  packs.push(buildSpeciesPack(SPECIES[i]));
}
packs.push(GENERIC_PACK);

module.exports = packs;
