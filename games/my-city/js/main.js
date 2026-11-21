/* ===== 启动 ===== */
(function (CM) {
  'use strict';

  function boot() {
    window.addEventListener('error', function (e) {
      try {
        const box = document.getElementById('toasts');
        if (box) {
          const d = document.createElement('div');
          d.className = 'toast bad';
          d.style.pointerEvents = 'auto';
          d.textContent = '脚本出错：' + (e.message || e.error) + ' @ ' + (e.filename || '').split('/').pop() + ':' + e.lineno;
          box.appendChild(d);
        }
        document.title = 'ERR ' + (e.message || '');
      } catch (err) { }
    });

    try {
      CM.game.init();
      /* 开发入口：index.html?demo=1&days=180&tod=0.7&seed=8888 */
      const q = new URLSearchParams(location.search);
      if (q.get('demo')) {
        CM.game.demo({
          days: parseInt(q.get('days') || '180', 10),
          tod: q.get('tod') != null ? parseFloat(q.get('tod')) : null,
          seed: q.get('seed') || '20261115'
        });
      }
      /* 开发入口：直接开局 ?start=manage&seed=123 */
      if (q.get('start')) {
        CM.ui.hideStart();
        CM.game.start(q.get('start'), q.get('seed') || '20261115');
        CM.game.setSpeed(0);
      }
      const nm = (q.get('name') || '').trim();
      if (nm) {
        document.title = nm + ' · 城市经营';
        const bt = document.querySelector('.brand-text');
        if (bt) bt.textContent = nm;
        const h1 = document.querySelector('.start-card h1');
        if (h1) h1.innerHTML = CM.esc(nm.slice(0, -2)) + '<span class="gold">' + CM.esc(nm.slice(-2)) + '</span>';
      }
    } catch (err) {
      console.error(err);
      const box = document.getElementById('toasts');
      if (box) {
        const d = document.createElement('div');
        d.className = 'toast bad';
        d.textContent = '初始化失败：' + err.message;
        box.appendChild(d);
      }
      document.title = 'ERR ' + err.message;
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

})(window.CM);
