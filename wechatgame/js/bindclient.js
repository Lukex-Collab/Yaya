// bindclient.js - 绑定客户端：读"卡" -> /bind 或 /tap -> 持久化 pet_id
// 原则：客户端只转发 token/sig，唯一性由服务端裁定；离线时降级为本地物种，不阻塞游玩。
var bus = require('./events');
var state = require('./state');
var net = require('./net');

var STORAGE_KEY = 'lingpal_bind';

function storage() {
  try {
    if (typeof wx !== 'undefined' && wx.getStorageSync && wx.setStorageSync) return wx;
  } catch (e) {}
  return null;
}

function loadLocal() {
  var st = storage();
  if (!st) return null;
  try {
    var raw = st.getStorageSync(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return null;
}

function saveLocal(data) {
  var st = storage();
  if (!st) return;
  try { st.setStorageSync(STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
}

// 启动时调用：已绑定 -> /tap 签到；未绑定 -> /bind；服务不可达 -> 离线兜底
function init(card) {
  var local = loadLocal();
  if (local && local.petId) {
    state.pet.petId = local.petId;
    state.pet.speciesId = local.speciesId || card.speciesId;
    return net.request(card.server + '/tap', {
      token: card.token, sig: card.sig, nonce: nonce()
    }).then(function (r) {
      if (r.status === 200) {
        bus.emit(bus.EVENTS.BIND_DONE, { petId: local.petId, first: false, speciesId: state.pet.speciesId });
      }
      return r;
    }).catch(function (e) {
      console.warn('[bind] tap offline: ' + e.message);
      return null;
    });
  }

  return net.request(card.server + '/bind', {
    token: card.token, sig: card.sig, nonce: nonce(), openid: 'dev_openid'
  }).then(function (r) {
    if (r.status === 200 && r.body && r.body.pet_id) {
      var data = { petId: r.body.pet_id, speciesId: r.body.species_id || card.speciesId };
      saveLocal(data);
      state.pet.petId = data.petId;
      state.pet.speciesId = data.speciesId;
      bus.emit(bus.EVENTS.BIND_DONE, { petId: data.petId, first: !!r.body.first_bind, speciesId: data.speciesId });
    }
    return r;
  }).catch(function (e) {
    // 服务未启动：离线兜底，仍可玩
    console.warn('[bind] bind offline, fallback to local species: ' + e.message);
    state.pet.speciesId = card.speciesId;
    return null;
  });
}

function nonce() {
  var t = Date.now().toString(36);
  var r = Math.random().toString(36).slice(2, 10);
  return t + '_' + r;
}

module.exports = { init: init, loadLocal: loadLocal, STORAGE_KEY: STORAGE_KEY };
