# telson.dev

个人站点 + 作品集 + 接单入口。纯静态，手写 HTML / CSS / JS，无框架、无构建步骤、无外部依赖（唯一外部请求是 Pteropilot 页的 B 站播放器）。

## 目录

```
telson-dev/
├── index.html          首页：自我介绍 + 精选作品 + 服务概览 + 联系
├── services.html       接单页：服务与报价、流程、交付标准、FAQ
├── pteropilot.html     Pteropilot 项目页（中英双语切换）
├── projects.html       作品集：Pteropilot / 宣传片管线 / 本站
├── 404.html            404 页
├── robots.txt
├── sitemap.xml
└── assets/
    ├── css/style.css   全部样式（单文件，约 21KB）
    ├── js/main.js      导航、滚动动画、复制、双语切换（约 4KB）
    └── img/            icon.png / cover.jpg / 三张宣传片截图
```

## 本地预览

```powershell
# 任选其一
python -m http.server 8080 --bind 127.0.0.1
# 然后打开 http://127.0.0.1:8080/
```

直接双击 `index.html` 也能看，但本地服务器更接近线上效果（相对路径与 fetch 行为一致）。

## 部署（三选一）

### 方案 A：自己的服务器 + nginx（最省事）

```bash
# 1. 上传（在 Windows PowerShell 里执行）
scp -r D:\Projects\telson-dev\* root@<服务器IP>:/var/www/telson.dev/

# 2. 服务器上写 nginx 配置 /etc/nginx/conf.d/telson.conf
```

```nginx
server {
    listen 80;
    server_name telson.dev www.telson.dev;
    root /var/www/telson.dev;
    index index.html;

    location / {
        try_files $uri $uri/ $uri.html =404;
    }
    error_page 404 /404.html;

    # 静态资源缓存
    location ~* \.(css|js|png|jpg|jpeg|svg|webp)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
}
```

```bash
# 3. HTTPS（需要域名已解析到这台机器）
certbot --nginx -d telson.dev -d www.telson.dev
nginx -t && systemctl reload nginx
```

> **重要：备案现实（2026-10-24 实测）。**
> 1. `telson.dev` 已解析到阿里云上海服务器 `8.153.14.7`，但访问返回 403，页面标题是 `Non-compliance ICP Filing` —— 被阿里云按未备案拦截。
> 2. **`.dev` 后缀工信部未批准，无法做 ICP 备案**（.dev / .app / .io / .me / .ai 等都不行）。所以这台大陆服务器**永远无法**直接托管 telson.dev。
>
> 结论：telson.dev 只能放在**境外主机**（Cloudflare Pages、香港/新加坡 VPS、GitHub Pages 等），这时完全不需要备案。
> 如果坚持用这台上海服务器，就必须换一个可备案的后缀（.com / .cn / .top / .xyz 等），再用家长的身份做个人备案。

### 方案 B：Cloudflare Pages（免费、免备案、自带 HTTPS）

1. 把本目录推到一个 GitHub 仓库
2. Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git
3. 构建命令留空，输出目录填 `/`（纯静态）
4. 绑定自定义域名 `telson.dev`，DNS 由 Cloudflare 托管即可

### 方案 C：阿里云 OSS / 腾讯云 COS 静态托管

上传整个目录，开启静态网站功能，把域名 CNAME 到桶域名。同样受备案约束（大陆节点）。

## 改内容时改哪里

| 想改什么 | 改哪里 |
| --- | --- |
| 报价、服务项 | `services.html` 里的 `.card` 区块 |
| 联系方式 | 全站搜 `2361034217` |
| 首页文案 | `index.html` 的 hero 与 section |
| Pteropilot 信息 | `pteropilot.html`（版本、功能、配置） |
| 颜色 / 字号 | `assets/css/style.css` 顶部 `:root` 变量 |
| 双语文本 | 元素上的 `data-zh` / `data-en` 属性 |

## 设计约定

- 品牌色：青 `#2fd9ff`、紫 `#8a5cff`、底色 `#06090f`
- 字体：系统字体栈（不加载外部字体，避免国内加载慢）
- 动画：`IntersectionObserver` 滚动渐入，尊重 `prefers-reduced-motion`
- 图片：都要有 `alt`，非首屏加 `loading="lazy"`

## 自检清单（改完跑一遍）

- [ ] 浏览器控制台无报错
- [ ] 390px / 768px / 1440px 三档没有横向滚动条
- [ ] 手机端菜单能展开
- [ ] Pteropilot 页「中文 / EN」切换正常，刷新后保持
- [ ] 所有站内链接 200，没有 404
- [ ] 复制按钮点击后变「已复制」

## 已验证（2026-10-24）

