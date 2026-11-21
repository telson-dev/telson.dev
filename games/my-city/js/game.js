/* ===== 游戏主控：状态、工具、输入、日推进、存档 ===== */
(function (CM) {
  'use strict';

  const PAINT_TOOLS = { clear: 1, road: 1, R: 1, C: 1, I: 1, reclaim: 1 };

  const store = {
    mem: {},
    get: function (k) {
      try { const v = localStorage.getItem(k); if (v != null) return v; } catch (e) { }
      return store.mem[k] != null ? store.mem[k] : null;
    },
    set: function (k, v) {
      try { localStorage.setItem(k, v); return true; }
      catch (e) { store.mem[k] = v; return false; }
    },
    del: function (k) {
      try { localStorage.removeItem(k); } catch (e) { }
      delete store.mem[k];
    }
  };

  const G = {
    state: null,
    drag: null,
    panning: null,
    lastDeny: 0,
    lastTick: 0,
    uiAcc: 0
  };

  /* ---------- 新局 ---------- */
  function newState(mode, seed) {
    const map = CM.mapgen(seed);
    const sandbox = mode === 'sandbox';
    return {
      v: 4,
      mode: mode,
      seed: map.seed,
      W: map.W, H: map.H,
      hall: map.hall,
      tiles: map.tiles,
      day: 1,
      tOfDay: 0.28,
      speed: 1,
      paused: false,
      money: sandbox ? CM.MODE.sandbox.money : CM.startMoney(map.W, map.H),
      pop: 0, capacity: 0, jobs: 0, employed: 0, labor: 0, unemployment: 0,
      satisfaction: 58,
      pollution: 0, green: 0,
      taxRate: 0.1,
      revenue: 0, upkeep: 0, net: 0,
      demandR: 0.6, demandC: 0.4, demandI: 0.3,
      selected: null, hover: null,
      tool: 'select',
      overlay: 'none',
      tut: { step: 0, cleared: 0, sawLayer: false },
      tutDone: false,
      summary: { cap: 0, jobs: 0, svcRates: {}, polSources: 0, trees: 0, parks: 0, sea: 0, roads: 0, land: map.W * map.H, reclaimed: 0, coastLand: 0 }
    };
  }

  G.start = function (mode, seed) {
    const st = newState(mode, seed);
    G.state = st;
    CM.ui.resetHud();
    CM.sim.recompute(st);
    CM.renderer.bind(st);
    CM.ui.setTool('select');
    CM.ui.setSpeed(1);
    CM.ui.setLayer('none');
    CM.ui.refresh(st);

    CM.ui.toast('第 1 天 · ' + (mode === 'sandbox' ? '沙盒模式，资金无限' : '经营模式，启动资金 ' + CM.money(st.money)), '');
    CM.ui.toast('左栏开荒修路，右键取消工具，空格暂停。', '');
  };

  /* ---------- 工具 ---------- */
  G.setTool = function (key) {
    if (!G.state) return;
    G.state.tool = key;
    CM.ui.setTool(key);
    CM.renderer.canvas.classList.toggle('placing', key !== 'select');
  };

  G.setLayer = function (key) {
    const st = G.state;
    if (!st) return;
    st.overlay = key;
    CM.ui.setLayer(key);
    if (key !== 'none') {
      st.tut.sawLayer = true;
      G.tutCheck();
    }
  };

  G.setSpeed = function (sp) {
    if (!G.state) return;
    G.state.speed = sp;
    CM.ui.setSpeed(sp);
  };

  G.select = function (t) {
    if (!G.state) return;
    G.state.selected = t;
    CM.ui.refresh(G.state);
  };

  function deny(reason) {
    const now = CM.now();
    if (now - G.lastDeny < 900) return;
    G.lastDeny = now;
    if (reason) CM.ui.toast(reason, 'bad');
  }

  function canPlace(st, t, tool) {
    if (!t) return { ok: false, reason: '' };
    if (tool === 'select') return { ok: false };
    if (tool === 'demolish') {
      if (t.building && t.building.kind === 'cityhall') return { ok: false, reason: '市政厅不可拆除。' };
      if (!t.building && !t.road && !t.zone) return { ok: false, reason: '这里没有可拆除的东西。' };
      return { ok: true, cost: 0 };
    }
    /* 海域：只能填海造陆 */
    if (t.terrain === 'sea') {
      if (tool !== 'reclaim') return { ok: false, reason: '海域不能直接建设，请先用「填海造陆」。' };
      if (!CM.landNeighbor(st, t)) return { ok: false, reason: '填海必须紧邻已有陆地。' };
      return { ok: true, cost: CM.reclaimCost(t) };
    }
    if (tool === 'reclaim') return { ok: false, reason: '这里已经是陆地。' };

    const clearCost = t.cleared ? 0 : Math.round(CM.TERRAIN[t.terrain].clearCost * CM.COST.clearSurcharge);

    if (tool === 'clear') {
      if (t.cleared) return { ok: false, reason: '这块地已经开垦过了。' };
      return { ok: true, cost: CM.TERRAIN[t.terrain].clearCost };
    }
    if (t.building) return { ok: false, reason: '这里已有建筑，先拆除。' };

    if (tool === 'road') {
      if (t.road) return { ok: false, reason: '这里已经是道路。' };
      return { ok: true, cost: clearCost + CM.COST.road };
    }
    if (CM.ZONES[tool]) {
      if (t.road) return { ok: false, reason: '道路上不能划区。' };
      if (t.zone === tool) return { ok: false, reason: '这里已经划为同类区域。' };
      return { ok: true, cost: clearCost + CM.COST.zone };
    }
    if (CM.PUB[tool]) {
      if (t.road) return { ok: false, reason: '道路上不能建造。' };
      return { ok: true, cost: clearCost + CM.PUB[tool].cost };
    }
    return { ok: false };
  }

  G.preview = function (st) {
    if (!st || !st.hover || st.tool === 'select' || st.tool === 'demolish') return null;
    const tool = st.tool;
    let kind = null, def = null;
    if (tool === 'clear') kind = 'clear';
    else if (tool === 'road') kind = 'road';
    else if (tool === 'reclaim') kind = 'reclaim';
    else if (CM.ZONES[tool]) { kind = 'zone'; def = tool; }
    else if (CM.PUB[tool]) { kind = 'building'; def = tool; }
    else return null;
    const chk = canPlace(st, st.hover, tool);
    return { tile: st.hover, kind: kind, def: def, ok: chk.ok };
  };

  function applyTool(t, tool) {
    const st = G.state;
    if (!st || !t) return false;
    const chk = canPlace(st, t, tool);
    if (!chk.ok) { deny(chk.reason); return false; }

    if (chk.cost > 0 && st.mode !== 'sandbox') {
      if (st.money < chk.cost) {
        deny('资金不足：需要 ' + CM.money(chk.cost));
        return false;
      }
      st.money -= chk.cost;
    }

    if (tool === 'demolish') {
      if (t.building) {
        const def = CM.RES[t.building.kind] || CM.PUB[t.building.kind];
        if (st.mode !== 'sandbox' && def && def.cost) st.money += Math.round(def.cost * CM.COST.refund);
        t.building = null;
      } else if (t.road) {
        t.road = false;
        if (st.mode !== 'sandbox') st.money += Math.round(CM.COST.road * CM.COST.refund);
      } else if (t.zone) {
        t.zone = null;
      }
    } else if (tool === 'clear') {
      if (!t.cleared) { t.cleared = true; st.tut.cleared++; }
    } else if (tool === 'road') {
      if (!t.cleared) { t.cleared = true; st.tut.cleared++; }
      t.road = true;
      t.zone = null;
    } else if (CM.ZONES[tool]) {
      if (!t.cleared) { t.cleared = true; st.tut.cleared++; }
      t.zone = tool;
    } else if (CM.PUB[tool]) {
      if (!t.cleared) { t.cleared = true; st.tut.cleared++; }
      t.zone = null;
      t.building = { kind: tool, active: true, idle: 0 };
    } else if (tool === 'reclaim') {
      t.terrain = 'reclaimed';
      t.reclaimed = true;
      t.cleared = true;
      t.depth = 0;
      CM.recomputeDepths(st);
    }

    CM.sim.recompute(st);
    CM.renderer.markTerrain();
    CM.ui.refresh(st);
    G.tutCheck();
    return true;
  }

  G.demolishSelected = function () {
    const st = G.state;
    if (!st || !st.selected) return;
    applyTool(st.selected, 'demolish');
    CM.ui.refresh(st);
  };

  /* ---------- 引导 ---------- */
  G.tutCheck = function () {
    const st = G.state;
    if (!st || st.tutDone) return;
    let guard = 0;
    while (guard++ < 7) {
      const step = st.tut.step;
      let ok = false;
      if (step === 0) ok = st.tut.cleared >= 3;
      else if (step === 1) {
        for (let i = 0; i < st.tiles.length; i++) if (st.tiles[i].road && st.tiles[i].roadConn) { ok = true; break; }
      } else if (step === 2) {
        let z = 0;
        for (let i = 0; i < st.tiles.length; i++) if (st.tiles[i].zone) z++;
        ok = z >= 4;
      } else if (step === 3) {
        let w = false, p = false;
        for (let i = 0; i < st.tiles.length; i++) {
          const b = st.tiles[i].building;
          if (!b) continue;
          const d = CM.PUB[b.kind];
          if (d && d.svc === 'water') w = true;
          if (d && d.svc === 'power') p = true;
        }
        ok = w && p;
      } else if (step === 4) {
        let c = 0;
        for (let i = 0; i < st.tiles.length; i++) if (st.tiles[i].zone === 'C') c++;
        ok = c >= 2;
      } else if (step === 5) {
        ok = st.tut.sawLayer;
      } else {
        st.tutDone = true;
        break;
      }
      if (!ok) break;
      st.tut.step++;
      if (st.tut.step >= CM.TUTORIAL.length) {
        st.tutDone = true;
        CM.ui.toast('引导完成。接下来怎么规划，你说了算。', 'good');
        break;
      }
      CM.ui.toast('✓ 引导 ' + st.tut.step + '/' + CM.TUTORIAL.length, 'good');
    }
    CM.ui.refresh(st);
  };

  /* ---------- 日推进 ---------- */
  function dayTick() {
    const st = G.state;
    if (!st) return;
    CM.sim.tick(st);
    if ((st.day - 1) % (CM.DAYS_PER_MONTH * 3) === 0) G.saveGame('auto');
  }

  function loop(ts) {
    const st = G.state;
    const dt = Math.min(0.1, (ts - G.lastTick) / 1000 || 0.016);
    G.lastTick = ts;

    if (st && !st.paused && st.speed > 0 && !CM.ui.modalOpen) {
      const dayLen = CM.DAY_SECONDS / st.speed;
      st.tOfDay += dt / dayLen;
      let guard = 0;
      while (st.tOfDay >= 1 && guard++ < 24) {
        st.tOfDay -= 1;
        dayTick();
      }
    }
    if (st) CM.renderer.frame(st, dt);

    G.uiAcc += dt;
    if (G.uiAcc > 0.1 && st) {
      G.uiAcc = 0;
      CM.ui.refresh(st);
    }
    requestAnimationFrame(loop);
  }

  /* ---------- 输入 ---------- */
  function bindInput() {
    const cv = CM.renderer.canvas;

    cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    cv.addEventListener('mousedown', function (e) {
      if (!G.state || CM.ui.modalOpen) return;
      const st = G.state;
      if (e.button === 2) { G.setTool('select'); return; }
      if (e.button === 1) {
        G.panning = { x: e.clientX, y: e.clientY, camx: CM.renderer.cam.x, camy: CM.renderer.cam.y };
        cv.classList.add('dragging');
        e.preventDefault();
        return;
      }
      if (e.button !== 0) return;

      const t = CM.renderer.pick(e.clientX, e.clientY);
      if (st.tool === 'select') {
        G.drag = { tool: 'select', x: e.clientX, y: e.clientY, camx: CM.renderer.cam.x, camy: CM.renderer.cam.y, moved: false, tile: t };
        return;
      }
      if (PAINT_TOOLS[st.tool]) {
        G.drag = { tool: st.tool, last: null, moved: false };
        if (applyTool(t, st.tool)) G.drag.last = t;
        else G.drag.blocked = true;
        return;
      }
      applyTool(t, st.tool);
    });

    window.addEventListener('mousemove', function (e) {
      const st = G.state;
      if (!st) return;

      if (G.panning) {
        CM.renderer.cam.x = G.panning.camx + (e.clientX - G.panning.x);
        CM.renderer.cam.y = G.panning.camy + (e.clientY - G.panning.y);
        CM.renderer.clampCam();
        return;
      }

      const t = CM.renderer.pick(e.clientX, e.clientY);
      if (t !== st.hover) st.hover = t;

      if (G.drag && G.drag.tool === 'select') {
        const dx = e.clientX - G.drag.x, dy = e.clientY - G.drag.y;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) G.drag.moved = true;
        if (G.drag.moved) {
          CM.renderer.cam.x = G.drag.camx + dx;
          CM.renderer.cam.y = G.drag.camy + dy;
          CM.renderer.clampCam();
        }
        return;
      }

      if (G.drag && PAINT_TOOLS[G.drag.tool] && !G.drag.blocked) {
        G.drag.moved = true;
        if (!G.drag.last || G.drag.last === t) return;
        lineTiles(G.drag.last, t, function (tt) {
          if (tt && applyTool(tt, G.drag.tool)) G.drag.last = tt;
        });
        if (t) G.drag.last = t;
      }
    });

    window.addEventListener('mouseup', function () {
      if (G.panning) {
        G.panning = null;
        CM.renderer.canvas.classList.remove('dragging');
        return;
      }
      const st = G.state;
      if (!st) return;
      if (G.drag) {
        if (G.drag.tool === 'select' && !G.drag.moved) G.select(G.drag.tile);
        G.drag = null;
      }
    });

    cv.addEventListener('wheel', function (e) {
      if (!G.state) return;
      e.preventDefault();
      CM.renderer.zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX, e.clientY);
    }, { passive: false });

    window.addEventListener('keydown', function (e) {
      const st = G.state;
      if (!st) return;
      const k = e.key.toLowerCase();
      if (e.key === 'Escape') {
        if (CM.ui.modalOpen) return;
        G.setTool('select');
        G.select(null);
        return;
      }
      if (e.key === ' ') {
        e.preventDefault();
        if (CM.ui.modalOpen) return;
        if (st.speed > 0) { G._sp = st.speed; G.setSpeed(0); }
        else G.setSpeed(G._sp || 1);
        return;
      }
      if (e.key === '0') G.setSpeed(0);
      if (e.key === '1') G.setSpeed(1);
      if (e.key === '2') G.setSpeed(2);
      if (e.key === '3') G.setSpeed(4);
      if (e.key === '4') G.setSpeed(8);
      if (e.key === '5') G.setSpeed(16);
      if (e.key === '6') G.setSpeed(32);
      if (e.key === '7') G.setSpeed(64);
      if (e.key === '8') G.setSpeed(128);
      const step = 46;
      if (k === 'a' || e.key === 'ArrowLeft') CM.renderer.panBy(step, 0);
      if (k === 'd' || e.key === 'ArrowRight') CM.renderer.panBy(-step, 0);
      if (k === 'w' || e.key === 'ArrowUp') CM.renderer.panBy(0, step);
      if (k === 's' || e.key === 'ArrowDown') CM.renderer.panBy(0, -step);
      if (k === 'q') G.setTool('clear');
      if (k === 'e') G.setTool('road');
    });
  }

  function lineTiles(a, b, cb) {
    let x0 = a.x, y0 = a.y, x1 = b.x, y1 = b.y;
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let guard = 0;
    while (guard++ < 200) {
      cb(CM.game.state.tiles[y0 * CM.game.state.W + x0]);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
    }
  }

  /* ---------- 存档 ---------- */
  const SLOTS = { auto: '自动存档', s1: '存档位 一', s2: '存档位 二', s3: '存档位 三' };
  G.slotName = function (slot) { return SLOTS[slot] || slot; };
  function key(slot) { return 'cm_save_' + slot; }

  G.saveGame = function (slot) {
    const st = G.state;
    if (!st) return false;
    const data = {};
    for (const k in st) {
      if (k === 'selected' || k === 'hover') continue;
      data[k] = st[k];
    }
    data.selectedIdx = st.selected ? (st.selected.y * st.W + st.selected.x) : -1;
    data.savedAt = Date.now();
    return store.set(key(slot), JSON.stringify({ v: 4, data: data }));
  };

  G.loadGame = function (slot) {
    const raw = store.get(key(slot));
    if (!raw) return false;
    let obj;
    try { obj = JSON.parse(raw); } catch (e) { return false; }
    if (!obj || obj.v !== 4 || !obj.data || !obj.data.tiles) return false;
    const st = obj.data;
    if (st.tiles.length !== st.W * st.H) return false;
    st.selected = st.selectedIdx >= 0 ? st.tiles[st.selectedIdx] : null;
    st.hover = null;
    st.paused = false;
    st.speed = st.speed || 1;
    delete st.selectedIdx;

    G.state = st;
    CM.ui.resetHud();
    CM.sim.recompute(st);
    CM.renderer.bind(st);
    CM.ui.hideStart();
    CM.ui.setTool(st.tool || 'select');
    CM.ui.setLayer(st.overlay || 'none');
    CM.ui.setSpeed(st.speed);
    CM.ui.refresh(st);
    return true;
  };

  G.deleteSave = function (slot) { store.del(key(slot)); };

  G.listSaves = function () {
    return Object.keys(SLOTS).map(function (slot) {
      const raw = store.get(key(slot));
      let desc = '空存档位', exists = false;
      if (raw) {
        try {
          const o = JSON.parse(raw);
          const d = o.data;
          const c = CM.sim.calendar(d.day);
          const landPct = d.tiles ? Math.round(d.tiles.filter(function (t) { return t.terrain !== 'sea'; }).length / d.tiles.length * 100) : 0;
          desc = (d.mode === 'sandbox' ? '沙盒' : '经营') + ' · 海岛 ' + d.W + '×' + d.H + '（陆地 ' + landPct + '%）' +
            ' · 第 ' + c.year + ' 年 ' + c.month + ' 月 ' + c.day + ' 日 · 人口 ' + Math.round(d.pop) +
            ' · ' + new Date(d.savedAt || 0).toLocaleString('zh-CN', { hour12: false });
          exists = true;
        } catch (e) { desc = '存档损坏'; }
      }
      return { slot: slot, name: SLOTS[slot], desc: desc, exists: exists };
    });
  };

  G.hasSave = function () { return !!store.get(key('auto')); };

  G.toStart = function () {
    G.state = null;
    CM.ui.lastChips = ''; CM.ui.lastSide = ''; CM.ui.lastInfo = ''; CM.ui.lastDate = '';
    CM.ui.showStart(function (mode, seed) { G.start(mode, seed); }, G.hasSave());
  };

  G.init = function () {
    CM.renderer.init(CM.$('#world'));
    bindInput();
    CM.ui.init();
    requestAnimationFrame(loop);
    CM.ui.showStart(function (mode, seed) { G.start(mode, seed); }, G.hasSave());

    window.addEventListener('pagehide', function () {
      if (G.state) G.saveGame('auto');
    });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && G.state) G.saveGame('auto');
    });
  };

  /* ---------- 开发自测：?demo=1&d=180&tod=0.5&size=24 ---------- */
  G.demo = function (opts) {
    opts = opts || {};
    CM.ui.hideStart();
    G.start('manage', opts.seed || '20261115');
    const st = G.state;
    st.tutDone = true;
    st.money = 900000;

    /* 只动陆地，海面保持原样 */
    function land(x, y) { const t = CM.tileAt(st, x, y); return (t && t.terrain !== 'sea') ? t : null; }
    function clearAt(x, y) { const t = land(x, y); if (t) { t.cleared = true; if (t.terrain === 'forest' || t.terrain === 'hill') t.terrain = 'grass'; } }
    function road(x, y) {
      const t = land(x, y);
      if (t && !t.building) { clearAt(x, y); t.road = true; t.zone = null; }
    }
    function zone(x, y, z) {
      const t = land(x, y);
      if (t && !t.building && !t.road) { clearAt(x, y); t.zone = z; }
    }
    function build(x, y, kind) {
      const t = land(x, y);
      if (t && !t.road) { clearAt(x, y); t.zone = null; t.building = { kind: kind, active: true, idle: 0 }; }
      return !!t;
    }
    /* 在指定点附近找一块空陆地 */
    function buildNear(cx0, cy0, kind, rad) {
      rad = rad || 4;
      for (let d = 0; d <= rad; d++) {
        for (let dy = -d; dy <= d; dy++) {
          for (let dx = -d; dx <= d; dx++) {
            if (Math.abs(dx) + Math.abs(dy) !== d) continue;
            const t = land(cx0 + dx, cy0 + dy);
            if (!t || t.building || t.road || t.zone || t.terrain === 'beach') continue;
            clearAt(cx0 + dx, cy0 + dy);
            t.building = { kind: kind, active: true, idle: 0 };
            return t;
          }
        }
      }
      return null;
    }

    const cx = st.hall.x, cy = st.hall.y;
    let x, y;
    const rx = Math.max(3, Math.round(st.W * 0.16)), ry = Math.max(3, Math.round(st.H * 0.12));

    /* 三条横街 + 两侧纵街，只铺在陆地上 */
    for (const yy of [cy - 3, cy + 1, cy + 5]) {
      for (x = cx - rx; x <= cx + rx; x++) road(x, yy);
    }
    for (const xx of [cx - rx, cx + rx]) {
      for (y = cy - 3; y <= cy + 5; y++) road(xx, y);
    }
    road(cx, cy + 1); road(cx - 1, cy + 1); road(cx + 1, cy + 1);

    /* 公共设施（就近找陆地落位） */
    buildNear(cx - 4, cy - 3, 'water');
    buildNear(cx + 3, cy - 3, 'power');
    buildNear(cx - 1, cy - 4, 'school2');
    buildNear(cx + 6, cy - 3, 'hospital');
    buildNear(cx - 6, cy - 1, 'park2');
    buildNear(cx + 6, cy + 2, 'police');
    buildNear(cx + 6, cy + 4, 'fire');
    buildNear(cx - 6, cy + 4, 'waste');
    buildNear(cx - 2, cy + 6, 'wind');
    buildNear(cx + 2, cy + 6, 'waterSmall');

    /* 区划 */
    for (x = cx - 5; x <= cx + 5; x++) { zone(x, cy - 2, 'R'); zone(x, cy - 1, 'R'); }
    for (x = cx - 5; x <= cx + 5; x++) { zone(x, cy + 2, 'C'); zone(x, cy + 3, 'C'); }
    for (x = cx - 5; x <= cx - 1; x++) { zone(x, cy + 4, 'I'); }

    /* 演示：在岛边填出一块新地 */
    let reclaimDemo = 0;
    for (let yy = 0; yy < st.H && reclaimDemo < 6; yy++) {
      for (let xx = 0; xx < st.W && reclaimDemo < 6; xx++) {
        const t = CM.tileAt(st, xx, yy);
        if (!t || t.terrain !== 'sea' || t.depth !== 0) continue;
        t.terrain = 'reclaimed'; t.reclaimed = true; t.cleared = true;
        reclaimDemo++;
      }
    }
    CM.recomputeDepths(st);

    CM.sim.recompute(st);
    CM.renderer.markTerrain();
    const days = opts.days || 180;
    for (let i = 0; i < days; i++) CM.sim.tick(st);
    CM.sim.recompute(st);
    CM.renderer.markTerrain();
    if (opts.tod != null) st.tOfDay = opts.tod;
    st.speed = 0;
    CM.ui.setSpeed(0);
    CM.renderer.centerOnTile(st.hall.x, st.hall.y);
    CM.ui.refresh(st);
  };

  CM.game = G;

})(window.CM);
