// services/api.js — 通用 API 请求封装
const db = wx.cloud.database();
const _ = db.command;

/**
 * 云开发数据库操作封装
 * 文档型数据库，天然 JSON 友好，记忆/日记/健康数据直接存储
 */
const api = {
  db,

  /** 获取云数据库集合引用 */
  collection(name) {
    return db.collection(name);
  },

  /** 通用查询 */
  async query(collection, where = {}, options = {}) {
    const {
      orderBy = 'createdAt',
      order = 'desc',
      skip = 0,
      limit = 20,
    } = options;

    let query = db.collection(collection).where(where);

    if (orderBy) {
      query = query.orderBy(orderBy, order);
    }

    const res = await query.skip(skip).limit(limit).get();
    return res.data;
  },

  /** 根据 ID 获取单条 */
  async getById(collection, id) {
    const res = await db.collection(collection).doc(id).get();
    return res.data;
  },

  /** 新增 */
  async add(collection, data) {
    const res = await db.collection(collection).add({
      data: { ...data, createdAt: new Date(), updatedAt: new Date() },
    });
    return res._id;
  },

  /** 更新 */
  async update(collection, id, data) {
    await db.collection(collection).doc(id).update({
      data: { ...data, updatedAt: new Date() },
    });
  },

  /** 删除 */
  async remove(collection, id) {
    await db.collection(collection).doc(id).remove();
  },

  /** 计数 */
  async count(collection, where = {}) {
    const res = await db.collection(collection).where(where).count();
    return res.total;
  },

  /** 聚合查询 */
  async aggregate(collection, pipeline) {
    const res = await db.collection(collection).aggregate().match(pipeline.match || {})
      .group(pipeline.group || {})
      .end();
    return res.list;
  },

  /** 调用云函数 */
  async callFunction(name, data = {}) {
    const res = await wx.cloud.callFunction({ name, data });
    return res.result;
  },
};

module.exports = api;
