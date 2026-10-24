/* telson.dev — tiny progressive-enhancement script (no dependencies) */
(function () {
  'use strict';

  /* ---------- sticky nav ---------- */
  var nav = document.querySelector('.nav');
  if (nav) {
    var onScroll = function () {
      nav.classList.toggle('is-stuck', window.scrollY > 12);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---------- mobile menu ---------- */
  var toggle = document.querySelector('.nav__toggle');
  var links = document.querySelector('.nav__links');
  if (toggle && links) {
    toggle.addEventListener('click', function () {
      var open = links.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    links.addEventListener('click', function (e) {
      if (e.target.closest('a')) {
        links.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ---------- scroll reveal ---------- */
  var revealables = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && revealables.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    revealables.forEach(function (el) { io.observe(el); });
  } else {
    revealables.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ---------- toast (single instance) ---------- */
  var toastEl = null;
  var toastTimer = null;

  function showToast(text, isError) {
    if (toastEl && toastEl.parentNode) {
      clearTimeout(toastTimer);
      toastEl.parentNode.removeChild(toastEl);
    }
    var el = document.createElement('div');
    el.className = 'toast' + (isError ? ' toast--err' : '');
    el.setAttribute('role', 'status');
    el.textContent = text;
    document.body.appendChild(el);
    toastEl = el;
    toastTimer = setTimeout(function () {
      el.classList.add('is-out');
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
        if (toastEl === el) toastEl = null;
      }, 220);
    }, 1800);
  }

  /* ---------- clipboard ---------- */
  function copyText(text, onOk, onFail) {
    function legacy() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, ta.value.length);
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      if (ok) { onOk(); } else { onFail(); }
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(onOk, legacy);
    } else {
      legacy();
    }
  }

  /* ---------- copy buttons ---------- */
  document.querySelectorAll('[data-copy]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var text = btn.getAttribute('data-copy');
      var doneLabel = btn.getAttribute('data-copy-done') || '已复制';
      var isSmall = btn.classList.contains('copy');
      var oldLabel = isSmall ? btn.textContent : null;

      copyText(text, function () {
        showToast(text.length <= 46 ? doneLabel + '：' + text : doneLabel);
        if (isSmall) {
          btn.textContent = doneLabel;
          btn.classList.add('is-done');
          setTimeout(function () {
            btn.textContent = oldLabel;
            btn.classList.remove('is-done');
          }, 1600);
        }
      }, function () {
        showToast('复制失败，请手动选中：' + text, true);
      });
    });
  });

  /* ---------- bilingual toggle (only pages that opt in) ---------- */
  var langRoot = document.querySelector('[data-i18n-root]');
  if (langRoot) {
    var buttons = document.querySelectorAll('.lang-toggle [data-lang]');
    var STORAGE_KEY = 'telson.lang';

    var apply = function (lang) {
      var isEn = lang === 'en';
      document.documentElement.lang = isEn ? 'en' : 'zh-CN';
      document.querySelectorAll('[data-zh][data-en]').forEach(function (el) {
        var value = el.getAttribute(isEn ? 'data-en' : 'data-zh');
        if (value !== null) el.innerHTML = value;
      });
      buttons.forEach(function (b) {
        b.setAttribute('aria-pressed', b.getAttribute('data-lang') === lang ? 'true' : 'false');
      });
      try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) {}
    };

    buttons.forEach(function (b) {
      b.addEventListener('click', function () { apply(b.getAttribute('data-lang')); });
    });

    var saved = null;
    try { saved = localStorage.getItem(STORAGE_KEY); } catch (e) {}
    if (saved === 'en') apply('en');
  }

  /* ---------- pointer-reactive grid (top of page only) ---------- */
  (function gridField() {
    var canvas = document.querySelector('.grid-canvas');
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    document.body.classList.add('has-canvas');

    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0;
    var H = 0;
    var step = 64;
    var radius = 240;
    var BASE = 0.048;
    var HOT = 0.5;
    var pointer = { x: 0, y: 0, on: false };
    var last = { x: 0, y: 0, has: false };

    var mask = document.createElement('canvas');
    var mctx = mask.getContext('2d');
    var shade = document.createElement('canvas');
    var sctx = shade.getContext('2d');

    /* 不透明网格：交叉处不会二次叠加，再用渐变遮罩出亮度 */
    function buildMask(hot) {
      mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      mctx.clearRect(0, 0, W, H);
      mctx.strokeStyle = '#8ea2d0';
      mctx.lineCap = 'butt';

      for (var x = 0.5; x <= W; x += step) {
        var w = 1;
        if (hot) {
          var dx = Math.abs(x - pointer.x);
          if (dx < radius) {
            var tx = 1 - dx / radius;
            w = 1 + tx * tx * 1.1;
          }
        }
        mctx.lineWidth = w;
        mctx.beginPath();
        mctx.moveTo(x, 0);
        mctx.lineTo(x, H);
        mctx.stroke();
      }

      for (var y = 0.5; y <= H; y += step) {
        var w2 = 1;
        if (hot) {
          var dy = Math.abs(y - pointer.y);
          if (dy < radius) {
            var ty = 1 - dy / radius;
            w2 = 1 + ty * ty;
          }
        }
        mctx.lineWidth = w2;
        mctx.beginPath();
        mctx.moveTo(0, y);
        mctx.lineTo(W, y);
        mctx.stroke();
      }
    }

    function paint() {
      ctx.clearRect(0, 0, W, H);

      if (!pointer.on) {
        buildMask(false);
        ctx.globalAlpha = BASE;
        ctx.drawImage(mask, 0, 0, W, H);
        ctx.globalAlpha = 1;
        return;
      }

      buildMask(true);

      /* 基础网格 */
      ctx.globalAlpha = BASE;
      ctx.drawImage(mask, 0, 0, W, H);
      ctx.globalAlpha = 1;

      /* 指针附近亮度：遮罩叠加，避免交叉点额外变亮 */
      sctx.setTransform(1, 0, 0, 1, 0, 0);
      sctx.clearRect(0, 0, shade.width, shade.height);
      sctx.drawImage(mask, 0, 0);
      sctx.globalCompositeOperation = 'destination-in';
      var g = sctx.createRadialGradient(
        pointer.x * dpr, pointer.y * dpr, 0,
        pointer.x * dpr, pointer.y * dpr, radius * 1.7 * dpr
      );
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.4, 'rgba(255,255,255,0.62)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      sctx.fillStyle = g;
      sctx.fillRect(0, 0, shade.width, shade.height);
      sctx.globalCompositeOperation = 'source-over';

      ctx.globalAlpha = HOT;
      ctx.drawImage(shade, 0, 0, W, H);
      ctx.globalAlpha = 1;

      /* 柔光 */
      var glow = ctx.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, radius * 1.5);
      glow.addColorStop(0, 'rgba(47,217,255,0.065)');
      glow.addColorStop(1, 'rgba(47,217,255,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);
    }

    function resize() {
      var rect = canvas.getBoundingClientRect();
      W = Math.max(1, Math.round(rect.width));
      H = Math.max(1, Math.round(rect.height));
      var pw = Math.round(W * dpr);
      var ph = Math.round(H * dpr);
      canvas.width = pw;
      canvas.height = ph;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      mask.width = pw;
      mask.height = ph;
      shade.width = pw;
      shade.height = ph;
      paint();
    }

    window.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch' || reduce) return;
      last.x = e.clientX;
      last.y = e.clientY;
      last.has = true;
      var docY = e.clientY + window.scrollY;
      pointer.x = e.clientX;
      pointer.y = docY;
      pointer.on = docY >= 0 && docY <= H;
      paint();
    }, { passive: true });

    window.addEventListener('pointerleave', function () {
      if (reduce) return;
      pointer.on = false;
      paint();
    });

    window.addEventListener('scroll', function () {
      if (reduce || !last.has) return;
      var docY = last.y + window.scrollY;
      pointer.x = last.x;
      pointer.y = docY;
      pointer.on = docY >= 0 && docY <= H;
      paint();
    }, { passive: true });

    window.addEventListener('resize', resize);
    resize();
    window.setTimeout(resize, 80);
  })();
  /* ---------- card spotlight follows the pointer ---------- */
  document.querySelectorAll('.card, .feature').forEach(function (el) {
    el.addEventListener('pointermove', function (e) {
      var r = el.getBoundingClientRect();
      el.style.setProperty('--mx', Math.round(e.clientX - r.left) + 'px');
      el.style.setProperty('--my', Math.round(e.clientY - r.top) + 'px');
    }, { passive: true });
  });

  /* ---------- scroll progress bar ---------- */
  var progressBar = document.querySelector('.scroll-progress i');
  if (progressBar) {
    var progressTicking = false;
    var updateProgress = function () {
      progressTicking = false;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var pct = max > 0 ? (window.scrollY / max) * 100 : 0;
      progressBar.style.width = Math.max(0, Math.min(100, pct)).toFixed(2) + '%';
    };
    window.addEventListener('scroll', function () {
      if (progressTicking) return;
      progressTicking = true;
      requestAnimationFrame(updateProgress);
    }, { passive: true });
    window.addEventListener('resize', updateProgress);
    updateProgress();
  }

  /* ---------- terminal typing in the hero card ---------- */
  var typeTarget = document.querySelector('[data-type]');
  if (typeTarget) {
    var fullText = typeTarget.getAttribute('data-type') || '';
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion || !fullText) {
      typeTarget.textContent = fullText;
    } else {
      var caret = document.createElement('span');
      caret.className = 'caret';
      typeTarget.textContent = '';
      typeTarget.appendChild(caret);
      var charIndex = 0;
      var typeStep = function () {
        if (charIndex >= fullText.length) {
          if (caret.parentNode) caret.parentNode.removeChild(caret);
          return;
        }
        caret.insertAdjacentText('beforebegin', fullText.charAt(charIndex));
        charIndex += 1;
        setTimeout(typeStep, 46 + Math.random() * 70);
      };
      setTimeout(typeStep, 300);
    }
  }

  /* ---------- footer year ---------- */
  var yearEl = document.querySelector('[data-year]');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
})();
