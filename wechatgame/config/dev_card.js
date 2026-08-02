// dev_card.js - 开发期"实体卡"模拟（生产由扫码/NFC 读卡传入）
// sig 由服务端 secret 预签（见 server/src/bind.js），客户端只转发、不持有 secret。
module.exports = {
  token: 'tok_dev_linghu',
  sig: '460ecb1970158e2e28dbb5e50385b7b286ace33442224bcc3cbe48a26daefee0',
  speciesId: 'linghu',
  server: 'http://127.0.0.1:8787'
};
