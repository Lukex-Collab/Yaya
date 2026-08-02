// services/memory.js — 记忆系统服务
// 参考 AgentPet 四层记忆架构 + CloudBase 文档数据库实现
// L1: 工作记忆（当前对话上下文，客户端）→ L2: 短期记忆（7天内，DB加权）→ L3: 长期记忆（重要事件）→ L4: 核心事实（用户姓名/喜好等）

const db = wx.cloud.database();
const _ = db.command;
const MEMORY_COLLECTION = 'memories';
const CORE_FACTS_COLLECTION = 'core_facts';

/**
 * 记忆数据结构：
 * {
 *   _id, _openid,
 *   content: string,           // 记忆内容
 *   type: 'fact'|'event'|'preference'|'emotion'|'health',
 *   importance: 1-10,         // 重要度
 *   emotion: string,          // 关联情绪
 *   decayFactor: 1.0,         // 衰减因子
 *   accessCount: 0,           // 被召回次数
 *   lastAccessed: Date,
 *   sourceMsgId: string,      // 来源消息ID
 *   isLocked: false,          // 用户锁定（不遗忘）
 *   createdAt: Date,
 * }
 */

/**
 * 从对话中提取并存储新记忆（异步，对话完成后调用）
 * 参考 digital-companion-core: stateful memory extraction
 */
async function extractAndStore(userId, messages, existingMemories = []) {
  try {
    const { buildMemoryExtractPrompt } = require('../utils/prompts');
    const { AI_MODEL } = require('../utils/constants');

    const prompt = buildMemoryExtractPrompt(messages, existingMemories);
    const ai = wx.cloud.extend.AI;
    const res = await ai.chatCompletions({
      model: AI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 500,
    });

    const text = res.choices?.[0]?.message?.content || '[]';
    const jsonStr = text.replace(/```json|```/g, '').trim();
    const newMemories = JSON.parse(jsonStr);

    if (Array.isArray(newMemories) && newMemories.length > 0) {
      const promises = newMemories.map(m =>
        db.collection(MEMORY_COLLECTION).add({
          data: {
            userId,
            content: m.content,
            type: m.type || 'fact',
            importance: m.importance || 5,
            emotion: m.emotion || 'neutral',
            decayFactor: 1.0,
            accessCount: 0,
            lastAccessed: new Date(),
            isLocked: false,
            createdAt: new Date(),
          },
        })
      );
      await Promise.all(promises);
      console.log(`[memory] 提取了 ${newMemories.length} 条新记忆`);
    }
    return newMemories || [];
  } catch (err) {
    console.error('[memory] 提取失败:', err);
    return [];
  }
}

/**
 * 搜索相关记忆（关键词 + 语义相似度）
 * Demo 阶段使用 CloudBase DB 的 regex 搜索；生产可用云函数调用 DeepSeek Embedding
 */
async function searchMemories(userId, query, limit = 5) {
  try {
    // 先搜核心事实（L4）
    const coreFacts = await db.collection(CORE_FACTS_COLLECTION)
      .where({ userId })
      .get();

    // 再搜记忆库（L2+L3），按重要度和最近访问排序
    const memories = await db.collection(MEMORY_COLLECTION)
      .where({
        userId,
        decayFactor: _.gt(0.3),  // 过滤已严重衰减的记忆
      })
      .orderBy('importance', 'desc')
      .orderBy('lastAccessed', 'desc')
      .limit(limit * 3)
      .get();

    // 关键词匹配排序
    const keywords = extractKeywords(query);
    const scored = memories.data.map(m => {
      let score = m.importance / 10;
      // 关键词命中加分
      for (const kw of keywords) {
        if (m.content.includes(kw)) score += 0.3;
      }
      // 衰减因子
      score *= m.decayFactor;
      return { ...m, _score: score };
    });

    scored.sort((a, b) => b._score - a._score);

    // 更新访问计数
    const topMemories = scored.slice(0, limit);
    const updatePromises = topMemories.map(m =>
      db.collection(MEMORY_COLLECTION).doc(m._id).update({
        data: {
          accessCount: _.inc(1),
          lastAccessed: new Date(),
        },
      })
    );
    Promise.all(updatePromises).catch(() => {}); // 异步更新，不阻塞

    return {
      facts: coreFacts.data,
      memories: topMemories,
    };
  } catch (err) {
    console.error('[memory] 搜索失败:', err);
    return { facts: [], memories: [] };
  }
}

/**
 * 获取所有记忆（记忆管理页用）
 */
async function getAllMemories(userId, page = 1, pageSize = 20) {
  try {
    const res = await db.collection(MEMORY_COLLECTION)
      .where({ userId })
      .orderBy('createdAt', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();
    return res.data;
  } catch (err) {
    console.error('[memory] 获取失败:', err);
    return [];
  }
}

/**
 * 删除一条记忆
 */
async function deleteMemory(memoryId) {
  return db.collection(MEMORY_COLLECTION).doc(memoryId).remove();
}

/**
 * 锁定/解锁记忆
 */
async function toggleLockMemory(memoryId, isLocked) {
  return db.collection(MEMORY_COLLECTION).doc(memoryId).update({
    data: { isLocked },
  });
}

/**
 * 记忆衰减：每日定时任务调用，降低低重要度的旧记忆权重
 * 参考：importance < 3 且 30 天未访问 → decayFactor × 0.5
 */
async function decayMemories(userId) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const res = await db.collection(MEMORY_COLLECTION)
    .where({
      userId,
      importance: _.lt(3),
      lastAccessed: _.lt(thirtyDaysAgo),
      isLocked: false,
    })
    .get();

  const promises = res.data.map(m =>
    db.collection(MEMORY_COLLECTION).doc(m._id).update({
      data: {
        decayFactor: Math.max(0.1, m.decayFactor * 0.5), // 最低保留 0.1
      },
    })
  );
  await Promise.all(promises);
  console.log(`[memory] 衰减了 ${res.data.length} 条旧记忆`);
}

/**
 * 提取中文关键词（简单实现，Demo 阶段够用）
 */
function extractKeywords(text) {
  // 移除标点空格
  const cleaned = text.replace(/[，。！？、；：""''（）\s.,!?;:'"()]/g, '');
  // 取 1-4 字片段
  const keywords = [];
  for (let len = 4; len >= 1; len--) {
    for (let i = 0; i <= cleaned.length - len; i++) {
      keywords.push(cleaned.slice(i, i + len));
    }
  }
  return [...new Set(keywords)].slice(0, 20);
}

module.exports = {
  extractAndStore,
  searchMemories,
  getAllMemories,
  deleteMemory,
  toggleLockMemory,
  decayMemories,
};
