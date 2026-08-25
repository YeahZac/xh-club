#!/usr/bin/env python3
"""Build tech-led outsourcing homepage (inline base64 or CDN URL mode)."""
from __future__ import annotations

import base64
import os
from io import BytesIO
from pathlib import Path

from PIL import Image

ROOT = Path("/Users/Admin1/Work/星河-小程序/projects")
ASSETS = Path("/Users/Admin1/.cursor/projects/Users-Admin1-Work-projects/assets")
OUT = ROOT / "h5/miniprogram-dev/miniprogram-dev-inline.html"
PUBLIC = ROOT / "server/public/index.html"
QR_SRC = ASSETS / "image-6ccd74e7-aec6-4c6c-8dca-0930e03b7aaa.png"
CDN_BASE = os.environ.get("H5_CDN_BASE", "").rstrip("/")
IMAGE_MODE = os.environ.get("H5_IMAGE_MODE", "inline").lower()


def jpeg_from(im: Image.Image, width: int, quality: int) -> str:
    im = im.convert("RGB")
    if im.width > width:
        height = max(1, round(im.height * width / im.width))
        im = im.resize((width, height), Image.Resampling.LANCZOS)
    buf = BytesIO()
    im.save(buf, "JPEG", quality=quality, optimize=True, progressive=True, subsampling=2)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def png_from(im: Image.Image, width: int) -> str:
    if im.width > width:
        height = max(1, round(im.height * width / im.width))
        im = im.resize((width, height), Image.Resampling.LANCZOS)
    buf = BytesIO()
    im.save(buf, "PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def load_image(path: Path, width: int, quality: int, *, png: bool = False, force_jpeg: bool = False) -> str:
    im = Image.open(path)
    if IMAGE_MODE == "url" and CDN_BASE:
        name = path.stem + (".png" if png and not force_jpeg else ".jpg")
        return f"{CDN_BASE}/{name}"
    if force_jpeg or (not png and path.suffix.lower() != ".png"):
        return jpeg_from(im, width, quality)
    if png or path.suffix.lower() == ".png":
        return png_from(im, width)
    return jpeg_from(im, width, quality)


imgs = {
    "b1": load_image(ASSETS / "banner-tech-team.jpg", 1080, 72),
    "b2": load_image(ASSETS / "banner-tech-cac.jpg", 1080, 72),
    "b3": load_image(ASSETS / "banner-tech-systems.jpg", 1080, 72),
    "building": load_image(ASSETS / "building-cocopark.jpg", 960, 74),
    "team": load_image(ASSETS / "office-team-work.jpg", 960, 72),
    "app_retail": load_image(ASSETS / "app-ui-retail.jpg", 420, 72),
    "app_rest": load_image(ASSETS / "app-ui-restaurant.jpg", 420, 72),
    "app_channel": load_image(ASSETS / "app-ui-channel.jpg", 420, 72),
    "app_mkt": load_image(ASSETS / "app-ui-marketing.jpg", 420, 72),
    "app_health": load_image(ASSETS / "app-ui-health.jpg", 420, 72),
    "app_logistics": load_image(ASSETS / "app-ui-logistics.jpg", 420, 72),
    "dash_cmd": load_image(ASSETS / "dash-command-center.jpg", 1200, 76),
    "dash_crm": load_image(ASSETS / "admin-crm-cn.jpg", 1200, 76),
    "dash_mall": load_image(ASSETS / "admin-mall-cn.jpg", 1200, 76),
    "dash_member": load_image(ASSETS / "dash-member-ops.jpg", 1200, 76),
    "dash_supply": load_image(ASSETS / "dash-supply-chain.jpg", 1200, 76),
    "dash_finance": load_image(ASSETS / "dash-finance.jpg", 1200, 76),
    "qr": load_image(QR_SRC, 152, 90, png=True),
}

html = r'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="renderer" content="webkit" />
  <meta name="format-detection" content="telephone=yes,email=yes" />
  <meta name="applicable-device" content="pc,mobile" />
  <meta name="theme-color" content="#070d1a" />
  <title>小程序开发_APP开发_商城会员CRM定制_企业信息系统外包</title>
  <meta name="description" content="深圳龙岗星河COCO Park，承接微信小程序、APP、商城、会员、CRM、广告与后台。已服务390+企业，源码交付、合同保障。电话15918651523。" />
  <meta name="keywords" content="小程序开发,深圳软件外包,获客系统,私域运营,APP开发,商城系统,会员系统,CRM系统,后台管理系统" />
  <style>
/* Hallmark · genre: atmospheric · macrostructure: Marquee Hero + Catalogue
 * theme: Cobalt · nav: N1b · footer: Ft5 · enrichment: photography + CN UI showcase
 * Hallmark · pre-emit critique: P5 H5 E5 S5 R4 V5 */

:root {
  --color-paper: #070d1a;
  --color-paper-2: #0c1528;
  --color-paper-3: #101e36;
  --color-card: #121f36;
  --color-rule: #1e3354;
  --color-muted: #8fa3c4;
  --color-ink: #e8f0ff;
  --color-accent: #2dd4ff;
  --color-accent-hover: #5ce4ff;
  --color-accent-active: #1ab8e0;
  --color-on-accent: #041018;
  --color-accent-2: #3b82f6;
  --color-gold: #c9a96e;
  --color-focus: #2dd4ff;
  --color-caption: rgba(7, 13, 26, 0.82);
  --color-scrim: rgba(4, 10, 20, 0.72);
  --font-display: "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Microsoft YaHei", sans-serif;
  --font-body: "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Microsoft YaHei", sans-serif;
  --text-hero: clamp(1.35rem, 4.2vw, 2rem);
  --text-xl: clamp(1.15rem, 2.4vw, 1.55rem);
  --text-sm: 0.875rem;
  --text-xs: 0.75rem;
  --space-3xs: 0.125rem;
  --space-2xs: 0.25rem;
  --space-xs: 0.5rem;
  --space-sm: 0.75rem;
  --space-md: 1rem;
  --space-lg: 1.5rem;
  --space-xl: 2.5rem;
  --radius: 12px;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --dur-micro: 120ms;
  --dur-short: 220ms;
  --page: 72rem;
  --z-nav: 4;
  --z-caption: 2;
  --glow: 0 0 0 1px rgba(45, 212, 255, 0.12), 0 24px 60px rgba(0, 0, 0, 0.45);
}
*, *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
html, body {
  margin: 0; padding: 0;
  overflow-x: clip;
  background: radial-gradient(120% 80% at 50% -10%, #142a52 0%, var(--color-paper) 42%, #050910 100%);
  color: var(--color-ink);
  font-family: var(--font-body);
  font-size: 16px;
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
}
img { display: block; width: 100%; height: auto; border: 0; }
figure { margin: 0; }
h1, h2, h3 { font-family: var(--font-display); font-style: normal; font-weight: 600; margin: 0; letter-spacing: -0.02em; overflow-wrap: anywhere; min-width: 0; }
p { margin: 0; }
a { color: var(--color-accent); text-decoration: none; -webkit-tap-highlight-color: rgba(45, 212, 255, 0.18); }
a:focus-visible, button:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 3px; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); border: 0; }

