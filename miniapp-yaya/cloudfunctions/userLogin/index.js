// cloudfunctions/userLogin/index.js — 微信登录云函数
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  try {
    // 查找已有用户
    const userRes = await db.collection('users')
      .where({ wechatOpenid: openid })
      .limit(1)
      .get();

    let user;
    if (userRes.data.length > 0) {
      // 老用户 — 更新登录时间
      user = userRes.data[0];
      await db.collection('users').doc(user._id).update({
        data: { updatedAt: new Date() },
      });
    } else {
      // 新用户 — 初始化
      const newUser = {
        wechatOpenid: openid,
        nickname: '新朋友',
        avatarUrl: '',
        yayaNickname: '牙牙',
        yayaPersonalitySeed: Math.floor(Math.random() * 100000),
        companionDays: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const addRes = await db.collection('users').add({ data: newUser });
      user = { _id: addRes._id, ...newUser };

      // 初始化推送设置
      await db.collection('push_settings').add({
        data: {
          userId: addRes._id,
          morningTime: '08:00',
          nightTime: '22:30',
          morningEnabled: true,
          nightEnabled: true,
          careEnabled: true,
          healthEnabled: true,
          quietStart: 22,
          quietEnd: 7,
          dailyCount: 0,
          updatedAt: new Date(),
        },
      });

      // 初始化成长数据
      await db.collection('user_growth').add({
        data: {
          userId: addRes._id,
          level: 1,
          companionshipDays: 1,
          intimacyScore: 0,
          interactionCount: 0,
          unlockedMilestones: [],
          createdAt: new Date(),
        },
      });
    }

    return {
      code: 0,
      user: {
        id: user._id,
        nickname: user.nickname,
        avatarUrl: user.avatarUrl,
        yayaNickname: user.yayaNickname,
        companionDays: user.companionDays,
      },
    };
  } catch (err) {
    console.error('[userLogin] Error:', err);
    return { code: -1, msg: err.message };
  }
};
