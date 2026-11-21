/* ===== 模拟：覆盖、连通、人口、经济、满意度（按天推进） ===== */
(function (CM) {
  'use strict';

  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  function bdef(b) { return CM.RES[b.kind] || CM.PUB[b.kind]; }

  /* ---------- 覆盖与连通 ---------- */
  function recompute(st) {
    const tiles = st.tiles;
    const W = st.W;
    let i, t;

    for (i = 0; i < tiles.length; i++) {
      t = tiles[i];
      t.cov = {};
      t.access = false;
      t.roadConn = false;
      t.pollution = 0;
      t.value = 0;
    }

    /* 1. 道路连通（从市政厅出发） */
    const hall = CM.tileAt(st, st.hall.x, st.hall.y);
    const q = [];
    const seen = {};
    function seed(t2) {
      if (!t2 || !t2.road) return;
      const id = t2.y * W + t2.x;
      if (seen[id]) return;
      seen[id] = 1; t2.roadConn = true; t2.access = true; q.push(t2);
    }
    for (i = 0; i < 4; i++) seed(CM.tileAt(st, hall.x + DIRS[i][0], hall.y + DIRS[i][1]));
    hall.access = true;
    while (q.length) {
      const cur = q.shift();
      for (i = 0; i < 4; i++) {
        const o = CM.tileAt(st, cur.x + DIRS[i][0], cur.y + DIRS[i][1]);
        if (o && o.road) {
          const id = o.y * W + o.x;
          if (!seen[id]) { seen[id] = 1; o.roadConn = true; o.access = true; q.push(o); }
        }
      }
    }

    /* 2. 公共服务覆盖（设施必须挨着已连通道路才起作用） */
    let roads = 0, trees = 0, parks = 0, sea = 0, reclaimed = 0, land = 0;
    for (i = 0; i < tiles.length; i++) {
      t = tiles[i];
      if (t.road) roads++;
      if (t.terrain === 'sea') { sea++; continue; }
      land++;
      if (t.terrain === 'reclaimed') reclaimed++;
      if (t.terrain === 'forest' && !t.cleared && !t.building) trees++;
      const b = t.building;
      if (!b) continue;
      const d = bdef(b);
      if (!d || !d.svc) continue;
      if (CM.PUB[b.kind] && b.kind === 'park') parks++;

      let acc = false;
      for (let k = 0; k < 4; k++) {
        const o = CM.tileAt(st, t.x + DIRS[k][0], t.y + DIRS[k][1]);
        if (o && o.road && o.roadConn) { acc = true; break; }
      }
      t.access = acc;
      b.active = acc;
      if (!acc || !d.radius) continue;

      const R2 = d.radius * d.radius;
      for (let dy = -d.radius; dy <= d.radius; dy++) {
        for (let dx = -d.radius; dx <= d.radius; dx++) {
          if (dx * dx + dy * dy > R2) continue;
          const o = CM.tileAt(st, t.x + dx, t.y + dy);
          if (o) o.cov[d.svc] = true;
        }
      }
    }

    /* 3. 私人建筑运转状态与统计 */
    let cap = 0, jobs = 0, resN = 0, ciN = 0, polSources = 0, units = 0;
    const rateUnit = { water: 0, power: 0, police: 0, fire: 0, school: 0, health: 0, park: 0, waste: 0 };

    for (i = 0; i < tiles.length; i++) {
      t = tiles[i];
      const b = t.building;
      if (!b) continue;
      const d = bdef(b);
      if (!d) continue;
      if (b.kind === 'cityhall') { b.active = true; continue; }
      if (!CM.RES[b.kind]) continue;   // 公共设施已在上一轮处理

      let acc = false;
      for (let k = 0; k < 4; k++) {
        const o = CM.tileAt(st, t.x + DIRS[k][0], t.y + DIRS[k][1]);
        if (o && o.road && o.roadConn) { acc = true; break; }
      }
      t.access = acc;
      b.active = acc && !!t.cov.power && !!t.cov.water;

      if (b.active) {
        if (d.cap) { cap += d.cap; resN++; units++; }
        if (d.jobs) { jobs += d.jobs; ciN++; units++; }
        const w = (d.cap || d.jobs || 1);
        for (const k in rateUnit) if (t.cov[k]) rateUnit[k] += w;
        if (d.pol) polSources += d.pol;
      }
    }

    const svcRates = {};
    const unitsDen = Math.max(units, 1);
    for (const k in rateUnit) svcRates[k] = units ? CM.clamp(rateUnit[k] / unitsDen, 0, 1) : 0;

    /* 4. 局部污染与地价 */
    for (i = 0; i < tiles.length; i++) {
      t = tiles[i];
      const b = t.building;
      if (b && b.active && CM.RES[b.kind] && CM.RES[b.kind].pol) {
        const pol = CM.RES[b.kind].pol;
        const rad = 3;
        for (let dy = -rad; dy <= rad; dy++) {
          for (let dx = -rad; dx <= rad; dx++) {
            const dd = Math.sqrt(dx * dx + dy * dy);
            if (dd > rad) continue;
            const o = CM.tileAt(st, t.x + dx, t.y + dy);
            /* 污染会飘过海面，但海面不计入地价 */
            if (o && o.terrain !== 'sea') o.pollution += pol * 2 * (1 - dd / rad);
          }
        }
      }
      const p = t.building && CM.PUB[t.building.kind];
      if (p && p.svc === 'park' && t.building.active) {
        const rad = p.radius <= 4 ? 2 : 4;
        for (let dy = -rad; dy <= rad; dy++) {
          for (let dx = -rad; dx <= rad; dx++) {
            const o = CM.tileAt(st, t.x + dx, t.y + dy);
            if (o && o.terrain !== 'sea') o.pollution = Math.max(0, o.pollution - (rad > 2 ? 5 : 3));
          }
        }
      }
    }

    for (i = 0; i < tiles.length; i++) {
      t = tiles[i];
      if (t.terrain === 'sea') { t.value = 0; continue; }
      const dist = Math.abs(t.x - st.hall.x) + Math.abs(t.y - st.hall.y);
      let v = 22 + Math.max(0, 12 - dist) * 3;
      let sc = 0;
      for (const k in t.cov) if (t.cov[k]) sc++;
      v += sc * 4;
      v -= t.pollution * 1.1;
      if (t.road) v -= 3;
      /* 临海地价加成：沙滩、填海地、靠海的住宅最贵 */
      if (t.coast) v += 16;
      if (t.terrain === 'beach') v += 4;
      t.value = Math.round(CM.clamp(v, 6, 180));
    }

    st.summary = {
      cap: cap, jobs: jobs, resN: resN, ciN: ciN, roads: roads,
      trees: trees, parks: parks, sea: sea, land: land, reclaimed: reclaimed,
      coastLand: st.coastLand || 0,
      polSources: polSources, svcRates: svcRates
    };
    st.capacity = cap;
    st.jobs = jobs;
    st.green = land > 0 ? Math.round(CM.clamp((trees + parks) / land * 100, 0, 100)) : 0;
    st.landArea = land;
    st.seaArea = sea;
    st.reclaimedCount = reclaimed;
  }

  /* ---------- 财政 ---------- */
  function economy(st) {
    const s = st.summary;
    let upkeep = s.roads * CM.COST.roadUpkeep;
    for (let i = 0; i < st.tiles.length; i++) {
      const b = st.tiles[i].building;
      if (!b) continue;
      const d = bdef(b);
      if (d && d.upkeep && b.active) upkeep += d.upkeep;
    }

    const tax = st.taxRate;
    const revRes = st.pop * 90 * tax * (0.72 + 0.28 * st.satisfaction / 100);
    const revBiz = s.jobs * 130 * tax;

    st.revenue = revRes + revBiz;
    st.upkeep = upkeep;
    st.net = st.revenue - upkeep;

    /* 按月结算，摊到每一天 */
    if (st.mode !== 'sandbox') st.money += st.net / CM.DAYS_PER_MONTH;
  }

  /* ---------- 人口与需求 ---------- */
  function population(st) {
    const s = st.summary;
    const labor = st.pop * 0.55;
    st.labor = labor;
    st.employed = Math.min(labor, s.jobs);
    const un = labor > 0.5 ? CM.clamp(1 - s.jobs / labor, 0, 1) : 0;
    st.unemployment = un;

    const cap = s.cap;
    const satF = CM.clamp((st.satisfaction - 25) / 55, 0, 1);
    const occ = cap > 0 ? CM.clamp(st.pop / cap, 0, 1.3) : 0;

    const lowVac = CM.clamp((0.95 - occ) * 1.3, 0, 1);
    st.demandR = CM.clamp(lowVac * (0.35 + 0.65 * satF) + (st.pop < 26 ? 0.35 : 0) + 0.05, 0, 1);
    st.demandC = CM.clamp(un * 1.15 + st.pop / 320 + (st.pop < 25 ? 0.18 : 0) + 0.06 -
      (s.jobs > labor * 1.35 ? 0.2 : 0), 0, 1);
    st.demandI = CM.clamp(un * 0.85 + st.pop / 420 + 0.04, 0, 1) * 0.85;

    const unEff = un * CM.clamp(labor / 25, 0.2, 1);
    let target = cap * (0.45 + 0.55 * satF) * (1 - CM.clamp(unEff * 0.85, 0, 0.78));
    if (cap > 0 && st.pop < 14) target = Math.max(target, Math.min(cap, 14));

    /* 一天的步长（约等于原来一个月的 1/30） */
    if (target > st.pop) st.pop += (target - st.pop) * 0.004 + 0.012;
    else st.pop += (target - st.pop) * 0.002;
    st.pop = Math.max(0, st.pop);
  }

  /* ---------- 私营开发与升级 ---------- */
  function development(st) {
    const rnd = Math.random;
    const tiles = st.tiles;
    const sat = st.satisfaction;

    for (let i = 0; i < tiles.length; i++) {
      const t = tiles[i];
      const b = t.building;

      if (b) {
        const d = CM.RES[b.kind];
        if (!d) continue;
        if (!b.active) {
          b.idle = (b.idle || 0) + 1;
          if (b.idle > 180) t.building = null;   // 长期停摆 → 荒废
          continue;
        }
        b.idle = 0;
        if (d.level < 3 && CM.ZONE_LEVELS[d.zone][d.level]) {
          let p = 0;
          if (t.value > 45 && sat > 52) p = 0.0008;
          if (t.value > 72 && sat > 62) p = 0.0017;
          if (t.value > 98 && sat > 72) p = 0.0028;
          if (p > 0 && rnd() < p) {
            t.building = { kind: CM.ZONE_LEVELS[d.zone][d.level], active: true, idle: 0 };
          }
        }
        continue;
      }

      if (!t.zone || !t.cleared || t.road || t.terrain === 'sea') continue;
      if (!t.cov.water || !t.cov.power) continue;

      let acc = false;
      for (let k = 0; k < 4; k++) {
        const o = CM.tileAt(st, t.x + DIRS[k][0], t.y + DIRS[k][1]);
        if (o && o.road && o.roadConn) { acc = true; break; }
      }
      if (!acc) continue;

      const z = t.zone;
      const dem = z === 'R' ? st.demandR : z === 'C' ? st.demandC : st.demandI;
      if (dem < 0.14) continue;

      let sc = 0;
      for (const k in t.cov) if (t.cov[k]) sc++;
      const q = 0.42 + 0.58 * (sc / 8);
      if (rnd() < dem * 0.0105 * q) {
        let lvl = 1;
        if (t.value > 50 && rnd() < 0.5) lvl = 2;
        if (t.value > 76 && sat > 60 && rnd() < 0.4) lvl = 3;
        const kind = CM.ZONE_LEVELS[z][lvl - 1];
        t.building = { kind: kind, active: true, idle: 0 };
      }
    }
  }

  /* ---------- 满意度 ---------- */
  function wellbeing(st) {
    const s = st.summary;
    const r = s.svcRates;
    let sat = 34;
    sat += r.water * 9 + r.power * 9;
    sat += r.police * 6 + r.fire * 4;
    sat += r.school * 7 + r.health * 6;
    sat += r.park * 4 + r.waste * 4;

    const un = st.unemployment || 0;
    const laborW = CM.clamp((st.pop * 0.55) / 25, 0.3, 1);
    sat -= un * 30 * laborW * (st.pop < 40 ? 0.6 : 1);
    sat -= st.pollution * 0.3;
    sat -= Math.max(0, st.taxRate - 0.1) * 190;

    if (st.pop < 1) sat = Math.max(sat, 55);
    sat = CM.clamp(sat, 3, 97);

    /* 满意度按天缓慢趋近目标 */
    st.satisfaction += (sat - st.satisfaction) * 0.014;
    st.satisfaction = CM.clamp(st.satisfaction, 0, 100);
  }

  /* ---------- 一天 ---------- */
  function tick(st) {
    st.day += 1;
    /* 更新月度统计用不到，直接按天算 */
    recompute(st);
    economy(st);
    population(st);
    development(st);
    recompute(st);
    wellbeing(st);
    st.monthTick = (st.monthTick || 0) + 1;
  }

  /* ---------- 日历 ---------- */
  function calendar(day) {
    const total = Math.max(1, day);
    const year = Math.floor((total - 1) / (CM.MONTHS_PER_YEAR * CM.DAYS_PER_MONTH)) + 1;
    const month = Math.floor(((total - 1) % (CM.MONTHS_PER_YEAR * CM.DAYS_PER_MONTH)) / CM.DAYS_PER_MONTH) + 1;
    const dom = ((total - 1) % CM.DAYS_PER_MONTH) + 1;
    return { year: year, month: month, day: dom };
  }

  function clockText(tOfDay) {
    const totalMin = Math.floor(tOfDay * 24 * 60);
    const hh = Math.floor(totalMin / 60);
    const mm = totalMin % 60;
    return (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm;
  }

  /* ---------- 评分（仅用于菜单里的城市概览） ---------- */
  function score(st) {
    const popScore = CM.clamp(st.pop / 400 * 35, 0, 35);
    const satScore = CM.clamp(st.satisfaction / 100 * 30, 0, 30);
    const moneyScore = CM.clamp(Math.max(0, st.money) / 300000 * 20, 0, 20);
    const envScore = CM.clamp(st.green / 100 * 15, 0, 15);
    return Math.round(popScore + satScore + moneyScore + envScore);
  }

  CM.sim = {
    recompute: recompute,
    tick: tick,
    calendar: calendar,
    clockText: clockText,
    score: score
  };

})(window.CM);
