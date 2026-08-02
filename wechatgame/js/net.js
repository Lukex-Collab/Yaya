// net.js - 极简请求封装：wx.request 优先，Node/测试环境回退 fetch
function request(url, body) {
  return new Promise(function (resolve, reject) {
    var wxx = (typeof wx !== 'undefined') ? wx : ((typeof window !== 'undefined' && window.wx) || null);
    if (wxx && wxx.request) {
      wxx.request({
        url: url,
        method: 'POST',
        header: { 'content-type': 'application/json' },
        data: body,
        success: function (res) { resolve({ status: res.statusCode, body: res.data }); },
        fail: function (err) { reject(err); }
      });
    } else if (typeof fetch === 'function') {
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }).then(function (r) {
        return r.json().then(function (j) { resolve({ status: r.status, body: j }); });
      }).catch(reject);
    } else {
      reject(new Error('no request transport'));
    }
  });
}

module.exports = { request: request };