.page {
  width: min(100%, var(--page));
  margin: 0 auto;
  padding: 0 var(--space-md) calc(var(--space-xl) + env(safe-area-inset-bottom));
}
.nav {
  display: flex; align-items: center; justify-content: space-between; gap: var(--space-sm);
  padding: calc(var(--space-sm) + env(safe-area-inset-top)) 0 var(--space-sm);
  position: relative; z-index: var(--z-nav);
}
.brand { color: var(--color-ink); font-weight: 600; font-size: 1rem; white-space: nowrap; }
.nav-links { display: none; list-style: none; margin: 0; padding: 0; gap: var(--space-md); }
.nav-links a { color: var(--color-muted); font-size: var(--text-sm); white-space: nowrap; }
.btn {
  display: inline-flex; align-items: center; justify-content: center;
  min-height: 2.5rem; padding: 0 var(--space-md);
  border: 1px solid var(--color-accent); border-radius: 999px;
  background: linear-gradient(135deg, var(--color-accent), var(--color-accent-2));
  color: var(--color-on-accent); font-weight: 600;
  font-size: var(--text-sm); white-space: nowrap;
  transition: filter var(--dur-micro) var(--ease-out), transform var(--dur-short) var(--ease-out);
}
.btn:hover { filter: brightness(1.08); }
.btn:active { transform: translateY(1px); }