- 4 个页面 + 404：控制台无本站报错（仅 B 站播放器自身警告）
- 站内链接全部 200，无破图，图片均有 alt
- 390 / 768 / 1440 三档无页面级横向溢出
- 滚动动画 9/9 触发；复制按钮正常；双语切换 + localStorage 持久化正常
- 首页零外部请求；Pteropilot 页仅 B 站 iframe

## 更换图标

当前**临时**使用 Pteropilot 的产品图标（`assets/img/icon.png`，256×256 PNG）。换成自己的图标时：

1. 准备 256×256 或 512×512 的 PNG，替换 `assets/img/icon.png`
2. 同时用作 favicon、apple-touch-icon、OG 图与页头 logo，改一个文件全站生效
3. 如需换 OG 分享图，另替换 `assets/img/cover.jpg`（建议 1600×900）

> 联系方式已改为「展示 + 一键复制」：邮箱与 QQ 都是纯文本 + 复制按钮，不再使用 `mailto:`（没有邮件客户端时 mailto 点了没反应）。
## 修复记录（2026-10-24 第二轮）

**问题**：部分复制按钮点击无反应；「发送邮件」按钮点击无效。

**根因**：

1. 邮件入口用的是 `mailto:` 链接，机器没有配置邮件客户端时点击就是「什么都不发生」——这不是站点 bug，但体验上等于坏了。
2. 复制成功/失败原本没有可见反馈，且 toast 用 CSS 入场动画，浏览器在自动化/后台标签页会延迟启动动画（实测延迟约 700ms），期间透明度为 0，看起来像「点了没反应」。

**修复**：

- 全站移除 `mailto:`（0 处残留）。邮箱、QQ 改为纯文本展示（`user-select: all`）+「复制」按钮，点击后浮层提示「已复制：xxx」。
- toast 改为**立即可见**（去掉入场动画），并改为单例（连续点击不会叠出多个浮层），失败时明确提示「复制失败，请手动选中」。
- 复制按钮扩大点击区域（最小 30px 高），移动端 `touch-action: manipulation`，并加 `:active` 反馈。
- 「复制邮箱地址」大按钮保留在接单页首屏与联系区。

**复测结果**：4 个页面 × 桌面(1440) / 手机(390) × 全部 10 个复制按钮 = **20 次点击全部通过**（toast 可见、单例计数=1、无横向溢出）；`mailto:` 与 QQ 跳转链接均为 0。
## 视觉细节（第二轮升级）

| 效果 | 做法 | 文件 |
| --- | --- | --- |
| **顶部网格背景** | 网格只铺在页面最上方（`height: min(780px, 92vh)`），向下用 mask 渐隐；超出部分不再有网格 | `style.css` `.bg-grid` |
| **指针高亮网格** | `<canvas class="grid-canvas">` 同步绘制：距指针 240px 内的竖线/横线按距离平方加粗、提亮，并叠加一层青色光晕；指针移开即恢复 | `main.js` `gridField()` |
| **渐变标题流动变色** | `h1 em` 用 300% 宽的渐变 + `background-clip: text`，`background-position` 11s 循环平移，颜色持续流动 | `style.css` `h1 em` / `@keyframes gradient-pan` |
| **卡片光斑** | 鼠标在卡片上移动时写入 `--mx/--my`，卡片叠加跟随指针的径向青色高光 | `main.js` + `.card::after` |
| **顶部滚动进度条** | 2px 渐变线，随滚动比例增长 | `.scroll-progress` |
| **首屏浮动** | 首页/项目页的框架图 7.5s 缓慢上下浮动 | `@keyframes hero-float` |
| **终端打字** | 首屏 `$ uvx pteropilot` 逐字打出来，带闪烁光标 | `[data-type]` |

**降级策略**：`prefers-reduced-motion: reduce` 时关闭渐变流动、浮动、打字与指针高亮（网格静态渲染）；JS 未执行时 `body.has-canvas` 不生效，回退为纯 CSS 网格。

**性能**：网格绘制不依赖 `requestAnimationFrame` 循环，只在 `pointermove` 时同步重绘（约 40 条线，单帧 < 1ms），静止时不占 CPU。

**验证（2026-10-24 第三轮）**：

- 5 页 × 桌面/手机 = 10 项全部通过：canvas 已绘制、CSS 网格已隐藏、进度条存在、无横向溢出、无 JS 报错
- 指针高亮实测：同一区域最大 alpha `29 → 141`（靠近指针）→ `29`（移开）→ `140`（再靠近）
- 渐变标题：`animation-name: gradient-pan`，背景位置实测 `59.09% → 92.72%`
- 滚动进度条：顶部 `0%` → 滚动一半 `67.74%`
- 终端打字：完成后文本为 `uvx pteropilot`，光标已移除