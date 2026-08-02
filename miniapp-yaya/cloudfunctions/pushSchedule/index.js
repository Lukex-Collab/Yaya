// cloudfunctions/pushSchedule/index.js — 定时推送（早安/晚安）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 在云开发控制台配置定时触发器：每天早上 7:57 和晚上 22:03 各触发一次

exports.main = async (event, context) => {
  const hour = new Date().getHours();
  const isMorning = hour >= 6 && hour < 12;
  const isNight = hour >= 21;

  if (!isMorning && !isNight) {
    return { code: 0, msg: '非推送时段，跳过' };
  }

  try {
    // 获取所有活跃用户（最近7天有对话）
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
    const activeUsers = await db.collection('messages')
      .aggregate()
      .match({ createdAt: db.command.gte(sevenDaysAgo) })
      .group({ _id: '$userId' })
      .end();

    let pushCount = 0;

    for (const user of activeUsers.list) {
      const userId = user._id;

      // 检查推送设置
      const settings = await db.collection('push_settings')
        .where({ userId }).limit(1).get();

      if (settings.data.length === 0) continue;
      const s = settings.data[0];

      // 免打扰检查
      const now = new Date();
      const currentHour = now.getHours();
      if (s.quietStart <= currentHour && currentHour < s.quietEnd) continue;

      // 每日限额检查
      if (s.dailyCount >= 5) continue;

      // 生成推送内容
      let pushContent = '';
      if (isMorning && s.morningEnabled !== false) {
        pushContent = `早安呀～新的一天开始了 ☀️ 今天也要元气满满哦！牙牙会一直陪着你的～`;
      } else if (isNight && s.nightEnabled !== false) {
        pushContent = `该睡觉啦 🌙 牙牙帮你检查过门窗了（虽然只是模拟的 😅），安心睡吧～晚安好梦 💤`;
      } else {
        continue;
      }

      // 记录推送
      await db.collection('push_logs').add({
        data: {
          userId,
          type: isMorning ? 'morning' : 'night',
          content: pushContent,
          isRead: false,
          createdAt: new Date(),
        },
      });

      // 更新今日推送数
      await db.collection('push_settings').where({ userId }).update({
        data: { dailyCount: db.command.inc(1) },
      });

      pushCount++;
    }

    return { code: 0, pushCount };
  } catch (err) {
    console.error('[pushSchedule] Error:', err);
    return { code: -1, msg: err.message };
  }
};
