/* ===== 地图生成：海中央的一座小岛 ===== */
/*
 * 地图 = 一整片海 + 中间一座岛。
 * 岛的“大小与形状”由种子决定：
 *   - 半径占地图的比例（fill）
 *   - 拉伸比与朝向（椭圆化）
 *   - 若干角向谐波（花瓣/湾岬）
 *   - 海岸线抖动噪声
 * 岛内地形：草地 / 林地 / 缓丘；岛缘一圈沙滩；其余是海（sea）。
 */
(function (CM) {
  'use strict';

  CM.idx = function (st, x, y) { return y * st.W + x; };

  CM.tileAt = function (st, x, y) {
    if (x < 0 || y < 0 || x >= st.W || y >= st.H) return null;
    return st.tiles[y * st.W + x];
  };

  function makeTile(x, y) {
    return {
      x: x, y: y,
      terrain: 'grass',
      cleared: false,
      road: false,
      zone: null,
      building: null,
      cov: {},
      access: false,
      pollution: 0,
      value: 0,
      depth: 0,        // 海的“离岸深度”，陆地恒为 0
      coast: false,    // 是否临海
      reclaimed: false // 是否填海所得
    };
  }

  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  /* 陆地判定 */
  CM.isLand = function (t) { return !!t && t.terrain !== 'sea'; };

  /* 相邻陆地（含沙滩、填海地） */
  CM.landNeighbor = function (st, t) {
    for (let k = 0; k < 4; k++) {
      const o = CM.tileAt(st, t.x + DIRS[k][0], t.y + DIRS[k][1]);
      if (CM.isLand(o)) return true;
    }
    return false;
  };

  /* 相邻海域 */
  CM.seaNeighbor = function (st, t) {
    for (let k = 0; k < 4; k++) {
      const o = CM.tileAt(st, t.x + DIRS[k][0], t.y + DIRS[k][1]);
      if (o && o.terrain === 'sea') return true;
    }
    return false;
  };

  /* 填海造价：按“原始离岸深度”计，越远离原岛越贵（填出的栈桥不会让后续变便宜） */
  CM.reclaimCost = function (t) {
    const d = CM.clamp((t.seaDepth != null ? t.seaDepth : (t.depth || 0)), 0, CM.RECLAIM.maxDepth);
    return CM.RECLAIM.base + d * CM.RECLAIM.perDepth;
  };

  /* ---------- 重新计算海域深度与海岸标记 ---------- */
  CM.recomputeDepths = function (st) {
    const tiles = st.tiles, W = st.W, H = st.H;
    let i, t;

    for (i = 0; i < tiles.length; i++) {
      t = tiles[i];
      t.coast = false;
      t.depth = (t.terrain === 'sea') ? -1 : 0;
    }

    /* 多源 BFS：与陆地相邻的海 = 深度 0 */
    const q = [];
    for (i = 0; i < tiles.length; i++) {
      t = tiles[i];
      if (t.terrain !== 'sea') continue;
      for (let k = 0; k < 4; k++) {
        const o = tiles[(t.y + DIRS[k][1]) * W + (t.x + DIRS[k][0])];
        if (t.x + DIRS[k][0] < 0 || t.x + DIRS[k][0] >= W || t.y + DIRS[k][1] < 0 || t.y + DIRS[k][1] >= H) continue;
        if (CM.isLand(o)) { t.depth = 0; q.push(t); break; }
      }
    }
    let head = 0;
    while (head < q.length) {
      const cur = q[head++];
      for (let k = 0; k < 4; k++) {
        const nx = cur.x + DIRS[k][0], ny = cur.y + DIRS[k][1];
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const o = tiles[ny * W + nx];
        if (o.terrain !== 'sea' || o.depth >= 0) continue;
        o.depth = cur.depth + 1;
        q.push(o);
      }
    }

    /* 陆地临海标记 */
    st.coastLand = 0;
    for (i = 0; i < tiles.length; i++) {
      t = tiles[i];
      if (t.terrain === 'sea') continue;
      if (CM.seaNeighbor(st, t)) { t.coast = true; st.coastLand++; }
    }
    return st;
  };

  /* ---------- 生成 ----------
   * 地图尺寸不再由玩家指定：种子先决定“岛有多大”，
   * 再由岛的半径反推地图网格（岛屿四周各留 2 格海）。
   */
  CM.mapgen = function (seed) {
    seed = (parseInt(seed, 10) || 20261115) >>> 0;
    const rnd = CM.rng(seed * 7919 + 17);

    /* ---- 种子决定岛的形状 ---- */
    const islandR0 = 8 + rnd() * 6.5;              // 岛的基准半径（格）8 ~ 14.5
    const stretch = 1 + rnd() * 0.34;              // 椭圆拉伸比 1.00 ~ 1.34
    const angle = rnd() * Math.PI * 2;             // 拉伸方向
    const cosA = Math.cos(angle), sinA = Math.sin(angle);
    const lobes = [];
    const ks = [2, 3, 4, 5];
    for (let li = 0; li < ks.length; li++) {
      lobes.push({
        a: (0.16 / ks[li]) * (0.45 + rnd() * 0.9),
        k: ks[li],
        p: rnd() * Math.PI * 2
      });
    }
    const wobble = 0.018 + rnd() * 0.032;           // 海岸线抖动
    const beachBand = 0.10 + rnd() * 0.05;          // 沙滩占半径的比例

    const MARGIN = 3;                               // 岛外至少留 3 格海
    const MIN_LAND = 90;                            // 陆地太少的种子自动放大岛

    /* ---- 由岛半径推出地图尺寸，并生成地块 ---- */
    let tiles = null, islandR = islandR0, W = 0, H = 0, landCount = 0;
    let hall = null;

    for (let attempt = 0; attempt < 5; attempt++) {
      const rx = islandR * stretch;
      const ry = islandR / Math.sqrt(stretch);
      const half = Math.ceil(Math.max(rx, ry)) + MARGIN;
      W = CM.clamp(half * 2 + 1, CM.MAP_MIN, CM.MAP_MAX);
      H = W;
      hall = { x: Math.floor(W / 2), y: Math.floor(H / 2) };
      const cx = hall.x, cy = hall.y;

      tiles = [];
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const t = makeTile(x, y);
          tiles.push(t);

          /* 地图外缘强制为海 */
          if (x < MARGIN || y < MARGIN || x >= W - MARGIN || y >= H - MARGIN) {
            t.terrain = 'sea';
            continue;
          }
          const dx = x - cx, dy = y - cy;
          const u = dx * cosA + dy * sinA;
          const v = -dx * sinA + dy * cosA;
          const rho = Math.sqrt((u / rx) * (u / rx) + (v / ry) * (v / ry));
          const theta = Math.atan2(v, u);

          let mult = 1;
          for (let i = 0; i < lobes.length; i++) {
            mult += lobes[i].a * Math.sin(lobes[i].k * theta + lobes[i].p);
          }
          if (mult < 0.55) mult = 0.55;

          let r = rho / mult;
          r += (CM.hash2(x, y, seed + 31) - 0.5) * wobble * 2;

          if (r < 1 - beachBand) t.terrain = 'grass';
          else if (r < 1) t.terrain = 'beach';
          else t.terrain = 'sea';
        }
      }
      landCount = 0;
      for (let i = 0; i < tiles.length; i++) if (tiles[i].terrain !== 'sea') landCount++;
      if (landCount >= MIN_LAND) break;
      islandR += 1.6;                               // 岛太小：按固定步长放大（仍然只由种子决定）
    }

    function T(x, y) {
      if (x < 0 || y < 0 || x >= W || y >= H) return null;
      return tiles[y * W + x];
    }

    /* ---- 岛内林地与缓丘 ---- */
    const areaLand = landCount;
    function blob(kind, count, minR, maxR) {
      for (let k = 0; k < count; k++) {
        const bx = 1 + Math.floor(rnd() * (W - 2));
        const by = 1 + Math.floor(rnd() * (H - 2));
        const r = minR + rnd() * (maxR - minR);
        const ri = Math.ceil(r);
        for (let dy = -ri; dy <= ri; dy++) {
          for (let dx = -ri; dx <= ri; dx++) {
            if (Math.sqrt(dx * dx + dy * dy) > r) continue;
            const t = T(bx + dx, by + dy);
            if (!t || t.terrain !== 'grass') continue;
            if (Math.abs(t.x - hall.x) + Math.abs(t.y - hall.y) < 3) continue;
            t.terrain = kind;
          }
        }
      }
    }
    blob('forest', Math.max(2, Math.round(areaLand / 11)), 1.0, 2.5);
    blob('hill', Math.max(1, Math.round(areaLand / 34)), 0.8, 1.6);

    /* ---- 市政厅周边保持开阔平地 ---- */
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const t = T(hall.x + dx, hall.y + dy);
        if (!t) continue;
        if (t.terrain !== 'grass') t.terrain = 'grass';
      }
    }

    /* ---- 市政厅落地 ---- */
    const ht = T(hall.x, hall.y);
    ht.terrain = 'grass';
    ht.cleared = true;
    ht.building = { kind: 'cityhall', active: true, idle: 0 };

    /* ---- 清理孤立碎岛 ----
     * 与市政厅不相连的陆地：小于 4 格的碎片直接沉回海里（避免不可达垃圾地）；
     * 够大的保留成“小岛”，可以用填海造陆一路连过去。
     */
    const SPEC = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const comp = new Int16Array(tiles.length).fill(-1);
    const sizes = [];
    let cid = 0;
    for (let i = 0; i < tiles.length; i++) {
      if (tiles[i].terrain === 'sea' || comp[i] >= 0) continue;
      const q = [i];
      comp[i] = cid;
      let n = 0;
      while (q.length) {
        const cur = q.pop();
        n++;
        const cx0 = cur % W, cy0 = Math.floor(cur / W);
        for (let k = 0; k < 4; k++) {
          const nx = cx0 + SPEC[k][0], ny = cy0 + SPEC[k][1];
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const oi = ny * W + nx;
          if (comp[oi] >= 0 || tiles[oi].terrain === 'sea') continue;
          comp[oi] = cid;
          q.push(oi);
        }
      }
      sizes.push(n);
      cid++;
    }
    const hallCid = comp[hall.y * W + hall.x];
    let islets = 0, pruned = 0;
    for (let i = 0; i < tiles.length; i++) {
      const c = comp[i];
      if (c < 0 || c === hallCid) continue;
      if (sizes[c] < 4) {
        tiles[i].terrain = 'sea';
        tiles[i].seaDepth = null;
        pruned++;
      } else if (!tiles[i].__islet) {
        tiles[i].__islet = 1;
      }
    }
    for (let c = 0; c < sizes.length; c++) if (c !== hallCid && sizes[c] >= 4) islets++;

    const st = { tiles: tiles, hall: hall, seed: seed, W: W, H: H };
    CM.recomputeDepths(st);

    /* 记录原始离岸深度（填海计价用） */
    for (let i = 0; i < tiles.length; i++) {
      if (tiles[i].terrain === 'sea' && tiles[i].seaDepth == null) tiles[i].seaDepth = tiles[i].depth;
    }

    /* 统计 */
    let seaCount = 0, beachCount = 0, landCount2 = 0;
    for (let i = 0; i < tiles.length; i++) {
      if (tiles[i].terrain === 'sea') seaCount++;
      else {
        landCount2++;
        if (tiles[i].terrain === 'beach') beachCount++;
      }
    }
    st.seaCount = seaCount;
    st.beachCount = beachCount;
    st.landCount = landCount2;
    st.islets = islets;
    st.prunedSpecks = pruned;
    st.mainIsland = sizes[hallCid] || 0;

    return st;
  };

})(window.CM);
