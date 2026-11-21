/* ===== 2.5D 等距渲染器（支持自定义地图尺寸与昼夜） ===== */
(function (CM) {
  'use strict';

  const TW = CM.TW, TH = CM.TH, HW = TW / 2, HD = TH / 2;
  const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  /* 等距菱形四条边：N-E, E-S, S-W, W-N（相对中心） */
  const EDGE_OF_DIR = [
    [HW, 0, 0, HD],      // +x : E → S
    [-HW, 0, 0, -HD],    // -x : W → N
    [0, HD, -HW, 0],     // +y : S → W
    [0, -HD, HW, 0]      // -y : N → E
  ];

  const R = {
    canvas: null, ctx: null,
    dpr: 1, vw: 0, vh: 0,
    cam: { x: 0, y: 0, zoom: 1 },
    state: null,
    W: 16, H: 16,
    order: [],
    terrain: null, tctx: null, TS: 2,
    terrainDirty: true,
    time: 0,
    night: 0,
    clouds: [],
    ui: { left: 258, right: 252, top: 60 }
  };

  /* ================= 基础图元 ================= */
  function dPath(c, cx, cy, hw, hd) {
    c.beginPath();
    c.moveTo(cx, cy - hd);
    c.lineTo(cx + hw, cy);
    c.lineTo(cx, cy + hd);
    c.lineTo(cx - hw, cy);
    c.closePath();
  }
  function fillDiamond(c, cx, cy, hw, hd, fill) {
    dPath(c, cx, cy, hw, hd);
    c.fillStyle = fill;
    c.fill();
  }
  function poly(c, pts, fill, stroke, lw) {
    c.beginPath();
    c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
    c.closePath();
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw || 1; c.stroke(); }
  }
  function inPoly(px, py, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
      if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }
  function isoBox(c, cx, cy, hw, hd, h, top, left, right) {
    poly(c, [[cx, cy - h - hd], [cx + hw, cy - h], [cx, cy - h + hd], [cx - hw, cy - h]], top);
    poly(c, [[cx - hw, cy - h], [cx, cy - h + hd], [cx, cy + hd], [cx - hw, cy]], left);
    poly(c, [[cx, cy - h + hd], [cx + hw, cy - h], [cx + hw, cy], [cx, cy + hd]], right);
  }
  function windows(c, ax, ay, e1x, e1y, e2x, e2y, rows, cols, color, u0, u1, v0, v1) {
    u0 = u0 == null ? 0.12 : u0; u1 = u1 == null ? 0.88 : u1;
    v0 = v0 == null ? 0.12 : v0; v1 = v1 == null ? 0.84 : v1;
    c.fillStyle = color;
    const du = (u1 - u0) / cols, dv = (v1 - v0) / rows;
    for (let r = 0; r < rows; r++) {
      for (let k = 0; k < cols; k++) {
        const ua = u0 + k * du + du * 0.18, ub = u0 + k * du + du * 0.78;
        const va = v0 + r * dv + dv * 0.16, vb = v0 + r * dv + dv * 0.72;
        c.beginPath();
        c.moveTo(ax + ua * e1x + va * e2x, ay + ua * e1y + va * e2y);
        c.lineTo(ax + ub * e1x + va * e2x, ay + ub * e1y + va * e2y);
        c.lineTo(ax + ub * e1x + vb * e2x, ay + ub * e1y + vb * e2y);
        c.lineTo(ax + ua * e1x + vb * e2x, ay + ua * e1y + vb * e2y);
        c.closePath();
        c.fill();
      }
    }
  }
  function hipRoof(c, cx, cy, hw, hd, h, rh, color, peakShift) {
    const ps = peakShift || 0;
    const ax = cx + ps, ay = cy - h - rh;
    poly(c, [[cx - hw, cy - h], [ax, ay], [cx, cy - h + hd]], CM.shade(color, 0.84));
    poly(c, [[cx, cy - h + hd], [ax, ay], [cx + hw, cy - h]], CM.shade(color, 1.05));
    poly(c, [[cx - hw, cy - h], [cx + hw, cy - h], [ax, ay]], CM.shade(color, 0.94));
  }
  function shadow(c, cx, cy, hw, hd, ox, oy, a) {
    fillDiamond(c, cx + (ox || 9), cy + (oy || 4), hw, hd, 'rgba(8,20,28,' + (a || 0.16) + ')');
  }

  /* 夜间窗色 */
  function winCol(dim, warm) {
    if (R.night > 0.12) {
      return 'rgba(255,212,140,' + CM.clamp(0.35 + R.night * 0.6, 0, 0.95) * (warm ? 1 : 0.85) + ')';
    }
    return dim ? 'rgba(40,54,68,0.28)' : 'rgba(38,52,66,0.55)';
  }

  /* ================= 树 ================= */
  function drawTree(c, cx, cy, scale, variant) {
    const s = scale;
    c.fillStyle = 'rgba(10,22,30,0.14)';
    c.beginPath(); c.ellipse(cx + 5 * s, cy + 2 * s, 7 * s, 3.2 * s, 0, 0, 6.2832); c.fill();
    c.fillStyle = '#5b4128';
    c.fillRect(cx - 1.1 * s, cy - 7 * s, 2.2 * s, 7 * s);
    const dark = variant ? '#2f5c33' : '#356439';
    const mid = variant ? '#3c7440' : '#437f45';
    const lite = variant ? '#559950' : '#5da757';
    c.fillStyle = dark;
    c.beginPath(); c.ellipse(cx, cy - 11 * s, 7.4 * s, 6.2 * s, 0, 0, 6.2832); c.fill();
    c.fillStyle = mid;
    c.beginPath(); c.ellipse(cx - 1.4 * s, cy - 13 * s, 5.6 * s, 4.8 * s, 0, 0, 6.2832); c.fill();
    c.fillStyle = lite;
    c.beginPath(); c.ellipse(cx - 2.2 * s, cy - 15 * s, 3.1 * s, 2.5 * s, 0, 0, 6.2832); c.fill();
  }

  /* ================= 建筑 ================= */
  function bc(color, dim) {
    return dim ? CM.mix(color, '#6f7a86', 0.55) : color;
  }

  function drawBuilding(c, t, opt) {
    opt = opt || {};
    const b = t.building;
    if (!b) return;
    const def = CM.RES[b.kind] || CM.PUB[b.kind];
    if (!def) return;
    const cx = (t.x - t.y) * HW, cy = (t.x + t.y) * HD;
    const dim = !b.active || opt.dim;
    const alpha = opt.alpha == null ? 1 : opt.alpha;
    if (alpha !== 1) c.globalAlpha = alpha;

    const jit = (CM.hash2(t.x, t.y, 33) - 0.5) * 0.13;
    const base = bc(CM.shade(def.color, 1 + jit), dim);
    const wc = winCol(dim, false);
    const wc2 = winCol(dim, true);

    switch (def.style) {
      /* ---------- 低层住宅楼 ---------- */
      case 'house': {
        const hw = 22, hd = 11, h = 13;
        shadow(c, cx, cy, hw, hd, 9, 4, 0.16);
        isoBox(c, cx, cy, hw, hd, h, CM.shade(base, 1.16), CM.shade(base, 0.8), CM.shade(base, 0.95));
        poly(c, [[cx + 9, cy - h + 5], [cx + 14, cy - h + 2.5], [cx + 14, cy + 2.5], [cx + 9, cy + 5]], '#6b4a33');
        windows(c, cx - hw, cy - h, hw, hd, 0, h, 2, 3, wc, 0.1, 0.9, 0.22, 0.72);
        windows(c, cx, cy - h + hd, hw, -hd, 0, h, 2, 3, wc, 0.1, 0.9, 0.22, 0.72);
        hipRoof(c, cx, cy, hw + 1.6, hd + 0.9, h, 9, bc(def.roof || '#a9563f', dim), 0);
        break;
      }
      /* ---------- 多层公寓 ---------- */
      case 'walkup': {
        const hw = 21, hd = 10.5, h = 31;
        shadow(c, cx, cy, hw, hd, 11, 4, 0.18);
        isoBox(c, cx, cy, hw, hd, h, CM.shade(base, 1.1), CM.shade(base, 0.78), CM.shade(base, 0.92));
        windows(c, cx - hw, cy - h, hw, hd, 0, h, 5, 3, wc);
        windows(c, cx, cy - h + hd, hw, -hd, 0, h, 5, 3, wc);
        /* 阳台横条 */
        c.strokeStyle = CM.rgba('#ffffff', dim ? 0.1 : 0.22);
        c.lineWidth = 1.4;
        for (let k = 1; k <= 4; k++) {
          const v = k / 4.6;
          c.beginPath();
          c.moveTo(cx - hw, cy - h + v * h - 1.4);
          c.lineTo(cx, cy - h + hd + v * h - 1.4);
          c.stroke();
        }
        isoBox(c, cx, cy, hw - 1.2, hd - 0.6, h + 2.2, CM.shade(bc(def.roof || '#9aa3ab', dim), 1.1), CM.shade(def.color, 0.86), CM.shade(def.color, 0.98));
        isoBox(c, cx - 7, cy - h - 4, 4.2, 2.1, 4, '#cdc6b8', '#9a938a', '#b3aca1');
        break;
      }
      /* ---------- 高层住宅 ---------- */
      case 'tower': {
        const hw = 19, hd = 9.5, h = 46;
        shadow(c, cx, cy, hw + 2, hd + 1, 13, 5, 0.2);
        isoBox(c, cx, cy, hw, hd, h, CM.shade(base, 1.08), CM.shade(base, 0.74), CM.shade(base, 0.9));
        windows(c, cx - hw, cy - h, hw, hd, 0, h, 11, 3, wc);
        windows(c, cx, cy - h + hd, hw, -hd, 0, h, 11, 3, wc);
        isoBox(c, cx, cy, hw - 4, hd - 2, h + 10, CM.shade(base, 1.16), CM.shade(base, 0.8), CM.shade(base, 0.94));
        windows(c, cx - hw + 4, cy - h - 10, hw - 4, hd - 2, 0, 10, 3, 2, wc2, 0.2, 0.8, 0.15, 0.8);
        isoBox(c, cx, cy, 6.5, 3.2, h + 16, CM.shade(bc(def.roof || '#8aa0ae', dim), 1.12), '#7b8b96', '#8d9ca6');
        c.strokeStyle = '#c8d2d8'; c.lineWidth = 1.2;
        c.beginPath(); c.moveTo(cx, cy - h - 16); c.lineTo(cx, cy - h - 26); c.stroke();
        c.fillStyle = R.night > 0.3 ? 'rgba(255,80,70,0.9)' : 'rgba(200,210,215,0.7)';
        c.beginPath(); c.arc(cx, cy - h - 26.5, 1.8, 0, 6.2832); c.fill();
        break;
      }
      /* ---------- 临街商铺 ---------- */
      case 'shop': {
        const hw = 20, hd = 10, h = 12;
        shadow(c, cx, cy, hw, hd, 9, 4, 0.16);
        isoBox(c, cx, cy, hw, hd, h, CM.shade(base, 1.14), CM.shade(base, 0.8), CM.shade(base, 0.94));
        poly(c, [[cx - hw, cy - h + 1], [cx, cy - h + hd + 1], [cx, cy - h + hd - 2.4], [cx - hw, cy - h - 2.4]], R.night > 0.2 ? '#ffcf85' : '#e8b45c');
        poly(c, [[cx, cy - h + hd + 1], [cx + hw, cy - h + 1], [cx + hw, cy - h - 2.4], [cx, cy - h + hd - 2.4]], R.night > 0.2 ? '#e8b870' : '#d5a04c');
        isoBox(c, cx + 8, cy - h + 2, 6, 3, 5.5, R.night > 0.2 ? '#ffe7b0' : '#ffe1a0', '#d9a94a', '#eab85f');
        windows(c, cx - hw, cy - h, hw, hd, 0, h, 1, 2, R.night > 0.2 ? 'rgba(255,214,150,0.75)' : 'rgba(34,48,62,0.5)', 0.1, 0.9, 0.42, 0.86);
        break;
      }
      /* ---------- 小型超市 ---------- */
      case 'supermarket': {
        const hw = 24, hd = 12, h = 14;
        shadow(c, cx, cy, hw, hd, 11, 5, 0.17);
        isoBox(c, cx, cy, hw, hd, h, CM.shade(base, 1.1), CM.shade(base, 0.78), CM.shade(base, 0.92));
        /* 招牌带 */
        poly(c, [[cx - hw, cy - h + 1], [cx, cy - h + hd + 1], [cx, cy - h + hd - 3], [cx - hw, cy - h - 3]], R.night > 0.2 ? '#ffe2a6' : '#f2d59a');
        poly(c, [[cx, cy - h + hd + 1], [cx + hw, cy - h + 1], [cx + hw, cy - h - 3], [cx, cy - h + hd - 3]], '#d8bd85');
        windows(c, cx - hw, cy - h, hw, hd, 0, h, 1, 4, R.night > 0.2 ? 'rgba(255,220,160,0.8)' : 'rgba(34,48,62,0.5)', 0.06, 0.94, 0.45, 0.88);
        /* 屋顶空调 */
        c.fillStyle = '#c9d1d6';
        c.fillRect(cx - 10, cy - h - 5, 7, 4);
        c.fillRect(cx + 3, cy - h - 4, 6, 3);
        break;
      }
      /* ---------- 大型综合体 ---------- */
      case 'mall': {
        const hw = 25, hd = 12.5, h = 26;
        shadow(c, cx, cy, hw + 2, hd + 1, 14, 5, 0.2);
        isoBox(c, cx, cy, hw, hd, h, CM.shade(base, 1.1), CM.shade(base, 0.76), CM.shade(base, 0.9));
        /* 玻璃幕墙条纹 */
        c.strokeStyle = R.night > 0.2 ? 'rgba(255,214,150,0.6)' : 'rgba(210,235,250,0.6)';
        c.lineWidth = 2.4;
        for (let k = 0; k < 4; k++) {
          const v = 0.16 + k * 0.2;
          c.beginPath();
          c.moveTo(cx - hw, cy - h + v * h);
          c.lineTo(cx, cy - h + hd + v * h);
          c.stroke();
        }
        windows(c, cx, cy - h + hd, hw, -hd, 0, h, 4, 4, winCol(dim, true));
        isoBox(c, cx + 2, cy - h - 1, hw * 0.55, hd * 0.55, h + 18, CM.shade(base, 1.15), CM.shade(base, 0.8), CM.shade(base, 0.94));
        windows(c, cx + 2 - hw * 0.55, cy - h - 18, hw * 0.55, hd * 0.55, 0, 16, 4, 3, wc2, 0.1, 0.9, 0.15, 0.85);
        /* 楼顶招牌 */
        c.fillStyle = R.night > 0.2 ? 'rgba(255,220,150,0.9)' : 'rgba(240,230,210,0.85)';
        c.fillRect(cx + 2 - 9, cy - h - 24, 18, 5);
        break;
      }
      /* ---------- 小型工厂 ---------- */
      case 'factory': {
        const hw = 21, hd = 10.5, h = 11;
        shadow(c, cx, cy, hw, hd, 10, 4, 0.18);
        isoBox(c, cx, cy, hw, hd, h, CM.shade(base, 1.06), CM.shade(base, 0.76), CM.shade(base, 0.9));
        const n = 2;
        for (let i = 0; i < n; i++) {
          const ox = -hw + (i + 0.5) * (hw * 2 / n);
          poly(c, [[cx + ox - hw / n, cy - h], [cx + ox, cy - h + hd * 0.55], [cx + ox, cy - h - 4], [cx + ox - hw / n, cy - h - 5.5]], CM.shade(base, 1.16));
        }
        isoBox(c, cx + hw * 0.55, cy - h * 0.6, 3.2, 1.6, 15, '#8f8478', '#5d564d', '#726a60');
        windows(c, cx - hw, cy - h, hw, hd, 0, h, 1, 3, winCol(dim, false), 0.08, 0.92, 0.35, 0.75);
        break;
      }
      /* ---------- 物流仓库 ---------- */
      case 'warehouse': {
        const hw = 24, hd = 12, h = 9;
        shadow(c, cx, cy, hw, hd, 11, 5, 0.17);
        isoBox(c, cx, cy, hw, hd, h, CM.shade(base, 1.05), CM.shade(base, 0.76), CM.shade(base, 0.9));
        /* 低脊屋顶 */
        poly(c, [[cx - hw, cy - h], [cx, cy - h + hd], [cx, cy - h - 6], [cx - hw, cy - h - 2]], CM.shade(base, 1.14));
        poly(c, [[cx, cy - h + hd], [cx + hw, cy - h], [cx + hw, cy - h - 2], [cx, cy - h - 6]], CM.shade(base, 1.02));
        /* 装卸口 */
        c.fillStyle = dim ? 'rgba(40,46,52,0.5)' : 'rgba(56,64,72,0.62)';
        for (let k = 0; k < 3; k++) {
          poly(c, [
            [cx - hw + 4 + k * 13, cy - h + 1.5 + k * 6.5],
            [cx - hw + 10 + k * 13, cy - h + 4.5 + k * 6.5],
            [cx - hw + 10 + k * 13, cy + 4.5 + k * 6.5],
            [cx - hw + 4 + k * 13, cy + 1.5 + k * 6.5]
          ], c.fillStyle);
        }
        c.fillStyle = '#8b8f93';
        c.fillRect(cx + 4, cy - h - 3, 8, 3);
        break;
      }
      /* ---------- 重工业园区 ---------- */
      case 'factory2': {
        const hw = 24, hd = 12, h = 15;
        shadow(c, cx, cy, hw, hd, 12, 5, 0.2);
        isoBox(c, cx, cy, hw, hd, h, CM.shade(base, 1.04), CM.shade(base, 0.74), CM.shade(base, 0.88));
        for (let i = 0; i < 3; i++) {
          const ox = -hw + (i + 0.5) * (hw * 2 / 3);
          poly(c, [[cx + ox - hw / 3, cy - h], [cx + ox, cy - h + hd * 0.5], [cx + ox, cy - h - 5], [cx + ox - hw / 3, cy - h - 6.5]], CM.shade(base, 1.14));
        }
        isoBox(c, cx - hw * 0.5, cy - h * 0.6, 3.4, 1.7, 22, '#8f8478', '#5d564d', '#726a60');
        isoBox(c, cx + hw * 0.45, cy - h * 0.5, 3, 1.5, 18, '#8a8075', '#59534b', '#6d665d');
        /* 储罐 */
        c.fillStyle = '#9aa3a8';
        c.beginPath(); c.ellipse(cx + 12, cy + 3, 5, 2.4, 0, 0, 6.2832); c.fill();
        c.fillRect(cx + 7, cy - 3, 10, 6);
        c.fillStyle = '#b8c0c4';
        c.beginPath(); c.ellipse(cx + 12, cy - 3, 5, 2.4, 0, 0, 6.2832); c.fill();
        windows(c, cx - hw, cy - h, hw, hd, 0, h, 1, 3, winCol(dim, false), 0.08, 0.92, 0.3, 0.7);
        break;
      }
      /* ---------- 风力发电机 ---------- */
      case 'wind': {
        const baseCol = '#dde3e6';
        shadow(c, cx, cy, 9, 4.5, 8, 3, 0.14);
        /* 塔筒 */
        c.fillStyle = dim ? '#8d979d' : baseCol;
        c.beginPath();
        c.moveTo(cx - 3, cy);
        c.lineTo(cx - 1.4, cy - 24);
        c.lineTo(cx + 1.4, cy - 24);
        c.lineTo(cx + 3, cy);
        c.closePath(); c.fill();
        c.fillStyle = 'rgba(0,0,0,0.12)';
        c.beginPath();
        c.moveTo(cx, cy);
        c.lineTo(cx - 1.4, cy - 24);
        c.lineTo(cx + 1.4, cy - 24);
        c.lineTo(cx + 3, cy);
        c.closePath(); c.fill();
        /* 机舱 */
        c.fillStyle = dim ? '#7f8a90' : '#e8eef1';
        c.fillRect(cx - 2, cy - 27, 4, 3.4);
        /* 叶片 */
        const ang = R.time * 1.1;
        c.save();
        c.translate(cx, cy - 26);
        c.strokeStyle = dim ? '#8fa0a8' : '#f4f8fa';
        c.lineWidth = 1.6;
        c.lineCap = 'round';
        for (let k = 0; k < 3; k++) {
          const a = ang + k * Math.PI * 2 / 3;
          c.beginPath();
          c.moveTo(0, 0);
          c.lineTo(Math.cos(a) * 13, Math.sin(a) * 13);
          c.stroke();
        }
        c.restore();
        c.fillStyle = '#6b777e';
        c.beginPath(); c.arc(cx, cy - 25.6, 1.4, 0, 6.2832); c.fill();
        break;
      }
      /* ---------- 小型水站 ---------- */
      case 'waterSmall': {
        const hw = 13, hd = 6.5;
        shadow(c, cx, cy, hw + 4, hd + 2, 8, 3, 0.14);
        isoBox(c, cx + 4, cy + 2, hw - 4, hd - 2, 6, CM.shade(base, 1.12), CM.shade(base, 0.8), CM.shade(base, 0.94));
        const tx = cx - 6, ty = cy - 4;
        c.strokeStyle = '#5d6b74'; c.lineWidth = 1.4;
        c.beginPath();
        c.moveTo(tx - 5, ty); c.lineTo(tx - 3.5, ty - 10);
        c.moveTo(tx + 5, ty); c.lineTo(tx + 3.5, ty - 10);
        c.stroke();
        c.fillStyle = CM.shade(base, 0.9);
        c.beginPath();
        c.moveTo(tx - 6, ty - 10); c.lineTo(tx + 6, ty - 10);
        c.lineTo(tx + 5, ty - 17); c.lineTo(tx - 5, ty - 17);
        c.closePath(); c.fill();
        c.fillStyle = CM.shade(base, 1.22);
        c.beginPath(); c.ellipse(tx, ty - 17, 5, 2.4, 0, 0, 6.2832); c.fill();
        break;
      }
      /* ---------- 自来水厂 ---------- */
      case 'water': {
        const hw = 18, hd = 9;
        shadow(c, cx, cy, hw + 4, hd + 2, 10, 4, 0.16);
        isoBox(c, cx, cy, hw, hd, 7, CM.shade(base, 1.12), CM.shade(base, 0.8), CM.shade(base, 0.94));
        const tx = cx - 2, ty = cy - 7;
        c.strokeStyle = '#5d6b74'; c.lineWidth = 1.6;
        c.beginPath();
        c.moveTo(tx - 7, ty + 1); c.lineTo(tx - 4, ty - 13);
        c.moveTo(tx + 7, ty + 1); c.lineTo(tx + 4, ty - 13);
        c.moveTo(tx, ty + 2); c.lineTo(tx, ty - 13);
        c.stroke();
        c.fillStyle = CM.shade(base, 0.9);
        c.beginPath();
        c.moveTo(tx - 8, ty - 13); c.lineTo(tx + 8, ty - 13);
        c.lineTo(tx + 7, ty - 23); c.lineTo(tx - 7, ty - 23);
        c.closePath(); c.fill();
        c.fillStyle = CM.shade(base, 1.22);
        c.beginPath(); c.ellipse(tx, ty - 23, 7, 3.4, 0, 0, 6.2832); c.fill();
        c.fillStyle = 'rgba(200,235,255,.35)';
        c.beginPath(); c.ellipse(tx - 1.5, ty - 23.6, 3.2, 1.5, 0, 0, 6.2832); c.fill();
        break;
      }
      /* ---------- 燃气发电厂 ---------- */
      case 'power': {
        const hw = 19, hd = 9.5;
        shadow(c, cx, cy, hw + 5, hd + 2, 11, 4, 0.17);
        isoBox(c, cx, cy, hw, hd, 9, CM.shade(base, 1.1), CM.shade(base, 0.76), CM.shade(base, 0.9));
        for (let k = 0; k < 2; k++) {
          const tx = cx - 8 + k * 15, ty = cy - 9;
          c.fillStyle = '#9aa3a8';
          c.beginPath();
          c.moveTo(tx - 6, ty); c.quadraticCurveTo(tx - 3.6, ty - 9, tx - 4.4, ty - 16);
          c.lineTo(tx + 4.4, ty - 16); c.quadraticCurveTo(tx + 3.6, ty - 9, tx + 6, ty);
          c.closePath(); c.fill();
          c.fillStyle = '#c2cbcf';
          c.beginPath(); c.ellipse(tx, ty - 16, 4.4, 2, 0, 0, 6.2832); c.fill();
          c.fillStyle = 'rgba(255,255,255,.55)';
          c.beginPath(); c.ellipse(tx, ty - 16.4, 3, 1.3, 0, 0, 6.2832); c.fill();
        }
        isoBox(c, cx + hw * 0.6, cy - 12, 2.6, 1.3, 14, '#8a8880', '#5f5d57', '#726f68');
        break;
      }
      /* ---------- 派出所 ---------- */
      case 'police': {
        const hw = 19, hd = 9.5, h = 13;
        shadow(c, cx, cy, hw, hd, 10, 4, 0.16);
        isoBox(c, cx, cy, hw, hd, h, CM.shade('#e6e9ec', 1.05), CM.shade('#d8dde1', 0.82), CM.shade('#e0e5e9', 0.95));
        isoBox(c, cx, cy, hw + 1, hd + 0.6, h + 3, '#4a6fa8', '#2f4a75', '#3b5c8c');
        isoBox(c, cx + hw * 0.55, cy - h - 1, 3.4, 1.7, 6, '#3c5a8c', '#22375c', '#2c4670');
        windows(c, cx - hw, cy - h, hw, hd, 0, h, 2, 3, CM.rgba('#4678b4', dim ? 0.3 : 0.55), 0.1, 0.9, 0.18, 0.72);
        break;
      }
      /* ---------- 消防站 ---------- */
      case 'fire': {
        const hw = 19, hd = 9.5, h = 13;
        shadow(c, cx, cy, hw, hd, 10, 4, 0.16);
        isoBox(c, cx, cy, hw, hd, h, CM.shade('#e9e3dc', 1.05), CM.shade('#d9d0c6', 0.82), CM.shade('#e3dad0', 0.95));
        hipRoof(c, cx, cy, hw + 1, hd + 0.6, h, 6, '#b04b43', 0);
        windows(c, cx, cy - h + hd, hw, -hd, 0, h, 1, 2, 'rgba(60,50,48,.55)', 0.12, 0.88, 0.35, 0.95);
        break;
      }
      /* ---------- 小学 ---------- */
      case 'school': {
        const hw = 20, hd = 10, h = 12;
        fillDiamond(c, cx + 2, cy + 2, hw + 4, hd + 2, 'rgba(200,215,160,.28)');
        shadow(c, cx, cy, hw, hd, 9, 4, 0.14);
        isoBox(c, cx, cy, hw - 2, hd - 1, h, CM.shade(base, 1.16), CM.shade(base, 0.8), CM.shade(base, 0.94));
        hipRoof(c, cx, cy, hw - 1, hd, h, 6, '#a2683f', 0);
        windows(c, cx - hw + 2, cy - h, hw - 2, hd - 1, 0, h, 2, 4, winCol(dim, false), 0.06, 0.94, 0.3, 0.8);
        c.strokeStyle = '#b9c2c9'; c.lineWidth = 1.2;
        c.beginPath(); c.moveTo(cx + hw - 4, cy - h); c.lineTo(cx + hw - 4, cy - h - 16); c.stroke();
        poly(c, [[cx + hw - 4, cy - h - 16], [cx + hw + 3, cy - h - 14], [cx + hw - 4, cy - h - 12]], '#cf5a52');
        break;
      }
      /* ---------- 中学 ---------- */
      case 'school2': {
        const hw = 23, hd = 11.5, h = 15;
        fillDiamond(c, cx + 2, cy + 3, hw + 4, hd + 2, 'rgba(196,214,150,.26)');
        shadow(c, cx, cy, hw, hd, 10, 4, 0.15);
        isoBox(c, cx, cy, hw - 3, hd - 1.5, h, CM.shade(base, 1.15), CM.shade(base, 0.79), CM.shade(base, 0.93));
        isoBox(c, cx - hw * 0.35, cy - h * 0.2, hw * 0.3, hd * 0.35, h + 6, CM.shade(base, 1.2), CM.shade(base, 0.84), CM.shade(base, 0.96));
        windows(c, cx - hw + 3, cy - h, hw - 3, hd - 1.5, 0, h, 3, 5, winCol(dim, false), 0.05, 0.95, 0.2, 0.82);
        c.strokeStyle = '#b9c2c9'; c.lineWidth = 1.2;
        c.beginPath(); c.moveTo(cx + hw - 5, cy - h); c.lineTo(cx + hw - 5, cy - h - 18); c.stroke();
        poly(c, [[cx + hw - 5, cy - h - 18], [cx + hw + 3, cy - h - 16], [cx + hw - 5, cy - h - 14]], '#cf5a52');
        break;
      }
      /* ---------- 社区诊所 ---------- */
      case 'clinic': {
        const hw = 15, hd = 7.5, h = 11;
        shadow(c, cx, cy, hw, hd, 8, 3, 0.14);
        isoBox(c, cx, cy, hw, hd, h, CM.shade(base, 1.06), CM.shade(base, 0.82), CM.shade(base, 0.95));
        c.fillStyle = '#cf4b45';
        c.fillRect(cx - 1.2, cy - h - 1.6, 2.4, 6);
        c.fillRect(cx - 3.6, cy - h + 0.4, 7.2, 2.4);
        windows(c, cx - hw, cy - h, hw, hd, 0, h, 2, 2, winCol(dim, false), 0.1, 0.9, 0.3, 0.8);
        break;
      }
      /* ---------- 综合医院 ---------- */
      case 'hospital': {
        const hw = 21, hd = 10.5, h = 22;
        shadow(c, cx, cy, hw, hd, 11, 4, 0.18);
        isoBox(c, cx, cy, hw, hd, h, CM.shade(base, 1.04), CM.shade(base, 0.8), CM.shade(base, 0.93));
        isoBox(c, cx, cy, hw - 2, hd - 1, h + 4, '#ffffff', '#cfd6db', '#e2e8ec');
        c.fillStyle = '#cf4b45';
        c.fillRect(cx - 1.5, cy - h - 4.4, 3, 9);
        c.fillRect(cx - 4.8, cy - h - 1.9, 9.6, 3);
        windows(c, cx - hw, cy - h, hw, hd, 0, h, 4, 3, winCol(dim, false));
        break;
      }
      /* ---------- 街心公园 ---------- */
      case 'park': {
        const hw = 26, hd = 13;
        fillDiamond(c, cx, cy, hw, hd, 'rgba(120,180,110,.55)');
        c.strokeStyle = 'rgba(232,224,190,.7)'; c.lineWidth = 3;
        c.beginPath();
        c.moveTo(cx - hw + 4, cy + 5);
        c.quadraticCurveTo(cx - 4, cy - 2, cx + hw - 5, cy - 6);
        c.stroke();
        drawTree(c, cx - 9, cy + 2, 0.78, 0);
        drawTree(c, cx + 3, cy + 5, 0.62, 1);
        drawTree(c, cx + 11, cy - 2, 0.55, 0);
        c.fillStyle = 'rgba(120,90,60,.75)';
        c.fillRect(cx - 4, cy - 4, 7, 2);
        break;
      }
      /* ---------- 中央公园 ---------- */
      case 'park2': {
        const hw = 30, hd = 15;
        fillDiamond(c, cx, cy, hw, hd, 'rgba(110,175,100,.6)');
        fillDiamond(c, cx + 6, cy + 5, 10, 5, 'rgba(90,160,205,.75)');
        c.strokeStyle = 'rgba(232,224,190,.75)'; c.lineWidth = 3.4;
        c.beginPath();
        c.moveTo(cx - hw + 5, cy + 4);
        c.quadraticCurveTo(cx - 6, cy - 8, cx + 6, cy - 6);
        c.quadraticCurveTo(cx + 16, cy - 4, cx + hw - 6, cy + 6);
        c.stroke();
        drawTree(c, cx - 13, cy + 1, 0.9, 0);
        drawTree(c, cx - 4, cy - 6, 0.75, 1);
        drawTree(c, cx + 13, cy - 4, 0.7, 0);
        drawTree(c, cx - 8, cy + 7, 0.6, 1);
        break;
      }
      /* ---------- 垃圾转运站 ---------- */
      case 'wasteSmall': {
        const hw = 14, hd = 7;
        shadow(c, cx, cy, hw, hd, 8, 3, 0.15);
        isoBox(c, cx, cy, hw, hd, 8, CM.shade(base, 1.1), CM.shade(base, 0.76), CM.shade(base, 0.9));
        c.fillStyle = '#6f767c';
        c.beginPath(); c.ellipse(cx + 9, cy + 1, 3, 1.6, 0, 0, 6.2832); c.fill();
        c.fillRect(cx + 6, cy - 3, 6, 3.4);
        break;
      }
      /* ---------- 垃圾处理厂 ---------- */
      case 'waste': {
        const hw = 19, hd = 9.5, h = 11;
        shadow(c, cx, cy, hw, hd, 10, 4, 0.17);
        isoBox(c, cx, cy, hw, hd, h, CM.shade(base, 1.1), CM.shade(base, 0.76), CM.shade(base, 0.9));
        isoBox(c, cx - 6, cy - h + 2, 8, 4, 5, '#8d949a', '#5c6266', '#70767b');
        isoBox(c, cx + 7, cy - h * 0.4, 4, 2, 12, '#9aa0a4', '#666d72', '#7b8288');
        c.fillStyle = '#6f767c';
        c.beginPath(); c.ellipse(cx + 9, cy + 1, 3, 1.6, 0, 0, 6.2832); c.fill();
        c.fillRect(cx + 6, cy - 2, 6, 3);
        break;
      }
      /* ---------- 市政厅 ---------- */
      case 'cityhall': {
        const hw = 23, hd = 11.5, h = 17;
        shadow(c, cx, cy, hw + 2, hd + 1, 12, 5, 0.2);
        isoBox(c, cx, cy, hw, hd, h, CM.shade(base, 1.08), CM.shade(base, 0.78), CM.shade(base, 0.92));
        c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1.6;
        for (let k = 0; k < 5; k++) {
          const u = 0.14 + k * 0.18;
          const x0 = cx - hw + u * hw, y0 = cy - h + u * hd;
          c.beginPath(); c.moveTo(x0, y0 + 1); c.lineTo(x0, y0 + h * 0.82); c.stroke();
        }
        poly(c, [[cx - hw, cy - h], [cx, cy - h + hd], [cx, cy - h - 3], [cx - hw, cy - h]], 'rgba(240,238,228,.9)');
        poly(c, [[cx, cy - h + hd], [cx + hw, cy - h], [cx + hw, cy - h - 3], [cx, cy - h - 3]], 'rgba(224,220,206,.92)');
        hipRoof(c, cx, cy, hw + 1.5, hd + 0.8, h + 3, 8, '#c9a04a', 0);
        windows(c, cx - hw, cy - h, hw, hd, 0, h, 2, 4, winCol(dim, true), 0.06, 0.94, 0.2, 0.7);
        c.strokeStyle = '#cfd6db'; c.lineWidth = 1.4;
        const fx = cx + hw - 6, fy = cy - h - 11;
        c.beginPath(); c.moveTo(fx, fy + 6); c.lineTo(fx, fy - 22); c.stroke();
        const wav = Math.sin(R.time * 2.2) * 2;
        poly(c, [[fx, fy - 22], [fx + 12, fy - 20 + wav], [fx + 12, fy - 14 + wav], [fx, fy - 12]], '#c4534c');
        break;
      }
      default:
        break;
    }

    if (alpha !== 1) c.globalAlpha = 1;

    if (!b.active) {
      const topY = cy - (def.h + 14);
      c.fillStyle = 'rgba(224,80,70,.92)';
      c.beginPath(); c.arc(cx, topY, 5.2, 0, 6.2832); c.fill();
      c.fillStyle = '#fff';
      c.font = '700 7px "Microsoft YaHei",sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('!', cx, topY + 0.5);
    }
  }

  /* 冒烟 */
  function drawSmoke(c, t) {
    const b = t.building;
    if (!b || !(b.kind === 'I1' || b.kind === 'I3' || b.kind === 'power')) return;
    const cx = (t.x - t.y) * HW, cy = (t.x + t.y) * HD;
    const d = CM.RES[b.kind] || CM.PUB[b.kind];
    const big = b.kind === 'I3' || b.kind === 'power';
    const px = cx + (b.kind === 'power' ? 12 : 11), py = cy - d.h - (big ? 13 : 9);
    for (let k = 0; k < 3; k++) {
      const p = ((R.time * 0.5 + k * 0.33) % 1);
      const yy = py - p * 26;
      const xx = px + Math.sin((p + k) * 6) * 3;
      const r = 2.2 + p * 5;
      c.fillStyle = 'rgba(190,196,200,' + (0.22 * (1 - p)) + ')';
      c.beginPath(); c.arc(xx, yy, r, 0, 6.2832); c.fill();
    }
  }

  /* ================= 地形离屏层 ================= */
  R.markTerrain = function () { R.terrainDirty = true; };

  R.buildTerrain = function () {
    const st = R.state;
    if (!st) return;
    const isoW = (R.W + R.H) * HW;
    const isoH = (R.W + R.H) * HD;
    R.TS = ((R.W + R.H) > 60) ? 1 : 2;
    if (!R.terrain || R.terrain.width !== isoW * R.TS || R.terrain.height !== isoH * R.TS) {
      R.terrain = document.createElement('canvas');
      R.terrain.width = Math.round(isoW * R.TS);
      R.terrain.height = Math.round(isoH * R.TS);
      R.tctx = R.terrain.getContext('2d');
    }
    const c = R.tctx;
    const TS = R.TS;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, R.terrain.width, R.terrain.height);
    c.setTransform(TS, 0, 0, TS, R.H * HW * TS, HD * TS);

    const seed = st.seed;
    R.coastSea = [];
    R.seaWaves = [];
    for (let i = 0; i < R.order.length; i++) {
      const t = st.tiles[R.order[i]];
      drawGround(c, t, seed);
      if (t.terrain !== 'sea') continue;
      if (t.depth === 0) {
        const dirs = [];
        for (let k = 0; k < 4; k++) {
          const o = CM.tileAt(st, t.x + DIRS4[k][0], t.y + DIRS4[k][1]);
          if (CM.isLand(o)) dirs.push(k);
        }
        if (dirs.length) R.coastSea.push({ x: t.x, y: t.y, dirs: dirs });
      }
      if (((t.x * 3 + t.y * 5) % 7 === 0) && (t.depth || 0) <= 3) {
        R.seaWaves.push({ x: t.x, y: t.y, ph: CM.hash2(t.x, t.y, seed + 17) * 6.283 });
      }
    }
    R.terrainDirty = false;
  };

  function drawGround(c, t, seed) {
    const cx = (t.x - t.y) * HW, cy = (t.x + t.y) * HD;
    const tt = CM.TERRAIN[t.terrain];
    const v = CM.hash2(t.x, t.y, seed);

    /* ---- 海 ---- */
    if (t.terrain === 'sea') {
      const dp = CM.clamp(t.depth || 0, 0, 6);
      const m = CM.clamp(dp / 5, 0, 1);
      let col = CM.mix('#5abed2', '#0f3452', m);
      col = CM.shade(col, 0.965 + v * 0.07);
      fillDiamond(c, cx, cy, HW + 1.3, HD + 1, col);
      if (dp <= 2) {
        c.strokeStyle = 'rgba(255,255,255,.07)';
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(cx - HW * 0.45, cy + HD * 0.22);
        c.quadraticCurveTo(cx - HW * 0.05, cy - HD * 0.12, cx + HW * 0.2, cy + HD * 0.1);
        c.stroke();
      }
      return;
    }

    /* ---- 陆地 ---- */
    let base;
    if (t.terrain === 'beach') {
      base = CM.shade(tt.color, 0.97 + v * 0.08);
    } else if (t.terrain === 'reclaimed') {
      base = CM.shade(tt.color, 0.95 + v * 0.09);
    } else {
      base = tt.color;
      if (t.cleared) base = CM.mix(tt.color, '#b9c886', t.terrain === 'grass' ? 0.44 : 0.54);
      const v2 = CM.hash2(Math.floor(t.x / 2), Math.floor(t.y / 2), seed + 7);
      base = CM.mix(base, v2 > 0.55 ? '#7fb356' : '#548a3a', Math.abs(v2 - 0.5) * 0.26);
      base = CM.shade(base, 0.95 + v * 0.1);
    }
    fillDiamond(c, cx, cy, HW + 0.7, HD + 0.5, base);

    /* 沙滩：沙粒 + 湿沙边 */
    if (t.terrain === 'beach') {
      c.fillStyle = 'rgba(255,255,255,.16)';
      for (let k = 0; k < 3; k++) {
        const a = CM.hash2(t.x * 5 + k, t.y * 7 + k, seed + 3);
        const b = CM.hash2(t.x * 9 + k, t.y * 3 + k, seed + 4);
        c.beginPath();
        c.ellipse(cx + (a - 0.5) * TW * 0.5, cy + (b - 0.5) * TH * 0.5, 1.7, 0.9, 0, 0, 6.2832);
        c.fill();
      }
      if (t.coast) {
        c.strokeStyle = 'rgba(120,200,215,.30)';
        c.lineWidth = 1.6;
        dPath(c, cx, cy, HW * 0.82, HD * 0.82);
        c.stroke();
      }
    }

    /* 填海地：平整的方格 */
    if (t.terrain === 'reclaimed') {
      c.strokeStyle = 'rgba(255,255,255,.13)';
      c.lineWidth = 0.9;
      c.beginPath();
      c.moveTo(cx - HW * 0.55, cy - HD * 0.28);
      c.lineTo(cx + HW * 0.55, cy + HD * 0.28);
      c.moveTo(cx - HW * 0.55, cy + HD * 0.28);
      c.lineTo(cx + HW * 0.55, cy - HD * 0.28);
      c.stroke();
    }

    if (!t.cleared) {
      if (t.terrain === 'grass') {
        c.strokeStyle = 'rgba(255,255,255,.10)';
        c.lineWidth = 0.9;
        for (let k = 0; k < 2; k++) {
          const a = CM.hash2(t.x * 3 + k, t.y * 5 + k, seed + 1);
          const b = CM.hash2(t.x * 7 + k, t.y * 11 + k, seed + 2);
          const px = cx + (a - 0.5) * TW * 0.62;
          const py = cy + (b - 0.5) * TH * 0.62;
          c.beginPath();
          c.moveTo(px, py); c.lineTo(px + 1.4, py - 3.4);
          c.moveTo(px + 2.6, py + 0.4); c.lineTo(px + 3.6, py - 2.6);
          c.stroke();
        }
      } else if (t.terrain === 'forest') {
        c.fillStyle = 'rgba(24,58,30,.30)';
        c.beginPath(); c.ellipse(cx, cy, HW * 0.5, HD * 0.5, 0, 0, 6.2832); c.fill();
      } else if (t.terrain === 'hill') {
        c.fillStyle = 'rgba(120,112,92,.5)';
        c.beginPath(); c.ellipse(cx - 6, cy + 2, 6, 3, 0, 0, 6.2832); c.fill();
        c.fillStyle = 'rgba(150,142,120,.55)';
        c.beginPath(); c.ellipse(cx + 7, cy - 2, 4.4, 2.2, 0, 0, 6.2832); c.fill();
      }
    } else if (t.terrain !== 'beach' && t.terrain !== 'reclaimed') {
      c.strokeStyle = 'rgba(255,255,255,.07)';
      c.lineWidth = 0.9;
      c.beginPath();
      c.moveTo(cx - HW * 0.62, cy);
      c.lineTo(cx + HW * 0.62, cy);
      c.stroke();
    }

    c.strokeStyle = 'rgba(20,40,30,.10)';
    c.lineWidth = 0.8;
    dPath(c, cx, cy, HW + 0.2, HD + 0.1);
    c.stroke();

    if (t.zone) {
      const z = CM.ZONES[t.zone];
      fillDiamond(c, cx, cy, HW * 0.94, HD * 0.94, CM.rgba(z.color, 0.33));
      c.setLineDash([7, 5]);
      c.strokeStyle = CM.rgba(z.color, 0.95);
      c.lineWidth = 1.8;
      dPath(c, cx, cy, HW * 0.9, HD * 0.9);
      c.stroke();
      c.setLineDash([]);
      c.font = '700 11px "Microsoft YaHei",sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = 2.6;
      c.strokeStyle = 'rgba(10,25,20,.45)';
      c.strokeText(z.letter, cx, cy);
      c.fillStyle = '#ffffff';
      c.fillText(z.letter, cx, cy);
    }

    if (t.road) {
      fillDiamond(c, cx, cy, HW * 0.96, HD * 0.96, '#565c64');
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (let k = 0; k < 4; k++) {
        const o = CM.tileAt(R.state, t.x + nb[k][0], t.y + nb[k][1]);
        if (!o || !o.road) continue;
        const ex = (nb[k][0] - nb[k][1]) * HW / 2, ey = (nb[k][0] + nb[k][1]) * HD / 2;
        c.strokeStyle = '#565c64'; c.lineWidth = 11; c.lineCap = 'butt';
        c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + ex, cy + ey); c.stroke();
      }
      c.setLineDash([5, 6]);
      c.strokeStyle = 'rgba(246,238,208,.34)';
      c.lineWidth = 1.1;
      for (let k = 0; k < 4; k++) {
        const o = CM.tileAt(R.state, t.x + nb[k][0], t.y + nb[k][1]);
        if (!o || !o.road) continue;
        const ex = (nb[k][0] - nb[k][1]) * HW / 2, ey = (nb[k][0] + nb[k][1]) * HD / 2;
        c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + ex, cy + ey); c.stroke();
      }
      c.setLineDash([]);
    }
  }

  /* ================= 相机 ================= */
  R.screenToIso = function (sx, sy) {
    return { x: (sx - R.cam.x) / R.cam.zoom, y: (sy - R.cam.y) / R.cam.zoom };
  };
  R.isoToScreen = function (ix, iy) {
    return { x: ix * R.cam.zoom + R.cam.x, y: iy * R.cam.zoom + R.cam.y };
  };
  R.tileScreen = function (x, y) {
    return R.isoToScreen((x - y) * HW, (x + y) * HD);
  };

  R.pick = function (sx, sy) {
    const st = R.state;
    if (!st) return null;
    const p = R.screenToIso(sx, sy);

    for (let i = R.order.length - 1; i >= 0; i--) {
      const t = st.tiles[R.order[i]];
      if (!t.building) continue;
      const cx = (t.x - t.y) * HW, cy = (t.x + t.y) * HD;
      const def = CM.RES[t.building.kind] || CM.PUB[t.building.kind];
      const h = def ? def.h + 4 : 8;
      const pts = [
        [cx, cy - h - HD], [cx + HW, cy - h], [cx + HW, cy],
        [cx, cy + HD], [cx - HW, cy], [cx - HW, cy - h]
      ];
      if (inPoly(p.x, p.y, pts)) return t;
    }

    const a = p.x / HW, b = p.y / HD;
    const fx = (a + b) / 2, fy = (b - a) / 2;
    const tx = Math.floor(fx + 0.5), ty = Math.floor(fy + 0.5);
    if (tx < 0 || ty < 0 || tx >= R.W || ty >= R.H) return null;
    return st.tiles[ty * R.W + tx];
  };

  R.mapBox = function () {
    const W = R.W, H = R.H;
    return {
      nx: 0, ny: -HD,
      ex: W * HW, ey: (W - 1) * HD,
      sx: (W - H) * HW, sy: (W + H - 1) * HD,
      wx: -H * HW, wy: (H - 1) * HD
    };
  };

  R.fitZoom = function () {
    const availW = Math.max(360, R.vw - R.ui.left - R.ui.right);
    const availH = Math.max(300, R.vh - R.ui.top - 24);
    const bw = (R.W + R.H) * HW;
    const bh = (R.W + R.H) * HD + 90;
    return CM.clamp(Math.min(availW / bw, availH / bh), 0.35, 1.9);
  };

  R.clampCam = function () {
    const z = R.cam.zoom;
    const bw = (R.W + R.H) * HW * z;
    const bh = (R.W + R.H) * HD * z;
    const cx = R.vw / 2, cy = R.vh / 2;
    R.cam.x = CM.clamp(R.cam.x, cx - bw * 0.75, cx + bw * 0.75);
    R.cam.y = CM.clamp(R.cam.y, cy - bh * 0.9, cy + bh * 0.9);
  };

  R.centerOnTile = function (tx, ty) {
    const isoX = (tx - ty) * HW, isoY = (tx + ty) * HD;
    const cx = R.ui.left + (R.vw - R.ui.left - R.ui.right) / 2;
    const cy = R.ui.top + (R.vh - R.ui.top) / 2;
    R.cam.zoom = R.fitZoom();
    R.cam.x = cx - isoX * R.cam.zoom;
    R.cam.y = cy - isoY * R.cam.zoom;
    R.clampCam();
  };

  R.zoomBy = function (factor, sx, sy) {
    const before = R.screenToIso(sx, sy);
    R.cam.zoom = CM.clamp(R.cam.zoom * factor, 0.3, 2.6);
    const after = R.screenToIso(sx, sy);
    R.cam.x += (after.x - before.x) * R.cam.zoom;
    R.cam.y += (after.y - before.y) * R.cam.zoom;
    R.clampCam();
  };

  R.panBy = function (dx, dy) {
    R.cam.x += dx; R.cam.y += dy;
    R.clampCam();
  };

  /* ================= 初始化 ================= */
  R.init = function (canvas) {
    R.canvas = canvas;
    R.ctx = canvas.getContext('2d');
    R.resize();
    window.addEventListener('resize', function () { R.resize(); });
    R.clouds = [
      { x: -0.25, y: 0.2, r: 210, sx: 0.008, sy: 0.003 },
      { x: 0.4, y: 0.55, r: 280, sx: 0.011, sy: 0.005 },
      { x: 0.9, y: 0.3, r: 170, sx: 0.007, sy: 0.002 }
    ];
  };

  R.resize = function () {
    const w = window.innerWidth, h = window.innerHeight;
    const side = CM.$('#sidepanel');
    const rightVisible = side && getComputedStyle(side).display !== 'none';
    R.ui.right = rightVisible ? 252 : 12;
    R.dpr = Math.min(window.devicePixelRatio || 1, 2);
    R.vw = w; R.vh = h;
    R.canvas.width = Math.floor(w * R.dpr);
    R.canvas.height = Math.floor(h * R.dpr);
    R.canvas.style.width = w + 'px';
    R.canvas.style.height = h + 'px';
    R.dirtyCache();
  };

  /* 静态图层缓存（暗角、沙盘投影）：每帧重画全屏/大半径渐变在软件光栅化下很贵 */
  R.dirtyCache = function () {
    R.cache = {};
  };

  function getBackground(bg) {
    const key = bg.top + '|' + bg.mid + '|' + bg.bot;
    const C = R.cache = R.cache || {};
    if (C.bg && C.bgKey === key) return C.bg;

    /* 单张全分辨率画布，跨昼夜档位原地重绘：只占一张图的内存，帧成本最低 */
    if (!C.bg) {
      C.bg = document.createElement('canvas');
      C.bg.width = Math.max(1, Math.floor(R.vw * R.dpr));
      C.bg.height = Math.max(1, Math.floor(R.vh * R.dpr));
    }
    const c = C.bg.getContext('2d');
    c.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
    c.clearRect(0, 0, R.vw, R.vh);
    const g = c.createLinearGradient(0, 0, 0, R.vh);
    g.addColorStop(0, bg.top);
    g.addColorStop(0.55, bg.mid);
    g.addColorStop(1, bg.bot);
    c.fillStyle = g;
    c.fillRect(0, 0, R.vw, R.vh);
    /* 暗角烘进背景，省掉每帧一次全屏 blit */
    const vig = getVignette();
    c.drawImage(vig, 0, 0, R.vw, R.vh);
    C.bgKey = key;
    return C.bg;
  }

  function getVignette() {
    const C = R.cache = R.cache || {};
    if (C.vignette) return C.vignette;
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.floor(R.vw * R.dpr));
    cv.height = Math.max(1, Math.floor(R.vh * R.dpr));
    const c = cv.getContext('2d');
    c.scale(R.dpr, R.dpr);
    const vg = c.createRadialGradient(R.vw * 0.5, R.vh * 0.48, Math.min(R.vw, R.vh) * 0.32,
      R.vw * 0.5, R.vh * 0.48, Math.max(R.vw, R.vh) * 0.78);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(2,8,12,.42)');
    c.fillStyle = vg;
    c.fillRect(0, 0, R.vw, R.vh);
    C.vignette = cv;
    return cv;
  }

  R.bind = function (state) {
    R.state = state;
    R.W = state.W;
    R.H = state.H;
    buildOrder();
    R.terrain = null;
    R.terrainDirty = true;
    R.resize();
    R.dirtyCache();
    R.centerOnTile(state.hall.x, state.hall.y);
  };

  function buildOrder() {
    const arr = [];
    for (let y = 0; y < R.H; y++) {
      for (let x = 0; x < R.W; x++) arr.push(y * R.W + x);
    }
    arr.sort(function (a, b) {
      const A = R.state.tiles[a], B = R.state.tiles[b];
      return (A.x + A.y) - (B.x + B.y) || A.x - B.x;
    });
    R.order = arr;
  }

  /* ================= 昼夜 ================= */
  function lighting(st) {
    const tt = st.tOfDay == null ? 0.35 : st.tOfDay;
    const e = Math.sin((tt - 0.25) * Math.PI * 2);      // -1 午夜, 0 日出/日落, 1 正午
    const daylight = CM.clamp(0.5 + e * 0.9, 0, 1);
    const night = CM.clamp(1 - daylight * 1.8, 0, 1);
    const dusk = CM.clamp(1 - Math.abs(e) * 3.2, 0, 1);
    return { e: e, daylight: daylight, night: night, dusk: dusk };
  }

  function bgColors(l) {
    /* 量化到 1/12 档，让背景位图可以复用（视觉上无感） */
    const day = Math.round(Math.min(1, Math.max(0, l.daylight)) * 12) / 12;
    const top = CM.mix('#08131c', '#16303f', day);
    const mid = CM.mix('#0c1a24', '#1b3442', day);
    const bot = CM.mix('#091219', '#132530', day);
    return { top: top, mid: mid, bot: bot };
  }

  /* ================= 主绘制 ================= */
  /* 沙盘底座（含投影）：整块烘成一张低分辨率底图，每帧只做一次小尺寸 drawImage */
  function getSlabBackdrop(b) {
    const d = 26;
    const key = 'slabBg:' + b.ex.toFixed(1) + ':' + b.ey.toFixed(1) + ':' + b.sx.toFixed(1) + ':' + b.sy.toFixed(1);
    if (R.cache && R.cache[key]) return R.cache[key];

    const r = Math.max(b.ex, 300) * 0.95;
    const cx0 = (b.nx + b.sx) / 2, cy0 = (b.ny + b.sy) / 2 + 40;
    /* 覆盖：地图菱形 + 投影椭圆 */
    const minX = Math.min(b.wx, cx0 - r);
    const maxX = Math.max(b.ex, cx0 + r);
    const minY = Math.min(b.ny, cy0 - r * 0.52);
    const maxY = Math.max(b.sy + d, cy0 + r * 0.52);
    const bw = maxX - minX, bh = maxY - minY;

    const cv = document.createElement('canvas');
    /* 低分辨率烘培：画面上这块只占 1000px 左右，240 宽足够软阴影 */
    const SC = 240 / Math.max(1, bw);
    cv.width = Math.max(2, Math.round(bw * SC));
    cv.height = Math.max(2, Math.round(bh * SC));
    const c = cv.getContext('2d');
    c.scale(SC, SC);
    c.translate(-minX, -minY);

    /* 投影 */
    c.save();
    c.translate(cx0, cy0);
    c.scale(1, 0.52);
    const g = c.createRadialGradient(0, 0, r * 0.12, 0, 0, r);
    g.addColorStop(0, 'rgba(0,0,0,.40)');
    g.addColorStop(0.66, 'rgba(0,0,0,.20)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.beginPath(); c.arc(0, 0, r, 0, 6.2832); c.fill();
    c.restore();

    /* 底板侧面与顶面 */
    poly(c, [[b.wx, b.wy], [b.sx, b.sy], [b.sx, b.sy + d], [b.wx, b.wy + d]], '#0a2033');
    poly(c, [[b.sx, b.sy], [b.ex, b.ey], [b.ex, b.ey + d], [b.sx, b.sy + d]], '#071726');
    poly(c, [[b.nx, b.ny], [b.ex, b.ey], [b.sx, b.sy], [b.wx, b.wy]], '#0e3350');
    c.strokeStyle = 'rgba(170,215,235,.22)';
    c.lineWidth = 1.6;
    c.beginPath(); c.moveTo(b.wx, b.wy); c.lineTo(b.nx, b.ny); c.lineTo(b.ex, b.ey); c.stroke();

    const out = { canvas: cv, x: minX, y: minY, w: bw, h: bh };
    R.cache = R.cache || {};
    R.cache[key] = out;
    return out;
  }

  function drawSlab(c) {
    const b = R.mapBox();
    const bd = getSlabBackdrop(b);
    c.drawImage(bd.canvas, bd.x, bd.y, bd.w, bd.h);
  }

  function drawGroundMarks(c, st) {
    if (st.hover) {
      const t = st.hover;
      const cx = (t.x - t.y) * HW, cy = (t.x + t.y) * HD;
      c.strokeStyle = 'rgba(255,255,255,.6)';
      c.lineWidth = 1.6;
      dPath(c, cx, cy, HW, HD);
      c.stroke();
    }
    if (st.selected) {
      const t = st.selected;
      const cx = (t.x - t.y) * HW, cy = (t.x + t.y) * HD;
      const p = 0.55 + 0.45 * Math.sin(R.time * 3.4);
      c.strokeStyle = 'rgba(240,196,110,' + p + ')';
      c.lineWidth = 2.4;
      dPath(c, cx, cy, HW * 1.02, HD * 1.02);
      c.stroke();
      c.strokeStyle = 'rgba(240,196,110,.28)';
      c.lineWidth = 6;
      dPath(c, cx, cy, HW * 1.02, HD * 1.02);
      c.stroke();
    }
  }

  function drawGhost(c, st) {
    const g = CM.game && CM.game.preview ? CM.game.preview(st) : null;
    if (!g || !g.tile) return;
    const t = g.tile;
    const cx = (t.x - t.y) * HW, cy = (t.x + t.y) * HD;
    c.save();
    if (g.kind === 'building') {
      drawBuilding(c, { x: t.x, y: t.y, building: { kind: g.def, active: true } }, { alpha: 0.62 });
    } else if (g.kind === 'zone') {
      fillDiamond(c, cx, cy, HW * 0.9, HD * 0.9, CM.rgba(CM.ZONES[g.def].color, 0.4));
    } else if (g.kind === 'road') {
      fillDiamond(c, cx, cy, HW * 0.94, HD * 0.94, 'rgba(90,96,104,.85)');
    } else if (g.kind === 'clear') {
      fillDiamond(c, cx, cy, HW * 0.9, HD * 0.9, 'rgba(220,230,180,.28)');
    } else if (g.kind === 'reclaim') {
      fillDiamond(c, cx, cy, HW * 0.9, HD * 0.9, 'rgba(214,202,168,.82)');
      c.save();
      c.strokeStyle = 'rgba(255,255,255,.5)';
      c.lineWidth = 1.2;
      dPath(c, cx, cy, HW * 0.56, HD * 0.56);
      c.stroke();
      c.restore();
    }
    c.restore();
    c.strokeStyle = g.ok ? 'rgba(120,230,150,.95)' : 'rgba(240,110,100,.95)';
    c.lineWidth = 2;
    dPath(c, cx, cy, HW * 0.96, HD * 0.96);
    c.stroke();
  }

  function drawClouds(c) {
    const t = R.time;
    const bw = (R.W + R.H) * HW;
    for (let i = 0; i < R.clouds.length; i++) {
      const cl = R.clouds[i];
      const x = ((cl.x + t * cl.sx) % 1.5 - 0.25) * bw - R.H * HW;
      const y = ((cl.y + t * cl.sy) % 1) * (R.W + R.H) * HD;
      const g = c.createRadialGradient(x, y, 0, x, y, cl.r);
      g.addColorStop(0, 'rgba(10,24,32,.14)');
      g.addColorStop(1, 'rgba(10,24,32,0)');
      c.fillStyle = g;
      c.fillRect(x - cl.r, y - cl.r, cl.r * 2, cl.r * 2);
    }
  }

  function drawOverlay(c, st) {
    const mode = st.overlay;
    if (!mode || mode === 'none') return;
    for (let i = 0; i < R.order.length; i++) {
      const t = st.tiles[R.order[i]];
      const cx = (t.x - t.y) * HW, cy = (t.x + t.y) * HD;
      const developed = !!(t.cleared || t.building || t.road || t.zone);
      let col = null;
      if (mode === 'pollution') {
        if (t.terrain === 'sea') continue;
        if (!developed && t.pollution < 0.5) continue;
        const p = CM.clamp(t.pollution / 30, 0, 1);
        col = p < 0.02 ? 'rgba(90,169,230,0.16)' : CM.rgba(CM.mix('#63c07a', '#e0675f', p), 0.62);
      } else if (mode === 'value') {
        if (t.terrain === 'sea' || !developed) continue;
        const v = CM.clamp(t.value / 120, 0, 1);
        col = CM.rgba(CM.mix('#2f4a5c', '#e2b45f', v), 0.66);
      } else if (mode === 'road') {
        if (t.terrain === 'sea') continue;
        if (t.road) col = t.roadConn ? 'rgba(99,192,122,.66)' : 'rgba(224,103,95,.7)';
        else col = t.roadConn ? 'rgba(120,200,150,.16)' : (developed ? 'rgba(0,0,0,.28)' : 'rgba(0,0,0,.14)');
      } else if (mode === 'service') {
        if (t.terrain === 'sea' || !developed) continue;
        const cv = t.cov || {};
        if (!cv.water || !cv.power) col = 'rgba(224,103,95,.58)';
        else {
          let miss = 0;
          const kk = ['police', 'fire', 'school', 'health', 'park', 'waste'];
          for (let k = 0; k < kk.length; k++) if (!cv[kk[k]]) miss++;
          if (miss >= 4) col = 'rgba(224,165,74,.58)';
          else if (miss >= 2) col = 'rgba(200,196,110,.5)';
          else if (miss === 1) col = 'rgba(150,200,120,.42)';
          else col = 'rgba(99,192,122,.34)';
        }
      }
      if (col) fillDiamond(c, cx, cy, HW * 0.98, HD * 0.98, col);
    }
  }

  R.frame = function (state, dt) {
    if (!state) return;
    R.state = state;
    R.time += dt;

    const prof = CM.PROFILE ? {} : null;
    let tMark = prof ? CM.now() : 0;
    function mark(name) {
      if (!prof) return;
      const t = CM.now();
      prof[name] = (prof[name] || 0) + (t - tMark);
      tMark = t;
    }
    if (prof) { R.stats = R.stats || {}; }

    const l = lighting(state);
    R.night = l.night;

    const c = R.ctx, d = R.dpr;
    c.setTransform(d, 0, 0, d, 0, 0);

    const bg = bgColors(l);
    c.drawImage(getBackground(bg), 0, 0, R.vw, R.vh);
    mark('bg');

    if (R.terrainDirty) { R.buildTerrain(); mark('buildTerrain'); }

    c.setTransform(d * R.cam.zoom, 0, 0, d * R.cam.zoom, d * R.cam.x, d * R.cam.y);
    c.imageSmoothingEnabled = true;

    drawSlab(c);
    mark('slab');

    if (R.terrain) {
      c.drawImage(R.terrain, -R.H * HW, -HD, (R.W + R.H) * HW, (R.W + R.H) * HD);
    }
    mark('terrainImage');

    /* 数据图层（地形之上、建筑之下） */
    drawOverlay(c, state);
    mark('overlay');

    /* 海面波纹 */
    if (R.seaWaves && R.seaWaves.length) {
      c.strokeStyle = 'rgba(215,240,255,.15)';
      c.lineWidth = 1.1;
      for (let i = 0; i < R.seaWaves.length; i++) {
        const w = R.seaWaves[i];
        const cx = (w.x - w.y) * HW, cy = (w.x + w.y) * HD;
        const ph = R.time * 1.2 + w.ph;
        const oy = Math.sin(ph) * 3;
        c.beginPath();
        c.moveTo(cx - 13, cy + oy);
        c.quadraticCurveTo(cx, cy - 4 + oy, cx + 13, cy + oy);
        c.stroke();
      }
    }

    mark('seaWaves');

    /* 海岸浪花 */
    if (R.coastSea && R.coastSea.length) {
      c.lineCap = 'round';
      const ph0 = R.time * 1.6;
      for (let i = 0; i < R.coastSea.length; i++) {
        const cs = R.coastSea[i];
        const cx = (cs.x - cs.y) * HW, cy = (cs.x + cs.y) * HD;
        const wob = 0.5 + 0.5 * Math.sin(ph0 + cs.x * 0.55 + cs.y * 0.85);
        c.strokeStyle = 'rgba(236,252,255,' + (0.10 + 0.20 * wob) + ')';
        c.lineWidth = 1.8 + 1.1 * wob;
        for (let k = 0; k < cs.dirs.length; k++) {
          const e = EDGE_OF_DIR[cs.dirs[k]];
          c.beginPath();
          c.moveTo(cx + e[0], cy + e[1]);
          c.lineTo(cx + e[2], cy + e[3]);
          c.stroke();
        }
      }
    }

    mark('coastFoam');

    /* 选中/悬停：在地面上，被建筑遮住 */
    drawGroundMarks(c, state);
    mark('groundMarks');

    /* 树木与建筑 */
    for (let i = 0; i < R.order.length; i++) {
      const t = state.tiles[R.order[i]];
      if (t.terrain === 'forest' && !t.cleared && !t.building && !t.road) {
        const cx = (t.x - t.y) * HW, cy = (t.x + t.y) * HD;
        const h1 = CM.hash2(t.x, t.y, state.seed + 5);
        const h2 = CM.hash2(t.x + 9, t.y + 3, state.seed + 11);
        drawTree(c, cx - 8 + h1 * 6, cy + 2 + h2 * 3, 0.92 + h1 * 0.3, h1 > 0.5 ? 1 : 0);
        drawTree(c, cx + 9 - h2 * 5, cy - 3 + h1 * 2, 0.7 + h2 * 0.25, h1 > 0.3 ? 0 : 1);
        if (h2 > 0.45) drawTree(c, cx - 2 + h1 * 10, cy - 9 + h2 * 2, 0.6, 1);
      }
      if (t.building) {
        drawBuilding(c, t, null);
        drawSmoke(c, t);
      }
    }

    mark('treesBuildings');

    /* 云影 */
    drawClouds(c);
    mark('clouds');

    /* 昼夜色调 */
    if (R.night > 0.02) {
      const b = R.mapBox();
      c.save();
      c.globalCompositeOperation = 'multiply';
      c.fillStyle = 'rgba(86,110,168,' + (0.24 + R.night * 0.56) + ')';
      poly(c, [[b.nx, b.ny], [b.ex, b.ey], [b.sx, b.sy], [b.wx, b.wy]], c.fillStyle);
      c.restore();
    }
    if (R.night > 0.1) {
      /* 灯光：路灯与楼里的窗 */
      const b = R.mapBox();
      c.save();
      c.globalCompositeOperation = 'lighter';
      const la = 0.3 * R.night;
      c.fillStyle = 'rgba(255,190,105,' + la + ')';
      for (let i = 0; i < R.order.length; i++) {
        const t = state.tiles[R.order[i]];
        if (t.road) {
          const cx = (t.x - t.y) * HW, cy = (t.x + t.y) * HD;
          c.beginPath(); c.arc(cx, cy - 1, 7, 0, 6.2832); c.fill();
        }
      }
      let glowBudget = 500;
      for (let i = 0; i < R.order.length && glowBudget > 0; i++) {
        const t = state.tiles[R.order[i]];
        if (!t.building) continue;
        const def = CM.RES[t.building.kind] || CM.PUB[t.building.kind];
        if (!def || !def.h || def.h < 6) continue;
        const cx = (t.x - t.y) * HW, cy = (t.x + t.y) * HD - def.h * 0.5;
        const g2 = c.createRadialGradient(cx, cy, 0, cx, cy, 16);
        g2.addColorStop(0, 'rgba(255,204,138,' + (0.22 * R.night) + ')');
        g2.addColorStop(1, 'rgba(255,204,138,0)');
        c.fillStyle = g2;
        c.fillRect(cx - 16, cy - 16, 32, 32);
        glowBudget--;
      }
      c.restore();
    }
    if (l.daylight > 0.3) {
      const b0 = R.mapBox();
      c.save();
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = 'rgba(255,244,214,' + (0.05 * l.daylight) + ')';
      poly(c, [[b0.nx, b0.ny], [b0.ex, b0.ey], [b0.sx, b0.sy], [b0.wx, b0.wy]], c.fillStyle);
      c.restore();
    }
    if (l.dusk > 0.05) {
      const b = R.mapBox();
      c.save();
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = 'rgba(255,146,80,' + (0.10 * l.dusk) + ')';
      poly(c, [[b.nx, b.ny], [b.ex, b.ey], [b.sx, b.sy], [b.wx, b.wy]], c.fillStyle);
      c.restore();
    }

    mark('tint');

    /* 放置预览 */
    drawGhost(c, state);
    mark('ghost');

    /* 暗角已烘进背景层，这里不再额外 blit */
    mark('vignette');

    if (prof) {
      R.stats.lastProf = prof;
      if (!R.stats.acc) R.stats.acc = {};
      for (const k in prof) R.stats.acc[k] = (R.stats.acc[k] || 0) + prof[k];
      R.stats.frames = (R.stats.frames || 0) + 1;
    }
  };

  /* 强制提交本帧绘制并返回耗时（用于测得真实光栅化成本） */
  R.frameCost = function (state, dt) {
    const c = R.ctx;
    const t0 = CM.now();
    R.frame(state, dt);
    c.getImageData(0, 0, 1, 1);   // 触发光栅化
    return CM.now() - t0;
  };

  /* 取走并清空累计的渲染耗时统计 */
  R.takeStats = function () {
    const s = R.stats || {};
    const out = { frames: s.frames || 0, acc: s.acc || {} };
    R.stats = {};
    return out;
  };

  /* ================= 工具栏小图标 ================= */
  R.drawIcon = function (canvas, key) {
    const dpr = 2;
    const w = 44, h = 38;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    const c = canvas.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    c.save();
    c.translate(w / 2, h / 2 + 9);
    c.scale(0.5, 0.5);
    const savedNight = R.night;
    R.night = 0;

    function baseDiamond(col) {
      fillDiamond(c, 0, 0, HW, HD, col || 'rgba(160,185,120,.35)');
      c.strokeStyle = 'rgba(255,255,255,.28)';
      c.lineWidth = 1.6;
      dPath(c, 0, 0, HW, HD);
      c.stroke();
    }

    if (key === 'select') {
      baseDiamond('rgba(255,255,255,.10)');
      c.strokeStyle = '#f0c46e'; c.lineWidth = 2.4;
      dPath(c, 0, 0, HW * 0.66, HD * 0.66); c.stroke();
      c.fillStyle = '#fff';
      c.beginPath();
      c.moveTo(-3, -18); c.lineTo(-3, 2); c.lineTo(1, -3); c.lineTo(7, -3);
      c.closePath(); c.fill();
    } else if (key === 'clear') {
      baseDiamond('rgba(150,180,110,.45)');
      c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = 1.8;
      for (let k = -1; k <= 1; k++) {
        c.beginPath(); c.moveTo(k * 10 - 3, 4); c.lineTo(k * 10 + 1, -6); c.stroke();
      }
      c.fillStyle = 'rgba(230,240,200,.9)';
      c.font = '700 17px "Microsoft YaHei",sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('荒', 0, -1);
    } else if (key === 'road') {
      fillDiamond(c, 0, 0, HW, HD, '#565c64');
      c.setLineDash([6, 6]);
      c.strokeStyle = 'rgba(240,230,190,.7)'; c.lineWidth = 2.4;
      c.beginPath(); c.moveTo(-HW / 2, -HD / 2); c.lineTo(HW / 2, HD / 2); c.stroke();
      c.setLineDash([]);
    } else if (key === 'reclaim') {
      /* 海面 + 正在填出的沙地 */
      fillDiamond(c, 0, 0, HW, HD, '#2f86ad');
      c.strokeStyle = 'rgba(200,240,255,.35)'; c.lineWidth = 1.4;
      dPath(c, 0, 0, HW * 0.7, HD * 0.7); c.stroke();
      fillDiamond(c, 2, 2, HW * 0.42, HD * 0.42, '#d8cba4');
      c.strokeStyle = 'rgba(120,90,40,.5)'; c.lineWidth = 1.2;
      dPath(c, 2, 2, HW * 0.42, HD * 0.42); c.stroke();
      c.fillStyle = 'rgba(255,255,255,.85)';
      c.font = '700 13px "Microsoft YaHei",sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('填', -8, -6);
    } else if (key === 'demolish') {
      baseDiamond('rgba(200,120,110,.25)');
      c.strokeStyle = '#e0675f'; c.lineWidth = 3.4;
      c.beginPath(); c.moveTo(-9, -9); c.lineTo(9, 9); c.moveTo(9, -9); c.lineTo(-9, 9); c.stroke();
    } else if (CM.ZONES[key]) {
      const z = CM.ZONES[key];
      fillDiamond(c, 0, 0, HW, HD, CM.rgba(z.color, 0.35));
      c.strokeStyle = CM.rgba(z.color, 0.9); c.lineWidth = 2;
      dPath(c, 0, 0, HW * 0.92, HD * 0.92); c.stroke();
      const map = { R: 'R1', C: 'C1', I: 'I1' };
      drawBuilding(c, { x: 0, y: 0, building: { kind: map[key], active: true } }, { alpha: 0.95 });
    } else if (CM.PUB[key]) {
      baseDiamond('rgba(160,185,120,.28)');
      drawBuilding(c, { x: 0, y: 0, building: { kind: key, active: true } }, { alpha: 1 });
    }
    R.night = savedNight;
    c.restore();
  };

  CM.renderer = R;

})(window.CM);
