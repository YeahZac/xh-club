(() => {
  const D = window.DEMO;
  const $ = (s, el = document) => el.querySelector(s);
  const view = $("#view");
  const tabs = $("#tabs");
  const cartDot = $("#cartDot");
  const toastEl = $("#toast");

  const store = {
    get(k, d) {
      try {
        const v = localStorage.getItem(k);
        return v == null ? d : JSON.parse(v);
      } catch {
        return d;
      }
    },
    set(k, v) {
      localStorage.setItem(k, JSON.stringify(v));
    },
  };

  let cart = store.get("rolu_cart", []);
  let orders = store.get("rolu_orders", []);
  let member = store.get("rolu_member", null);
  let route = parseHash();

  function parseHash() {
    const h = (location.hash || "#/home").replace(/^#/, "");
    const parts = h.split("/").filter(Boolean);
    return { page: parts[0] || "home", id: parts[1] || "", extra: parts[2] || "" };
  }

  function go(path) {
    location.hash = path.startsWith("#") ? path : `#${path}`;
  }

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toastEl.classList.remove("show"), 1800);
  }

  function money(n) {
    return `¥${Number(n).toFixed(n % 1 ? 1 : 0)}`;
  }

  function saveCart() {
    store.set("rolu_cart", cart);
    updateCartDot();
  }

  function updateCartDot() {
    const n = cart.reduce((s, i) => s + (i.qty || 1), 0);
    if (n > 0) {
      cartDot.hidden = false;
      cartDot.textContent = n > 99 ? "99+" : String(n);
    } else {
      cartDot.hidden = true;
    }
  }

  function addCart(item) {
    const key = `${item.type}:${item.id}:${item.skuId || ""}:${item.date || ""}`;
    const hit = cart.find((c) => c.key === key);
    if (hit) hit.qty += item.qty || 1;
    else cart.push({ ...item, key, qty: item.qty || 1 });
    saveCart();
    toast("已加入购物车");
  }

  function cartTotal() {
    return cart.reduce((s, i) => s + i.price * i.qty, 0);
  }

  function setTab(name) {
    tabs.querySelectorAll(".tab").forEach((t) => {
      t.classList.toggle("on", t.dataset.tab === name);
    });
    // 仅五大主 Tab 显示底栏；首页模块进入的二级页（list/详情/结算等）一律隐藏
    const rootTabs = new Set(["home", "packages", "member", "cart", "mine"]);
    const show = rootTabs.has(route.page);
    tabs.style.display = show ? "grid" : "none";
    document.body.classList.toggle("hide-tabs", !show);
  }

  function shell(title, body, opts = {}) {
    const back = opts.back !== false;
    return `
      <header class="top">
        ${back ? `<button class="back" data-back>‹</button>` : `<span style="width:36px"></span>`}
        <h1>${title}</h1>
        <span style="width:36px"></span>
      </header>
      <main class="page">${body}</main>
    `;
  }

  function stars(n) {
    const full = Math.floor(n);
    return "★".repeat(full) + (n % 1 >= 0.5 ? "☆" : "") + ` ${n}`;
  }

  /* ---------- pages ---------- */

  function pageHome() {
    const banners = D.banners || [];
    const scenics = D.scenics || [];
    const events = D.events || [];
    const pkgs = D.packages || [];
    setTab("home");
    view.innerHTML = `
      <div class="hero">
        <div class="brand-row">
          <div class="logo">袍</div>
          <div>
            <div class="name">袍旅 · 文旅票务</div>
            <div class="sub">景区 · 活动 · 同袍会 · 套票 · Demo</div>
          </div>
        </div>
        <div class="search" data-go="#/packages">搜景区 / 活动 / 套票</div>
      </div>
      <div class="page" style="padding-top:0;margin-top:-8px">
        <div class="banner-wrap">
          ${(banners[0] && `<img class="banner" src="${banners[0].img}" alt="" />`) || ""}
        </div>
        <div class="cats">
          <button class="cat" data-go="#/list/scenic"><div class="ic">🏔</div>景区门票</button>
          <button class="cat" data-go="#/list/event"><div class="ic">🎎</div>汉服活动</button>
          <button class="cat" data-go="#/list/packages"><div class="ic">🎁</div>超值套票</button>
          <button class="cat" data-go="#/list/member"><div class="ic">🏅</div>同袍会</button>
        </div>
        <div class="sec-h"><h2>热门景区</h2><a data-go="#/list/scenic">全部</a></div>
        <div class="grid">
          ${scenics
            .slice(0, 4)
            .map(
              (s) => `
            <a class="card" data-go="#/scenic/${s.id}">
              <img src="${s.cover}" alt="" />
              <div class="body">
                <div class="t">${s.name}</div>
                <div class="m">${s.area} · ${stars(s.score)}</div>
                <div class="price"><b>${money(s.priceFrom)}</b><span>起</span></div>
              </div>
            </a>`
            )
            .join("")}
        </div>
        <div class="sec-h"><h2>近期活动</h2><a data-go="#/list/event">全部</a></div>
        ${events
          .slice(0, 3)
          .map(
            (e) => `
          <a class="list-item" data-go="#/event/${e.id}">
            <img src="${e.cover}" alt="" />
            <div class="info">
              <div class="t">${e.name}</div>
              <div class="m">${e.date} · ${e.venue}</div>
              <div class="price"><b>${money(e.priceFrom)}</b><span>起</span></div>
            </div>
          </a>`
          )
          .join("")}
        <div class="sec-h"><h2>套票精选</h2><a data-go="#/packages">更多</a></div>
        ${pkgs
          .slice(0, 2)
          .map(
            (p) => `
          <a class="list-item" data-go="#/pkg/${p.id}">
            <img src="${p.cover}" alt="" />
            <div class="info">
              <div class="t">${p.name}</div>
              <div class="m">${p.desc}</div>
              <div class="price"><b>${money(p.price)}</b><span class="old">${money(p.origin)}</span></div>
            </div>
          </a>`
          )
          .join("")}
        <p class="hint">本页为产品原型 Demo，支付为模拟流程，不产生真实扣款。</p>
      </div>
    `;
  }

  function pageList(kind) {
    if (kind === "packages") return pagePackages({ secondary: true });
    if (kind === "member") return pageMember({ secondary: true });
    setTab("home");
    const title = kind === "event" ? "汉服活动" : "景区门票";
    const items = kind === "event" ? D.events : D.scenics;
    const path = kind === "event" ? "event" : "scenic";
    view.innerHTML = shell(
      title,
      items
        .map(
          (s) => `
        <a class="list-item" data-go="#/${path}/${s.id}">
          <img src="${s.cover}" alt="" />
          <div class="info">
            <div class="t">${s.name}</div>
            <div class="m">${s.area || s.venue || ""} · ${s.date || stars(s.score || 4.8)}</div>
            <div class="price"><b>${money(s.priceFrom)}</b><span>起</span></div>
          </div>
        </a>`
        )
        .join("")
    );
  }

  function pageScenic(id) {
    const s = D.scenics.find((x) => x.id === id);
    if (!s) return go("#/home");
    setTab("scenic");
    let skuId = s.tickets[0]?.id;
    let date = s.dates?.[0] || "";
    view.innerHTML = shell(
      s.name,
      `
      <img class="cover-lg" src="${s.cover}" alt="" />
      <div class="panel">
        <div class="title-lg">${s.name}</div>
        <div class="meta">${s.area} · ${stars(s.score)} · ${s.openTime || ""}</div>
        <p class="desc">${s.desc || ""}</p>
      </div>
      <div class="panel">
        <div class="label">选择日期</div>
        <div class="chips" id="dates">
          ${(s.dates || [])
            .map((d, i) => `<button class="chip ${i === 0 ? "on" : ""}" data-date="${d}">${d.slice(5)}</button>`)
            .join("")}
        </div>
        <div class="label" style="margin-top:12px">门票类型</div>
        <div class="skus" id="skus">
          ${s.tickets
            .map(
              (t, i) => `
            <button class="sku ${i === 0 ? "on" : ""}" data-sku="${t.id}">
              <div>
                <div class="n">${t.name}</div>
                <div class="d">${t.desc || ""}</div>
              </div>
              <div class="p">${money(t.price)}</div>
            </button>`
            )
            .join("")}
        </div>
      </div>
      <div class="buybar">
        <div class="sum" id="sum">${money(s.tickets[0]?.price || 0)}</div>
        <button class="btn ghost" id="add">加入购物车</button>
        <button class="btn primary" id="buy">立即购买</button>
      </div>
    `
    );

    const refresh = () => {
      const t = s.tickets.find((x) => x.id === skuId);
      $("#sum").textContent = money(t?.price || 0);
    };

    view.onclick = (e) => {
      const chip = e.target.closest("[data-date]");
      if (chip) {
        date = chip.dataset.date;
        view.querySelectorAll("[data-date]").forEach((c) => c.classList.toggle("on", c === chip));
      }
      const sku = e.target.closest("[data-sku]");
      if (sku) {
        skuId = sku.dataset.sku;
        view.querySelectorAll("[data-sku]").forEach((c) => c.classList.toggle("on", c === sku));
        refresh();
      }
      if (e.target.id === "add" || e.target.id === "buy") {
        const t = s.tickets.find((x) => x.id === skuId);
        const item = {
          type: "scenic",
          id: s.id,
          skuId: t.id,
          title: `${s.name} · ${t.name}`,
          date,
          price: t.price,
          cover: s.cover,
          qty: 1,
        };
        if (e.target.id === "add") addCart(item);
        else {
          store.set("rolu_checkout", [item]);
          go("#/checkout");
        }
      }
    };
  }

  function pageEvent(id) {
    const e = D.events.find((x) => x.id === id);
    if (!e) return go("#/home");
    setTab("event");
    let skuId = e.tickets[0]?.id;
    view.innerHTML = shell(
      "活动详情",
      `
      <img class="cover-lg" src="${e.cover}" alt="" />
      <div class="panel">
        <div class="title-lg">${e.name}</div>
        <div class="meta">${e.date} · ${e.venue}</div>
        <p class="desc">${e.desc || ""}</p>
      </div>
      <div class="panel">
        <div class="label">票档</div>
        <div class="skus" id="skus">
          ${e.tickets
            .map(
              (t, i) => `
            <button class="sku ${i === 0 ? "on" : ""}" data-sku="${t.id}">
              <div>
                <div class="n">${t.name}</div>
                <div class="d">${t.desc || ""}</div>
              </div>
              <div class="p">${money(t.price)}</div>
            </button>`
            )
            .join("")}
        </div>
      </div>
      <div class="buybar">
        <div class="sum" id="sum">${money(e.tickets[0]?.price || 0)}</div>
        <button class="btn ghost" id="add">加入购物车</button>
        <button class="btn primary" id="buy">立即购买</button>
      </div>
    `
    );
    view.onclick = (ev) => {
      const sku = ev.target.closest("[data-sku]");
      if (sku) {
        skuId = sku.dataset.sku;
        view.querySelectorAll("[data-sku]").forEach((c) => c.classList.toggle("on", c === sku));
        const t = e.tickets.find((x) => x.id === skuId);
        $("#sum").textContent = money(t?.price || 0);
      }
      if (ev.target.id === "add" || ev.target.id === "buy") {
        const t = e.tickets.find((x) => x.id === skuId);
        const item = {
          type: "event",
          id: e.id,
          skuId: t.id,
          title: `${e.name} · ${t.name}`,
          date: e.date,
          price: t.price,
          cover: e.cover,
          qty: 1,
        };
        if (ev.target.id === "add") addCart(item);
        else {
          store.set("rolu_checkout", [item]);
          go("#/checkout");
        }
      }
    };
  }

  function pagePackages(opts = {}) {
    const secondary = !!opts.secondary;
    setTab("packages");
    view.innerHTML = shell(
      "超值套票",
      (D.packages || [])
        .map(
          (p) => `
        <a class="pkg-card" data-go="#/pkg/${p.id}">
          <img src="${p.cover}" alt="" />
          <div class="body">
            <div class="badge">省 ${money(p.origin - p.price)}</div>
            <div class="t">${p.name}</div>
            <div class="m">${p.desc}</div>
            <div class="includes">${(p.includes || []).map((x) => `<span>· ${x}</span>`).join("")}</div>
            <div class="price"><b>${money(p.price)}</b><span class="old">${money(p.origin)}</span></div>
          </div>
        </a>`
        )
        .join("") + '<p class="hint">套票可一次结算，模拟组合优惠。</p>',
      { back: secondary }
    );
  }

  function pagePkg(id) {
    const p = D.packages.find((x) => x.id === id);
    if (!p) return go("#/packages");
    setTab("pkg");
    view.innerHTML = shell(
      "套票详情",
      `
      <img class="cover-lg" src="${p.cover}" alt="" />
      <div class="panel">
        <div class="title-lg">${p.name}</div>
        <p class="desc">${p.desc}</p>
        <div class="label">包含内容</div>
        <ul class="ul">${(p.includes || []).map((x) => `<li>${x}</li>`).join("")}</ul>
        <div class="price-row">
          <b>${money(p.price)}</b>
          <span class="old">${money(p.origin)}</span>
          <span class="save">立省 ${money(p.origin - p.price)}</span>
        </div>
      </div>
      <div class="buybar">
        <div class="sum">${money(p.price)}</div>
        <button class="btn ghost" id="add">加入购物车</button>
        <button class="btn primary" id="buy">立即购买</button>
      </div>
    `
    );
    view.onclick = (e) => {
      if (e.target.id !== "add" && e.target.id !== "buy") return;
      const item = {
        type: "package",
        id: p.id,
        skuId: p.id,
        title: p.name,
        date: "",
        price: p.price,
        cover: p.cover,
        qty: 1,
      };
      if (e.target.id === "add") addCart(item);
      else {
        store.set("rolu_checkout", [item]);
        go("#/checkout");
      }
    };
  }

  function pageMember(opts = {}) {
    const secondary = !!opts.secondary;
    setTab("member");
    const tiers = D.membership?.tiers || [];
    const badges = D.membership?.badges || [];
    let tierId = member?.tierId || tiers[0]?.id;
    let badgeIds = new Set(member?.badgeIds || []);
    const calc = () => {
      const t = tiers.find((x) => x.id === tierId);
      let sum = t?.price || 0;
      badges.forEach((b) => {
        if (badgeIds.has(b.id)) sum += b.price;
      });
      return { t, sum };
    };

    const render = () => {
      const { t, sum } = calc();
      const body = `
        <div class="hero member-tab-hero">
          <div class="brand-row">
            <div class="logo">袍</div>
            <div>
              <div class="name">同袍会</div>
              <div class="sub">会员档位 · 徽章加购 · 权益叠加</div>
            </div>
          </div>
          ${
            member
              ? `<div class="mh-status" style="margin-top:12px">已开通：${member.tierName}${
                  member.badgeNames?.length ? " · " + member.badgeNames.join("、") : ""
                }</div>`
              : ""
          }
        </div>
        <div class="page" style="padding-top:0;margin-top:-8px">
          <div class="panel" style="margin-left:0;margin-right:0">
            <div class="label">选择会员档位</div>
            <div class="skus">
              ${tiers
                .map(
                  (x) => `
                <button class="sku ${x.id === tierId ? "on" : ""}" data-tier="${x.id}">
                  <div>
                    <div class="n">${x.name}</div>
                    <div class="d">${(x.perks || []).slice(0, 2).join(" · ")}</div>
                  </div>
                  <div class="p">${money(x.price)}</div>
                </button>`
                )
                .join("")}
            </div>
          </div>
          <div class="panel" style="margin-left:0;margin-right:0">
            <div class="label">同袍会徽章（本页直接加购）</div>
            <div class="badge-grid">
              ${badges
                .map(
                  (b) => `
                <button class="badge-item ${badgeIds.has(b.id) ? "on" : ""}" data-badge="${b.id}">
                  <div class="emoji">${b.icon || "🏅"}</div>
                  <div class="n">${b.name}</div>
                  <div class="p">+${money(b.price)}</div>
                </button>`
                )
                .join("")}
            </div>
          </div>
          <div class="panel" style="margin-left:0;margin-right:0">
            <div class="label">当前档位权益</div>
            <ul class="ul">${(t?.perks || []).map((x) => `<li>${x}</li>`).join("")}</ul>
          </div>
          <p class="hint">在本页完成档位与徽章选择，无需进入二级页。</p>
        </div>
        <div class="buybar${secondary ? "" : " above-tabs"}">
          <div class="sum">${money(sum)}</div>
          <button class="btn primary" id="buyMem" style="flex:1">确认开通 / 升级</button>
        </div>
      `;
      view.innerHTML = secondary ? shell("同袍会", body) : body;
      if (secondary) {
        view.querySelector("[data-back]")?.addEventListener("click", () => history.back());
      }
    };

    render();
    view.onclick = (e) => {
      if (e.target.closest("[data-back]")) {
        history.back();
        return;
      }
      const tier = e.target.closest("[data-tier]");
      if (tier) {
        tierId = tier.dataset.tier;
        render();
        return;
      }
      const badge = e.target.closest("[data-badge]");
      if (badge) {
        const id = badge.dataset.badge;
        if (badgeIds.has(id)) badgeIds.delete(id);
        else badgeIds.add(id);
        render();
        return;
      }
      if (e.target.id === "buyMem") {
        const { t, sum } = calc();
        const selectedBadges = badges.filter((b) => badgeIds.has(b.id));
        const item = {
          type: "member",
          id: "member",
          skuId: tierId,
          title: `同袍会 · ${t.name}${selectedBadges.length ? " +徽章" : ""}`,
          date: "",
          price: sum,
          cover: D.membership?.cover || (D.banners?.[0]?.img || ""),
          qty: 1,
          meta: {
            tierId,
            tierName: t.name,
            badgeIds: [...badgeIds],
            badgeNames: selectedBadges.map((b) => b.name),
          },
        };
        store.set("rolu_checkout", [item]);
        go("#/checkout");
      }
    };
  }

  function pageCart() {
    setTab("cart");
    if (!cart.length) {
      view.innerHTML = shell(
        "购物车",
        `<div class="empty">购物车是空的<br/><button class="btn primary" data-go="#/home" style="margin-top:16px">去逛逛</button></div>`,
        { back: false }
      );
      return;
    }
    view.innerHTML = shell(
      "购物车",
      `
      ${cart
        .map(
          (c, i) => `
        <div class="cart-row">
          <img src="${c.cover}" alt="" />
          <div class="info">
            <div class="t">${c.title}</div>
            <div class="m">${c.date || "随时可用"}</div>
            <div class="row">
              <b>${money(c.price)}</b>
              <div class="qty">
                <button data-qty="${i}:-">−</button>
                <span>${c.qty}</span>
                <button data-qty="${i}:+">+</button>
              </div>
            </div>
          </div>
          <button class="del" data-del="${i}">删除</button>
        </div>`
        )
        .join("")}
      <div class="buybar above-tabs">
        <div class="sum">合计 ${money(cartTotal())}</div>
        <button class="btn primary" id="checkout" style="flex:1">去结算 (${cart.reduce((s, i) => s + i.qty, 0)})</button>
      </div>
    `,
      { back: false }
    );
    view.onclick = (e) => {
      const q = e.target.closest("[data-qty]");
      if (q) {
        const [i, op] = q.dataset.qty.split(":");
        const idx = +i;
        if (op === "+") cart[idx].qty++;
        else cart[idx].qty = Math.max(1, cart[idx].qty - 1);
        saveCart();
        pageCart();
      }
      const d = e.target.closest("[data-del]");
      if (d) {
        cart.splice(+d.dataset.del, 1);
        saveCart();
        pageCart();
      }
      if (e.target.id === "checkout") {
        store.set(
          "rolu_checkout",
          cart.map((c) => ({ ...c }))
        );
        go("#/checkout");
      }
    };
  }

  function pageCheckout() {
    setTab("checkout");
    const items = store.get("rolu_checkout", []);
    if (!items.length) return go("#/cart");
    const total = items.reduce((s, i) => s + i.price * i.qty, 0);
    view.innerHTML = shell(
      "确认订单",
      `
      <div class="panel">
        <div class="label">出行人 / 联系人（模拟）</div>
        <input class="input" id="name" placeholder="姓名" value="陈柏焱" />
        <input class="input" id="phone" placeholder="手机号" value="15918651523" style="margin-top:8px" />
      </div>
      <div class="panel">
        <div class="label">商品明细</div>
        ${items
          .map(
            (c) => `
          <div class="order-line">
            <div>
              <div class="t">${c.title}</div>
              <div class="m">x${c.qty} ${c.date ? "· " + c.date : ""}</div>
            </div>
            <b>${money(c.price * c.qty)}</b>
          </div>`
          )
          .join("")}
      </div>
      <div class="panel">
        <div class="label">支付方式（模拟）</div>
        <label class="pay-opt"><input type="radio" name="pay" value="wechat" checked /> 微信支付</label>
        <label class="pay-opt"><input type="radio" name="pay" value="alipay" /> 支付宝</label>
        <label class="pay-opt"><input type="radio" name="pay" value="union" /> 云闪付</label>
      </div>
      <div class="buybar">
        <div class="sum">应付 ${money(total)}</div>
        <button class="btn primary" id="toPay" style="flex:1">提交订单</button>
      </div>
    `
    );
    view.onclick = (e) => {
      if (e.target.id !== "toPay") return;
      const name = $("#name").value.trim() || "游客";
      const phone = $("#phone").value.trim();
      const pay = view.querySelector('input[name="pay"]:checked')?.value || "wechat";
      const order = {
        id: "R" + Date.now().toString().slice(-10),
        items,
        total,
        name,
        phone,
        pay,
        status: "pending",
        createdAt: new Date().toISOString(),
      };
      store.set("rolu_pending", order);
      go("#/pay");
    };
  }

  function pagePay() {
    setTab("pay");
    const order = store.get("rolu_pending", null);
    if (!order) return go("#/home");
    const payName = { wechat: "微信支付", alipay: "支付宝", union: "云闪付" }[order.pay] || "微信支付";
    view.innerHTML = shell(
      "模拟支付",
      `
      <div class="pay-card">
        <div class="pay-logo">${order.pay === "alipay" ? "支" : order.pay === "union" ? "云" : "微"}</div>
        <div class="pay-name">${payName}</div>
        <div class="pay-amount">${money(order.total)}</div>
        <div class="pay-oid">订单号 ${order.id}</div>
        <button class="btn primary" id="payOk" style="width:100%;margin-top:20px">确认支付</button>
        <button class="btn ghost" id="payCancel" style="width:100%;margin-top:10px">取消支付</button>
        <p class="hint">演示环境：点击确认即可完成，不会真实扣款。</p>
      </div>
    `
    );
    view.onclick = (e) => {
      if (e.target.id === "payCancel") {
        toast("已取消支付");
        go("#/orders");
        return;
      }
      if (e.target.id !== "payOk") return;
      order.status = "paid";
      order.paidAt = new Date().toISOString();
      orders.unshift(order);
      store.set("rolu_orders", orders);
      store.set("rolu_pending", null);
      // clear purchased from cart
      const keys = new Set(order.items.map((i) => i.key).filter(Boolean));
      if (keys.size) {
        cart = cart.filter((c) => !keys.has(c.key));
        saveCart();
      }
      // buy-now does not clear unrelated cart items
      const memItem = order.items.find((i) => i.type === "member");
      if (memItem?.meta) {
        member = {
          tierId: memItem.meta.tierId,
          tierName: memItem.meta.tierName,
          badgeIds: memItem.meta.badgeIds,
          badgeNames: memItem.meta.badgeNames,
          since: order.paidAt,
        };
        store.set("rolu_member", member);
      }
      go(`#/order/${order.id}`);
      toast("支付成功");
    };
  }

  function pageOrders() {
    setTab("mine");
    view.innerHTML = shell(
      "我的订单",
      orders.length
        ? orders
            .map(
              (o) => `
          <a class="order-card" data-go="#/order/${o.id}">
            <div class="row">
              <span>${o.id}</span>
              <span class="st ${o.status}">${o.status === "paid" ? "已支付" : "待支付"}</span>
            </div>
            <div class="t">${o.items.map((i) => i.title).join("、")}</div>
            <div class="row"><span>${(o.createdAt || "").slice(0, 16).replace("T", " ")}</span><b>${money(o.total)}</b></div>
          </a>`
            )
            .join("")
        : `<div class="empty">暂无订单</div>`
    );
  }

  function pageOrder(id) {
    setTab("order");
    const o = orders.find((x) => x.id === id) || store.get("rolu_pending", null);
    if (!o || (o.id !== id && o.status === "pending")) {
      const pending = store.get("rolu_pending", null);
      if (pending?.id === id) {
        go("#/pay");
        return;
      }
    }
    const order = orders.find((x) => x.id === id);
    if (!order) return go("#/orders");
    view.innerHTML = shell(
      "订单详情",
      `
      <div class="success-banner ${order.status === "paid" ? "ok" : ""}">
        ${order.status === "paid" ? "支付成功" : "待支付"}
      </div>
      <div class="panel">
        <div class="label">订单号 ${order.id}</div>
        ${order.items
          .map(
            (c) => `
          <div class="order-line">
            <div>
              <div class="t">${c.title}</div>
              <div class="m">x${c.qty} ${c.date ? "· " + c.date : ""}</div>
            </div>
            <b>${money(c.price * c.qty)}</b>
          </div>`
          )
          .join("")}
        <div class="order-line total"><span>实付</span><b>${money(order.total)}</b></div>
      </div>
      <div class="panel">
        <div class="m">联系人 ${order.name} ${order.phone || ""}</div>
        <div class="m">支付方式 ${
          { wechat: "微信", alipay: "支付宝", union: "云闪付" }[order.pay] || ""
        }</div>
      </div>
      <div class="panel" style="text-align:center">
        <div class="qr-fake">电子票 / 核销码<br/><span style="font-size:28px;letter-spacing:4px">${order.id.slice(-8)}</span></div>
        <p class="hint">入园出示此码（演示）</p>
      </div>
      <button class="btn primary" data-go="#/home" style="width:100%;margin:12px 0 24px">返回首页</button>
    `
    );
  }

  function pageMine() {
    setTab("mine");
    view.innerHTML = shell(
      "我的",
      `
      <div class="mine-head">
        <div class="avatar">袍</div>
        <div>
          <div class="n">袍旅体验用户</div>
          <div class="m">${member ? `同袍会 · ${member.tierName}` : "尚未开通同袍会"}</div>
        </div>
      </div>
      <div class="menu">
        <a data-go="#/orders">我的订单</a>
        <a data-go="#/member">同袍会会员 / 徽章</a>
        <a data-go="#/cart">购物车</a>
        <a id="clearDemo">清除本地演示数据</a>
      </div>
      <p class="hint">产品原型 Demo · 可手机浏览器打开 · 数据仅存本机</p>
    `,
      { back: false }
    );
    $("#clearDemo")?.addEventListener("click", () => {
      if (!confirm("清除购物车、订单与会员状态？")) return;
      cart = [];
      orders = [];
      member = null;
      saveCart();
      store.set("rolu_orders", []);
      store.set("rolu_member", null);
      store.set("rolu_checkout", []);
      store.set("rolu_pending", null);
      toast("已清除");
      pageMine();
    });
  }

  function render() {
    route = parseHash();
    view.onclick = null;
    const { page, id, extra } = route;
    if (page === "home") pageHome();
    else if (page === "list") pageList(id || "scenic");
    else if (page === "scenic") pageScenic(id);
    else if (page === "event") pageEvent(id);
    else if (page === "packages") pagePackages();
    else if (page === "pkg") pagePkg(id);
    else if (page === "member") pageMember();
    else if (page === "cart") pageCart();
    else if (page === "checkout") pageCheckout();
    else if (page === "pay") pagePay();
    else if (page === "orders") pageOrders();
    else if (page === "order") pageOrder(id);
    else if (page === "mine") pageMine();
    else pageHome();

    // bind navigation
    document.querySelectorAll("[data-go]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        go(el.getAttribute("data-go"));
      });
    });
    document.querySelectorAll("[data-back]").forEach((el) => {
      el.addEventListener("click", () => history.back());
    });
  }

  tabs.addEventListener("click", (e) => {
    const t = e.target.closest(".tab");
    if (!t) return;
    const map = {
      home: "#/home",
      packages: "#/packages",
      member: "#/member",
      cart: "#/cart",
      mine: "#/mine",
    };
    go(map[t.dataset.tab] || "#/home");
  });

  window.addEventListener("hashchange", render);
  updateCartDot();
  if (!location.hash) location.hash = "#/home";
  else render();
})();
