// pages/world/world.js — 灵伴世界（3D宠物探索世界）
const app = getApp();

Page({
  data: {
    statusBarHeight: 20,
    exploreStatus: '探索中...',
    gems: 120,
    petEmoji: '🦊',
    petName: '云狐',
    petState: 'idle',       // idle/walking/eating/playing
    currentZone: null,

    // 探索点（Demo数据，后续从后端加载）
    explorePoints: [
      { id:1, name:'浆果森林', icon:'🍓', type:'forest', x:25, y:40,
        desc:'一片长满浆果的神奇森林，据说能捡到稀有的星光石', nearbyPets:['🐱墨猫','🐰泡兔'] },
      { id:2, name:'星湖', icon:'💧', type:'water', x:60, y:30,
        desc:'映着星光的湖泊，灵伴们喜欢在这里游泳和嬉戏', nearbyPets:['🐲芽龙'] },
      { id:3, name:'暖阳山坡', icon:'☀️', type:'mountain', x:40, y:70,
        desc:'阳光最好的小山坡，是午睡和晒太阳的绝佳地点', nearbyPets:['🐻岩熊','🦊云狐'] },
      { id:4, name:'神秘洞穴', icon:'🕳️', type:'cave', x:75, y:65,
        desc:'据说深处藏着远古灵伴的秘密...', nearbyPets:[] },
      { id:5, name:'春日花园', icon:'🌸', type:'garden', x:15, y:20,
        desc:'四季如春的花园，蝴蝶和灵伴们在这里跳舞', nearbyPets:['🐰泡兔','🐱墨猫'] },
    ],
  },

  onLoad() {
    this.setData({
      statusBarHeight: app.globalData.statusBarHeight || 20,
    });
  },

  onShow() {
    this.loadWorldState();
  },

  async loadWorldState() {
    // 从后端加载宠物状态和探索进度
    try {
      const db = wx.cloud.database();
      const res = await db.collection('pet_state').where({ userId: 'demo' }).limit(1).get();
      if (res.data.length > 0) {
        const state = res.data[0];
        this.setData({
          petEmoji: speciesEmoji(state.species) || '🦊',
          petName: state.name || '云狐',
          petState: state.currentState || 'idle',
          gems: state.gems || 0,
        });
      }
    } catch (err) {
      console.log('[world] 使用离线模式');
    }
  },

  onPetTap() {
    // 点击宠物触发互动
    const reactions = ['蹦跳了一下！', '对你眨了眨眼 ✨', '打了个滚～', '摇摇尾巴', '开心地转圈圈 🎵'];
    const r = reactions[Math.floor(Math.random() * reactions.length)];
    wx.showToast({ title: r, icon: 'none' });
    this.setData({ petState: 'playing' });
    setTimeout(() => this.setData({ petState: 'idle' }), 2000);
  },

  onExplorePoint(e) {
    const id = e.currentTarget.dataset.id;
    const point = this.data.explorePoints.find(p => p.id === id);
    this.setData({ currentZone: point });
    wx.vibrateShort({ type: 'light' });
  },

  goExplore() {
    wx.navigateTo({ url: '/pages/world-explore/world-explore' });
  },

  goPetDetail() {
    wx.navigateTo({ url: '/pages/world-pet/world-pet' });
  },

  goFeed() {
    wx.showToast({ title: '🍖 喂食成功！云狐很开心～', icon: 'none' });
    const gems = this.data.gems + 5;
    this.setData({ gems });
  },

  goShop() {
    wx.showToast({ title: '🎁 商店即将开放', icon: 'none' });
  },

  goSocial() {
    wx.showToast({ title: '👥 社交广场即将开放', icon: 'none' });
  },

  onShareAppMessage() {
    return {
      title: `来灵伴世界看看我的${this.data.petName}吧！ 🧸`,
      path: '/pages/world/world',
    };
  },
});

function speciesEmoji(species) {
  const map = { '云狐':'🦊', '墨猫':'🐱', '芽龙':'🐲', '泡兔':'🐰', '岩熊':'🐻' };
  return map[species] || '🦊';
}
