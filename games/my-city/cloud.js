/* 云端账号与存档客户端（站点与游戏共用）
   后端地址集中在 api-config.js 里改一行即可。 */
(function () {
  var API = (window.MC_API || '/api').replace(/\/+$/, '');

  function req(method, path, body) {
    var opt = {
      method: method,
      credentials: 'include',
      headers: { 'Accept': 'application/json' },
      cache: 'no-store'
    };
    if (body !== undefined) {
      opt.headers['Content-Type'] = 'application/json';
      opt.body = JSON.stringify(body);
    }
    return fetch(API + path, opt).then(function (r) {
      return r.json().catch(function () { return { ok: false, code: 'bad_response' }; })
        .then(function (j) {
          if (!r.ok || j.ok === false) {
            var err = new Error(j.error || ('HTTP ' + r.status));
            err.code = j.code || 'http_' + r.status;
            err.status = r.status;
            throw err;
          }
          return j;
        });
    });
  }

  var Cloud = {
    api: API,
    reachable: null,

    /* 探测后端是否在线：离线时前端要能优雅退化 */
    probe: function () {
      return req('GET', '/health').then(function (j) {
        Cloud.reachable = true;
        return j;
      }).catch(function () {
        Cloud.reachable = false;
        return null;
      });
    },

    me: function () { return req('GET', '/auth/me'); },
    register: function (u, p) { return req('POST', '/auth/register', { username: u, password: p }); },
    login: function (u, p) { return req('POST', '/auth/login', { username: u, password: p }); },
    logout: function () { return req('POST', '/auth/logout'); },

    saves: function () { return req('GET', '/saves'); },
    load: function (slot) { return req('GET', '/saves/' + encodeURIComponent(slot)); },
    save: function (slot, data, meta) {
      return req('PUT', '/saves/' + encodeURIComponent(slot), { data: data, meta: meta || {} });
    },
    del: function (slot) { return req('DELETE', '/saves/' + encodeURIComponent(slot)); }
  };

  window.MCCloud = Cloud;
})();
