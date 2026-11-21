/* 云端账号与存档客户端（站点与游戏共用）

鉴权优先级：
  1) 跨域部署（前端 telson.dev，后端 winbow-net.com）→ Bearer token，存 localStorage。
     原因：.dev 无法在大陆服务器备案，站点只能留在境外 Pages，跨站 Cookie 会被浏览器拦。
  2) 同源部署（nginx 把 /api 与站点放一起）→ Cookie 也能用，token 同样有效。
后端地址只改 api-config.js 一行。
*/
(function () {
  var API = (window.MC_API || '/api').replace(/\/+$/, '');
  var TOKEN_KEY = 'mc_token';

  function getToken() {
    try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; }
  }
  function setToken(t) {
    try {
      if (t) localStorage.setItem(TOKEN_KEY, t);
      else localStorage.removeItem(TOKEN_KEY);
    } catch (e) { }
  }

  function req(method, path, body) {
    var opt = {
      method: method,
      credentials: 'include',
      headers: { 'Accept': 'application/json' },
      cache: 'no-store'
    };
    var token = getToken();
    if (token) opt.headers['Authorization'] = 'Bearer ' + token;
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
            if (r.status === 401) setToken('');
            throw err;
          }
          return j;
        });
    });
  }

  var Cloud = {
    api: API,
    reachable: null,
    getToken: getToken,

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

    register: function (u, p) {
      return req('POST', '/auth/register', { username: u, password: p }).then(function (j) {
        if (j.token) setToken(j.token);
        return j;
      });
    },

    login: function (u, p) {
      return req('POST', '/auth/login', { username: u, password: p }).then(function (j) {
        if (j.token) setToken(j.token);
        return j;
      });
    },

    logout: function () {
      return req('POST', '/auth/logout').catch(function () { }).then(function () {
        setToken('');
      });
    },

    saves: function () { return req('GET', '/saves'); },
    load: function (slot) { return req('GET', '/saves/' + encodeURIComponent(slot)); },
    save: function (slot, data, meta) {
      return req('PUT', '/saves/' + encodeURIComponent(slot), { data: data, meta: meta || {} });
    },
    del: function (slot) { return req('DELETE', '/saves/' + encodeURIComponent(slot)); }
  };

  window.MCCloud = Cloud;
})();