.carousel { margin: 0 calc(var(--space-md) * -1); }
.viewport {
  overflow-x: auto; overflow-y: hidden;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
.viewport::-webkit-scrollbar { display: none; }
.track { display: flex; }
.slide {
  flex: 0 0 100%; min-width: 100%; max-width: 100%;
  margin: 0; scroll-snap-align: start; position: relative; overflow: hidden;
  background: var(--color-paper-2);
}
.slide img {
  width: 100%; aspect-ratio: 16 / 9; object-fit: cover;
  object-position: center 40%;
}
.slide::after {
  content: "";
  position: absolute; inset: 0;
  background: linear-gradient(180deg, rgba(7,13,26,0.05) 20%, rgba(7,13,26,0.78) 100%);
  pointer-events: none;
}
.caption {
  position: absolute; left: var(--space-sm); bottom: var(--space-sm); right: var(--space-sm);
  z-index: var(--z-caption); max-width: 20rem;
  padding: var(--space-sm);
}
.caption strong {
  display: block;
  font-size: var(--text-hero);
  line-height: 1.2;
  color: var(--color-ink);
  text-shadow: 0 2px 24px rgba(0,0,0,0.55);
}
.caption span {
  display: block; margin-top: var(--space-2xs);
  font-size: var(--text-sm); color: var(--color-muted);
  line-height: 1.45;
}
.dots { display: flex; justify-content: center; gap: var(--space-xs); padding: var(--space-sm) 0 0; }
.dots button { width: 0.45rem; height: 0.45rem; padding: 0; border: 0; border-radius: 99px; background: var(--color-rule); cursor: pointer; }
.dots button.is-on { background: var(--color-accent); width: 1.1rem; }

.band { padding-top: var(--space-xl); }
.band h2 { font-size: var(--text-xl); margin-bottom: var(--space-sm); max-width: 24ch; }
.band .lede { color: var(--color-muted); font-size: var(--text-sm); max-width: 40ch; margin-bottom: var(--space-md); }

.trust {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-sm);
  margin-top: var(--space-md);
}
.trust-card {
  padding: var(--space-md);
  border-radius: var(--radius);
  border: 1px solid var(--color-rule);
  background: linear-gradient(160deg, rgba(18,31,54,0.95), rgba(10,18,32,0.88));
  box-shadow: var(--glow);
}
.trust-card strong { display: block; font-size: 1rem; margin-bottom: var(--space-2xs); color: var(--color-ink); }
.trust-card p { font-size: var(--text-xs); color: var(--color-muted); line-height: 1.55; }

.pain-grid, .solve-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-sm);
}
.pain-card, .solve-card {
  padding: var(--space-md);
  border-radius: var(--radius);
  border: 1px solid var(--color-rule);
  background: var(--color-card);
}
.pain-card h3, .solve-card h3 { font-size: 1rem; margin-bottom: var(--space-2xs); }
.pain-card p, .solve-card p { font-size: var(--text-xs); color: var(--color-muted); line-height: 1.55; }
.solve-card { border-color: rgba(45, 212, 255, 0.28); background: linear-gradient(145deg, rgba(16,30,54,0.95), rgba(8,16,30,0.92)); }

