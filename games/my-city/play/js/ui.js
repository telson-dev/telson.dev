/* ===== 界面 ===== */
(function (CM) {
  'use strict';

  const U = {
    els: {},
    modalOpen: false,
    lastChips: '',
    lastSide: '',
    lastInfo: '',
    lastDate: '',
    lastClock: '',
    onModalClose: null
  };

  const TOOLS = [
    { key: 'select', name: '查看', sub: '点击地块看详情' },
    { key: 'clear', name: '开荒', sub: '¥180 起 / 块' },
    { key: 'reclaim', name: '填海造陆', sub: '¥800 起 / 块 · 需临陆' },
    { key: 'road', name: '道路', sub: '¥400 / 块 · 需连通市政厅' },
    { key: 'demolish', name: '拆除', sub: '返还 40% 造价' }
  ];

  const CHIPS = [
    { key: 'money', label: '金库', cls: function (s) { return s.money < 0 ? 'bad' : ''; }, val: function (s) { return CM.money(s.money); } },
    { key: 'pop', label: '人口', cls: function () { return ''; }, val: function (s) { return CM.num(s.pop); } },
    { key: 'jobs', label: '岗位', cls: function () { return ''; }, val: function (s) { return CM.num(s.jobs); } },
    { key: 'emp', label: '就业率', cls: function (s) { return (1 - s.unemployment) >= 0.92 ? 'good' : (1 - s.unemployment) < 0.75 ? 'bad' : 'warn'; },
      val: function (s) { return Math.round((1 - (s.unemployment || 0)) * 100) + '%'; } },
    { key: 'sat', label: '满意度', cls: function (s) { return s.satisfaction >= 65 ? 'good' : s.satisfaction < 40 ? 'bad' : 'warn'; }, val: function (s) { return Math.round(s.satisfaction); } },
    { key: 'pol', label: '污染', opt: true, cls: function (s) { return s.pollution > 55 ? 'bad' : s.pollution > 30 ? 'warn' : 'good'; }, val: function (s) { return Math.round(s.pollution); } },
    { key: 'green', label: '绿地', opt: true, cls: function () { return 'good'; }, val: function (s) { return Math.round(s.green) + '%'; } }
  ];

  function iconHTML(key, name, sub) {
    return '<button class="tool" data-tool="' + key + '">' +
      '<canvas class="ico" data-icon="' + key + '"></canvas>' +
      '<div class="tmeta"><b>' + name + '</b><span>' + sub + '</span></div>' +
      '</button>';
  }

  U.init = function () {
    U.els.chips = CM.$('#statChips');
    U.els.toolbar = CM.$('#toolbar');
    U.els.side = CM.$('#sidepanel');
    U.els.info = CM.$('#infoPanel');
    U.els.layerbar = CM.$('#layerbar');
    U.els.date = CM.$('#dateText');
    U.els.clock = CM.$('#clockText');
    U.els.bar = CM.$('#dayBar');
    U.els.toasts = CM.$('#toasts');
    U.els.modalRoot = CM.$('#modalRoot');

    /* 工具栏 */
    let html = '<div class="tgroup"><div class="tlabel">工具</div>';
    TOOLS.forEach(function (t) { html += iconHTML(t.key, t.name, t.sub); });
    html += '</div>';

    html += '<div class="tgroup"><div class="tlabel">区划（开发商自建）</div><div class="grid2">';
    ['R', 'C', 'I'].forEach(function (z) {
      const zd = CM.ZONES[z];
      html += iconHTML(z, zd.name, '¥40 / 块');
    });
    html += '</div></div>';

    CM.PUB_GROUPS.forEach(function (g) {
      html += '<div class="tgroup"><div class="tlabel">' + g.name + '</div><div class="grid2">';
      g.items.forEach(function (k) {
        const d = CM.PUB[k];
        html += iconHTML(k, d.name, CM.money(d.cost));
      });
      html += '</div></div>';
    });
    U.els.toolbar.innerHTML = html;
    CM.$$('.tool', U.els.toolbar).forEach(function (btn) {
      btn.addEventListener('click', function () { CM.game.setTool(btn.dataset.tool); });
    });
    CM.$$('canvas[data-icon]', U.els.toolbar).forEach(function (cv) {
      CM.renderer.drawIcon(cv, cv.dataset.icon);
    });

    /* 图层条 */
    U.els.layerbar.innerHTML = CM.LAYERS.map(function (l) {
      return '<button class="lb' + (l.key === 'none' ? ' active' : '') + '" data-layer="' + l.key + '">' + l.name + '</button>';
    }).join('');
    CM.$$('.lb', U.els.layerbar).forEach(function (b) {
      b.addEventListener('click', function () { CM.game.setLayer(b.dataset.layer); });
    });

    /* 速度 */
    CM.$$('.sp').forEach(function (b) {
      b.addEventListener('click', function () { CM.game.setSpeed(parseInt(b.dataset.speed, 10)); });
    });

    CM.$('#btnSave').addEventListener('click', function () { if (CM.game.state) U.showSave(CM.game.state); });
    CM.$('#btnMenu').addEventListener('click', function () { if (CM.game.state) U.showMenu(CM.game.state); });

    U.els.info.addEventListener('click', function (e) {
      if (e.target.closest('.ip-close')) CM.game.select(null);
      if (e.target.closest('[data-act="demolish"]')) CM.game.demolishSelected();
    });
  };

  U.setTool = function (key) {
    CM.$$('.tool', U.els.toolbar).forEach(function (b) {
      b.classList.toggle('active', b.dataset.tool === key);
    });
    const cv = CM.$('#world');
    if (cv) cv.classList.toggle('placing', key !== 'select');
  };

  U.setLayer = function (key) {
    CM.$$('.lb', U.els.layerbar).forEach(function (b) {
      b.classList.toggle('active', b.dataset.layer === key);
    });
  };

  U.setSpeed = function (sp) {
    CM.$$('.sp').forEach(function (b) {
      b.classList.toggle('active', parseInt(b.dataset.speed, 10) === sp);
    });
  };

  /* ---------- 刷新 ---------- */
  U.refresh = function (state) {
    if (!state) return;

    let chipHtml = '';
    for (let i = 0; i < CHIPS.length; i++) {
      const c = CHIPS[i];
      chipHtml += '<div class="chip ' + (c.opt ? 'opt ' : '') + c.cls(state) + '"><span class="k">' + c.label + '</span><span class="v">' + c.val(state) + '</span></div>';
    }
    if (chipHtml !== U.lastChips) { U.els.chips.innerHTML = chipHtml; U.lastChips = chipHtml; }

    const cal = CM.sim.calendar(state.day);
    const dateStr = '第 ' + cal.year + ' 年 ' + cal.month + ' 月 ' + cal.day + ' 日';
    if (dateStr !== U.lastDate) { U.els.date.textContent = dateStr; U.lastDate = dateStr; }
    const clockStr = CM.sim.clockText(state.tOfDay);
    if (clockStr !== U.lastClock) { U.els.clock.textContent = clockStr; U.lastClock = clockStr; }
    U.els.bar.style.width = (state.tOfDay * 100).toFixed(1) + '%';

    const sideHtml = buildSide(state);
    if (sideHtml !== U.lastSide) {
      U.els.side.innerHTML = sideHtml;
      U.lastSide = sideHtml;
      const btn = CM.$('#tutClose', U.els.side);
      if (btn) btn.addEventListener('click', function () { state.tutDone = true; U.refresh(state); });
    }

    if (state.selected) {
      const infoHtml = buildInfo(state, state.selected);
      if (infoHtml !== U.lastInfo) {
        U.els.info.innerHTML = infoHtml;
        U.lastInfo = infoHtml;
        U.els.info.classList.remove('hidden');
      }
    } else if (U.lastInfo !== '') {
      U.lastInfo = '';
      U.els.info.innerHTML = '';
      U.els.info.classList.add('hidden');
    }
  };

  function bar(v, color) {
    return '<div class="bar"><i style="width:' + CM.clamp(v, 0, 100) + '%;background:' + color + '"></i></div>';
  }
  function meter(label, v, color) {
    return '<div class="meter"><div class="top"><span>' + label + '</span><b>' + Math.round(v) + '</b></div>' + bar(v, color) + '</div>';
  }

  function buildSide(state) {
    const s = state;
    let h = '';

    if (!state.tutDone && state.tut.step < CM.TUTORIAL.length) {
      const step = CM.TUTORIAL[state.tut.step];
      let dots = '';
      for (let i = 0; i < CM.TUTORIAL.length; i++) dots += '<i class="' + (i <= state.tut.step ? 'on' : '') + '"></i>';
      h += '<div class="card tut">' +
        '<h3>开局引导 <span class="tag">' + (state.tut.step + 1) + '/' + CM.TUTORIAL.length + '</span>' +
        '<button id="tutClose" style="margin-left:auto;color:#8ea3b6;font-size:11px">跳过</button></h3>' +
        '<div class="step">' + step.text + '</div>' +
        '<div class="dots">' + dots + '</div></div>';
    }

    h += '<div class="card"><h3>城市概况</h3>' +
      meter('满意度', s.satisfaction, 'linear-gradient(90deg,#4f9d63,#7ed08c)') +
      meter('失业率', (s.unemployment || 0) * 100, 'linear-gradient(90deg,#c96a5f,#e0867c)') +
      meter('污染', s.pollution, 'linear-gradient(90deg,#8d8f5e,#c96a5f)') +
      meter('绿地率', s.green, 'linear-gradient(90deg,#4f8f5a,#8fd09a)') +
      '<div class="row"><span>陆地 / 海域</span><b>' + Math.round(s.landArea || 0) + ' / ' + Math.round(s.seaArea || 0) + ' 格</b></div>' +
      '<div class="row"><span>已填海</span><b>' + Math.round(s.reclaimedCount || 0) + ' 格</b></div>' +
      '<div class="row" style="margin-top:4px"><span>住房容量 / 岗位</span><b>' + Math.round(s.capacity || 0) + ' / ' + Math.round(s.jobs || 0) + '</b></div>' +
      '<div class="row"><span>常住人口</span><b>' + CM.num(s.pop) + '</b></div>' +
      '</div>';

    h += '<div class="card"><h3>市场需求 <span class="tag">市民想要什么</span></h3>' +
      meter('住宅 · 住得下', (s.demandR || 0) * 100, 'linear-gradient(90deg,#3f9d63,#6fe09a)') +
      meter('商业 · 有事做', (s.demandC || 0) * 100, 'linear-gradient(90deg,#3b7fb5,#5ab6ff)') +
      meter('工业 · 能挣钱', (s.demandI || 0) * 100, 'linear-gradient(90deg,#b57f2f,#f2b95c)') +
      '</div>';

    h += '<div class="card"><h3>财政 <span class="tag">每月</span></h3>' +
      '<div class="row"><span>税收收入</span><b class="up">+' + CM.money(s.revenue || 0) + '</b></div>' +
      '<div class="row"><span>维护支出</span><b class="down">-' + CM.money(s.upkeep || 0) + '</b></div>' +
      '<div class="row" style="border-top:1px solid var(--line);margin-top:4px;padding-top:6px"><span>月净额</span><b class="' + ((s.net || 0) >= 0 ? 'up' : 'down') + '">' + ((s.net || 0) >= 0 ? '+' : '') + CM.money(s.net || 0) + '</b></div>' +
      '<div class="row"><span>金库</span><b class="' + (s.money < 0 ? 'down' : '') + '">' + CM.money(s.money) + '</b></div>' +
      '</div>';

    const r = (s.summary && s.summary.svcRates) || {};
    let rows = '';
    for (const k in CM.SVC) {
      const v = Math.round((r[k] || 0) * 100);
      rows += '<div class="row"><span>' + CM.SVC[k] + '</span><b class="' + (v >= 95 ? 'up' : v < 60 ? 'down' : '') + '">' + v + '%</b></div>';
    }
    h += '<div class="card"><h3>服务覆盖 <span class="tag">按人口</span></h3>' + rows + '</div>';

    return h;
  }

  function buildInfo(state, t) {
    const b = t.building;
    const def = b ? (CM.RES[b.kind] || CM.PUB[b.kind]) : null;
    const terr = CM.TERRAIN[t.terrain];

    /* ---- 海域面板 ---- */
    if (t.terrain === 'sea') {
      const canReclaim = CM.landNeighbor(state, t);
      let rows = '<div class="ip-desc">' + terr.desc + '</div>';
      rows += '<div class="row"><span>离岸深度</span><b>' + (t.seaDepth != null ? t.seaDepth : (t.depth || 0)) + ' 格</b></div>';
      rows += canReclaim
        ? '<div class="row"><span>填海造价</span><b>' + CM.money(CM.reclaimCost(t)) + '</b></div>'
        : '<div class="row"><span>填海造价</span><b class="down">不临陆地，无法填海</b></div>';
      return '<div class="ip-head"><span class="ip-title">海洋</span>' +
        '<span class="ip-sub">(' + t.x + ', ' + t.y + ')</span>' +
        '<button class="ip-close" title="关闭">×</button></div>' +
        rows + '<div class="badges"><span class="badge off">不可建设</span>' +
        (canReclaim ? '<span class="badge on">可用填海造陆</span>' : '') + '</div>';
    }

    let title, sub;
    if (def) {
      title = def.name + (CM.RES[b.kind] ? ' · ' + def.level + ' 级' : '');
      sub = '(' + t.x + ', ' + t.y + ') · ' + (b.active ? '运转中' : '停摆');
    } else if (t.zone) {
      title = CM.ZONES[t.zone].name + ' · 待开发';
      sub = '(' + t.x + ', ' + t.y + ') · ' + terr.name;
    } else if (t.road) {
      title = '道路';
      sub = '(' + t.x + ', ' + t.y + ') · ' + (t.roadConn ? '已连通市政厅' : '未连通市政厅');
    } else {
      title = terr.name + (t.cleared ? ' · 已开垦' : ' · 未开垦');
      sub = '(' + t.x + ', ' + t.y + ')';
    }

    let rows = '';
    if (def) {
      if (def.desc) rows += '<div class="ip-desc">' + def.desc + '</div>';
      if (def.cap) rows += '<div class="row"><span>居住容量</span><b>' + def.cap + ' 户</b></div>';
      if (def.jobs) rows += '<div class="row"><span>提供岗位</span><b>' + def.jobs + ' 个</b></div>';
      if (def.pol) rows += '<div class="row"><span>污染</span><b class="down">+' + def.pol + '</b></div>';
      if (def.upkeep) rows += '<div class="row"><span>维护费</span><b class="down">-' + CM.money(def.upkeep) + ' / 月</b></div>';
      if (def.cost) rows += '<div class="row"><span>造价</span><b>' + CM.money(def.cost) + '</b></div>';
    }
    if (b && !b.active) {
      rows += '<div class="row"><span>停摆原因</span><b class="down">' +
        (!t.access ? '没有道路接入' : (!t.cov.power ? '缺电' : '缺水')) + '</b></div>';
    }
    rows += '<div class="row"><span>局部污染</span><b>' + Math.round(t.pollution) + '</b></div>';
    rows += '<div class="row"><span>地价</span><b>' + t.value + '</b></div>';

    let badges = '';
    if (b || t.zone) {
      let roadOk = false;
      const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (let k = 0; k < 4; k++) {
        const o = CM.tileAt(state, t.x + DIRS[k][0], t.y + DIRS[k][1]);
        if (o && o.road && o.roadConn) { roadOk = true; break; }
      }
      if (t.zone && !b && !roadOk) badges += '<span class="badge off">缺道路接入</span>';
      for (const k in CM.SVC) {
        badges += '<span class="badge ' + (t.cov[k] ? 'on' : 'off') + '">' + CM.SVC[k] + '</span>';
      }
    } else if (!t.cleared) {
      badges = '<span class="badge off">尚未开垦</span><span class="badge">开垦费 ' +
        CM.money(Math.round(terr.clearCost)) + '</span>';
      if (t.coast) badges += '<span class="badge on">临海</span>';
    } else if (t.terrain === 'reclaimed' && !t.building && !t.road && !t.zone) {
      badges = '<span class="badge on">新填陆地</span><span class="badge">可直接建设</span>';
    }

    return '<div class="ip-head"><span class="ip-title">' + title + '</span>' +
      '<span class="ip-sub">' + sub + '</span>' +
      '<button class="ip-close" title="关闭">×</button></div>' +
      rows + '<div class="badges">' + badges + '</div>' +
      (b || t.road || t.zone ? '<div class="ip-actions"><button data-act="demolish">拆除 / 清除</button></div>' : '');
  }

  /* ---------- 提示 ---------- */
  U.toast = function (msg, kind) {
    const d = CM.el('div', 'toast' + (kind ? ' ' + kind : ''));
    d.innerHTML = msg;
    U.els.toasts.appendChild(d);
    setTimeout(function () {
      d.classList.add('out');
      setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 380);
    }, 2800);
    while (U.els.toasts.children.length > 3) U.els.toasts.removeChild(U.els.toasts.firstChild);
  };

  /* ---------- 弹窗 ---------- */
  U.openModal = function (html, onClose) {
    U.els.modalRoot.innerHTML = '<div class="modal">' + html + '</div>';
    U.els.modalRoot.classList.add('on');
    U.modalOpen = true;
    U.onModalClose = onClose || null;
  };

  U.closeModal = function () {
    U.els.modalRoot.classList.remove('on');
    U.els.modalRoot.innerHTML = '';
    U.modalOpen = false;
    const cb = U.onModalClose;
    U.onModalClose = null;
    if (cb) cb();
  };

  U.showSave = function (state) {
    const slots = CM.game.listSaves();
    let html = '<div class="m-kicker">存档</div><h2>保存与读取</h2>';
    html += '<p style="font-size:11.5px">存档保存在本机浏览器里；每 3 个月会自动存档一次。</p>';
    slots.forEach(function (s) {
      html += '<div class="slot"><div class="sinfo"><b>' + s.name + '</b><span>' + s.desc + '</span></div>' +
        '<button data-save="' + s.slot + '">保存</button>' +
        (s.exists ? '<button data-load="' + s.slot + '">读取</button><button data-del="' + s.slot + '">删除</button>' : '') +
        '</div>';
    });
    html += '<div class="mrow"><button id="svClose">关闭</button></div>';
    U.openModal(html);
    state.paused = true;
    CM.$('#svClose', U.els.modalRoot).addEventListener('click', function () { U.closeModal(); state.paused = false; });
    CM.$$('[data-save]', U.els.modalRoot).forEach(function (b) {
      b.addEventListener('click', function () {
        const ok = CM.game.saveGame(b.dataset.save);
        U.closeModal();
        state.paused = false;
        U.toast(ok ? '已保存到「' + CM.game.slotName(b.dataset.save) + '」' : '保存失败：浏览器禁止本地存储', ok ? 'good' : 'bad');
      });
    });
    CM.$$('[data-load]', U.els.modalRoot).forEach(function (b) {
      b.addEventListener('click', function () {
        const ok = CM.game.loadGame(b.dataset.load);
        if (ok) { U.closeModal(); U.toast('已读取存档', 'good'); }
        else U.toast('存档损坏或版本不符', 'bad');
      });
    });
    CM.$$('[data-del]', U.els.modalRoot).forEach(function (b) {
      b.addEventListener('click', function () {
        CM.game.deleteSave(b.dataset.del);
        U.closeModal();
        state.paused = false;
        U.showSave(state);
      });
    });
  };

  U.showMenu = function (state) {
    const cal = CM.sim.calendar(state.day);
    const html = '<div class="m-kicker">菜单</div><h2>' + CM.MODE[state.mode].name + ' · ' + state.W + '×' + state.H + '</h2>' +
      '<p style="font-size:11.5px">第 ' + cal.year + ' 年 ' + cal.month + ' 月 ' + cal.day + ' 日 · 人口 ' + CM.num(state.pop) +
      ' · 城市评分 ' + CM.sim.score(state) + ' / 100</p>' +
      '<div class="m-actions">' +
      '<button class="mbtn" id="mResume"><b>继续游戏</b><span>回到城市</span></button>' +
      '<button class="mbtn" id="mHelp"><b>玩法说明</b><span>核心机制与数值含义</span></button>' +
      '<button class="mbtn" id="mRestart"><b>重新开始</b><span>放弃当前城市，回到开始界面</span></button>' +
      '</div>';
    U.openModal(html);
    state.paused = true;
    CM.$('#mResume', U.els.modalRoot).addEventListener('click', function () { U.closeModal(); state.paused = false; });
    CM.$('#mHelp', U.els.modalRoot).addEventListener('click', function () { U.showHelp(state); });
    CM.$('#mRestart', U.els.modalRoot).addEventListener('click', function () {
      U.closeModal(); state.paused = true; CM.game.toStart();
    });
  };

  U.showHelp = function (state) {
    const html = '<div class="m-kicker">玩法说明</div><h2>怎么经营这座岛</h2>' +
      '<p><b>0. 你在一座岛上。</b>四面是海，岛的<b>大小与形状由地图种子决定</b>。海面不能建设，只能用「填海造陆」把海变成陆地——必须紧邻已有陆地，越往深海填越贵（紧邻 ¥800 起，每深一格 +¥700）。</p>' +
      '<p><b>1. 土地是自然的。</b>全图原本是草地、林地、缓丘与河流，任何建设先要「开荒」；林地更贵、缓丘最贵，水域不能建。</p>' +
      '<p><b>2. 你只划线，开发商来盖。</b>住宅区会长出低层住宅楼 → 多层公寓 → 高层住宅；商业区是临街商铺 → 小型超市 → 大型综合体；工业区是小型工厂 → 物流仓库 → 重工业园区。地价和满意度越高，楼越高。</p>' +
      '<p><b>3. 配套要跟上。</b>道路必须连到市政厅；建筑挨着没连通的路、或缺水缺电，都会停摆。水电、治安、消防、教育、医疗、绿地、环卫都有覆盖半径。</p>' +
      '<p><b>4. 时间按天走。</b>1× 速度下 5 分钟一个游戏日，有昼夜变化；可以随时加速到 2×/4×/8×/16× 或暂停。</p>' +
      '<p><b>5. 钱来自税收。</b>住宅提供人口、商业和工业提供岗位；月收入＝人口税＋岗位税，维护费每月扣。经营模式里金库为负时不能继续动工。</p>' +
      '<p><b>6. 沙盒模式</b>资金无限，适合试验布局、看城市长大。</p>' +
      '<div class="mrow"><button id="hpClose" class="primary">知道了</button></div>';
    U.openModal(html);
    state.paused = true;
    CM.$('#hpClose', U.els.modalRoot).addEventListener('click', function () {
      U.closeModal();
      state.paused = false;
      U.refresh(state);
    });
  };

  /* ---------- 开始界面 ---------- */
  U.showStart = function (onStart, hasSave) {
    const sc = CM.$('#startScreen');
    sc.classList.remove('hidden');
    const seedIn = CM.$('#seedInput');

    /* 玩家只能定种子；岛的大小与地图尺寸由种子决定 */
    function previewSeed() {
      const seed = seedIn.value || '20261115';
      let map = null;
      try { map = CM.mapgen(seed); } catch (e) { }
      const hint = CM.$('#seedHint');
      if (!hint) return;
      if (map) {
        hint.textContent = '这张图：' + map.W + '×' + map.H + ' 格 · 陆地 ' + map.landCount + ' 格 · 海域 ' + map.seaCount + ' 格';
      } else {
        hint.textContent = '岛的大小、形状、地块与地图尺寸，全部由种子决定';
      }
    }
    seedIn.oninput = previewSeed;
    seedIn.onchange = previewSeed;
    previewSeed();

    CM.$$('.mode', sc).forEach(function (b) {
      b.onclick = function () {
        const seed = seedIn.value || '20261115';
        U.hideStart();
        onStart(b.dataset.mode, seed);
      };
    });

    const cont = CM.$('#btnContinue');
    cont.classList.toggle('hidden', !hasSave);
    cont.onclick = function () {
      if (CM.game.loadGame('auto')) { U.hideStart(); U.toast('已读取自动存档', 'good'); }
    };
  };

  U.hideStart = function () {
    CM.$('#startScreen').classList.add('hidden');
  };

  /* 新局 / 读档时清掉上一局的界面残留 */
  U.resetHud = function () {
    U.lastChips = ''; U.lastSide = ''; U.lastInfo = ''; U.lastDate = ''; U.lastClock = '';
    if (!U.els.info) return;
    U.els.info.innerHTML = '';
    U.els.info.classList.add('hidden');
    U.els.toasts.innerHTML = '';
  };

  CM.ui = U;

})(window.CM);
