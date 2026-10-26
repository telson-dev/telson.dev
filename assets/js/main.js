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

  /* ---------- global language toggle (zh / en) ---------- */
  (function i18n() {
    var toggles = document.querySelectorAll('.lang-toggle [data-lang]');
    if (!toggles.length) return;

    var STORAGE_KEY = 'telson.lang';

    /* 词表：键为页面上出现的原始中文文本（去首尾空白后精确匹配） */
    var DICT = {
      '首页': 'Home',
      '作品': 'Work',
      '接单': 'Services',
      '接单 · 找我干活': 'Hire me',
      '复制': 'Copy',
      '邮箱': 'Email',
      '。': '.',
      '独立开发者 · Independent Developer': 'Independent developer',
      '把想法做成': 'Turning ideas into ',
      '能用的软件': 'software that works',
      '我写 AI 工具、自动化脚本和小而美的网页。代表作': 'I build AI tools, automation scripts and small, fast websites. Featured project:',
      '——': '—',
      '一个开源的 MCP 服务器，让 Claude、Cursor 用一句中文就能管理': 'an open-source MCP server that lets Claude and Cursor manage',
      'Pterodactyl / Pelican 游戏服务器面板。': 'Pterodactyl / Pelican game server panels in plain language.',
      '接单 · 说说你的需求': 'Hire me · tell me what you need',
      '看看我做过什么': "See what I've built",
      '自动化': 'Automation',
      '静态站': 'Static sites',
      '精选作品': 'Featured work',
      '开源的 MCP 服务器。不用交出 SSH，也不用登录面板——在对话里说一句话，服务器就动起来了。': 'Open-source MCP server. No SSH, no panel logins — one sentence in chat and your server moves.',
      'v0.2.2 · MIT · 已发布': 'v0.2.2 · MIT · released',
      '用自然语言，管好你的游戏服务器': 'Manage your game servers in plain language',
      '支持 Pterodactyl v1 与 Pelican。服务器列表、电源控制、控制台指令、文件管理、一键备份，全部走面板 API，权限最小化：只读模式和危险操作二次确认默认开启，API Key 永远留在你本机。': 'Works with Pterodactyl v1 and Pelican. Server list, power control, console, file management, one-click backups — all through the panel API with least privilege: read-only mode and confirmation for risky actions on by default, and the API key never leaves your machine.',
      '项目详情 →': 'Project details →',
      '需要人帮你把东西做出来？': 'Need someone to build it?',
      '代码交付、异步沟通、说清楚就干活。小单当天开工，大单先出方案再报价。': 'Code delivered, async communication, clear scope then work. Small jobs start the same day; larger ones get a plan and a quote first.',
      '自动化脚本与爬虫': 'Automation and scraping',
      '把重复劳动交给代码：数据采集、批量处理、定时任务、报表生成、Excel 自动化。': 'Hand repetitive work to code: scraping, batch processing, scheduled tasks, reports, Excel automation.',
      '¥199 起': 'from ¥199',
      '网页与工具站': 'Websites and tools',
      '产品官网、落地页、内部工具。响应式、加载快、直接能上线，源码完整交付。': 'Product sites, landing pages, internal tools. Responsive, fast, ready to ship — full source included.',
      '¥499 起': 'from ¥499',
      'AI / MCP 工具定制': 'AI / MCP tooling',
      '把你的业务接进 Claude、Cursor：MCP Server、Agent 工具链、模型调用与自动化流程。': 'Plug your business into Claude and Cursor: MCP servers, agent toolchains, model calls, automation.',
      '查看完整服务与报价 →': 'See full services and pricing →',
      '关于': 'About',
      '写代码，也写文档。': 'I write code — and docs.',
      '我是 telson，独立开发者。喜欢把 AI 和代码拼在一起，做出真正能用的东西： 有能跑起来的开源项目，有能上线的网站，也有把想法变成 30 秒画面的渲染管线。': "I'm telson, an independent developer. I like putting AI and code together to ship things that work: open-source projects that run, websites that go live, and a render pipeline that turns an idea into a 30-second film.",
      '我更在意「交付出来能不能用」，而不是「代码写了多少行」。 这台网站也是手写的静态站——零框架、零外部依赖、单文件 CSS。': 'I care whether the handover actually works, not how many lines it took. This site is hand-written and static — no framework, no external dependencies, one CSS file.',
      '快速了解': 'Quick facts',
      '开源项目': 'Open source',
      '：Pteropilot（GitHub + PyPI，MIT）': ': Pteropilot (GitHub + PyPI, MIT)',
      '擅长': 'Focus',
      '：Python 自动化、TypeScript 前端、MCP / Agent 工具': ': Python automation, TypeScript front-end, MCP / agent tooling',
      '工作方式': 'How I work',
      '：文字沟通、异步交付、源码全给': ': text only, async delivery, full source',
      '联系': 'Contact',
      '：QQ 邮箱，24 小时内回复': ': QQ email, reply within 24h',
      '看接单说明 →': 'See how hiring works →',
      '有需求？复制邮箱，写封邮件给我。': 'Got something in mind? Copy my email and write to me.',
      '把「要做什么、给谁用、什么时候要」写清楚发过来，我会先回一个方案和报价。 学生项目和开源项目可以聊价格。': "Send what you want built, who it's for and when you need it. I'll reply with a plan and a quote. Student and open-source projects can be negotiated.",
      '手写静态站，无框架无依赖': 'Hand-written static site, no framework, no dependencies',

      '接单 · Services': 'Services',
      '把你的需求，': 'Turn your requirements into ',
      '变成能用的代码': 'working code',
      '小工具、脚本、网站、AI 定制——我负责写代码和交付，你负责说清楚要什么。 全程文字沟通、异步交付，源码全部给你，不留后手。': 'Small tools, scripts, websites and AI work — I write and deliver the code, you just say clearly what you need. Text-only, async delivery, full source included, no lock-in.',
      '复制邮箱地址': 'Copy email address',
      '先看报价': 'See pricing',
      '24 小时内回复': 'Reply within 24h',
      '含 2 次修改': '2 revisions included',
      '源码交付': 'Full source',
      '7 天 bug 修复': '7-day bug fixes',
      '服务与报价': 'Services and pricing',
      '做什么，多少钱': 'What I build and what it costs',
      '下面是起步价。实际价格看需求复杂度，先报方案再动手，不会做到一半加价。': 'These are starting prices. Final price depends on complexity; you get a plan and quote first, and no mid-job price hikes.',
      '自动化脚本 / 爬虫 / 数据处理': 'Automation, scraping, data processing',
      '数据采集、批量改名、定时任务、Excel / CSV 自动化、接口对接、报表生成。交付可运行的 Python 脚本与使用说明。': 'Scraping, batch renaming, scheduled jobs, Excel / CSV automation, API integration, reports. You get runnable Python scripts plus docs.',
      '¥199 起 · 通常 1-3 天': 'from ¥199 · usually 1-3 days',
      '网页 / 落地页 / 工具站': 'Websites, landing pages, tools',
      '产品官网、活动落地页、内部工具、文档站。响应式、加载快、无多余依赖，源码与部署说明一起交付。': 'Product sites, campaign pages, internal tools, docs sites. Responsive, fast, no bloat; source and deploy notes included.',
      '¥499 起 · 通常 3-7 天': 'from ¥499 · usually 3-7 days',
      '把业务接进 Claude、Cursor：MCP Server、Agent 工具链、模型调用、自动化工作流。可参考我的开源项目 Pteropilot。': 'Plug your business into Claude and Cursor: MCP servers, agent toolchains, model calls, automation. See my open-source Pteropilot for an example.',
      '¥499 起 · 通常 3-10 天': 'from ¥499 · usually 3-10 days',
      '视频剪辑 / 产品宣传片': 'Video editing, product films',
      '30-60 秒产品短片、动效字幕、配乐。程序化渲染管线保证品牌色、字体、节奏一致（见作品页）。': '30-60s product films, animated captions, original music. A programmatic render pipeline keeps brand colours, type and pacing consistent (see Work).',
      '¥299 起 · 通常 2-5 天': 'from ¥299 · usually 2-5 days',
      '报价说明：': 'Pricing notes: ',
      '小单按件报价；需求不明确时先付定金做原型再定总价； 开源项目、学生项目、非商用项目可以谈价格； 加急按 1.5-2 倍计价。': 'Small jobs are quoted per piece; if scope is unclear, pay a deposit for a prototype before the final price; open-source, student and non-commercial projects are negotiable; rush jobs are charged at 1.5-2x.',
      '流程': 'Process',
      '从发消息到交付': 'From message to delivery',
      '发需求': 'Send the brief',
      '邮件写清：要做什么、给谁用、什么时候要、预算范围。有参考图或现有代码更好。': 'Email what to build, who it is for, when you need it, and your budget. Reference images or existing code help.',
      '报价与确认': 'Quote and confirm',
      '24 小时内回复方案、工期和价格。你确认后开始，需求有疑问会先问清楚。': 'You get a plan, timeline and price within 24h. Work starts after you confirm; anything unclear gets clarified first.',
      '付 50% 定金': 'Pay 50% deposit',
      '支持支付宝 / 微信。定金到账即排期开工，尾款验收后付。': 'Alipay or WeChat. Work is scheduled once the deposit arrives; the rest is paid after acceptance.',
      '开发与交付': 'Build and deliver',
      '阶段性给你看进度；交付可运行源码、仓库或压缩包，附使用与部署说明，含 2 次修改。': 'Progress updates along the way; delivery includes runnable source (repo or archive), usage and deploy notes, and 2 revisions.',
      '验收与售后': 'Acceptance and support',
      '你验收合格后付尾款。交付后 7 天内免费修 bug；新增需求另算。': 'Pay the rest after acceptance. Free bug fixes for 7 days after delivery; new features are quoted separately.',
      '标准': 'Standards',
      '交付清单与边界': 'What you get, what I will not do',
      '你会拿到': 'What you get',
      '可运行的完整源码（不是截图、不是 exe）': 'Complete runnable source (not a screenshot, not an .exe)',
      'README / 使用说明，别人也能看懂': 'README / usage notes anyone can follow',
      '部署或运行指导（需要的话远程协助）': 'Deploy or run guidance (remote help if needed)',
      '7 天内免费修 bug': 'Free bug fixes for 7 days',
      '不接的需求': 'What I will not take',
      '游戏外挂、私服、破解、绕过付费': 'Game cheats, private servers, cracking, paywall bypass',
      '刷量、刷单、代充、养号': 'Fake traffic, fake orders, top-ups, account farming',
      '爬取隐私数据、付费内容、绕过登录': 'Scraping private data or paywalled content, bypassing logins',
      '任何违法违规内容': 'Anything illegal',
      '这几类不接，也不用问价格。': 'I do not take these, so no need to ask for a price.',
      '下单前常问的': 'Common questions',
      '怎么付款？': 'How do I pay?',
      '先付 50% 定金开工，验收后付尾款。支持支付宝、微信、银行转账。小额单（¥100 以下）可以一次付清。': '50% deposit to start, the rest after acceptance. Alipay, WeChat, bank transfer. Jobs under ¥100 can be paid in full up front.',
      '多久能交付？': 'How long does it take?',
      '小脚本 1-3 天，网页 3-7 天，AI 定制 3-10 天。具体以报价时约定的工期为准；加急可谈。': 'Small scripts 1-3 days, websites 3-7 days, AI work 3-10 days. The quoted timeline applies; rush jobs are negotiable.',
      '可以开发票吗？': 'Can you issue an invoice?',
      '目前是个人开发者，暂不提供发票。需要合同可以出简单的书面约定。': 'I am an individual developer, so no formal invoices for now. For contracts I can write a simple agreement.',
      '需求做到一半要改怎么办？': 'What if requirements change halfway?',
      '报价里含 2 次修改。开发中新增的需求按工作量重新报价，不会擅自加钱，也不会白干。': 'The quote includes 2 revisions. New requests during the build are re-quoted by effort — no surprise charges, no free work either.',
      '能帮我上线吗？': 'Can you deploy it?',
      '可以给部署说明；需要远程协助或代部署，按 ¥99 一次性收取（含备案之外的服务器配置，不含域名备案）。': 'Deploy notes are included; remote help or done-for-you deployment is a one-off ¥99 (server setup only, domain registration not included).',
      '怎么沟通？': 'How do we communicate?',
      '以邮件和 QQ 为主，文字沟通、异步回复。复杂需求我会整理成需求清单，避免来回确认。': 'Email and QQ, text only, async replies. For complex work I turn the brief into a checklist to avoid back-and-forth.',
      '把需求发过来': 'Send me the brief',
      '邮件标题写「需求 + 一句话描述」，正文写清做什么、给谁用、什么时候要。 我 24 小时内回复；不合适也会直说。': 'Subject "project + one-line summary", body with what, for whom and when. I reply within 24h — and I will say so plainly if it is not a fit.',
      '先看看作品': 'See the work first',

      '—— 一个开源的 MCP 服务器，让 Claude、Cursor 用一句中文就能管理 Pterodactyl / Pelican 游戏服务器面板。': '— an open-source MCP server that lets Claude and Cursor manage Pterodactyl / Pelican game server panels in plain language.',
      'telson.dev · 手写静态站，无框架无依赖': 'telson.dev · Hand-written static site, no framework, no dependencies',
      '/ 紫': '/ purple',
      '# 需要 Python 3.12+ 与 uv': '# requires Python 3.12+ and uv',
      '# 需要 git、uv 与 Python 3.12+': '# requires git, uv and Python 3.12+',
      '作品 · Work': 'Work',
      '做过的东西': "Things I've built",
      '三个项目，三种活法：一个能装进 AI 对话的开源工具，一条代码渲染出来的宣传片，一台不靠框架的网站。': 'Three projects, three modes: an open-source tool that plugs into AI chat, a promo film rendered by code, a site with no framework.',
      '01 · 开源项目': '01 · Open source',
      '开源的 MCP server：让 Claude、Cursor 用自然语言管理 Pterodactyl / Pelican 游戏服务器。 面板 API 全功能覆盖（电源、控制台、文件、备份），权限最小化设计，API Key 不出本机。': 'Open-source MCP server: Claude and Cursor manage Pterodactyl / Pelican game servers in plain language. Full panel API coverage (power, console, files, backups) with least privilege; the API key never leaves your machine.',
      '02 · 视频管线': '02 · Video pipeline',
      '30 秒产品宣传片': '30-second product film',
      '整支片子由代码生成：1080P60、1800 帧、分镜与动效全部写成确定性函数， 配乐用纯代码合成（126 BPM，drop 精确落在第 10 秒），全程没有剪辑软件、没有素材库、没有版权风险。': 'The whole film is generated by code: 1080P60, 1800 frames, every shot and animation a deterministic function; music synthesised in pure code (126 BPM, drop exactly at 0:10). No editing suite, no stock library, no licensing risk.',
      '00:01 · 冷开场': '00:01 · Cold open',
      '00:13 · 工具链': '00:13 · Toolchain',
      '00:26 · 收尾': '00:26 · Outro',
      '技术做法': 'How it works',
      '确定性动画': 'Deterministic animation',
      '：单个 HTML 画布，': ': one HTML canvas, ',
      ' 由秒数推导全部画面': ' derives every frame from the time value',
      '帧级渲染': 'Frame-level rendering',
      '：无头 Chrome 逐帧截图 → ffmpeg 编码，可重跑、可复现': ': headless Chrome captures every frame, ffmpeg encodes it — re-runnable and reproducible',
      '代码合成配乐': 'Music from code',
      '：纯 Python 标准库生成，节拍与画面共用同一组常量': ': generated with the Python standard library; beats and visuals share the same constants',
      '程序化质检': 'Programmatic QA',
      '：像素探针检查品牌色、文本边界 lint、60 点亮度扫描': ': pixel probes for brand colours, text-bounds lint, a 60-point luminance sweep',
      '参数': 'Specs',
      '时长 30.000 秒，126 BPM，drop @10s': '30.000 s, 126 BPM, drop @10s',
      '品牌色：青': 'Brand: cyan',
      '纯音乐 + 屏幕字幕，无配音': 'Original music + on-screen captions, no voice-over',
      'B 站观看 ↗': 'Watch on Bilibili ↗',
      '站内播放 →': 'Play here →',
      '03 · 本站': '03 · This site',
      '你正在看的这台网站。手写 HTML / CSS / JS，没有框架、没有构建步骤、没有外部字体和依赖， 一个': 'The site you are on. Hand-written HTML / CSS / JS — no framework, no build step, no external fonts or dependencies; one ',
      '就能部署。': ' deploys it.',
      '四个页面、一个 CSS 文件、一个 30 行的 JS': 'Four pages, one CSS file, about 30 lines of JS',
      '响应式布局，移动端可读': 'Responsive, readable on mobile',
      '支持中英双语切换（Pteropilot 页）': 'Chinese / English toggle on every page',
      '首屏无外部请求，加载快': 'No external requests on first load',
      '技术栈': 'Stack',
      '零依赖': 'Zero deps',
      '自己写站点的好处：想改哪儿改哪儿，不用跟框架斗智斗勇。': 'Hand-written means you change whatever you want, without fighting a framework.',
      '下一步': 'Next',
      '你也可以有一个这样的东西': 'You could have something like this too',
      '工具、网站、脚本、短片——说清楚你要什么，我来拆成能交付的活。': 'Tools, sites, scripts, films — say what you need and I will break it into deliverable work.',
      '看接单服务 →': 'See services →',
      '复制邮箱': 'Copy email',

      '这个页面': 'This page ',
      '好像被删掉了': 'seems to be gone',
      '地址可能写错了，或者它本来就不存在。回首页或者看看作品吧。': 'The address may be wrong, or it never existed. Head back home or take a look at the work.',
      '回首页': 'Back home',
      '看作品': 'See work'
    };

    var COPY_DONE = { '已复制': 'Copied', '邮箱已复制': 'Email copied' };
    var originals = new WeakMap();

    function walkTextNodes(root, fn) {
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: function (node) {
          var parent = node.parentNode;
          if (!parent) return NodeFilter.FILTER_REJECT;
          var tag = parent.nodeName;
          if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'CODE' || tag === 'PRE' || tag === 'TEXTAREA') {
            return NodeFilter.FILTER_REJECT;
          }
          if (parent.closest && parent.closest('[data-zh][data-en]')) return NodeFilter.FILTER_REJECT;
          if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      var node;
      while ((node = walker.nextNode())) fn(node);
    }

    /* 键匹配忽略全部空白，规避 HTML 里的换行与缩进 */
    var norm = function (s) { return s.replace(/\s+/g, ''); };
    var INDEX = {};
    Object.keys(DICT).forEach(function (k) { INDEX[norm(k)] = DICT[k]; });

    function translateTextNodes(lang) {
      var isEn = lang === 'en';
      walkTextNodes(document.body, function (node) {
        if (!originals.has(node)) originals.set(node, node.nodeValue);
        var zh = originals.get(node);
        if (!isEn) { node.nodeValue = zh; return; }
        var lead = (zh.match(/^\s*/) || [''])[0];
        var trail = (zh.match(/\s*$/) || [''])[0];
        var hit = INDEX[norm(zh)];
        node.nodeValue = hit === undefined ? zh : lead + hit + trail;
      });
    }

    function syncCopyButtons(lang) {
      document.querySelectorAll('[data-copy]').forEach(function (btn) {
        var zhLabel = btn.getAttribute('data-copy-done-zh');
        if (zhLabel === null) {
          zhLabel = btn.getAttribute('data-copy-done') || '已复制';
          btn.setAttribute('data-copy-done-zh', zhLabel);
        }
        btn.setAttribute('data-copy-done', lang === 'en' ? (COPY_DONE[zhLabel] || 'Copied') : zhLabel);
      });
    }

    function apply(lang) {
      var isEn = lang === 'en';
      activeLang = lang;
      document.documentElement.lang = isEn ? 'en' : 'zh-CN';

      document.querySelectorAll('[data-zh][data-en]').forEach(function (el) {
        var value = el.getAttribute(isEn ? 'data-en' : 'data-zh');
        if (value !== null) el.innerHTML = value;
      });

      translateTextNodes(lang);
      syncCopyButtons(lang);

      var titleZh = document.body.getAttribute('data-title-zh');
      var titleEn = document.body.getAttribute('data-title-en');
      if (isEn && titleEn) document.title = titleEn;
      if (!isEn && titleZh) document.title = titleZh;

      toggles.forEach(function (b) {
        b.setAttribute('aria-pressed', b.getAttribute('data-lang') === lang ? 'true' : 'false');
      });

      try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) {}
    }

    toggles.forEach(function (b) {
      b.addEventListener('click', function () { apply(b.getAttribute('data-lang')); });
    });

    var saved = null;
    try { saved = localStorage.getItem(STORAGE_KEY); } catch (e) {}
    var activeLang = saved === 'en' ? 'en' : 'zh';
    if (saved === 'en') apply('en');

    /* ---------- 版本号：从 GitHub 拉取 pyproject.toml 解析，失败回退本地默认 ---------- */
    var VERSION_TOKEN_RE = /v\d+\.\d+\.\d+/g;
    function applyVersion(ver) {
      var zh = 'v' + ver + ' · MIT · 已发布';
      var en = 'v' + ver + ' · MIT · released';
      Object.keys(DICT).forEach(function (k) {
        if (/^v\d+\.\d+\.\d+ · MIT · /.test(k)) delete DICT[k];
      });
      DICT[zh] = en;
      document.querySelectorAll('[data-version]').forEach(function (el) {
        if (el.hasAttribute('data-zh') && el.hasAttribute('data-en')) {
          el.setAttribute('data-zh', zh);
          el.setAttribute('data-en', en);
          el.innerHTML = activeLang === 'en' ? en : zh;
        } else {
          el.textContent = el.textContent.replace(VERSION_TOKEN_RE, 'v' + ver);
        }
      });
    }
    function loadVersionFromGithub() {
      fetch('https://raw.githubusercontent.com/telson-dev/pteropilot/main/pyproject.toml', { cache: 'no-store' })
        .then(function (r) {
          if (!r.ok) throw new Error('http ' + r.status);
          return r.text();
        })
        .then(function (txt) {
          var m = txt.match(/version\s*=\s*["']([^"']+)["']/);
          if (m && m[1]) applyVersion(m[1]);
        })
        .catch(function () { /* 拉取失败：保持本地默认版本号 */ });
    }
    loadVersionFromGithub();
  })();

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