.showcase { display: grid; gap: var(--space-xl); }
.subhead {
  font-size: var(--text-sm);
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: none;
  color: var(--color-gold);
  margin: 0 0 var(--space-sm);
}
.case-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-md);
}
.case-panel {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  border-radius: calc(var(--radius) + 2px);
  border: 1px solid rgba(45, 212, 255, 0.16);
  background: linear-gradient(168deg, rgba(16, 28, 50, 0.98) 0%, rgba(8, 14, 28, 0.94) 100%);
  overflow: hidden;
  box-shadow: var(--glow);
}
.case-panel .meta {
  padding: var(--space-md) var(--space-md) var(--space-sm);
  flex: 0 0 auto;
}
.case-panel .tag {
  display: inline-block;
  margin-bottom: var(--space-2xs);
  padding: 0.15rem 0.45rem;
  border-radius: 999px;
  border: 1px solid rgba(201, 169, 110, 0.35);
  color: var(--color-gold);
  font-size: 0.65rem;
  letter-spacing: 0.08em;
}
.case-panel h3 {
  font-size: 1.05rem;
  line-height: 1.3;
  color: var(--color-ink);
}
.case-panel .meta p {
  margin-top: var(--space-xs);
  font-size: var(--text-xs);
  color: var(--color-muted);
  line-height: 1.65;
}
.ui-shot {
  margin: 0 var(--space-md) var(--space-md);
  border-radius: 10px;
  overflow: hidden;
  background: #02060f;
  border: 1px solid rgba(45, 212, 255, 0.12);
  flex: 1 1 auto;
}
.ui-shot.mobile { aspect-ratio: 9 / 16; min-height: 14rem; }
.ui-shot.mobile img {
  width: 100%; height: 100%; object-fit: cover; object-position: top center;
}
.ui-shot.desktop { aspect-ratio: 16 / 10; min-height: 10rem; }
.ui-shot.desktop img {
  width: 100%; height: 100%; object-fit: cover; object-position: center;
}
.case-panel.copy {
  justify-content: center;
  padding: var(--space-lg) var(--space-md);
  min-height: 11rem;
  background: linear-gradient(155deg, rgba(12, 22, 40, 0.96), rgba(7, 13, 26, 0.98));
}
.case-panel.copy h3 { font-size: 1.1rem; margin-bottom: var(--space-sm); }
.case-panel.copy p { font-size: var(--text-sm); color: var(--color-muted); line-height: 1.7; }
.case-panel.copy .tag { margin-bottom: var(--space-sm); }

.office {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-sm);
}
.office figure {
  border-radius: var(--radius);
  overflow: hidden;
  border: 1px solid var(--color-rule);
  background: var(--color-paper-2);
}
.office img { aspect-ratio: 16 / 10; object-fit: cover; }
.office figcaption {
  padding: var(--space-sm) var(--space-md);
  font-size: var(--text-xs);
  color: var(--color-muted);
  border-top: 1px solid var(--color-rule);
}

.quote {
  margin-top: var(--space-xl);
  padding: var(--space-lg) var(--space-md);
  background: linear-gradient(160deg, rgba(18,31,54,0.96), rgba(7,13,26,0.98));
  border: 1px solid var(--color-rule);
  border-radius: var(--radius);
  text-align: center;
  box-shadow: var(--glow);
}
.quote h2 { margin-bottom: var(--space-md); }
.quote-box { display: grid; justify-items: center; gap: var(--space-sm); }
.qr {
  background: #fff;
  border: 1px solid var(--color-rule);
  padding: var(--space-2xs);
  border-radius: 8px;
}
.qr img { width: 5.75rem; height: 5.75rem; object-fit: contain; }
.tel { font-size: 1.15rem; font-weight: 600; color: var(--color-ink); white-space: nowrap; }
.mail { color: var(--color-muted); font-size: var(--text-sm); word-break: break-all; }
.addr, .foot-addr {
  color: var(--color-ink);
  font-size: clamp(0.72rem, 3.1vw, var(--text-sm));
  line-height: 1.6;
  max-width: none;
  white-space: nowrap;
}
.foot .foot-addr { color: var(--color-muted); }
.hint { color: var(--color-muted); font-size: var(--text-xs); }

.foot {
  margin-top: var(--space-lg); padding-top: var(--space-md);
  border-top: 1px solid var(--color-rule);
  text-align: center;
}
.foot .line { font-size: var(--text-xl); font-weight: 600; margin-bottom: var(--space-xs); }
.foot p, .foot a { color: var(--color-muted); font-size: var(--text-xs); line-height: 1.7; }
.foot a { white-space: nowrap; }

