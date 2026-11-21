/* 游戏介绍页的账号面板：注册 / 登录 / 云端存档列表 */
(function () {
  function $(s) { return document.querySelector(s); }

  var form = $('#authForm');
  if (!form) return;

  var msg = $('#authMsg');
  var body = $('#cloudBody');
  var btnLogin = $('#btnLogin');
  var btnRegister = $('#btnRegister');

  function say(text, kind) {
    if (!msg) return;
    msg.textContent = text || '';
    msg.className = 'auth-msg' + (kind ? ' auth-msg--' + kind : '');
  }

  function busy(on) {
    if (btnLogin) btnLogin.disabled = on;
    if (btnRegister) btnRegister.disabled = on;
  }

  function fmtTime(ts) {
    try {
      return new Date(ts * 1000).toLocaleString('zh-CN', { hour12: false });
    } catch (e) {
      return '';
    }
  }

  function slotLabel(slot) {
    return slot === 'auto' ? '自动存档' : '存档 ' + slot;
  }

  function renderGuest(note) {
    body.innerHTML =
      '<p class="muted" style="font-size:13.5px;margin:0">' +
      (note || '尚未登录。登录后这里会列出你在云端的存档，可以直接读档继续。') +
      '</p>';
  }

  function renderSaves(user, saves) {
    var head = '<p class="auth-user">已登录：<strong>' + escapeHtml(user.username) + '</strong>' +
      ' <button type="button" class="linkbtn" id="btnLogout">退出</button></p>';
    if (!saves.length) {
      body.innerHTML = head + '<p class="muted" style="font-size:13.5px;margin:10px 0 0">云端还没有存档。进入游戏后会自动同步。</p>';
    } else {
      var rows = saves.map(function (s) {
        return '<div class="save-row">' +
          '<span class="save-slot">' + escapeHtml(slotLabel(s.slot)) + '</span>' +
          '<span class="save-size">' + Math.round(s.bytes / 1024) + ' KB · ' + fmtTime(s.updatedAt) + '</span>' +
          '<a class="save-go" href="play/?slot=' + encodeURIComponent(s.slot) + '">继续游玩 →</a>' +
          '</div>';
      }).join('');
      body.innerHTML = head + rows;
    }
    var lo = $('#btnLogout');
    if (lo) lo.addEventListener('click', function () {
      busy(true);
      MCCloud.logout().then(function () {
        say('已退出登录', 'ok');
        refresh();
      }).catch(function (e) {
        say('退出失败：' + e.message, 'err');
      }).then(function () { busy(false); });
    });
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function refresh() {
    renderGuest(cloud.guestNote);
    return MCCloud.me().then(function (j) {
      if (!j.user) {
        renderGuest();
        return;
      }
      renderSaves(j.user, j.saves || []);
    }).catch(function () {
      renderGuest(cloud.offline);
    });
  }

  var cloud = {
    guestNote: null,
    offline: '云端服务暂时连不上（可能维护中）。不登录也能玩，进度存在本机浏览器里。'
  };

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var u = ($('#authUser').value || '').trim();
    var p = $('#authPass').value || '';
    if (!u || !p) { say('请填写用户名和密码', 'err'); return; }
    busy(true);
    say('登录中…');
    MCCloud.login(u, p).then(function (j) {
      say('欢迎回来，' + j.user.username, 'ok');
      $('#authPass').value = '';
      refresh();
    }).catch(function (e) {
      say(e.status === 401 ? '用户名或密码不对'
        : e.status === 429 ? '尝试太频繁，请稍后再试'
          : '登录失败：' + e.message, 'err');
    }).then(function () { busy(false); });
  });

  if (btnRegister) {
    btnRegister.addEventListener('click', function () {
      var u = ($('#authUser').value || '').trim();
      var p = $('#authPass').value || '';
      if (!u || p.length < 8) {
        say('用户名 3～24 位、密码至少 8 位', 'err');
        return;
      }
      busy(true);
      say('注册中…');
      MCCloud.register(u, p).then(function (j) {
        say('注册成功，已自动登录：' + j.user.username, 'ok');
        $('#authPass').value = '';
        refresh();
      }).catch(function (e) {
        say(e.status === 409 ? '这个用户名已被占用'
          : e.status === 429 ? '注册太频繁，请稍后再试'
            : '注册失败：' + e.message, 'err');
      }).then(function () { busy(false); });
    });
  }

  /* 启动：先探测后端，再拉账号状态 */
  MCCloud.probe().then(function (j) {
    if (!j) {
      /* 后端还没上线：不当作错误，明确告诉玩家现在就是本机存档 */
      renderGuest('云端存档正在开通中。现在进游戏用的是这台电脑上的本机存档，等开通后登录即可同步。');
      say('云端存档开通中', '');
      var card = $('#authCard');
      if (card) card.classList.add('is-offline');
      return;
    }
    refresh();
  });
})();
