const money = (value) => value || "Liên hệ";

let currentSite = null;
let activeFilter = "all";
let searchTerm = "";

async function loadSite() {
  const site = await loadSiteData();
  currentSite = site;
  document.title = `${site.brand.name || "DHS MEDIA"} - Kho tool reup video`;
  byId("brandName").textContent = site.brand.name || "DHS MEDIA";
  byId("brandLogo").textContent = site.brand.logoText || "DM";
  byId("heroEyebrow").textContent = site.hero.eyebrow || "";
  byId("heroTitle").textContent = site.hero.title || "";
  byId("heroDescription").textContent = site.hero.description || "";
  byId("heroImage").src = site.hero.image || "/assets/app-preview.svg";

  byId("stats").innerHTML = (site.stats || []).map((item) => `
    <article class="stat"><strong>${escapeHtml(item.value)}</strong><span>${escapeHtml(item.label)}</span></article>
  `).join("");

  renderProducts();
  renderVideoProducts(site);
  renderWorkflowProducts(site);
  renderDemos(site);
  renderFaq(site);
  renderContact(site);
  applyInitialView();
}

function renderProducts() {
  const apps = currentSite?.apps || [];
  const filtered = apps.filter((app) => {
    const haystack = normalizeText(`${app.name} ${app.tagline} ${app.description} ${(app.features || []).join(" ")}`);
    const status = normalizeText(app.status || "");
    const matchesSearch = !searchTerm || haystack.includes(searchTerm);
    const matchesFilter = activeFilter === "all"
      || (activeFilter === "ready" && status.includes("dang"))
      || (activeFilter === "soon" && (status.includes("sap") || status.includes("phat trien")));
    return matchesSearch && matchesFilter;
  });

  byId("featuredGrid").innerHTML = apps.slice(0, 3).map(productCard).join("");
  byId("appGrid").innerHTML = filtered.map(productCard).join("") || `
    <div class="empty-state">Không tìm thấy sản phẩm phù hợp.</div>
  `;

  document.querySelectorAll(".buy-btn").forEach((button) => {
    button.addEventListener("click", () => openBuyModal(apps[Number(button.dataset.index)]));
  });
}

function renderVideoProducts(site) {
  const products = site.videoProducts || [];
  byId("videoProductGrid").innerHTML = products.map((item, index) => `
    <article class="video-product-card">
      <button class="video-thumb-button" data-video-index="${index}" data-preview-index="${index}" type="button" aria-label="Xem ${escapeAttr(item.title)}">
        <img src="${escapeAttr(item.thumbnail || "/assets/app-preview.svg")}" alt="${escapeAttr(item.title)}">
        <span class="play-mark">▶</span>
        <span class="sale-badge">${escapeHtml(item.category || "Prompt AI")}</span>
      </button>
      <div class="product-body">
        <div class="product-tags">
          <span>${escapeHtml(item.status || "Đang bán")}</span>
          <span>${escapeHtml(item.format || "Video + Prompt")}</span>
        </div>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.description)}</p>
        <div class="product-price">
          <strong>${escapeHtml(item.price || "Liên hệ")}</strong>
          <span>${escapeHtml(item.license || "Bản quyền sử dụng")}</span>
        </div>
        <div class="card-actions">
          <button class="btn primary buy-video-btn" data-video-index="${index}" type="button">Mua prompt</button>
          <button class="btn ghost" data-video-index="${index}" type="button">Xem video</button>
        </div>
      </div>
    </article>
  `).join("") || `<div class="empty-state">Chưa có sản phẩm video AI/prompt.</div>`;

  document.querySelectorAll("[data-video-index]").forEach((button) => {
    button.addEventListener("click", () => openVideoModal(products[Number(button.dataset.videoIndex)]));
  });
  document.querySelectorAll("[data-preview-index]").forEach((button) => {
    let timer = null;
    const item = products[Number(button.dataset.previewIndex)];
    button.addEventListener("mouseenter", () => {
      timer = window.setTimeout(() => showHoverPreview(button, item), 160);
    });
    button.addEventListener("mouseleave", () => {
      window.clearTimeout(timer);
      hideHoverPreview(button);
    });
    button.addEventListener("focus", () => showHoverPreview(button, item));
    button.addEventListener("blur", () => hideHoverPreview(button));
  });
}