@media (pointer: coarse) { .btn { min-height: 3rem; } }
@media (hover: hover) and (pointer: fine) { .btn:hover { transform: translateY(-1px); } }

@media (min-width: 40rem) {
  .page { padding-left: var(--space-lg); padding-right: var(--space-lg); }
  .nav-links { display: flex; }
  .carousel { margin: 0; }
  .slide { border-radius: var(--radius); }
  .caption { left: var(--space-lg); bottom: var(--space-lg); right: auto; max-width: 26rem; }
  .trust { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .pain-grid, .solve-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .case-grid.cols-3 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .office { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (min-width: 56rem) {
  .trust { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .case-grid.cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (prefers-reduced-motion: reduce) {
  * { animation: none !important; transition: none !important; }
}
  </style>
</head>
<body>
  <div class="page">
    <header class="nav">
      <a class="brand" href="#top">企业系统外包</a>
      <ul class="nav-links">
        <li><a href="#trust">实力</a></li>
        <li><a href="#cases">案例</a></li>
        <li><a href="#office">团队</a></li>
      </ul>
      <a class="btn" href="#contact">获取报价</a>
    </header>

    <h1 class="sr-only">深圳企业信息系统外包：小程序、APP、商城、会员、CRM、后台定制开发</h1>

    <div class="carousel" id="carousel">
      <div class="viewport" id="viewport">
        <div class="track">
          <figure class="slide">
            <img src="{{b1}}" alt="中国程序员团队在深圳科技办公室协作开发" width="1080" height="608" fetchpriority="high" decoding="async" />
            <p class="caption"><strong>技术团队贴身交付</strong><span>需求、设计、开发、上线一条链，沟通不绕弯。</span></p>
          </figure>
          <figure class="slide">
            <img src="{{b2}}" alt="企业关注获客成本与增长数据" width="1080" height="608" loading="lazy" decoding="async" />
            <p class="caption"><strong>获客只见账单不见人</strong><span>用系统承接线索，让每一分投放可追溯。</span></p>
          </figure>
          <figure class="slide">
            <img src="{{b3}}" alt="小程序与后台系统协同开发" width="1080" height="608" loading="lazy" decoding="async" />
            <p class="caption"><strong>小程序到后台一体打通</strong><span>前台体验、中台运营、后台管理同步规划。</span></p>
          </figure>
        </div>
      </div>
      <div class="dots" id="dots" role="tablist" aria-label="Banner 切换"></div>
    </div>

    <section class="band" id="trust">
      <h2>诚信交付，专业落地</h2>
      <p class="lede">已服务 390+ 企业，落地上千个系统。合同签署、源码交付、文档交接，项目过程透明可查。</p>
      <div class="trust">
        <article class="trust-card">
          <strong>合同与源码保障</strong>
          <p>签约明确范围与工期，验收后交付完整源码与部署文档，知识产权归您所有。</p>
        </article>
        <article class="trust-card">
          <strong>390+ 企业验证</strong>
          <p>覆盖零售、餐饮、制造、服务业等多行业，从 MVP 到集团级系统均有落地经验。</p>
        </article>
        <article class="trust-card">
          <strong>全职研发团队</strong>
          <p>产品、UI、前后端、测试分工协作，支持驻场与远程并行，响应需求变更。</p>
        </article>
        <article class="trust-card">
          <strong>上线后持续服务</strong>
          <p>提供运维指导、功能迭代与培训支持，系统跟着业务一起长大。</p>
        </article>
      </div>
    </section>

    <section class="band">
      <h2>增长常卡在这四步</h2>
      <div class="pain-grid">
        <article class="pain-card">
          <h3>获客只见账单不见人</h3>
          <p>信息流、达人、地推预算花出去，线索质量参差不齐，ROI 算不清。</p>
        </article>
        <article class="pain-card">
          <h3>私域加完就沉没</h3>
          <p>企微好友堆满列表，没有标签分层，也没有自动化触达与裂变机制。</p>
        </article>
        <article class="pain-card">
          <h3>成交一次就流失</h3>
          <p>缺少会员、积分、卡券与复购提醒，老客户回不来，只能继续买量。</p>
        </article>
        <article class="pain-card">
          <h3>投放一停增长归零</h3>
          <p>没有小程序承接与传播钩子，广告关停后门店客流立刻下滑。</p>
        </article>
      </div>
    </section>

    <section class="band" id="systems">
      <h2>系统加玩法，一起做增长</h2>
      <div class="solve-grid">
        <article class="solve-card">
          <h3>小程序 + 抽奖裂变</h3>
          <p>留资、核销、助力抽奖同一入口，用转介绍摊薄获客成本。</p>
        </article>
        <article class="solve-card">
          <h3>私域 + 会员复购</h3>
          <p>社群接到会员系统，积分、卡券、复购包把一次成交做成回头客。</p>
        </article>
        <article class="solve-card">
          <h3>投放 + CRM 跟进</h3>
          <p>广告进落地页，线索进看板，跟进进度与转化漏斗实时可见。</p>
        </article>
        <article class="solve-card">
          <h3>APP + 渠道分销</h3>
          <p>订货、拜访、对账在业务员手机上完成，渠道销量按人按区汇总。</p>
        </article>
      </div>
    </section>

    <section class="band" id="cases">
      <h2>系统样本 · 所见即所得</h2>
      <p class="lede">以下为各行业定制系统的界面样本。命名以系统为单位，每一套均可按您的业务深度定制。</p>

      <div class="showcase">
        <div>
          <p class="subhead">移动系统</p>
          <div class="case-grid cols-3">
            <article class="case-panel">
              <div class="meta">
                <span class="tag">MOBILE</span>
                <h3>智慧零售会员系统</h3>
                <p>门店收银、线上商城与会员积分三端打通，一项权益全渠道通用，复购路径清晰可追踪。</p>
              </div>
              <div class="ui-shot mobile"><img src="{{app_retail}}" alt="智慧零售会员系统APP首页界面" loading="lazy" decoding="async" /></div>
            </article>
            <article class="case-panel">
              <div class="meta">
                <span class="tag">MOBILE</span>
                <h3>餐饮连锁运营系统</h3>
                <p>预订排队、会员卡与多店库存联动，高峰期翻台与备餐节奏有据可依。</p>
              </div>
              <div class="ui-shot mobile"><img src="{{app_rest}}" alt="餐饮连锁运营系统APP首页界面" loading="lazy" decoding="async" /></div>
            </article>
            <article class="case-panel">
              <div class="meta">
                <span class="tag">MOBILE</span>
                <h3>渠道分销订货系统</h3>
                <p>经销商手机端下单对账，总部实时掌握各区域出货、回款与库存水位。</p>
              </div>
              <div class="ui-shot mobile"><img src="{{app_channel}}" alt="渠道分销订货系统APP首页界面" loading="lazy" decoding="async" /></div>
            </article>
            <article class="case-panel">
              <div class="meta">
                <span class="tag">MOBILE</span>
                <h3>营销裂变增长系统</h3>
                <p>抽奖助力、分享海报与奖品核销形成闭环，让老客户持续带来新客。</p>
              </div>
              <div class="ui-shot mobile"><img src="{{app_mkt}}" alt="营销裂变增长系统APP首页界面" loading="lazy" decoding="async" /></div>
            </article>
            <article class="case-panel">
              <div class="meta">
                <span class="tag">MOBILE</span>
                <h3>医疗健康管理系统</h3>
                <p>预约挂号、报告查询与健康档案一屏触达，提升患者粘性与复诊率。</p>
              </div>
              <div class="ui-shot mobile"><img src="{{app_health}}" alt="医疗健康管理系统APP首页界面" loading="lazy" decoding="async" /></div>
            </article>
            <article class="case-panel">
              <div class="meta">
                <span class="tag">MOBILE</span>
                <h3>智慧物流调度系统</h3>
                <p>司机派单、路线优化与签收回传同步，配送状态全程可视、异常即时预警。</p>
              </div>
              <div class="ui-shot mobile"><img src="{{app_logistics}}" alt="智慧物流调度系统APP首页界面" loading="lazy" decoding="async" /></div>
            </article>
          </div>
        </div>

        <div>
          <p class="subhead">交付保障</p>
          <div class="case-grid cols-3">
            <article class="case-panel copy">
              <span class="tag">DELIVERY</span>
              <h3>源码交付 · 自主可控</h3>
              <p>验收后移交完整源码、接口文档与部署手册，支持二次开发与团队接手，知识产权归您所有。</p>
            </article>
            <article class="case-panel copy">
              <span class="tag">SECURITY</span>
              <h3>私有化 · 合规部署</h3>
              <p>可按企业要求选择云部署或私有化机房，数据归属清晰，满足行业审计与等保要求。</p>
            </article>
            <article class="case-panel copy">
              <span class="tag">SERVICE</span>
              <h3>上线陪跑 · 持续迭代</h3>
              <p>上线不是终点。版本升级、运营培训与故障响应全程跟进，系统跟着业务一起长大。</p>
            </article>
          </div>
        </div>

        <div>
          <p class="subhead">后台数据中台</p>
          <div class="case-grid cols-3">
            <article class="case-panel">
              <div class="meta">
                <span class="tag">DASHBOARD</span>
                <h3>企业经营指挥大屏</h3>
                <p>销售额、客流、区域热力与核心 KPI 一屏纵览，管理层例会可直接投屏决策。</p>
              </div>
              <div class="ui-shot desktop"><img src="{{dash_cmd}}" alt="企业经营指挥大屏数据看板" loading="lazy" decoding="async" /></div>
            </article>
            <article class="case-panel">
              <div class="meta">
                <span class="tag">DASHBOARD</span>
                <h3>CRM 销售跟进中台</h3>
                <p>线索池、商机阶段、跟进记录与成交漏斗完整打通，销售过程透明可复盘。</p>
              </div>
              <div class="ui-shot desktop"><img src="{{dash_crm}}" alt="CRM销售跟进中台界面" loading="lazy" decoding="async" /></div>
            </article>
            <article class="case-panel">
              <div class="meta">
                <span class="tag">DASHBOARD</span>
                <h3>商城运营数据中台</h3>
                <p>商品转化、活动 ROI、库存周转多维度下钻，运营动作有数据支撑。</p>
              </div>
              <div class="ui-shot desktop"><img src="{{dash_mall}}" alt="商城运营数据中台界面" loading="lazy" decoding="async" /></div>
            </article>
            <article class="case-panel">
              <div class="meta">
                <span class="tag">DASHBOARD</span>
                <h3>会员经营分析看板</h3>
                <p>RFM 分层、复购曲线与积分消耗全景呈现，精准识别高价值人群。</p>
              </div>
              <div class="ui-shot desktop"><img src="{{dash_member}}" alt="会员经营分析看板界面" loading="lazy" decoding="async" /></div>
            </article>
            <article class="case-panel">
              <div class="meta">
                <span class="tag">DASHBOARD</span>
                <h3>供应链进销存系统</h3>
                <p>采购、入库、出库、预警与供应商绩效一站管理，库存周转心中有数。</p>
              </div>
              <div class="ui-shot desktop"><img src="{{dash_supply}}" alt="供应链进销存系统后台界面" loading="lazy" decoding="async" /></div>
            </article>
            <article class="case-panel">
              <div class="meta">
                <span class="tag">DASHBOARD</span>
                <h3>财务对账结算系统</h3>
                <p>多渠道收款、分账退款与日报月报自动生成，财务核对省时省力。</p>
              </div>
              <div class="ui-shot desktop"><img src="{{dash_finance}}" alt="财务对账结算系统后台界面" loading="lazy" decoding="async" /></div>
            </article>
          </div>
        </div>
      </div>
    </section>

    <section class="band" id="office">
      <h2>团队与办公地址</h2>
      <p class="lede">深圳市龙岗区星河 COCO Park F 栋 2 楼 · 欢迎预约到访或远程沟通需求。</p>
      <div class="office">
        <figure>
          <img src="{{building}}" alt="星河COCO Park办公楼外景" loading="lazy" decoding="async" />
          <figcaption>星河 COCO Park F 栋 · 公司所在写字楼</figcaption>
        </figure>
        <figure>
          <img src="{{team}}" alt="程序员团队在办公室协作开发" loading="lazy" decoding="async" />
          <figcaption>产品研发团队 · 需求评审与联调交付</figcaption>
        </figure>
      </div>
    </section>

    <aside class="quote" id="contact">
      <h2>获取报价</h2>
      <div class="quote-box">
        <div class="qr"><img src="{{qr}}" alt="微信二维码" width="152" height="152" /></div>
        <a class="tel" href="tel:15918651523">15918651523</a>
        <a class="mail" href="mailto:zacforward@163.com">zacforward@163.com</a>
        <p class="addr">深圳市龙岗区星河 COCO Park F栋2楼</p>
        <p class="hint">扫码加微信，说清行业、功能与预算，24 小时内回复方案思路</p>
      </div>
    </aside>

    <footer class="foot">
      <p class="line">从获客到复购，系统接着做。</p>
      <p>小程序 · APP · 商城 · 会员 · CRM · 广告 · 后台</p>
      <p class="foot-addr">深圳市龙岗区星河 COCO Park F栋2楼</p>
      <p><a href="https://beian.miit.gov.cn/" rel="noopener noreferrer">粤ICP备2026098929号</a></p>
    </footer>
  </div>
  <script>
  (function () {
    var vp = document.getElementById('viewport');
    var dots = document.getElementById('dots');
    if (!vp || !dots) return;
    var n = vp.querySelectorAll('.slide').length;
    var i = 0, timer = null, reduce = false;
    try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
    function go(k) {
      i = (k + n) % n;
      var w = vp.clientWidth || 1;
      if (vp.scrollTo) vp.scrollTo({ left: i * w, behavior: reduce ? 'auto' : 'smooth' });
      else vp.scrollLeft = i * w;
      var btns = dots.querySelectorAll('button');
      for (var j = 0; j < btns.length; j++) btns[j].className = j === i ? 'is-on' : '';
    }
    function play() {
      if (reduce) return;
      stop();
      timer = setInterval(function () { go(i + 1); }, 3000);
    }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    for (var d = 0; d < n; d++) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', '第' + (d + 1) + '张');
      if (d === 0) b.className = 'is-on';
      b.onclick = (function (k) { return function () { go(k); play(); }; })(d);
      dots.appendChild(b);
    }
    vp.addEventListener('scroll', function () {
      var w = vp.clientWidth || 1;
      var next = Math.round(vp.scrollLeft / w);
      if (next !== i && next >= 0 && next < n) {
        i = next;
        var btns = dots.querySelectorAll('button');
        for (var j = 0; j < btns.length; j++) btns[j].className = j === i ? 'is-on' : '';
      }
    }, { passive: true });
    vp.addEventListener('touchstart', stop, { passive: true });
    vp.addEventListener('touchend', play, { passive: true });
    go(0);
    play();
  })();
  </script>
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"ProfessionalService","name":"企业信息系统外包","telephone":"+86-15918651523","email":"zacforward@163.com","address":{"@type":"PostalAddress","streetAddress":"星河COCO Park F栋2楼","addressLocality":"深圳市龙岗区","addressRegion":"广东省","addressCountry":"CN"},"areaServed":"CN","serviceType":["微信小程序开发","APP开发","商城系统","会员系统","CRM系统","广告系统","后台管理系统"]}
  </script>
</body>
</html>
'''

for key, val in imgs.items():
    html = html.replace("{{" + key + "}}", val)

OUT.write_text(html)
PUBLIC.write_text(html)
print("wrote", OUT, "bytes", OUT.stat().st_size)
print("copied to", PUBLIC)
for k, v in imgs.items():
    print(k, len(v))
