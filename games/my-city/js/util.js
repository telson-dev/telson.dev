/* ===== 通用工具 ===== */
window.CM = window.CM || {};

(function (CM) {
  'use strict';

  CM.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  CM.lerp = function (a, b, t) { return a + (b - a) * t; };
  CM.smooth = function (t) { return t * t * (3 - 2 * t); };
  CM.len2 = function (dx, dy) { return Math.sqrt(dx * dx + dy * dy); };

  /* 确定性伪随机：mulberry32 */
  CM.rng = function (seed) {
    let a = (seed >>> 0) || 1;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  /* 稳定的二维散列，返回 0..1 */
  CM.hash2 = function (x, y, seed) {
    let h = (x * 374761393 + y * 668265263 + (seed || 0) * 2246822519) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h = h ^ (h >>> 16);
    return ((h >>> 0) % 100000) / 100000;
  };

  CM.pick = function (arr, rnd) {
    return arr[Math.floor((rnd ? rnd() : Math.random()) * arr.length) % arr.length];
  };

  /* ---------- 颜色 ---------- */
  function hex2rgb(hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    const n = parseInt(hex, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  CM.hex2rgb = hex2rgb;

  function rgb2hex(r, g, b) {
    const f = function (v) { return CM.clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0'); };
    return '#' + f(r) + f(g) + f(b);
  }

  /* f > 1 提亮，f < 1 压暗 */
  CM.shade = function (hex, f) {
    const c = hex2rgb(hex);
    if (f >= 1) {
      const t = CM.clamp((f - 1) / 0.6, 0, 1);
      return rgb2hex(CM.lerp(c[0], 255, t), CM.lerp(c[1], 255, t), CM.lerp(c[2], 255, t));
    }
    const t = CM.clamp(1 - f, 0, 1);
    return rgb2hex(c[0] * (1 - t), c[1] * (1 - t), c[2] * (1 - t));
  };

  CM.rgba = function (hex, a) {
    const c = hex2rgb(hex);
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  };

  CM.mix = function (h1, h2, t) {
    const a = hex2rgb(h1), b = hex2rgb(h2);
    return rgb2hex(CM.lerp(a[0], b[0], t), CM.lerp(a[1], b[1], t), CM.lerp(a[2], b[2], t));
  };

  /* ---------- 数字格式 ---------- */
  CM.num = function (n) {
    n = Math.round(n || 0);
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  /* 金额始终显示完整数字（千分位），不做 万/亿 缩写 */
  CM.money = function (n) {
    n = Math.round(n || 0);
    return (n < 0 ? '-' : '') + '¥' + CM.num(Math.abs(n));
  };

  CM.rate = function (v) { return (v * 100).toFixed(0) + '%'; };

  /* ---------- DOM ---------- */
  CM.$ = function (sel, root) { return (root || document).querySelector(sel); };
  CM.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  CM.el = function (tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  };
  CM.esc = function (s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
    });
  };

  CM.now = function () { return (window.performance && performance.now) ? performance.now() : Date.now(); };

})(window.CM);