function renderWorkflowProducts(site) {
  byId("workflowProductGrid").innerHTML = (site.workflows || []).map((item) => `
    <article class="workflow-product-card">
      <img src="${escapeAttr(item.cover || "/assets/app-preview.svg")}" alt="${escapeAttr(item.title)}">
      <div>
        <div class="product-tags">
          <span>${escapeHtml(item.level || "Cơ bản")}</span>
          <span>${escapeHtml(item.duration || "Theo nhu cầu")}</span>
        </div>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.description)}</p>
        <div class="product-price">
          <strong>${escapeHtml(item.price || "Liên hệ")}</strong>
          <span>Workflow</span>
        </div>
      </div>
    </article>
  `).join("") || `<div class="empty-state">Chưa có workflow riêng.</div>`;
}

function productCard(app) {
  const apps = currentSite?.apps || [];
  const index = apps.indexOf(app);
  const firstPlan = (app.prices || [])[0];
  const price = firstPlan?.price || app.priceFrom || "Liên hệ";
  const plan = firstPlan?.name || "Giá từ";
  const status = app.status || "Đang bán";
  const tag = normalizeText(status).includes("sap") ? "Sắp ra mắt" : "Đang bán";
  const discount = app.prices && app.prices.length > 1 ? "Nhiều gói" : "Bản quyền";

  return `
    <article class="product-card">
      <div class="thumb-wrap">
        <img src="${escapeAttr(app.cover || "/assets/app-preview.svg")}" alt="${escapeAttr(app.name)}">
        <span class="sale-badge">${escapeHtml(discount)}</span>
      </div>
      <div class="product-body">
        <div class="product-tags">
          <span>${escapeHtml(tag)}</span>
          <span>${escapeHtml(app.version || "DHS")}</span>
        </div>
        <h3>${escapeHtml(app.name)}</h3>
        <p>${escapeHtml(app.tagline)}</p>
        <div class="product-price">
          <strong>${escapeHtml(money(price))}</strong>
          <span>${escapeHtml(plan)}</span>
        </div>
        <ul>${(app.features || []).slice(0, 3).map((f) => `<li>${escapeHtml(f)}</li>`).join("")}</ul>
        <div class="card-actions">
          <button class="btn primary buy-btn" data-index="${index}">Mua ngay</button>
          ${app.demoUrl ? `<a class="btn ghost" href="${escapeAttr(app.demoUrl)}" target="_blank" rel="noreferrer">Demo</a>` : `<button class="btn ghost" type="button" data-view="demo">Demo</button>`}
        </div>
      </div>
    </article>
  `;
}

function renderDemos(site) {
  byId("demoList").innerHTML = (site.demos || []).map((demo) => `
    <article class="demo-card">
      <div class="demo-thumb">${demo.poster ? `<img src="${escapeAttr(demo.poster)}" alt="${escapeAttr(demo.title)}">` : "<span>DEMO</span>"}</div>
      <h3>${escapeHtml(demo.title || "Demo sản phẩm")}</h3>
      <p class="muted">${escapeHtml(demo.description || "Cập nhật link demo trong cấu hình web.")}</p>
      ${demo.url ? `<a href="${escapeAttr(demo.url)}" target="_blank" rel="noreferrer">Mở demo</a>` : "<span class=\"muted\">Chưa có link demo</span>"}
    </article>
  `).join("");
}

function renderFaq(site) {
  byId("faqList").innerHTML = (site.faq || []).map((item) => `
    <article class="faq-item"><h3>${escapeHtml(item.question)}</h3><p class="muted">${escapeHtml(item.answer)}</p></article>
  `).join("");
}

function renderContact(site) {
  byId("contactCard").innerHTML = Object.entries(site.contact || {}).map(([key, value]) => `
    <div class="contact-line"><span>${escapeHtml(key.toUpperCase())}</span><strong>${escapeHtml(value)}</strong></div>
  `).join("");
}

async function loadSiteData() {
  try {
    const res = await fetch("/api/site");
    if (res.ok) return await res.json();
  } catch {}
  return fetch("/site.json").then((res) => res.json());
}

function openBuyModal(app) {
  const prices = app.prices && app.prices.length ? app.prices : [{ name: "Liên hệ", price: app.priceFrom || "Liên hệ" }];
  byId("modalTitle").textContent = `Chọn gói mua ${app.name}`;
  byId("modalDesc").textContent = app.description || app.tagline || "";
  byId("planSelect").innerHTML = prices.map((plan, index) => `<option value="${index}">${escapeHtml(plan.price)} - ${escapeHtml(plan.name)}</option>`).join("");
  const updateAmount = () => {
    const plan = prices[Number(byId("planSelect").value)] || prices[0];
    byId("payAmount").textContent = `${plan.price} / ${plan.name}`;
  };
  byId("planSelect").onchange = updateAmount;
  updateAmount();
  byId("buyModal").hidden = false;
}

