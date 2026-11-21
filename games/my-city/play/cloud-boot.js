/* 游戏启动时的云端接线：
   1) 查询登录状态（未登录就纯本机存档，不影响游戏）
   2) 地址栏带 ?slot= 时，直接从云端读该槽位
   3) 顶部显示云端同步状态小徽标 */
(function () {
  if (!window.CM || !CM.game || !window.MCCloud) return;

  var G = CM.game;

  /* 顶栏小徽标：本机 / 云端 状态 */
  function badge(text, kind) {
    var el = document.getElementById('cloudState');
    if (!el) {
      var host = document.querySelector('#topbar .clock') || document.querySelector('#topbar');
      if (!host) return;
      el = document.createElement('div');
      el.id = 'cloudState';
      el.className = 'cloud-state';
      host.appendChild(el);
    }
    el.textContent = text;
    el.className = 'cloud-state' + (kind ? ' cloud-state--' + kind : '');
  }

  CM.ui.cloudBadge = function (kind) {
    if (!G.cloudUser) return;
    if (kind === 'ok') badge('云端已同步', 'ok');
    else badge('云端同步失败', 'err');
  };

  /* 等游戏自身启动完成再接线（main.js 里是 DOMContentLoaded） */
  function boot() {
    MCCloud.probe().then(function (up) {
      if (!up) { badge('本机存档', ''); return; }

      MCCloud.me().then(function (j) {
        G.cloudUser = j.user || null;

        if (!G.cloudUser) {
          badge('本机存档（未登录）', '');
          return;
        }

        badge('已登录 ' + G.cloudUser.username, 'ok');

        var q = new URLSearchParams(location.search);
        var slot = q.get('slot');
        if (slot) {
          G.loadCloud(slot).then(function (ok) {
            if (ok) {
              badge('已载入云端存档', 'ok');
            } else {
              badge('云端没有这个存档', 'err');
            }
          });
        }
      }).catch(function () {
        badge('本机存档', '');
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 100); });
  } else {
    setTimeout(boot, 100);
  }
})();
