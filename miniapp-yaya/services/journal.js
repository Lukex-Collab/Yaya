// services/journal.js — 手账日记服务
const api = require('./api');
const { buildJournalPrompt } = require('../utils/prompts');
const { AI_MODEL } = require('../utils/constants');
const JOURNAL_COLLECTION = 'journals';

/**
 * 从对话生成牙牙视角日记
 * 参考文档 4.3.2 节：以牙牙第一人称口吻书写
 */
async function generateJournal(userId, messages, date) {
  try {
    const prompt = buildJournalPrompt(messages, date);
    const ai = wx.cloud.extend.AI;
    const res = await ai.chatCompletions({
      model: AI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: 500,
    });

    const text = res.choices?.[0]?.message?.content || '{}';
    const jsonStr = text.replace(/```json|```/g, '').trim();
    const journal = JSON.parse(jsonStr);

    const id = await api.add(JOURNAL_COLLECTION, {
      userId,
      title: journal.title || '牙牙的日记',
      content: journal.content || '今天什么也没发生...',
      emoji: journal.emoji || '📖',
      emotion: journal.emotion || 'neutral',
      wordCount: (journal.content || '').length,
      linkedMemories: [],
      isPrivate: false,
      date: date || new Date().toISOString().split('T')[0],
      source: 'ai',  // ai | user
    });

    return { id, ...journal };
  } catch (err) {
    console.error('[journal] 生成失败:', err);
    return null;
  }
}

/**
 * 获取日记列表
 */
async function getJournals(userId, options = {}) {
  const { emotion, page = 1, pageSize = 20 } = options;
  const where = { userId };
  if (emotion) where.emotion = emotion;

  return api.query(JOURNAL_COLLECTION, where, {
    orderBy: 'date',
    order: 'desc',
    skip: (page - 1) * pageSize,
    limit: pageSize,
  });
}

/**
 * 获取单篇日记
 */
async function getJournal(journalId) {
  return api.getById(JOURNAL_COLLECTION, journalId);
}

/**
 * 创建日记（用户手动）
 */
async function createJournal(userId, data) {
  return api.add(JOURNAL_COLLECTION, {
    userId,
    title: data.title,
    content: data.content,
    emoji: data.emoji || '📝',
    emotion: data.emotion || 'neutral',
    wordCount: (data.content || '').length,
    isPrivate: data.isPrivate || false,
    date: new Date().toISOString().split('T')[0],
    source: 'user',
    linkedMemories: data.linkedMemories || [],
  });
}

/**
 * 更新日记
 */
async function updateJournal(journalId, data) {
  return api.update(JOURNAL_COLLECTION, journalId, data);
}

/**
 * 删除日记
 */
async function deleteJournal(journalId) {
  return api.remove(JOURNAL_COLLECTION, journalId);
}

/**
 * 获取情绪统计
 */
async function getMoodStats(userId, period = 'month') {
  const days = period === 'week' ? 7 : period === 'month' ? 30 : 90;
  const startDate = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];

  const journals = await api.query(JOURNAL_COLLECTION, {
    userId,
    date: wx.cloud.database()._.gte(startDate),
  }, { orderBy: 'date', order: 'asc', limit: 100 });

  // 按情绪分组统计
  const stats = {};
  for (const j of journals) {
    stats[j.emotion] = (stats[j.emotion] || 0) + 1;
  }

  return {
    total: journals.length,
    distribution: stats,
    timeline: journals.map(j => ({ date: j.date, emotion: j.emotion, emoji: j.emoji })),
  };
}

module.exports = {
  generateJournal,
  getJournals,
  getJournal,
  createJournal,
  updateJournal,
  deleteJournal,
  getMoodStats,
};