function openVideoModal(item) {
  if (!item) return;
  byId("videoTitle").textContent = item.title || "Video sản phẩm";
  byId("videoDesc").textContent = item.description || "";
  byId("videoPlayer").className = `video-player ${getVideoPlayerMode(item)}`;
  byId("videoPlayer").innerHTML = videoEmbed(item.videoUrl, item.thumbnail);
  byId("videoBuyBtn").onclick = () => {
    byId("videoModal").hidden = true;
    openAuth("register");
  };
  byId("videoModal").hidden = false;
}

function videoEmbed(url, thumbnail) {
  const cleanUrl = String(url || "").trim();
  if (!cleanUrl) {
    return `<div class="video-placeholder"><img src="${escapeAttr(thumbnail || "/assets/app-preview.svg")}" alt="Video preview"><span>Chưa có link video</span></div>`;
  }
  const youtubeId = getYouTubeId(cleanUrl);
  if (youtubeId) {
    return `<iframe src="https://www.youtube.com/embed/${escapeAttr(youtubeId)}?rel=0&playsinline=1" title="Video sản phẩm" allowfullscreen></iframe>`;
  }
  if (/\.(mp4|webm|ogg)(\?|$)/i.test(cleanUrl)) {
    return `<video src="${escapeAttr(cleanUrl)}" controls playsinline preload="metadata" poster="${escapeAttr(thumbnail || "")}"></video>`;
  }
  return `<iframe src="${escapeAttr(cleanUrl)}" title="Video sản phẩm" allowfullscreen></iframe>`;
}

function hoverPreviewEmbed(item) {
  const cleanUrl = String(item?.videoUrl || "").trim();
  if (!cleanUrl) return "";
  const youtubeId = getYouTubeId(cleanUrl);
  if (youtubeId) {
    return `<iframe class="hover-preview" src="https://www.youtube.com/embed/${escapeAttr(youtubeId)}?autoplay=1&mute=1&controls=0&loop=1&playlist=${escapeAttr(youtubeId)}&playsinline=1&rel=0" title="Preview" allow="autoplay; encrypted-media; picture-in-picture" tabindex="-1"></iframe>`;
  }
  if (/\.(mp4|webm|ogg)(\?|$)/i.test(cleanUrl)) {
    return `<video class="hover-preview" src="${escapeAttr(cleanUrl)}" muted autoplay loop playsinline preload="metadata"></video>`;
  }
  return "";
}

function showHoverPreview(button, item) {
  if (!button || button.querySelector(".hover-preview")) return;
  const markup = hoverPreviewEmbed(item);
  if (!markup) return;
  button.insertAdjacentHTML("beforeend", markup);
  button.classList.add("is-previewing");
}

function hideHoverPreview(button) {
  if (!button) return;
  button.classList.remove("is-previewing");
  button.querySelectorAll(".hover-preview").forEach((node) => node.remove());
}

function isPortraitVideo(url) {
  return /youtube\.com\/shorts\//i.test(String(url || ""));
}

function getVideoPlayerMode(item) {
  const url = String(item?.videoUrl || "").trim();
  if (!url) return "placeholder";
  if (isVideoFile(url)) return "video-file";
  return isPortraitVideo(url) ? "portrait" : "landscape";
}

function isVideoFile(url) {
  return /\.(mp4|webm|ogg)(\?|$)/i.test(String(url || ""));
}

function getYouTubeId(url) {
  const match = String(url).match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  return match ? match[1] : "";
}

function openAuth(mode = "login") {
  byId("authModal").hidden = false;
  setAuthTab(mode);
}

function setAuthTab(mode) {
  const isRegister = mode === "register";
  byId("loginForm").hidden = isRegister;
  byId("registerForm").hidden = !isRegister;
  document.querySelectorAll("[data-auth-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.authTab === mode);
  });
  byId("authMessage").textContent = "";
}

function switchView(view) {
  const nextView = view || "home";
  document.querySelectorAll("[data-view-section]").forEach((section) => {
    const active = section.dataset.viewSection === nextView;
    section.hidden = !active;
    section.classList.toggle("active", active);
  });
  document.querySelectorAll(".nav-tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === nextView);
  });
  byId("buyModal").hidden = true;
  byId("authModal").hidden = true;
  window.history.replaceState(null, "", `#${nextView}`);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function applyInitialView() {
  const initialView = String(location.hash || "#home").replace("#", "");
  switchView(["home", "apps", "workflow", "demo", "account"].includes(initialView) ? initialView : "home");
}

