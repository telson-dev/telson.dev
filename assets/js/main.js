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
      'v0.2.3 · MIT · 已发布': 'v0.2.3 · MIT · released',
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

    /* 繁体文本映射：与 DICT 的键一一对应（运行时按需替换） */
    var TW_DICT = {
      '首页': '首頁',
      '接单': '接單',
      '接单 · 找我干活': '接單 · 找我幹活',
      '复制': '複製',
      '邮箱': '郵箱',
      '独立开发者 · Independent Developer': '獨立開發者 · Independent Developer',
      '能用的软件': '能用的軟體',
      '我写 AI 工具、自动化脚本和小而美的网页。代表作': '我寫 AI 工具、自動化指令碼和小而美的網頁。代表作',
      '一个开源的 MCP 服务器，让 Claude、Cursor 用一句中文就能管理': '一個開源的 MCP 伺服器，讓 Claude、Cursor 用一句中文就能管理',
      'Pterodactyl / Pelican 游戏服务器面板。': 'Pterodactyl / Pelican 遊戲伺服器面板。',
      '接单 · 说说你的需求': '接單 · 說說你的需求',
      '看看我做过什么': '看看我做過什麼',
      '自动化': '自動化',
      '静态站': '靜態站',
      '精选作品': '精選作品',
      '开源的 MCP 服务器。不用交出 SSH，也不用登录面板——在对话里说一句话，服务器就动起来了。': '開源的 MCP 伺服器。不用交出 SSH，也不用登入面板——在對話裡說一句話，伺服器就動起來了。',
      'v0.2.3 · MIT · 已发布': 'v0.2.3 · MIT · 已釋出',
      '用自然语言，管好你的游戏服务器': '用自然語言，管好你的遊戲伺服器',
      '支持 Pterodactyl v1 与 Pelican。服务器列表、电源控制、控制台指令、文件管理、一键备份，全部走面板 API，权限最小化：只读模式和危险操作二次确认默认开启，API Key 永远留在你本机。': '支援 Pterodactyl v1 與 Pelican。伺服器列表、電源控制、控制檯指令、檔案管理、一鍵備份，全部走面板 API，許可權最小化：只讀模式和危險操作二次確認預設開啟，API Key 永遠留在你本機。',
      '项目详情 →': '專案詳情 →',
      '需要人帮你把东西做出来？': '需要人幫你把東西做出來？',
      '代码交付、异步沟通、说清楚就干活。小单当天开工，大单先出方案再报价。': '程式碼交付、非同步溝通、說清楚就幹活。小單當天開工，大單先出方案再報價。',
      '自动化脚本与爬虫': '自動化指令碼與爬蟲',
      '把重复劳动交给代码：数据采集、批量处理、定时任务、报表生成、Excel 自动化。': '把重複勞動交給程式碼：資料採集、批次處理、定時任務、報表生成、Excel 自動化。',
      '网页与工具站': '網頁與工具站',
      '产品官网、落地页、内部工具。响应式、加载快、直接能上线，源码完整交付。': '產品官網、落地頁、內部工具。響應式、載入快、直接能上線，原始碼完整交付。',
      'AI / MCP 工具定制': 'AI / MCP 工具定製',
      '把你的业务接进 Claude、Cursor：MCP Server、Agent 工具链、模型调用与自动化流程。': '把你的業務接進 Claude、Cursor：MCP Server、Agent 工具鏈、模型呼叫與自動化流程。',
      '查看完整服务与报价 →': '檢視完整服務與報價 →',
      '关于': '關於',
      '写代码，也写文档。': '寫程式碼，也寫文件。',
      '我是 telson，独立开发者。喜欢把 AI 和代码拼在一起，做出真正能用的东西： 有能跑起来的开源项目，有能上线的网站，也有把想法变成 30 秒画面的渲染管线。': '我是 telson，獨立開發者。喜歡把 AI 和程式碼拼在一起，做出真正能用的東西： 有能跑起來的開源專案，有能上線的網站，也有把想法變成 30 秒畫面的渲染管線。',
      '我更在意「交付出来能不能用」，而不是「代码写了多少行」。 这台网站也是手写的静态站——零框架、零外部依赖、单文件 CSS。': '我更在意「交付出來能不能用」，而不是「程式碼寫了多少行」。 這臺網站也是手寫的靜態站——零框架、零外部依賴、單檔案 CSS。',
      '快速了解': '快速瞭解',
      '开源项目': '開源專案',
      '擅长': '擅長',
      '：Python 自动化、TypeScript 前端、MCP / Agent 工具': '：Python 自動化、TypeScript 前端、MCP / Agent 工具',
      '：文字沟通、异步交付、源码全给': '：文字溝通、非同步交付、原始碼全給',
      '联系': '聯絡',
      '：QQ 邮箱，24 小时内回复': '：QQ 郵箱，24 小時內回覆',
      '看接单说明 →': '看接單說明 →',
      '有需求？复制邮箱，写封邮件给我。': '有需求？複製郵箱，寫封郵件給我。',
      '把「要做什么、给谁用、什么时候要」写清楚发过来，我会先回一个方案和报价。 学生项目和开源项目可以聊价格。': '把「要做什麼、給誰用、什麼時候要」寫清楚發過來，我會先回一個方案和報價。 學生專案和開源專案可以聊價格。',
      '手写静态站，无框架无依赖': '手寫靜態站，無框架無依賴',
      '接单 · Services': '接單 · Services',
      '变成能用的代码': '變成能用的程式碼',
      '小工具、脚本、网站、AI 定制——我负责写代码和交付，你负责说清楚要什么。 全程文字沟通、异步交付，源码全部给你，不留后手。': '小工具、指令碼、網站、AI 定製——我負責寫程式碼和交付，你負責說清楚要什麼。 全程文字溝通、非同步交付，原始碼全部給你，不留後手。',
      '复制邮箱地址': '複製郵箱地址',
      '先看报价': '先看報價',
      '24 小时内回复': '24 小時內回覆',
      '源码交付': '原始碼交付',
      '7 天 bug 修复': '7 天 bug 修復',
      '服务与报价': '服務與報價',
      '做什么，多少钱': '做什麼，多少錢',
      '下面是起步价。实际价格看需求复杂度，先报方案再动手，不会做到一半加价。': '下面是起步價。實際價格看需求複雜度，先報方案再動手，不會做到一半加價。',
      '自动化脚本 / 爬虫 / 数据处理': '自動化指令碼 / 爬蟲 / 資料處理',
      '数据采集、批量改名、定时任务、Excel / CSV 自动化、接口对接、报表生成。交付可运行的 Python 脚本与使用说明。': '資料採集、批次改名、定時任務、Excel / CSV 自動化、介面對接、報表生成。交付可執行的 Python 指令碼與使用說明。',
      '网页 / 落地页 / 工具站': '網頁 / 落地頁 / 工具站',
      '产品官网、活动落地页、内部工具、文档站。响应式、加载快、无多余依赖，源码与部署说明一起交付。': '產品官網、活動落地頁、內部工具、文件站。響應式、載入快、無多餘依賴，原始碼與部署說明一起交付。',
      '把业务接进 Claude、Cursor：MCP Server、Agent 工具链、模型调用、自动化工作流。可参考我的开源项目 Pteropilot。': '把業務接進 Claude、Cursor：MCP Server、Agent 工具鏈、模型呼叫、自動化工作流。可參考我的開源專案 Pteropilot。',
      '视频剪辑 / 产品宣传片': '影片剪輯 / 產品宣傳片',
      '30-60 秒产品短片、动效字幕、配乐。程序化渲染管线保证品牌色、字体、节奏一致（见作品页）。': '30-60 秒產品短片、動效字幕、配樂。程式化渲染管線保證品牌色、字型、節奏一致（見作品頁）。',
      '报价说明：': '報價說明：',
      '小单按件报价；需求不明确时先付定金做原型再定总价； 开源项目、学生项目、非商用项目可以谈价格； 加急按 1.5-2 倍计价。': '小單按件報價；需求不明確時先付定金做原型再定總價； 開源專案、學生專案、非商用專案可以談價格； 加急按 1.5-2 倍計價。',
      '从发消息到交付': '從發訊息到交付',
      '发需求': '發需求',
      '邮件写清：要做什么、给谁用、什么时候要、预算范围。有参考图或现有代码更好。': '郵件寫清：要做什麼、給誰用、什麼時候要、預算範圍。有參考圖或現有程式碼更好。',
      '报价与确认': '報價與確認',
      '24 小时内回复方案、工期和价格。你确认后开始，需求有疑问会先问清楚。': '24 小時內回覆方案、工期和價格。你確認後開始，需求有疑問會先問清楚。',
      '支持支付宝 / 微信。定金到账即排期开工，尾款验收后付。': '支援支付寶 / 微信。定金到賬即排期開工，尾款驗收後付。',
      '开发与交付': '開發與交付',
      '阶段性给你看进度；交付可运行源码、仓库或压缩包，附使用与部署说明，含 2 次修改。': '階段性給你看進度；交付可執行原始碼、倉庫或壓縮包，附使用與部署說明，含 2 次修改。',
      '验收与售后': '驗收與售後',
      '你验收合格后付尾款。交付后 7 天内免费修 bug；新增需求另算。': '你驗收合格後付尾款。交付後 7 天內免費修 bug；新增需求另算。',
      '标准': '標準',
      '交付清单与边界': '交付清單與邊界',
      '你会拿到': '你會拿到',
      '可运行的完整源码（不是截图、不是 exe）': '可執行的完整原始碼（不是截圖、不是 exe）',
      'README / 使用说明，别人也能看懂': 'README / 使用說明，別人也能看懂',
      '部署或运行指导（需要的话远程协助）': '部署或執行指導（需要的話遠端協助）',
      '7 天内免费修 bug': '7 天內免費修 bug',
      '游戏外挂、私服、破解、绕过付费': '遊戲外掛、私服、破解、繞過付費',
      '刷量、刷单、代充、养号': '刷量、刷單、代充、養號',
      '爬取隐私数据、付费内容、绕过登录': '爬取隱私資料、付費內容、繞過登入',
      '任何违法违规内容': '任何違法違規內容',
      '这几类不接，也不用问价格。': '這幾類不接，也不用問價格。',
      '下单前常问的': '下單前常問的',
      '怎么付款？': '怎麼付款？',
      '先付 50% 定金开工，验收后付尾款。支持支付宝、微信、银行转账。小额单（¥100 以下）可以一次付清。': '先付 50% 定金開工，驗收後付尾款。支援支付寶、微信、銀行轉賬。小額單（¥100 以下）可以一次付清。',
      '小脚本 1-3 天，网页 3-7 天，AI 定制 3-10 天。具体以报价时约定的工期为准；加急可谈。': '小指令碼 1-3 天，網頁 3-7 天，AI 定製 3-10 天。具體以報價時約定的工期為準；加急可談。',
      '可以开发票吗？': '可以開發票嗎？',
      '目前是个人开发者，暂不提供发票。需要合同可以出简单的书面约定。': '目前是個人開發者，暫不提供發票。需要合同可以出簡單的書面約定。',
      '需求做到一半要改怎么办？': '需求做到一半要改怎麼辦？',
      '报价里含 2 次修改。开发中新增的需求按工作量重新报价，不会擅自加钱，也不会白干。': '報價裡含 2 次修改。開發中新增的需求按工作量重新報價，不會擅自加錢，也不會白乾。',
      '能帮我上线吗？': '能幫我上線嗎？',
      '可以给部署说明；需要远程协助或代部署，按 ¥99 一次性收取（含备案之外的服务器配置，不含域名备案）。': '可以給部署說明；需要遠端協助或代部署，按 ¥99 一次性收取（含備案之外的伺服器配置，不含域名備案）。',
      '怎么沟通？': '怎麼溝通？',
      '以邮件和 QQ 为主，文字沟通、异步回复。复杂需求我会整理成需求清单，避免来回确认。': '以郵件和 QQ 為主，文字溝通、非同步回覆。複雜需求我會整理成需求清單，避免來回確認。',
      '把需求发过来': '把需求發過來',
      '邮件标题写「需求 + 一句话描述」，正文写清做什么、给谁用、什么时候要。 我 24 小时内回复；不合适也会直说。': '郵件標題寫「需求 + 一句話描述」，正文寫清做什麼、給誰用、什麼時候要。 我 24 小時內回覆；不合適也會直說。',
      '—— 一个开源的 MCP 服务器，让 Claude、Cursor 用一句中文就能管理 Pterodactyl / Pelican 游戏服务器面板。': '—— 一個開源的 MCP 伺服器，讓 Claude、Cursor 用一句中文就能管理 Pterodactyl / Pelican 遊戲伺服器面板。',
      'telson.dev · 手写静态站，无框架无依赖': 'telson.dev · 手寫靜態站，無框架無依賴',
      '# 需要 Python 3.12+ 与 uv': '# 需要 Python 3.12+ 與 uv',
      '# 需要 git、uv 与 Python 3.12+': '# 需要 git、uv 與 Python 3.12+',
      '做过的东西': '做過的東西',
      '三个项目，三种活法：一个能装进 AI 对话的开源工具，一条代码渲染出来的宣传片，一台不靠框架的网站。': '三個專案，三種活法：一個能裝進 AI 對話的開源工具，一條程式碼渲染出來的宣傳片，一臺不靠框架的網站。',
      '01 · 开源项目': '01 · 開源專案',
      '开源的 MCP server：让 Claude、Cursor 用自然语言管理 Pterodactyl / Pelican 游戏服务器。 面板 API 全功能覆盖（电源、控制台、文件、备份），权限最小化设计，API Key 不出本机。': '開源的 MCP server：讓 Claude、Cursor 用自然語言管理 Pterodactyl / Pelican 遊戲伺服器。 面板 API 全功能覆蓋（電源、控制檯、檔案、備份），許可權最小化設計，API Key 不出本機。',
      '02 · 视频管线': '02 · 影片管線',
      '30 秒产品宣传片': '30 秒產品宣傳片',
      '整支片子由代码生成：1080P60、1800 帧、分镜与动效全部写成确定性函数， 配乐用纯代码合成（126 BPM，drop 精确落在第 10 秒），全程没有剪辑软件、没有素材库、没有版权风险。': '整支片子由程式碼生成：1080P60、1800 幀、分鏡與動效全部寫成確定性函式， 配樂用純程式碼合成（126 BPM，drop 精確落在第 10 秒），全程沒有剪輯軟體、沒有素材庫、沒有版權風險。',
      '00:01 · 冷开场': '00:01 · 冷開場',
      '00:13 · 工具链': '00:13 · 工具鏈',
      '技术做法': '技術做法',
      '确定性动画': '確定性動畫',
      '：单个 HTML 画布，': '：單個 HTML 畫布，',
      ' 由秒数推导全部画面': ' 由秒數推導全部畫面',
      '帧级渲染': '幀級渲染',
      '：无头 Chrome 逐帧截图 → ffmpeg 编码，可重跑、可复现': '：無頭 Chrome 逐幀截圖 → ffmpeg 編碼，可重跑、可復現',
      '代码合成配乐': '程式碼合成配樂',
      '：纯 Python 标准库生成，节拍与画面共用同一组常量': '：純 Python 標準庫生成，節拍與畫面共用同一組常量',
      '程序化质检': '程式化質檢',
      '：像素探针检查品牌色、文本边界 lint、60 点亮度扫描': '：畫素探針檢查品牌色、文字邊界 lint、60 點亮度掃描',
      '参数': '引數',
      '时长 30.000 秒，126 BPM，drop @10s': '時長 30.000 秒，126 BPM，drop @10s',
      '纯音乐 + 屏幕字幕，无配音': '純音樂 + 螢幕字幕，無配音',
      'B 站观看 ↗': 'B 站觀看 ↗',
      '站内播放 →': '站內播放 →',
      '你正在看的这台网站。手写 HTML / CSS / JS，没有框架、没有构建步骤、没有外部字体和依赖， 一个': '你正在看的這臺網站。手寫 HTML / CSS / JS，沒有框架、沒有構建步驟、沒有外部字型和依賴， 一個',
      '四个页面、一个 CSS 文件、一个 30 行的 JS': '四個頁面、一個 CSS 檔案、一個 30 行的 JS',
      '响应式布局，移动端可读': '響應式佈局，移動端可讀',
      '支持中英双语切换（Pteropilot 页）': '支援中英雙語切換（Pteropilot 頁）',
      '首屏无外部请求，加载快': '首屏無外部請求，載入快',
      '技术栈': '技術棧',
      '零依赖': '零依賴',
      '自己写站点的好处：想改哪儿改哪儿，不用跟框架斗智斗勇。': '自己寫站點的好處：想改哪兒改哪兒，不用跟框架鬥智鬥勇。',
      '你也可以有一个这样的东西': '你也可以有一個這樣的東西',
      '工具、网站、脚本、短片——说清楚你要什么，我来拆成能交付的活。': '工具、網站、指令碼、短片——說清楚你要什麼，我來拆成能交付的活。',
      '看接单服务 →': '看接單服務 →',
      '复制邮箱': '複製郵箱',
      '这个页面': '這個頁面',
      '好像被删掉了': '好像被刪掉了',
      '地址可能写错了，或者它本来就不存在。回首页或者看看作品吧。': '地址可能寫錯了，或者它本來就不存在。回首頁或者看看作品吧。',
      '回首页': '回首頁',
      '); PyPI can lag, install from GitHub for the freshest build.">装过旧版？升级：': '); PyPI can lag, install from GitHub for the freshest build.">裝過舊版？升級：',
      '**告警推送失败不再伪装成「查询失败」**：webhook/邮件发送失败时单独归入 `send_failed` / `send_errors`，输出醒目警告并让进程**退出码 3**（此前混在查询错误里、退出码仍 0——服务器真挂了、告警又没发出去时，用户会以为有监控实际没人收到，属最危险的静默失败）；一条都没发出时也不推进冷却状态，下次扫描会重试（Fixed）': '**告警推送失敗不再偽裝成「查詢失敗」**：webhook/郵件傳送失敗時單獨歸入 `send_failed` / `send_errors`，輸出醒目警告並讓程序**退出碼 3**（此前混在查詢錯誤裡、退出碼仍 0——伺服器真掛了、告警又沒發出去時，使用者會以為有監控實際沒人收到，屬最危險的靜默失敗）；一條都沒發出時也不推進冷卻狀態，下次掃描會重試（Fixed）',
      '**面板地址自动规范化**：`PANEL_URL` 填成 `https://panel.example.com/api`（面板文档常见写法）时，原来会拼出 `/api/api/client` → 404，看着像密钥错；现在自动剥掉 `/api`、`/api/client`、`/api/application` 后缀与尾斜杠，真实子路径（如 `/pterodactyl`）保持不变。（Fixed）': '**面板地址自動規範化**：`PANEL_URL` 填成 `https://panel.example.com/api`（面板文件常見寫法）時，原來會拼出 `/api/api/client` → 404，看著像金鑰錯；現在自動剝掉 `/api`、`/api/client`、`/api/application` 字尾與尾斜槓，真實子路徑（如 `/pterodactyl`）保持不變。（Fixed）',
      '403 / 角色不对': '403 / 角色不對',
      '404 / 地址错误': '404 / 地址錯誤',
      '404 — 页面不存在 | telson.dev': '404 — 頁面不存在 | telson.dev',
      '43 个 MCP 工具（状态/电源/文件/备份/玩家/数据库/审计/定时任务…）': '43 個 MCP 工具（狀態/電源/檔案/備份/玩家/資料庫/審計/定時任務…）',
      '7 天全功能试用': '7 天全功能試用',
      'AI 接管面板，只要一句话': 'AI 接管面板，只要一句話',
      'API Key 只保存在你本机的客户端配置里，仅用于直接请求你的面板，不经过任何第三方服务器。': 'API Key 只儲存在你本機的客戶端配置裡，僅用於直接請求你的面板，不經過任何第三方伺服器。',
      'Claude Desktop：编辑 claude_desktop_config.json；Cursor：MCP 面板里添加。': 'Claude Desktop：編輯 claude_desktop_config.json；Cursor：MCP 面板裡新增。',
      'GitHub 完整记录 ↗': 'GitHub 完整記錄 ↗',
      'Key 不出本机': 'Key 不出本機',
      'Lite 为便携版（约 32MB），免安装；国内可直接下载。': 'Lite 為便攜版（約 32MB），免安裝；國內可直接下載。',
      'Lite（便携版）': 'Lite（便攜版）',
      'MCP server（在 Claude / Cursor 里用）': 'MCP server（在 Claude / Cursor 裡用）',
      'PANEL_URL 要带协议（https://）；API Key 用权限最小化的那个（见第 4 步）。': 'PANEL_URL 要帶協議（https://）；API Key 用許可權最小化的那個（見第 4 步）。',
      'Pelican 兼容性验证；新增 upload_file / download_file / create_folder / rename_file 四个文件工具；修复状态与分页问题': 'Pelican 相容性驗證；新增 upload_file / download_file / create_folder / rename_file 四個檔案工具；修復狀態與分頁問題',
      'Pro 和开源版有什么区别？': 'Pro 和開源版有什麼區別？',
      'Pro（¥59.99 终身）': 'Pro（¥59.99 終身）',
      'Pterodactyl / Pelican 的典型用户拿到的是面板账号和受限 API Key，而不是节点上的 root。面板存在的意义就是把操作系统隔离掉。': 'Pterodactyl / Pelican 的典型使用者拿到的是面板賬號和受限 API Key，而不是節點上的 root。面板存在的意義就是把作業系統隔離掉。',
      'Pteropilot Pro — 终身买断 · 标准版 + Lite | telson.dev': 'Pteropilot Pro — 終身買斷 · 標準版 + Lite | telson.dev',
      'Pteropilot Pro 使用指南 — 安装 / 激活 / 连接面板 | telson.dev': 'Pteropilot Pro 使用指南 — 安裝 / 啟用 / 連線面板 | telson.dev',
      'Pteropilot Pro 已发布': 'Pteropilot Pro 已釋出',
      'Pteropilot · 开源免费 · MIT': 'Pteropilot · 開源免費 · MIT',
      'Pteropilot · 更新日志 · MIT': 'Pteropilot · 更新日誌 · MIT',
      'Pteropilot — 用自然语言管理 Pterodactyl / Pelican 游戏服务器 | telson.dev': 'Pteropilot — 用自然語言管理 Pterodactyl / Pelican 遊戲伺服器 | telson.dev',
      'Pteropilot 使用教程 — 安装 / 配置 / 示例 | telson.dev': 'Pteropilot 使用教程 — 安裝 / 配置 / 示例 | telson.dev',
      'Pteropilot 是 MCP server，让 Claude、Cursor 等 AI 助手用自然语言管理 Pterodactyl / Pelican 面板上的游戏服务器。全程不需要写代码。': 'Pteropilot 是 MCP server，讓 Claude、Cursor 等 AI 助手用自然語言管理 Pterodactyl / Pelican 面板上的遊戲伺服器。全程不需要寫程式碼。',
      'Pteropilot 更新日志 — 版本历史 | telson.dev': 'Pteropilot 更新日誌 — 版本歷史 | telson.dev',
      'Python 环境 + 改配置': 'Python 環境 + 改配置',
      'README 安装章节：补国内 PyPI 镜像（清华源）命令与 `--version` 自检方法；把国内常不可用的 git+GitHub 安装方式换成 GitHub Release 下载 `.whl`，并明确说明本项目不提供代理方案（Changed）': 'README 安裝章節：補國內 PyPI 映象（清華源）命令與 `--version` 自檢方法；把國內常不可用的 git+GitHub 安裝方式換成 GitHub Release 下載 `.whl`，並明確說明本專案不提供代理方案（Changed）',
      'SmartScreen 提示「未知发布者」属正常，点「更多信息 → 仍要运行」即可；下载后双击即用，无需安装。': 'SmartScreen 提示「未知釋出者」屬正常，點「更多資訊 → 仍要執行」即可；下載後雙擊即用，無需安裝。',
      'Windows 一键装告警计划任务：`scripts/install_alerts_task.ps1`——一条命令建计划任务（默认每 5 分钟），自动生成包装脚本（面板凭据写进去，后台运行不依赖环境变量；中文日志 UTF-8 正常）、日志落 `~/.pteropilot/alerts.log`，支持 `-Status` / `-Remove` / `-DryRun` / `-Exe` 与邮件通道。解决 README 只有 cron 示例、Windows 服主不会配的问题。': 'Windows 一鍵裝告警計劃任務：`scripts/install_alerts_task.ps1`——一條命令建計劃任務（預設每 5 分鐘），自動生成包裝指令碼（面板憑據寫進去，後臺執行不依賴環境變數；中文日誌 UTF-8 正常）、日誌落 `~/.pteropilot/alerts.log`，支援 `-Status` / `-Remove` / `-DryRun` / `-Exe` 與郵件通道。解決 README 只有 cron 示例、Windows 服主不會配的問題。',
      'Windows 图形客户端（标准版 + Lite）：面板管理界面、内置 AI 助手、自动备份、云同步与自动更新。7 天全功能试用，上线优惠价 ¥59.99。': 'Windows 圖形客戶端（標準版 + Lite）：面板管理介面、內建 AI 助手、自動備份、雲同步與自動更新。7 天全功能試用，上線優惠價 ¥59.99。',
      'Windows 图形客户端：标准版（桌面安装）+ Lite（便携版）一套授权，终身使用。': 'Windows 圖形客戶端：標準版（桌面安裝）+ Lite（便攜版）一套授權，終身使用。',
      'Windows 桌面客户端（图形界面）': 'Windows 桌面客戶端（圖形介面）',
      '`PANEL_READONLY` 容错增强：`1/true/yes/on`（大小写、空格不敏感）均能开启只读模式。（Changed）': '`PANEL_READONLY` 容錯增強：`1/true/yes/on`（大小寫、空格不敏感）均能開啟只讀模式。（Changed）',
      '`analyze_player_activity` 玩家活跃分析工具（第 41 个）：分析最近控制台日志里的加入/退出事件——活跃玩家排行（进/退次数）、高峰时段、日志末尾仍在线的人。只读，回答「谁最常来」「什么时候人多」；`top` 1-20 默认 10，并明确标注统计窗口受日志长度限制。': '`analyze_player_activity` 玩家活躍分析工具（第 41 個）：分析最近控制檯日誌裡的加入/退出事件——活躍玩家排行（進/退次數）、高峰時段、日誌末尾仍線上的人。只讀，回答「誰最常來」「什麼時候人多」；`top` 1-20 預設 10，並明確標註統計視窗受日誌長度限制。',
      '`list_mounts` 挂载点查看工具（第 43 个）：列出服务器的额外存储挂载——名称、`source → target` 路径、只读/可写、是否用户可自行挂载。排查「我上传的文件怎么看不到」（挂载没配或只读）。只读。': '`list_mounts` 掛載點檢視工具（第 43 個）：列出伺服器的額外儲存掛載——名稱、`source → target` 路徑、只讀/可寫、是否使用者可自行掛載。排查「我上傳的檔案怎麼看不到」（掛載沒配或只讀）。只讀。',
      '`list_schedules` 定时任务查看工具（第 40 个）：列出服务器在面板里配置的计划任务——cron 表达式、是否启用、仅在线时执行、上次/下次运行时间、每任务步骤数。只读，回答「自动重启配好了吗」「这个服有哪些定时任务」。': '`list_schedules` 定時任務檢視工具（第 40 個）：列出伺服器在面板裡配置的計劃任務——cron 表示式、是否啟用、僅線上時執行、上次/下次執行時間、每任務步驟數。只讀，回答「自動重啟配好了嗎」「這個服有哪些定時任務」。',
      '`list_server_users` 子用户权限查看工具（第 42 个）：列出能管理该服务器的子用户——邮箱/用户名 + 被授予的权限项数与权限大类，回答「谁能动我的服」。只读。': '`list_server_users` 子使用者許可權檢視工具（第 42 個）：列出能管理該伺服器的子使用者——郵箱/使用者名稱 + 被授予的許可權項數與許可權大類，回答「誰能動我的服」。只讀。',
      '`pteropilot --doctor` 环境自检：检查 Python 版本、面板配置、地址规范化（带 `/api` 会提示已剥掉）、密钥前缀角色（`ptla_` 用错会指出）、面板连通（401/403/404 分别给出含义与修法）、告警渠道；输出**不含密钥**，可整段贴给他人排查。配套 `--no-network` 只查配置不联网': '`pteropilot --doctor` 環境自檢：檢查 Python 版本、面板配置、地址規範化（帶 `/api` 會提示已剝掉）、金鑰字首角色（`ptla_` 用錯會指出）、面板連通（401/403/404 分別給出含義與修法）、告警渠道；輸出**不含金鑰**，可整段貼給他人排查。配套 `--no-network` 只查配置不聯網',
      '`pteropilot --version` 在工具数明显偏少（&lt;30）时额外提示「可能装到了旧版本（PyPI 发布可能滞后）」，避免用户以为功能缺失（Changed）': '`pteropilot --version` 在工具數明顯偏少（&lt;30）時額外提示「可能裝到了舊版本（PyPI 釋出可能滯後）」，避免使用者以為功能缺失（Changed）',
      '`pteropilot --version`（也支持 `-V`/`-v`）：打印版本与**当前工具数**，不校验面板配置、不启动 server。用于确认装的是不是最新版（PyPI 可能滞后于 GitHub Release）。': '`pteropilot --version`（也支援 `-V`/`-v`）：列印版本與**當前工具數**，不校驗面板配置、不啟動 server。用於確認裝的是不是最新版（PyPI 可能滯後於 GitHub Release）。',
      '`pteropilot-alerts --reset`：清空冷却/连续确认状态（调完灵敏度想立刻验证、或服务器已修好但还卡在冷却期时用）；只动状态文件、不碰按服务器配置，支持 `--dry-run` 与 `--json`': '`pteropilot-alerts --reset`：清空冷卻/連續確認狀態（調完靈敏度想立刻驗證、或伺服器已修好但還卡在冷卻期時用）；只動狀態檔案、不碰按伺服器配置，支援 `--dry-run` 與 `--json`',
      '`pteropilot-alerts --test` 通道自检：发一条测试消息验证 webhook/邮件配置是否正确（不读服务器、不写状态），失败时列出常见原因并以退出码 1 返回（便于脚本判断）。配置告警时先跑它，别等真崩服才发现没收到。': '`pteropilot-alerts --test` 通道自檢：發一條測試訊息驗證 webhook/郵件配置是否正確（不讀伺服器、不寫狀態），失敗時列出常見原因並以退出碼 1 返回（便於指令碼判斷）。配置告警時先跑它，別等真崩服才發現沒收到。',
      '`release.yml` 只上传 wheel 与 sdist：原来用 `dist/*` 会把 `uv build` 生成的 `.gitignore` 当成附件传到 Release。（Fixed）': '`release.yml` 只上傳 wheel 與 sdist：原來用 `dist/*` 會把 `uv build` 生成的 `.gitignore` 當成附件傳到 Release。（Fixed）',
      '`scripts/release.py` 整棵树一致性检查：本地 HEAD tree 必须等于远端 main tree，任何漏推文件都会在打 tag 前被拦下。': '`scripts/release.py` 整棵樹一致性檢查：本地 HEAD tree 必須等於遠端 main tree，任何漏推檔案都會在打 tag 前被攔下。',
      '`scripts/sync_release_notes.py`：把 CHANGELOG 对应版本章节搬进 GitHub Release 描述（含安装指引与变更历史链接）——自动生成的 release notes 只有一行链接，用户看不出改了什么。': '`scripts/sync_release_notes.py`：把 CHANGELOG 對應版本章節搬進 GitHub Release 描述（含安裝指引與變更歷史連結）——自動生成的 release notes 只有一行連結，使用者看不出改了什麼。',
      '`stop` 电源操作纳入二次确认（与 restart/kill 一致；start 免确认）。（Changed）': '`stop` 電源操作納入二次確認（與 restart/kill 一致；start 免確認）。（Changed）',
      'batch_backup_status 显示备份总大小 + 多台并发；get_server_status 网络流量人类可读': 'batch_backup_status 顯示備份總大小 + 多臺併發；get_server_status 網路流量人類可讀',
      'batch_get_status 并发化：多台服务器状态并发拉取（保序、单台失败不阻断）': 'batch_get_status 併發化：多臺伺服器狀態併發拉取（保序、單臺失敗不阻斷）',
      'diagnose_crash 扩充：看门狗超时、原生崩溃信号；密钥脱敏加固': 'diagnose_crash 擴充：看門狗超時、原生崩潰訊號；金鑰脫敏加固',
      'get_server_status 显示内存/磁盘上限；在线时长格式化为人类可读（1 天 1 小时 1 分 1 秒）': 'get_server_status 顯示記憶體/磁碟上限；線上時長格式化為人類可讀（1 天 1 小時 1 分 1 秒）',
      'list_backups / list_files 大小人类可读（1048576 → 1.0 MB），备份显示创建日期': 'list_backups / list_files 大小人類可讀（1048576 → 1.0 MB），備份顯示建立日期',
      'list_my_servers 支持 with_status 状态列与 status 过滤（如只看 running）': 'list_my_servers 支援 with_status 狀態列與 status 過濾（如只看 running）',
      'pteropilot Pro 标准版': 'pteropilot Pro 標準版',
      'telson.dev — 独立开发者 · AI 工具 / 自动化 / 网页': 'telson.dev — 獨立開發者 · AI 工具 / 自動化 / 網頁',
      'v0.1.0 · 商业版 · 已发布': 'v0.1.0 · 商業版 · 已釋出',
      'webhook / 邮件，需自己配 cron 或计划任务': 'webhook / 郵件，需自己配 cron 或計劃任務',
      '① 安装': '① 安裝',
      '① 浏览器先试试能不能打开面板；② 面板若挂了 CDN/防护（Cloudflare 等），可能拦程序请求；③ 公司/学校网络可能封非 443 端口或异常 UA，换网络试试。': '① 瀏覽器先試試能不能開啟面板；② 面板若掛了 CDN/防護（Cloudflare 等），可能攔程式請求；③ 公司/學校網路可能封非 443 埠或異常 UA，換網路試試。',
      '① 确认整串码完整粘贴（PTPRO1- 开头很长，别断行、别漏字符）；② 确认复制时没带多余空格；③ 若提示「已被使用/设备数已满」，先在旧设备解绑；④ 仍不行把「复制诊断信息」结果发我。': '① 確認整串碼完整貼上（PTPRO1- 開頭很長，別斷行、別漏字元）；② 確認複製時沒帶多餘空格；③ 若提示「已被使用/裝置數已滿」，先在舊裝置解綁；④ 仍不行把「複製診斷資訊」結果發我。',
      '① 面板地址：带 https:// 的完整域名（如 https://panel.example.com），末尾不加斜杠和路径。② API 密钥：在面板「账户 → API 凭据」新建一枚 Client 类型的密钥，复制整串 ptlc_ 开头的值。': '① 面板地址：帶 https:// 的完整域名（如 https://panel.example.com），末尾不加斜槓和路徑。② API 金鑰：在面板「賬戶 → API 憑據」新建一枚 Client 型別的金鑰，複製整串 ptlc_ 開頭的值。',
      '② 激活': '② 啟用',
      '③ 连接面板': '③ 連線面板',
      '「smp 服最近一次备份是什么时候？没有就现在建一个」': '「smp 服最近一次備份是什麼時候？沒有就現在建一個」',
      '「smp 服的 IP 和端口是多少？」': '「smp 服的 IP 和埠是多少？」',
      '「列出我所有服务器和状态」': '「列出我所有伺服器和狀態」',
      '「往 creative 服上传这个插件并重启」': '「往 creative 服上傳這個外掛並重啟」',
      '「看看最近日志有没有崩溃信号」': '「看看最近日誌有沒有崩潰訊號」',
      '「这个服分配的数据库地址和账号是什么？」': '「這個服分配的資料庫地址和賬號是什麼？」',
      '一个激活码能用几台电脑？': '一個啟用碼能用幾臺電腦？',
      '一套授权，两个版本': '一套授權，兩個版本',
      '一次买断，无订阅续费；两个版本同时获得。': '一次買斷，無訂閱續費；兩個版本同時獲得。',
      '一次列出全部服务器状态摘要，批量开机 / 关机 / 重启，单台失败不阻断整体。': '一次列出全部伺服器狀態摘要，批次開機 / 關機 / 重啟，單臺失敗不阻斷整體。',
      '一次购买，终身使用——标准版 + Lite，管好你的游戏服务器。': '一次購買，終身使用——標準版 + Lite，管好你的遊戲伺服器。',
      '三分钟接入': '三分鐘接入',
      '三步接上你的面板：安装、配置、提问。': '三步接上你的面板：安裝、配置、提問。',
      '上线优惠价 ¥59.99（原价 ¥99.99）。终身授权 · 含标准版与 Lite · 最多 2 台设备 · 7 天退款。': '上線優惠價 ¥59.99（原價 ¥99.99）。終身授權 · 含標準版與 Lite · 最多 2 臺裝置 · 7 天退款。',
      '下载 Lite ↗': '下載 Lite ↗',
      '下载与安装': '下載與安裝',
      '下载即用（标准版 / Lite 便携版）': '下載即用（標準版 / Lite 便攜版）',
      '下载后直接双击运行。U 盘、临时机器、不想改系统都适合。': '下載後直接雙擊執行。U 盤、臨時機器、不想改系統都適合。',
      '下载地址：爱发电订单「已购内容」；标准版也可在产品页下载。首次打开若提示「未知发布者」（SmartScreen），点「更多信息 → 仍要运行」——这是未买代码签名证书的常规提示，不是病毒。': '下載地址：愛發電訂單「已購內容」；標準版也可在產品頁下載。首次開啟若提示「未知釋出者」（SmartScreen），點「更多資訊 → 仍要執行」——這是未買程式碼簽名證書的常規提示，不是病毒。',
      '下载标准版 / Lite': '下載標準版 / Lite',
      '下载标准版 ↗': '下載標準版 ↗',
      '下载试用': '下載試用',
      '下载试用 ↗': '下載試用 ↗',
      '不放心就开 PANEL_READONLY=1，AI 只能看不能动。': '不放心就開 PANEL_READONLY=1，AI 只能看不能動。',
      '不需要。Pro 连接你已经运行中的 Pterodactyl / Pelican 面板，只需要面板地址和 API Key。': '不需要。Pro 連線你已經執行中的 Pterodactyl / Pelican 面板，只需要面板地址和 API Key。',
      '不需要。Pteropilot 连接你已经运行中的 Pterodactyl / Pelican 面板，只需要面板地址和 API Key。': '不需要。Pteropilot 連線你已經執行中的 Pterodactyl / Pelican 面板，只需要面板地址和 API Key。',
      '不需要，内置 AI 助手（自己填 API key）': '不需要，內建 AI 助手（自己填 API key）',
      '为什么不用「直接 SSH 执行命令」？': '為什麼不用「直接 SSH 執行命令」？',
      '了解 Pro →': '瞭解 Pro →',
      '云同步 · 自动更新': '雲同步 · 自動更新',
      '云同步与更新': '雲同步與更新',
      '从 v0.1.0 到 v0.2.27：43 个工具、300+ 项测试，持续迭代。': '從 v0.1.0 到 v0.2.27：43 個工具、300+ 項測試，持續迭代。',
      '从下载到用起来': '從下載到用起來',
      '从控制台日志解析玩家进出，直接回答「现在谁在线」，兼容主流服务端日志格式。': '從控制檯日誌解析玩家進出，直接回答「現在誰線上」，相容主流服務端日誌格式。',
      '从源码运行（开发者）': '從原始碼執行（開發者）',
      '任何支持 MCP 的客户端，例如 Claude Desktop、Cursor 等。': '任何支援 MCP 的客戶端，例如 Claude Desktop、Cursor 等。',
      '你正在看的这台网站。手写 HTML / CSS / JS，没有框架、没有构建步骤、没有外部字体和依赖，': '你正在看的這臺網站。手寫 HTML / CSS / JS，沒有框架、沒有構建步驟、沒有外部字型和依賴，',
      '使用指南 · 约 5 分钟上手': '使用指南 · 約 5 分鐘上手',
      '便携版（约 32MB）· 免安装 · Windows 10/11': '便攜版（約 32MB）· 免安裝 · Windows 10/11',
      '修复 SECURITY.md 漏洞报告链接的相对路径 404。（Fixed）': '修復 SECURITY.md 漏洞報告連結的相對路徑 404。（Fixed）',
      '修复 v0.2.22 Release 错版：远端 pyproject 版本曾停留在 0.2.7，导致 tag 指向的代码构建出旧版本包。（Fixed）': '修復 v0.2.22 Release 錯版：遠端 pyproject 版本曾停留在 0.2.7，導致 tag 指向的程式碼構建出舊版本包。（Fixed）',
      '先下载试用': '先下載試用',
      '先下载试试，或直接联系我': '先下載試試，或直接聯絡我',
      '先体验再买；试用到期自动降级为只读。': '先體驗再買；試用到期自動降級為只讀。',
      '先只看，再动手': '先只看，再動手',
      '先用只读模式跑一遍，确认行为符合预期再放开': '先用只讀模式跑一遍，確認行為符合預期再放開',
      '先设 PANEL_READONLY=1 试用：AI 只能看不能动，确认行为后再开写权限。': '先設 PANEL_READONLY=1 試用：AI 只能看不能動，確認行為後再開寫許可權。',
      '先试用也行': '先試用也行',
      '免安装，单文件直接运行，U 盘可用。': '免安裝，單檔案直接執行，U 盤可用。',
      '全程文字沟通、异步交付，源码全部给你，不留后手。': '全程文字溝通、非同步交付，原始碼全部給你，不留後手。',
      '全部走面板 API，权限最小化：只读模式和危险操作二次确认默认开启，API Key 永远留在你本机。': '全部走面板 API，許可權最小化：只讀模式和危險操作二次確認預設開啟，API Key 永遠留在你本機。',
      '关于卡片里填 AI API key（默认 DeepSeek，也可换其它 OpenAI 兼容端点）→ 打开「AI 助手」面板直接对话：『哪个服内存快满了』『帮我重启 smp 服』，它会自己调面板接口。': '關於卡片裡填 AI API key（預設 DeepSeek，也可換其它 OpenAI 相容端點）→ 開啟「AI 助手」面板直接對話：『哪個服記憶體快滿了』『幫我重啟 smp 服』，它會自己調面板介面。',
      '其他问题': '其他問題',
      '兼容面板': '相容面板',
      '内置 AI 助手、自动备份、云同步与自动更新；7 天全功能试用，上线优惠价 ¥59.99（原价 ¥99.99）。': '內建 AI 助手、自動備份、雲同步與自動更新；7 天全功能試用，上線優惠價 ¥59.99（原價 ¥99.99）。',
      '内置更新检查；配置可选云同步备份（可选）。': '內建更新檢查；配置可選雲同步備份（可選）。',
      '内置轮询：界面提示 + 可选 webhook 推送，一键测试': '內建輪詢：介面提示 + 可選 webhook 推送，一鍵測試',
      '写操作批量工具 batch_power / batch_backup 支持「全部服务器」通配：作用于全部服务器时任何电源信号都强制二次确认（防误操作）': '寫操作批次工具 batch_power / batch_backup 支援「全部伺服器」通配：作用於全部伺服器時任何電源訊號都強制二次確認（防誤操作）',
      '列出全部服务器，读取在线状态与资源占用。': '列出全部伺服器，讀取線上狀態與資源佔用。',
      '加 QQ 2361034217，把「复制诊断信息」的内容一起发来（不含密钥，可放心发），定位会快很多。': '加 QQ 2361034217，把「複製診斷資訊」的內容一起發來（不含金鑰，可放心發），定位會快很多。',
      '加急按 1.5-2 倍计价。': '加急按 1.5-2 倍計價。',
      '卡住了看这里': '卡住了看這裡',
      '危险操作（重启、删文件、覆盖备份）会要求二次确认；写操作走面板 API，Key 不出本机。': '危險操作（重啟、刪檔案、覆蓋備份）會要求二次確認；寫操作走面板 API，Key 不出本機。',
      '参数 limit 1-100（默认 20 条），只读不改任何设置': '引數 limit 1-100（預設 20 條），只讀不改任何設定',
      '双击安装 → 桌面出现快捷方式 → 打开即可。想要托盘常驻、开机自启选这个。': '雙擊安裝 → 桌面出現快捷方式 → 開啟即可。想要托盤常駐、開機自啟選這個。',
      '发布脚本（`scripts/release.py`、`scripts/sync_release_notes.py`）的 GitHub API 调用加入**指数退避重试**：网络抖动（RemoteDisconnected / 超时 / 连接错误）自动重试 3 次，HTTP 4xx/5xx 仍立即失败——曾因一次连接中断导致打 tag 半途失败（Changed）': '釋出指令碼（`scripts/release.py`、`scripts/sync_release_notes.py`）的 GitHub API 呼叫加入**指數退避重試**：網路抖動（RemoteDisconnected / 超時 / 連線錯誤）自動重試 3 次，HTTP 4xx/5xx 仍立即失敗——曾因一次連線中斷導致打 tag 半途失敗（Changed）',
      '发布自动化 `scripts/release.py`：用 GitHub API 打 tag 触发 `release.yml` 自动构建并发布 Release（绕开被墙的 `git push --tags`）；内置三道检查——远端 pyproject 版本必须与本地一致（防止 tag 打出旧版包）、工作区必须干净、tag 不可重复。': '釋出自動化 `scripts/release.py`：用 GitHub API 打 tag 觸發 `release.yml` 自動構建併發布 Release（繞開被牆的 `git push --tags`）；內建三道檢查——遠端 pyproject 版本必須與本地一致（防止 tag 打出舊版包）、工作區必須乾淨、tag 不可重複。',
      '只读模式、危险操作二次确认、权限边界由 API Key 决定。AI 只能做你允许它做的事，而不是拥有一台机器的全部能力。': '只讀模式、危險操作二次確認、許可權邊界由 API Key 決定。AI 只能做你允許它做的事，而不是擁有一臺機器的全部能力。',
      '只读模式一键开启，高危操作需要二次确认，API Key 永不离开本机。': '只讀模式一鍵開啟，高危操作需要二次確認，API Key 永不離開本機。',
      '只读模式：设置里打开「只读」后，客户端只能看不能改（电源/命令/文件写入全部禁用），适合给别人演示或临时借人用。': '只讀模式：設定裡開啟「只讀」後，客戶端只能看不能改（電源/命令/檔案寫入全部禁用），適合給別人演示或臨時借人用。',
      '同时支持 Pterodactyl v1 与 Pelican；所用 API 端点与 payload 形状已对照 Pelican 源码核实。': '同時支援 Pterodactyl v1 與 Pelican；所用 API 端點與 payload 形狀已對照 Pelican 原始碼核實。',
      '启动、停止、重启、强杀，动作后轮询状态直到就绪。': '啟動、停止、重啟、強殺，動作後輪詢狀態直到就緒。',
      '告警命令 pteropilot-alerts 增强：--dry-run 演练（只打印将通知谁，不发送）、--json 机器可读输出（便于 cron/监控脚本解析）': '告警命令 pteropilot-alerts 增強：--dry-run 演練（只列印將通知誰，不傳送）、--json 機器可讀輸出（便於 cron/監控指令碼解析）',
      '四步：安装 → 激活 → 连接面板 → 开始管理。卡在哪一步，直接看下面的对应章节或常见问题。': '四步：安裝 → 啟用 → 連線面板 → 開始管理。卡在哪一步，直接看下面的對應章節或常見問題。',
      '回到 Pteropilot 项目页': '回到 Pteropilot 專案頁',
      '回到项目页': '回到專案頁',
      '国内怎么买？海外呢？': '國內怎麼買？海外呢？',
      '国内：爱发电下单，付款后自动收到激活码。海外购买渠道即将开放。': '國內：麵包多商店下單，付款後自動收到啟用碼。海外購買渠道即將開放。',
      '国内：爱发电下单，付款后自动收到激活码；也可直接联系购买。海外：支付渠道即将开放。': '國內：麵包多商店下單，付款後自動收到啟用碼；也可直接聯絡購買。海外：支付渠道即將開放。',
      '图形界面全套 + 17 个 AI 工具': '圖形介面全套 + 17 個 AI 工具',
      '填两个字段': '填兩個欄位',
      '备份、文件、电源状态在面板里都是有权限、有审计、有状态语义的一等操作，不是随手一条 shell 命令。': '備份、檔案、電源狀態在面板裡都是有許可權、有審計、有狀態語義的一等操作，不是隨手一條 shell 命令。',
      '多半是密钥类型错了：要新建 Client 类型（不是 Application），或用错了别人的密钥。到面板「账户 → API 凭据」重新建一枚再贴。': '多半是金鑰型別錯了：要新建 Client 型別（不是 Application），或用錯了別人的金鑰。到面板「賬戶 → API 憑據」重新建一枚再貼。',
      '学生项目和开源项目可以聊价格。': '學生專案和開源專案可以聊價格。',
      '它会不会误删我的文件？': '它會不會誤刪我的檔案？',
      '安全开关': '安全開關',
      '安装程序（约 97MB）· Windows 10/11': '安裝程式（約 97MB）· Windows 10/11',
      '安装程序，桌面快捷方式，常驻后台管理。': '安裝程式，桌面快捷方式，常駐後臺管理。',
      '安装门槛': '安裝門檻',
      '完整文档 ↗': '完整文件 ↗',
      '完整记录见 GitHub CHANGELOG；这里只列对使用者有影响的变更。': '完整記錄見 GitHub CHANGELOG；這裡只列對使用者有影響的變更。',
      '宣传片在 B 站播放：BV1hznV61ESf': '宣傳片在 B 站播放：BV1hznV61ESf',
      '密钥能连上但权限不够：需要面板账号对该服务器有访问权限（子用户需要被分配服务器）。找面板管理员开权限。': '金鑰能連上但許可權不夠：需要面板賬號對該伺服器有訪問許可權（子使用者需要被分配伺服器）。找面板管理員開許可權。',
      '小单按件报价；需求不明确时先付定金做原型再定总价；': '小單按件報價；需求不明確時先付定金做原型再定總價；',
      '小工具、脚本、网站、AI 定制——我负责写代码和交付，你负责说清楚要什么。': '小工具、指令碼、網站、AI 定製——我負責寫程式碼和交付，你負責說清楚要什麼。',
      '崩服检测与告警': '崩服檢測與告警',
      '左侧列表选中服务器 → 右侧显示实时状态（CPU/内存/磁盘/在线玩家，5 秒刷新）。颜色标记异常态，一眼看出哪台不对劲。': '左側列表選中伺服器 → 右側顯示實時狀態（CPU/記憶體/磁碟/線上玩家，5 秒重新整理）。顏色標記異常態，一眼看出哪臺不對勁。',
      '常见问题': '常見問題',
      '建议先开只读模式确认行为；高危操作需要二次确认；API Key 的权限也可以自行收窄到最小。': '建議先開只讀模式確認行為；高危操作需要二次確認；API Key 的許可權也可以自行收窄到最小。',
      '建议给 AI 使用权限最小化的 API Key。': '建議給 AI 使用許可權最小化的 API Key。',
      '开始使用': '開始使用',
      '开源、免费，MIT 许可。源码在 GitHub，包在 PyPI。': '開源、免費，MIT 許可。原始碼在 GitHub，包在 PyPI。',
      '开源版 GitHub ↗': '開源版 GitHub ↗',
      '开源版 vs Pro': '開源版 vs Pro',
      '开源版免费、给会配 AI 客户端的人；Pro 是给「想点点鼠标就管服务器」的人的图形客户端。': '開源版免費、給會配 AI 客戶端的人；Pro 是給「想點點滑鼠就管伺服器」的人的圖形客戶端。',
      '开源版教程': '開源版教程',
      '开源版是 MCP server（让 AI 助手管理面板），免费开源、MIT 协议；Pro 是图形化 Windows 客户端（标准版 + Lite），商业闭源（EULA 授权，不是 MIT），带面板管理界面、内置 AI 助手、自动备份、云同步与自动更新。开源版不受影响，继续免费。': '開源版是 MCP server（讓 AI 助手管理面板），免費開源、MIT 協議；Pro 是圖形化 Windows 客戶端（標準版 + Lite），商業閉源（EULA 授權，不是 MIT），帶面板管理介面、內建 AI 助手、自動備份、雲同步與自動更新。開源版不受影響，繼續免費。',
      '开源版（免费）': '開源版（免費）',
      '开源的 MCP server，让 Claude、Cursor 等 AI 助手直接管理 Pterodactyl / Pelican 面板上的游戏服务器。': '開源的 MCP server，讓 Claude、Cursor 等 AI 助手直接管理 Pterodactyl / Pelican 面板上的遊戲伺服器。',
      '开源的 MCP server：让 Claude、Cursor 用自然语言管理 Pterodactyl / Pelican 游戏服务器。': '開源的 MCP server：讓 Claude、Cursor 用自然語言管理 Pterodactyl / Pelican 遊戲伺服器。',
      '开源项目、学生项目、非商用项目可以谈价格；': '開源專案、學生專案、非商用專案可以談價格；',
      '想更省事也可以直接用开源版 Pteropilot（MCP + AI 客户端），完全免费。': '想更省事也可以直接用開源版 Pteropilot（MCP + AI 客戶端），完全免費。',
      '想要图形界面？': '想要圖形介面？',
      '我 24 小时内回复；不合适也会直说。': '我 24 小時內回覆；不合適也會直說。',
      '我是 telson，独立开发者。喜欢把 AI 和代码拼在一起，做出真正能用的东西：': '我是 telson，獨立開發者。喜歡把 AI 和程式碼拼在一起，做出真正能用的東西：',
      '我更在意「交付出来能不能用」，而不是「代码写了多少行」。': '我更在意「交付出來能不能用」，而不是「程式碼寫了多少行」。',
      '打开客户端 → 顶部「许可证」卡片 → 把购买得到的激活码整段粘贴（含 PTPRO1- 前缀，别漏字符）→ 点「激活」→ 显示「已激活 · 终身」即成功。': '開啟客戶端 → 頂部「許可證」卡片 → 把購買得到的啟用碼整段貼上（含 PTPRO1- 字首，別漏字元）→ 點「啟用」→ 顯示「已啟用 · 終身」即成功。',
      '批量工具并发化：广播/批量电源/批量备份，多台耗时从 N× 降到 ≈1×': '批次工具併發化：廣播/批次電源/批次備份，多臺耗時從 N× 降到 ≈1×',
      '批量操作': '批次操作',
      '批量读工具 batch_list_players / batch_get_console_log 支持「全部服务器」通配——查所有服的在线玩家/日志一句话搞定': '批次讀工具 batch_list_players / batch_get_console_log 支援「全部伺服器」通配——查所有服的線上玩家/日誌一句話搞定',
      '把 pteropilot 加进你的 AI 客户端': '把 pteropilot 加進你的 AI 客戶端',
      '把「要做什么、给谁用、什么时候要」写清楚发过来，我会先回一个方案和报价。': '把「要做什麼、給誰用、什麼時候要」寫清楚發過來，我會先回一個方案和報價。',
      '换电脑：直接在新电脑上粘贴同一个激活码即可，不需要在旧电脑上解绑（一份授权最多 2 台设备）。': '換電腦：直接在新電腦上貼上同一個啟用碼即可，不需要在舊電腦上解綁（一份授權最多 2 臺裝置）。',
      '接单 · 开发服务与报价 | telson.dev': '接單 · 開發服務與報價 | telson.dev',
      '支持 Pterodactyl v1 与 Pelican。服务器列表、电源控制、控制台指令、文件管理、一键备份，': '支援 Pterodactyl v1 與 Pelican。伺服器列表、電源控制、控制檯指令、檔案管理、一鍵備份，',
      '支持哪些 AI 客户端？': '支援哪些 AI 客戶端？',
      '支持退款吗？': '支援退款嗎？',
      '收费吗？': '收費嗎？',
      '改完配置重启客户端，等 AI 识别到 pteropilot 的 39 个工具。': '改完配置重啟客戶端，等 AI 識別到 pteropilot 的 39 個工具。',
      '整支片子由代码生成：1080P60、1800 帧、分镜与动效全部写成确定性函数，': '整支片子由程式碼生成：1080P60、1800 幀、分鏡與動效全部寫成確定性函式，',
      '文件管理': '檔案管理',
      '文档口径补全（endpoint 矩阵 / 路线图），无新功能（与 v0.2.19 功能一致）': '文件口徑補全（endpoint 矩陣 / 路線圖），無新功能（與 v0.2.19 功能一致）',
      '新增 `get_console_log` 工具：读取服务器控制台最近日志，补全「发指令 → 看回馈」闭环。': '新增 `get_console_log` 工具：讀取伺服器控制檯最近日誌，補全「發指令 → 看回饋」閉環。',
      '新增 batch_backup_status / batch_backup 批量备份；双面板兼容（PANEL_APP_KEY + 密钥角色诊断）': '新增 batch_backup_status / batch_backup 批次備份；雙面板相容（PANEL_APP_KEY + 金鑰角色診斷）',
      '新增 batch_list_players 批量在线玩家；get_server_status 增加在线玩家数（日志推断）': '新增 batch_list_players 批次線上玩家；get_server_status 增加線上玩家數（日誌推斷）',
      '新增 broadcast_message（批量广播公告）、read_server_logs（日志排查）、player_history_stats（玩家活跃统计）、schedule_restart（公告 + 定时重启）': '新增 broadcast_message（批次廣播公告）、read_server_logs（日誌排查）、player_history_stats（玩家活躍統計）、schedule_restart（公告 + 定時重啟）',
      '新增 check_panel_connection 连接诊断：验证地址/密钥，401/403/404 给出可操作提示': '新增 check_panel_connection 連線診斷：驗證地址/金鑰，401/403/404 給出可操作提示',
      '新增 diagnose_crash 崩溃诊断（内存不足 / JVM 崩溃 / 反复崩溃循环）与 batch_power 批量电源': '新增 diagnose_crash 崩潰診斷（記憶體不足 / JVM 崩潰 / 反覆崩潰迴圈）與 batch_power 批次電源',
      '新增 get_backup_download（备份下载链接）、get_server_startup（启动命令与变量）、batch_get_console_log（批量日志）': '新增 get_backup_download（備份下載連結）、get_server_startup（啟動命令與變數）、batch_get_console_log（批次日誌）',
      '新增 get_server_activity 操作审计日志：查谁在什么时候重启了服务器、删了哪个文件、建了备份（面板事件流，系统/计划任务触发会标注）——第 39 个工具': '新增 get_server_activity 操作審計日誌：查誰在什麼時候重啟了伺服器、刪了哪個檔案、建了備份（面板事件流，系統/計劃任務觸發會標註）——第 39 個工具',
      '新增 get_server_network 网络分配查看：服务器 IP/端口（主地址 ⭐ 标记、附加端口、备注，支持 ip_alias 域名）——第 37 个工具': '新增 get_server_network 網路分配檢視：伺服器 IP/埠（主地址 ⭐ 標記、附加埠、備註，支援 ip_alias 域名）——第 37 個工具',
      '新增 list_databases 数据库查看：面板里已分配的数据库主机/库名/用户名/来源限制（配 LuckPerms、CoreProtect 等 MySQL 插件时直接用）——第 38 个工具': '新增 list_databases 資料庫檢視：面板裡已分配的資料庫主機/庫名/使用者名稱/來源限制（配 LuckPerms、CoreProtect 等 MySQL 外掛時直接用）——第 38 個工具',
      '新增 list_players、check_server_health、batch_get_status；MCP 握手真实版本号；面板错误中文化': '新增 list_players、check_server_health、batch_get_status；MCP 握手真實版本號；面板錯誤中文化',
      '新增 pteropilot-alerts 崩服告警命令：钉钉/企业微信 webhook + 邮件双通道、冷却去重、连续确认阈值、按服务器配置与路由': '新增 pteropilot-alerts 崩服告警命令：釘釘/企業微信 webhook + 郵件雙通道、冷卻去重、連續確認閾值、按伺服器配置與路由',
      '新增 search_server_logs 日志搜索：关键字搜索（不区分大小写、带行号、末尾 5000 行）': '新增 search_server_logs 日誌搜尋：關鍵字搜尋（不區分大小寫、帶行號、末尾 5000 行）',
      '更多能力：电源控制、控制台指令、文件管理、备份、玩家在线、网络地址、数据库信息、批量操作、广播公告、定时重启、崩服告警。完整清单见 pteropilot 项目页。': '更多能力：電源控制、控制檯指令、檔案管理、備份、玩家線上、網路地址、資料庫資訊、批次操作、廣播公告、定時重啟、崩服告警。完整清單見 pteropilot 專案頁。',
      '更新日志': '更新日誌',
      '更新日志 →': '更新日誌 →',
      '最多 2 台 · 换机直接填同一个码': '最多 2 臺 · 換機直接填同一個碼',
      '最多 2 台设备': '最多 2 臺裝置',
      '最多 2 台（如你自己的台式机 + 笔记本）。换电脑时直接在新电脑上填同一个激活码即可，不需要在旧电脑上做任何操作。': '最多 2 臺（如你自己的桌上型電腦 + 筆記本）。換電腦時直接在新電腦上填同一個啟用碼即可，不需要在舊電腦上做任何操作。',
      '最小权限': '最小許可權',
      '有能跑起来的开源项目，有能上线的网站，也有把想法变成 30 秒画面的渲染管线。': '有能跑起來的開源專案，有能上線的網站，也有把想法變成 30 秒畫面的渲染管線。',
      '有问题、想要新功能，欢迎提 issue；也欢迎直接写信告诉我你在哪个面板上用、遇到了什么。': '有問題、想要新功能，歡迎提 issue；也歡迎直接寫信告訴我你在哪個面板上用、遇到了什麼。',
      '有问题？': '有問題？',
      '有（配置备份、版本提示）': '有（配置備份、版本提示）',
      '服务器总览': '伺服器總覽',
      '查看 Pteropilot Pro': '檢視 Pteropilot Pro',
      '查看备份列表、创建新备份、从备份恢复、删除旧备份。': '檢視備份列表、建立新備份、從備份恢復、刪除舊備份。',
      '标准版与 Lite': '標準版與 Lite',
      '标准版较大（97MB），国内网络从 GitHub 下载可能较慢，必要时可用加速工具；功能与 Lite 完全一致，也可先用 Lite。': '標準版較大（97MB），國內網路從 GitHub 下載可能較慢，必要時可用加速工具；功能與 Lite 完全一致，也可先用 Lite。',
      '标准版（安装程序）': '標準版（安裝程式）',
      '标准版（桌面安装版）': '標準版（桌面安裝版）',
      '桌面 + 笔记本；换电脑可一键解绑旧设备。': '桌面 + 筆記本；換電腦可一鍵解綁舊裝置。',
      '没有 uv？先装 uv（Windows：': '沒有 uv？先裝 uv（Windows：',
      '浏览、读取、写入、上传、重命名、删除、新建文件夹、生成一次性下载链接。': '瀏覽、讀取、寫入、上傳、重新命名、刪除、新建資料夾、生成一次性下載連結。',
      '激活失败 / 提示码无效': '啟用失敗 / 提示碼無效',
      '点「测试连接」': '點「測試連線」',
      '状态级 + 日志级崩溃信号检测（OOM / JVM / 异常退出 / 致命错误），可配 webhook / 邮件通知、冷却去重、连续确认防误报。': '狀態級 + 日誌級崩潰訊號檢測（OOM / JVM / 異常退出 / 致命錯誤），可配 webhook / 郵件通知、冷卻去重、連續確認防誤報。',
      '独立开发者 · AI 工具 / 自动化 / 网页': '獨立開發者 · AI 工具 / 自動化 / 網頁',
      '玩家在线': '玩家線上',
      '环境变量': '環境變數',
      '用 uvx 一条命令': '用 uvx 一條命令',
      '用自然语言干活': '用自然語言幹活',
      '用自然语言，管好你的游戏服务器。': '用自然語言，管好你的遊戲伺服器。',
      '电源控制': '電源控制',
      '电源（启动/停止/重启/强杀，危险操作二次确认）、控制台看日志发指令、文件浏览上传、备份（手动 + 自动）、服务器地址与数据库查询、操作审计。': '電源（啟動/停止/重啟/強殺，危險操作二次確認）、控制檯看日誌發指令、檔案瀏覽上傳、備份（手動 + 自動）、伺服器地址與資料庫查詢、操作審計。',
      '直接向服务器发送指令，读回控制台输出。': '直接向伺服器傳送指令，讀回控制檯輸出。',
      '直接安装。': '直接安裝。',
      '直接安装。" data-zh-tw="沒有 uv？先裝 uv（Windows：': '直接安裝。" data-zh-tw="沒有 uv？先裝 uv（Windows：',
      '看 30 秒宣传片': '看 30 秒宣傳片',
      '真实面板实测工具 scripts/live_smoke.py（只读端到端探测，不触发写操作）': '真實面板實測工具 scripts/live_smoke.py（只讀端到端探測，不觸發寫操作）',
      '立即购买 ¥59.99 · 自动发码': '立即購買 ¥59.99 · 自動發碼',
      '立即购买 ¥59.99（优惠）': '立即購買 ¥59.99（優惠）',
      '第 1 步 · 安装': '第 1 步 · 安裝',
      '第 2 步 · 配置客户端': '第 2 步 · 配置客戶端',
      '第 3 步 · 提问': '第 3 步 · 提問',
      '第 4 步 · 安全建议': '第 4 步 · 安全建議',
      '粘贴激活码': '貼上啟用碼',
      '约 32MB · 免安装单文件': '約 32MB · 免安裝單檔案',
      '约 97MB · Windows 10/11 64 位': '約 97MB · Windows 10/11 64 位',
      '终身买断': '終身買斷',
      '终身授权': '終身授權',
      '给 AI 一把 root，和给它一把有权限范围的 API Key，是两件完全不同的事。': '給 AI 一把 root，和給它一把有許可權範圍的 API Key，是兩件完全不同的事。',
      '给 AI 用权限最小化的 API Key：在面板里创建只含必要权限的 API Key。': '給 AI 用許可權最小化的 API Key：在面板裡建立只含必要許可權的 API Key。',
      '能做什么': '能做什麼',
      '能力覆盖': '能力覆蓋',
      '自动更新 · 云同步': '自動更新 · 雲同步',
      '设为 1 进入只读模式': '設為 1 進入只讀模式',
      '设置卡片里有「测试连接」按钮：成功会显示可访问的服务器数量；失败会明确提示是密钥问题（401/403）还是地址问题（404/网络不可达），按提示改即可。': '設定卡片裡有「測試連線」按鈕：成功會顯示可訪問的伺服器數量；失敗會明確提示是金鑰問題（401/403）還是地址問題（404/網路不可達），按提示改即可。',
      '设置里可把配置（面板地址、每服调优、告警）一键备份到云端，换电脑一键恢复；新版本会自动提示更新。': '設定裡可把配置（面板地址、每服調優、告警）一鍵備份到雲端，換電腦一鍵恢復；新版本會自動提示更新。',
      '试用、激活、换机、退款，任何问题都可以找我。开源版照旧免费，欢迎去 GitHub 提 issue。': '試用、啟用、換機、退款，任何問題都可以找我。開源版照舊免費，歡迎去 GitHub 提 issue。',
      '试用期多久？': '試用期多久？',
      '试试 Pteropilot Pro': '試試 Pteropilot Pro',
      '该走 API 的就走 API': '該走 API 的就走 API',
      '说明：数据库密码不在面板 API 返回范围内，工具会提示去面板网页端查看': '說明：資料庫密碼不在面板 API 返回範圍內，工具會提示去面板網頁端檢視',
      '购买后 7 天内可申请退款（与软件描述严重不符或无法正常使用），退款后激活码作废。': '購買後 7 天內可申請退款（與軟體描述嚴重不符或無法正常使用），退款後啟用碼作廢。',
      '购买已开放（自动发码）；下载与 7 天试用随时可用。': '購買已開放（自動發碼）；下載與 7 天試用隨時可用。',
      '路线图 ↗': '路線圖 ↗',
      '运行环境': '執行環境',
      '返回产品页': '返回產品頁',
      '这台网站也是手写的静态站——零框架、零外部依赖、单文件 CSS。': '這臺網站也是手寫的靜態站——零框架、零外部依賴、單檔案 CSS。',
      '连不上面板 / 超时': '連不上面板 / 超時',
      '连接面板': '連線面板',
      '连接面板 401 / 密钥无效': '連線面板 401 / 金鑰無效',
      '选一台服务器': '選一臺伺服器',
      '邮件标题写「需求 + 一句话描述」，正文写清做什么、给谁用、什么时候要。': '郵件標題寫「需求 + 一句話描述」，正文寫清做什麼、給誰用、什麼時候要。',
      '配乐用纯代码合成（126 BPM，drop 精确落在第 10 秒），全程没有剪辑软件、没有素材库、没有版权风险。': '配樂用純程式碼合成（126 BPM，drop 精確落在第 10 秒），全程沒有剪輯軟體、沒有素材庫、沒有版權風險。',
      '配好之后，直接说人话': '配好之後，直接說人話',
      '配置完先让 AI 执行 check_panel_connection 自检：返回「✅ 已连通」即配置正确；报 401/403/404 会给出具体排查方向。': '配置完先讓 AI 執行 check_panel_connection 自檢：返回「✅ 已連通」即配置正確；報 401/403/404 會給出具體排查方向。',
      '里生成\' data-zh-tw=\'API Key 在面板的': '裡生成\' data-zh-tw=\'API Key 在面板的',
      '需要 AI 客户端': '需要 AI 客戶端',
      '需要 Python 3.12+。用 uv 一行跑起来，然后在 MCP 客户端里加一段配置即可。': '需要 Python 3.12+。用 uv 一行跑起來，然後在 MCP 客戶端里加一段配置即可。',
      '需要 Python 3.12+。项目用 uv 管理，一条命令安装并运行：': '需要 Python 3.12+。專案用 uv 管理，一條命令安裝並執行：',
      '需要的话，去 GitHub 给它一颗星': '需要的話，去 GitHub 給它一顆星',
      '需要自己先装一个面板吗？': '需要自己先裝一個面板嗎？',
      '需要自己先装面板吗？': '需要自己先裝面板嗎？',
      '需要（装 Claude / Cursor 并配 JSON）': '需要（裝 Claude / Cursor 並配 JSON）',
      '面向 Pterodactyl / Pelican 面板的 Windows 客户端：图形化管理界面、内置 AI 助手、自动备份、云同步与自动更新。开源版（MCP server）继续免费。': '面向 Pterodactyl / Pelican 面板的 Windows 客戶端：圖形化管理介面、內建 AI 助手、自動備份、雲同步與自動更新。開源版（MCP server）繼續免費。',
      '面板 API 全功能覆盖（电源、控制台、文件、备份），权限最小化设计，API Key 不出本机。': '面板 API 全功能覆蓋（電源、控制檯、檔案、備份），許可權最小化設計，API Key 不出本機。',
      '面板上的游戏服务器。\' data-zh-tw=\'開源的 MCP server，讓 Claude、Cursor 等 AI 助手直接管理': '面板上的遊戲伺服器。\' data-zh-tw=\'開源的 MCP server，讓 Claude、Cursor 等 AI 助手直接管理',
      '面板不可达/密钥错误时不再抛一堆堆栈，改为输出可读错误原因': '面板不可達/金鑰錯誤時不再拋一堆堆疊，改為輸出可讀錯誤原因',
      '面板地址要填域名根路径：https://panel.example.com（不要加 /api、不要带具体页面路径、末尾不要斜杠）。': '面板地址要填域名根路徑：https://panel.example.com（不要加 /api、不要帶具體頁面路徑、末尾不要斜槓）。',
      '面板用户本来就没有 shell': '面板使用者本來就沒有 shell',
      '面板的 Windows 客户端：图形化管理界面、内置 AI 助手、自动备份、云同步与自动更新。开源版（MCP server）继续免费。\' data-zh-tw=\'面向': '面板的 Windows 客戶端：圖形化管理介面、內建 AI 助手、自動備份、雲同步與自動更新。開源版（MCP server）繼續免費。\' data-zh-tw=\'面向',
      '顺便看看接单服务': '順便看看接單服務',
      '首个版本：服务器列表/状态/电源/指令/文件/备份、只读模式、高危二次确认、中英双语 README': '首個版本：伺服器列表/狀態/電源/指令/檔案/備份、只讀模式、高危二次確認、中英雙語 README',
      '首次打开界面起 7 天全功能试用；到期未激活自动降级为只读（可查看，不可操作）。': '首次開啟介面起 7 天全功能試用；到期未啟用自動降級為只讀（可檢視，不可操作）。',
      '首次打开自带 7 天全功能试用，不激活也能用全部功能。觉得合适再买码激活，试用数据不会丢。': '首次開啟自帶 7 天全功能試用，不啟用也能用全部功能。覺得合適再買碼啟用，試用資料不會丟。',
      '）；PyPI 版本可能滞后，最新版可从 GitHub 直装。': '）；PyPI 版本可能滯後，最新版可從 GitHub 直裝。',
      '）；PyPI 版本可能滞后，最新版可从 GitHub 直装。" data-zh-tw="裝過舊版？升級：': '）；PyPI 版本可能滯後，最新版可從 GitHub 直裝。" data-zh-tw="裝過舊版？升級：',
      '，或用官网安装脚本）。也可以': '，或用官網安裝指令碼）。也可以',
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

    /* 繁体索引：键为简体原文（同样忽略空白） */
    var TW_INDEX = {};
    Object.keys(TW_DICT).forEach(function (k) { TW_INDEX[norm(k)] = TW_DICT[k]; });

    function translateTextNodes(lang) {
      var isEn = lang === 'en';
      var isTw = lang === 'zh-TW';
      walkTextNodes(document.body, function (node) {
        if (!originals.has(node)) originals.set(node, node.nodeValue);
        var zh = originals.get(node);
        if (!isEn && !isTw) { node.nodeValue = zh; return; }
        var lead = (zh.match(/^\s*/) || [''])[0];
        var trail = (zh.match(/\s*$/) || [''])[0];
        var hit = isEn ? INDEX[norm(zh)] : TW_INDEX[norm(zh)];
        if (hit === undefined && isTw) hit = TW_INDEX[norm(zh)];
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
      var isTw = lang === 'zh-TW';
      activeLang = lang;
      document.documentElement.lang = isEn ? 'en' : (isTw ? 'zh-Hant-TW' : 'zh-CN');

      document.querySelectorAll('[data-zh][data-en]').forEach(function (el) {
        var attr = isEn ? 'data-en' : (isTw ? 'data-zh-tw' : 'data-zh');
        var value = el.getAttribute(attr);
        // 繁体缺译文时回退简体，避免出现空白
        if (value === null && isTw) value = el.getAttribute('data-zh');
        if (value !== null) el.innerHTML = value;
      });

      translateTextNodes(lang);
      syncCopyButtons(lang);

      var titleZh = document.body.getAttribute('data-title-zh');
      var titleEn = document.body.getAttribute('data-title-en');
      var titleTw = document.body.getAttribute('data-title-tw');
      if (isEn && titleEn) document.title = titleEn;
      else if (isTw) document.title = titleTw || titleZh || document.title;
      else if (titleZh) document.title = titleZh;

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
    var activeLang = saved === 'en' ? 'en' : (saved === 'zh-TW' ? 'zh-TW' : 'zh');
    if (saved === 'en' || saved === 'zh-TW') apply(saved);

    /* ---------- 版本号：从 GitHub 拉取 pyproject.toml 解析，失败回退本地默认 ---------- */
    var VERSION_TOKEN_RE = /v\d+\.\d+\.\d+/g;
    function applyVersion(ver) {
      var zh = 'v' + ver + ' · MIT · 已发布';
      var en = 'v' + ver + ' · MIT · released';
      var zhTw = 'v' + ver + ' · MIT · 已釋出';
      Object.keys(DICT).forEach(function (k) {
        if (/^v\d+\.\d+\.\d+ · MIT · /.test(k)) delete DICT[k];
      });
      Object.keys(TW_DICT).forEach(function (k) {
        if (/^v\d+\.\d+\.\d+ · MIT · /.test(k)) delete TW_DICT[k];
      });
      DICT[zh] = en;
      TW_DICT[zh] = zhTw;
      TW_INDEX[norm(zh)] = zhTw;
      document.querySelectorAll('[data-version]').forEach(function (el) {
        if (el.hasAttribute('data-zh') && el.hasAttribute('data-en')) {
          el.setAttribute('data-zh', zh);
          el.setAttribute('data-en', en);
          el.setAttribute('data-zh-tw', zhTw);
          el.innerHTML = activeLang === 'en' ? en : (activeLang === 'zh-TW' ? zhTw : zh);
        } else {
          el.textContent = el.textContent.replace(VERSION_TOKEN_RE, 'v' + ver);
        }
      });
    }
    function parseVersion(txt) {
      var m = txt.match(/version\s*=\s*["']([^"']+)["']/);
      return m && m[1] ? m[1] : null;
    }
    function loadVersionFromGithub() {
      // 主路：GitHub API（contents 端点返回 base64）；备胎：raw CDN。都失败则保持本地默认。
      fetch('https://api.github.com/repos/telson-dev/pteropilot/contents/pyproject.toml', { cache: 'no-store' })
        .then(function (r) {
          if (!r.ok) throw new Error('http ' + r.status);
          return r.json();
        })
        .then(function (j) {
          var ver = parseVersion(j && j.content ? atob(j.content) : '');
          if (ver) applyVersion(ver);
        })
        .catch(function () {
          return fetch('https://raw.githubusercontent.com/telson-dev/pteropilot/main/pyproject.toml', { cache: 'no-store' })
            .then(function (r) {
              if (!r.ok) throw new Error('http ' + r.status);
              return r.text();
            })
            .then(function (txt) {
              var ver = parseVersion(txt);
              if (ver) applyVersion(ver);
            })
            .catch(function () { /* 两条路都失败：保持本地默认版本号 */ });
        });
    }
    loadVersionFromGithub();
  })();

  /* ---------- 首页闪烁标语（Minecraft 风格：每次刷新随机一条，点击换一条） ---------- */
  /* 标语写在 assets/splashes.txt 里，一行一条，以 # 开头的行是注释（不会显示）。 */
  (function heroSplash() {
    var el = document.getElementById('hero-splash');
    if (!el) return;
    var SPLASHES = [];
    function pick() {
      if (!SPLASHES.length) return; // 没填标语时保持页面默认，不显示空内容
      var i;
      do {
        i = Math.floor(Math.random() * SPLASHES.length);
      } while (SPLASHES.length > 1 && i === last);
      last = i;
      el.textContent = SPLASHES[i];
    }
    var last = -1;
    fetch('assets/splashes.txt', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.text() : ''; })
      .then(function (txt) {
        // 每行可以是「简体|繁体」；按当前语言取对应写法（没有 | 就原样用）
        var curLang = null;
        try { curLang = localStorage.getItem('telson.lang'); } catch (e) {}
        var useTw = curLang === 'zh-TW';
        SPLASHES = txt.split(/\r?\n/)
          .map(function (s) { return s.trim(); })
          .filter(function (s) { return s && s.charAt(0) !== '#'; })
          .map(function (s) {
            var parts = s.split('|');
            if (parts.length >= 2) return (useTw ? parts[1] : parts[0]).trim();
            return s;
          })
          .filter(function (s) { return !!s; });
        if (!SPLASHES.length) return;
        pick();
        el.addEventListener('click', pick);
      })
      .catch(function () { /* 加载失败则保持页面默认 */ });
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