function saveCustomer(customer) {
  const customers = JSON.parse(localStorage.getItem("dhsCustomers") || "[]");
  const exists = customers.some((item) => item.email === customer.email);
  const next = exists
    ? customers.map((item) => item.email === customer.email ? { ...item, ...customer } : item)
    : [...customers, { ...customer, createdAt: new Date().toISOString() }];
  localStorage.setItem("dhsCustomers", JSON.stringify(next));
}

async function sendLead(customer) {
  const lead = stripPrivateCustomer(customer);
  saveCustomer(lead);
  try {
    await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lead)
    });
  } catch {}
}

async function registerAccount(customer) {
  saveCustomer(customer);
  try {
    const res = await fetch("/api/accounts/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(customer)
    });
    if (res.ok) return await res.json();
  } catch {}
  await sendLead(customer);
  return { ok: true, storage: "browser-only", customer: stripPrivateCustomer(customer) };
}

async function loginAccount(email, password) {
  try {
    const res = await fetch("/api/accounts/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    if (res.ok) return await res.json();
  } catch {}
  const customers = JSON.parse(localStorage.getItem("dhsCustomers") || "[]");
  const customer = customers.find((item) => item.email === email && item.password === password);
  return customer ? { ok: true, storage: "browser-only", customer: stripPrivateCustomer(customer) } : { ok: false };
}

function stripPrivateCustomer(customer) {
  return {
    name: String(customer?.name || ""),
    email: String(customer?.email || "").toLowerCase(),
    phone: String(customer?.phone || ""),
    interest: String(customer?.interest || ""),
    source: String(customer?.source || "customer")
  };
}

function byId(id) {
  return document.getElementById(id);
}

document.querySelectorAll("[data-auth-open]").forEach((button) => {
  button.addEventListener("click", () => openAuth(button.dataset.authOpen));
});

document.querySelectorAll("[data-auth-tab]").forEach((button) => {
  button.addEventListener("click", () => setAuthTab(button.dataset.authTab));
});

document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-view]");
  if (!target) return;
  switchView(target.dataset.view);
});

document.querySelectorAll("[data-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach((item) => item.classList.toggle("active", item === button));
    renderProducts();
  });
});

byId("searchForm")?.addEventListener("submit", (event) => {
  event.preventDefault();
  searchTerm = normalizeText(byId("productSearch").value || "");
  renderProducts();
  switchView("apps");
});

byId("modalClose")?.addEventListener("click", () => byId("buyModal").hidden = true);
byId("authClose")?.addEventListener("click", () => byId("authModal").hidden = true);
byId("videoClose")?.addEventListener("click", () => byId("videoModal").hidden = true);
byId("videoCloseBtn")?.addEventListener("click", () => byId("videoModal").hidden = true);

byId("leadForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const customer = {
    name: String(form.get("name") || ""),
    email: String(form.get("email") || "").toLowerCase(),
    interest: String(form.get("interest") || ""),
    source: "newsletter"
  };
  await sendLead(customer);
  byId("leadMessage").textContent = "Đã ghi nhận thông tin. Admin sẽ gửi cập nhật khi có sản phẩm mới.";
  event.currentTarget.reset();
});

byId("registerForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const customer = {
    name: String(form.get("name") || ""),
    email: String(form.get("email") || "").toLowerCase(),
    phone: String(form.get("phone") || ""),
    password: String(form.get("password") || ""),
    source: "account"
  };
  const result = await registerAccount(customer);
  if (!result?.ok) {
    byId("authMessage").textContent = "Chưa đăng ký được tài khoản. Vui lòng thử lại.";
    return;
  }
  localStorage.setItem("dhsCurrentCustomer", customer.email);
  event.currentTarget.reset();
  setAuthTab("login");
  byId("loginForm").querySelector('[name="email"]').value = customer.email;
  byId("authMessage").textContent = "Đăng ký thành công. Bạn có thể đăng nhập bằng tài khoản vừa tạo.";
});

byId("loginForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const email = String(form.get("email") || "").toLowerCase();
  const password = String(form.get("password") || "");
  const result = await loginAccount(email, password);
  if (!result?.ok) {
    byId("authMessage").textContent = "Email hoặc mật khẩu chưa đúng. Nếu chưa có tài khoản, hãy đăng ký trước.";
    return;
  }
  const customer = result.customer || { email };
  saveCustomer({ ...customer, password });
  localStorage.setItem("dhsCurrentCustomer", email);
  byId("authMessage").textContent = "Xin chào " + (customer.name || email) + ".";
});

function normalizeText(value) {
  return String(value || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

loadSite().catch((error) => {
  document.body.innerHTML = `<main class="section"><h1>Không tải được dữ liệu web</h1><p>${escapeHtml(error.message)}</p></main>`;
});
