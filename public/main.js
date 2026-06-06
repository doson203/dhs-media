const money = (value) => value || "Liên hệ";

let currentSite = null;
let activeFilter = "all";
let activeProductView = "all";
let searchTerm = "";
let activeCheckoutProduct = null;
const CURRENT_CUSTOMER_KEY = "dhsCurrentCustomer";
let googleClientId = "";
let googleAuthReady = false;
const AUTH_REQUEST_TIMEOUT_MS = 20000;

async function apiJson(url, options = {}, timeoutMs = AUTH_REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    const data = await res.json().catch(() => ({}));
    return { res, data };
  } catch (error) {
    if (error?.name === "AbortError") {
      return {
        res: { ok: false, status: 504 },
        data: { ok: false, message: "Máy chủ phản hồi quá lâu. Vui lòng thử lại sau." }
      };
    }
    return {
      res: { ok: false, status: 0 },
      data: { ok: false, message: "Không kết nối được máy chủ. Vui lòng kiểm tra mạng và thử lại." }
    };
  } finally {
    window.clearTimeout(timer);
  }
}

function setFormBusy(form, busy, label) {
  if (!form) return;
  const button = form.querySelector('button[type="submit"]');
  if (!button) return;
  if (!button.dataset.idleText) button.dataset.idleText = button.textContent;
  button.disabled = Boolean(busy);
  button.textContent = busy ? label : button.dataset.idleText;
}

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
  renderPromptProducts(site);
  renderWorkflowProducts(site);
  renderProductWorkflows(site);
  renderDemos(site);
  renderFaq(site);
  renderContact(site);
  normalizeAuthCopy();
  renderAuthState();
  initGoogleLogin();
  loadVideoHistory();
  applyInitialView();
  handleEmailVerificationReturn();
  handlePaymentReturn();
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

function applyProductView() {
  document.querySelectorAll("[data-product-section]").forEach((section) => {
    const sectionName = section.dataset.productSection;
    section.hidden = activeProductView !== "all" && sectionName !== activeProductView;
  });
  document.querySelectorAll("[data-product-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.productView === activeProductView);
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
    button.addEventListener("click", () => {
      if (button.classList.contains("buy-video-btn")) return;
      openVideoModal(products[Number(button.dataset.videoIndex)]);
    });
  });
  document.querySelectorAll(".buy-video-btn").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      openCheckoutModal(products[Number(button.dataset.videoIndex)]);
    });
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

function renderVideoProductsSafe(site) {
  const products = site.videoProducts || [];
  byId("videoProductGrid").innerHTML = products.map((item, index) => {
    const canPlay = hasVideoUrl(item.videoUrl);
    return `
    <article class="video-product-card">
      <button class="video-thumb-button" data-video-index="${index}" data-preview-index="${index}" type="button" aria-label="Xem ${escapeAttr(item.title)}">
        <img src="${escapeAttr(item.thumbnail || "/assets/app-preview.svg")}" alt="${escapeAttr(item.title)}">
        ${canPlay ? `<span class="play-mark">▶</span>` : `<span class="sale-badge media-badge">Ảnh</span>`}
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
          <button class="btn ghost" data-video-index="${index}" type="button">${canPlay ? "Xem video" : "Xem chi tiết"}</button>
        </div>
      </div>
    </article>`;
  }).join("") || `<div class="empty-state">Chưa có sản phẩm video AI/prompt.</div>`;

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

function renderPromptProducts(site) {
  const products = site.videoProducts || [];
  const indexed = products.map((item, index) => ({ item, index }));
  const freeProducts = indexed.filter(({ item }) => isFreePrompt(item));
  const paidProducts = indexed.filter(({ item }) => !isFreePrompt(item));
  const freeGrid = byId("freePromptGrid");
  const paidGrid = byId("paidPromptGrid");
  if (byId("freePromptCount")) byId("freePromptCount").textContent = `${freeProducts.length} mẫu`;
  if (byId("paidPromptCount")) byId("paidPromptCount").textContent = `${paidProducts.length} mẫu`;
  if (freeGrid) {
    freeGrid.innerHTML = freeProducts.map(({ item, index }) => promptProductCard(item, index, true)).join("")
      || `<div class="empty-state">Các mẫu miễn phí sẽ sớm được mở lại.</div>`;
  }
  if (paidGrid) {
    paidGrid.innerHTML = paidProducts.map(({ item, index }) => promptProductCard(item, index, false)).join("")
      || `<div class="empty-state">Chưa có prompt trả phí.</div>`;
  }
  if (byId("videoProductGrid")) byId("videoProductGrid").innerHTML = "";
  document.querySelectorAll(".buy-video-btn").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const product = products[Number(button.dataset.videoIndex)];
      if (isFreePrompt(product)) {
        if (!product?.promptUrl) {
          showPaymentNotice("Sản phẩm này đang được cập nhật. Vui lòng quay lại sau hoặc chọn mẫu khác.", "error");
          return;
        }
        showPaymentNotice("Sản phẩm miễn phí đã sẵn sàng. Bạn có thể mở link nhận tài nguyên ngay.", "success", product.promptUrl);
        return;
      }
      openCheckoutModal(product);
    });
  });
  document.querySelectorAll("[data-video-index]").forEach((button) => {
    if (button.classList.contains("buy-video-btn")) return;
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
  applyProductView();
}

function promptProductCard(item, index, isFree) {
  const canPlay = hasVideoUrl(item.videoUrl);
  const priceText = isFree ? "Miễn phí" : (item.price || "Liên hệ");
  return `
    <article class="video-product-card prompt-card ${isFree ? "free-card" : "paid-card"}">
      <button class="video-thumb-button" data-video-index="${index}" data-preview-index="${index}" type="button" aria-label="Xem ${escapeAttr(item.title)}">
        <img src="${escapeAttr(item.thumbnail || "/assets/app-preview.svg")}" alt="${escapeAttr(item.title)}">
        ${canPlay ? `<span class="play-mark">▶</span>` : `<span class="sale-badge media-badge">Ảnh</span>`}
        <span class="sale-badge">${escapeHtml(isFree ? "Miễn phí" : (item.category || "Prompt AI"))}</span>
      </button>
      <div class="product-body">
        <div class="product-tags">
          <span>${escapeHtml(isFree ? "Free" : (item.status || "Đang bán"))}</span>
          <span>${escapeHtml(item.format || "Video + Prompt")}</span>
        </div>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.description)}</p>
        <div class="product-price">
          <strong>${escapeHtml(priceText)}</strong>
          <span>${escapeHtml(item.license || "1 bộ prompt/tài liệu")}</span>
        </div>
        <div class="card-actions">
          <button class="btn primary buy-video-btn" data-video-index="${index}" type="button">${isFree ? "Nhận miễn phí" : "Mua prompt"}</button>
          <button class="btn ghost" data-video-index="${index}" type="button">${canPlay ? "Xem video" : "Xem chi tiết"}</button>
        </div>
      </div>
    </article>`;
}

function isFreePrompt(item) {
  const text = normalizeText(`${item.pricingType || ""} ${item.price || ""} ${item.status || ""} ${item.category || ""}`);
  const amount = parseMoneyAmount(item.price);
  return text.includes("free") || text.includes("mienphi") || text.includes("0d") || text.includes("0vnd") || amount === 0;
}

function parseMoneyAmount(value) {
  const raw = String(value || "").trim();
  if (!raw || normalizeText(raw).includes("lienhe")) return null;
  const digits = raw.replace(/[^\d]/g, "");
  return digits ? Number(digits) : null;
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

function renderProductWorkflows(site) {
  const grid = byId("productWorkflowGrid");
  if (!grid) return;
  grid.innerHTML = (site.workflows || []).map((item) => `
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
  `).join("") || `<div class="empty-state">Các workflow sẽ được cập nhật thêm trong thời gian tới.</div>`;
  applyProductView();
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
      <p class="muted">${escapeHtml(demo.description || "Video demo sẽ được bổ sung trong thời gian tới.")}</p>
      ${demo.url ? `<a href="${escapeAttr(demo.url)}" target="_blank" rel="noreferrer">Mở demo</a>` : "<span class=\"muted\">Sắp có demo</span>"}
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
  const sourceUrl = normalizeVideoUrl(item.videoUrl);
  byId("videoTitle").textContent = item.title || "Video sản phẩm";
  byId("videoDesc").textContent = item.description || "";
  byId("videoPlayer").className = `video-player ${getVideoPlayerModeSafe(item)}`;
  byId("videoPlayer").innerHTML = videoEmbedSafeV2(item.videoUrl, item.thumbnail);
  bindVideoFallback(item);
  const sourceBtn = byId("videoSourceBtn");
  if (sourceBtn) {
    sourceBtn.hidden = !sourceUrl;
    sourceBtn.href = sourceUrl || "#";
  }
  byId("videoBuyBtn").onclick = () => {
    byId("videoModal").hidden = true;
    openCheckoutModal(item);
  };
  byId("videoModal").hidden = false;
}

function openCheckoutModal(product) {
  if (!product) return;
  activeCheckoutProduct = product;
  byId("checkoutProduct").textContent = `${product.title || product.name} - ${product.price || "Liên hệ"}`;
  byId("checkoutMessage").textContent = "";
  const currentCustomer = getCurrentCustomer();
  const currentEmail = currentCustomer?.email || "";
  const form = byId("checkoutForm");
  form.querySelector('[name="email"]').value = currentEmail.includes("@") ? currentEmail : "";
  form.querySelector('[name="name"]').value = currentCustomer?.name || "";
  form.querySelector('[name="phone"]').value = currentCustomer?.phone || "";
  const submit = form.querySelector('button[type="submit"]');
  if (submit) submit.textContent = "Hiển thị mã thanh toán";
  const inlineBox = byId("inlinePaymentBox");
  if (inlineBox) {
    inlineBox.hidden = true;
    inlineBox.innerHTML = "";
  }
  byId("checkoutModal").hidden = false;
}

async function handlePaymentReturn() {
  const params = new URLSearchParams(window.location.search);
  const payment = params.get("payment");
  const orderCode = params.get("orderCode");
  if (!payment || !orderCode) return;
  if (payment === "cancel") {
    showPaymentNotice("Thanh toán đã bị hủy. Bạn có thể bấm mua lại khi cần.", "error");
    return;
  }
  showPaymentNotice("Đang kiểm tra trạng thái thanh toán...", "loading");
  try {
    const res = await fetch("/api/checkout/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderCode })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      showPaymentNotice(data.message || "Chưa kiểm tra được thanh toán. Vui lòng gửi mã đơn " + orderCode + " cho đội hỗ trợ.", "error");
      return;
    }
    if (!data.paid) {
      showPaymentNotice("Đơn hàng chưa được payOS xác nhận thanh toán. Mã đơn: " + orderCode + ".", "loading");
      return;
    }
    const emailText = data.emailStatus === "SENT"
      ? "Link sản phẩm đã được gửi qua email."
      : "Email chưa gửi được tự động, bạn có thể lấy link sản phẩm ngay bên dưới.";
    showPaymentNotice(`Thanh toán thành công. ${emailText}`, data.emailStatus === "SENT" ? "success" : "warning", data.promptUrl);
  } catch (error) {
    showPaymentNotice("Không kiểm tra được thanh toán. Vui lòng gửi mã đơn " + orderCode + " cho đội hỗ trợ.", "error");
  }
}

function showPaymentNotice(message, type = "info", promptUrl = "") {
  let notice = byId("paymentNotice");
  if (!notice) {
    notice = document.createElement("div");
    notice.id = "paymentNotice";
    notice.className = "payment-notice";
    notice.setAttribute("role", "status");
    notice.setAttribute("aria-live", "polite");
    document.body.prepend(notice);
  }
  notice.dataset.state = type;
  notice.innerHTML = `
    <strong>${escapeHtml(message)}</strong>
    ${promptUrl ? `<a class="btn small primary" href="${escapeAttr(promptUrl)}" target="_blank" rel="noopener noreferrer">Mở link sản phẩm</a>` : ""}
  `;
}

function renderInlinePayment(data) {
  const box = byId("inlinePaymentBox");
  if (!box) return;
  const qrText = data.qrCode || data.checkoutUrl || "";
  const qrUrl = qrText ? `https://quickchart.io/qr?size=260&margin=1&text=${encodeURIComponent(qrText)}` : "";
  const amountText = data.amount ? new Intl.NumberFormat("vi-VN").format(Number(data.amount)) + "đ" : "Theo đơn hàng";
  box.hidden = false;
  box.innerHTML = `
    <div class="qr-panel">
      ${qrUrl ? `<img src="${escapeAttr(qrUrl)}" alt="Mã QR thanh toán">` : ""}
      <div class="qr-info">
        <span>Mã đơn</span>
        <strong>${escapeHtml(data.orderCode || "")}</strong>
        <span>Số tiền</span>
        <strong>${escapeHtml(amountText)}</strong>
        <span>Nội dung chuyển khoản</span>
        <code>DHS${escapeHtml(data.orderCode || "")}</code>
        <div class="qr-actions">
          <button class="btn primary" type="button" id="verifyPaymentBtn" data-order-code="${escapeAttr(data.orderCode || "")}">Tôi đã thanh toán</button>
          ${data.checkoutUrl ? `<a class="btn ghost" href="${escapeAttr(data.checkoutUrl)}" target="_blank" rel="noopener noreferrer">Mở trang payOS</a>` : ""}
        </div>
      </div>
    </div>
  `;
  byId("verifyPaymentBtn")?.addEventListener("click", async () => {
    await verifyInlinePayment(data.orderCode);
  });
}

async function verifyInlinePayment(orderCode) {
  if (!orderCode) return;
  byId("checkoutMessage").textContent = "Đang kiểm tra thanh toán...";
  try {
    const res = await fetch("/api/checkout/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderCode })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      byId("checkoutMessage").textContent = data.message || "Chưa kiểm tra được thanh toán.";
      return;
    }
    if (!data.paid) {
      byId("checkoutMessage").textContent = "payOS chưa xác nhận thanh toán. Vui lòng thử lại sau vài giây.";
      return;
    }
    byId("checkoutMessage").textContent = data.emailStatus === "SENT"
      ? "Thanh toán thành công. Link sản phẩm đã được gửi qua email."
      : "Thanh toán thành công. Email chưa gửi được, bạn có thể mở link sản phẩm bên dưới.";
    showPaymentNotice("Thanh toán thành công.", data.emailStatus === "SENT" ? "success" : "warning", data.promptUrl);
  } catch (error) {
    byId("checkoutMessage").textContent = "Không kiểm tra được thanh toán. Vui lòng thử lại.";
  }
}

function videoEmbed(url, thumbnail) {
  const cleanUrl = String(url || "").trim();
  if (!cleanUrl) {
    return `<div class="video-placeholder"><img src="${escapeAttr(thumbnail || "/assets/app-preview.svg")}" alt="Video preview"><span>Đang hiển thị ảnh sản phẩm</span></div>`;
  }
  const youtubeId = getYouTubeId(cleanUrl);
  if (youtubeId) {
    return `<iframe src="https://www.youtube.com/embed/${escapeAttr(youtubeId)}?rel=0&playsinline=1" title="Video sản phẩm" allowfullscreen></iframe>`;
  }
  if (/\.(mp4|webm|ogg)(\?|$)/i.test(cleanUrl)) {
    return `<video src="${escapeAttr(cleanUrl)}" controls autoplay muted loop playsinline preload="auto" poster="${escapeAttr(thumbnail || "")}"></video>`;
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
  const markup = hoverPreviewEmbedSafe(item);
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

function videoEmbedSafe(url, thumbnail) {
  const cleanUrl = normalizeVideoUrl(url);
  if (!cleanUrl) {
    return `<div class="video-placeholder"><img src="${escapeAttr(thumbnail || "/assets/app-preview.svg")}" alt="Video preview"><span>Đang hiển thị ảnh sản phẩm</span></div>`;
  }
  const youtubeId = getYouTubeIdSafe(cleanUrl);
  if (youtubeId) {
    return `<iframe src="https://www.youtube.com/embed/${escapeAttr(youtubeId)}?rel=0&playsinline=1&autoplay=1&mute=1" title="Video sản phẩm" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
  }
  if (isVideoFile(cleanUrl)) {
    return `<video src="${escapeAttr(cleanUrl)}" controls autoplay muted loop playsinline preload="auto" poster="${escapeAttr(thumbnail || "")}"></video>`;
  }
  return `<iframe src="${escapeAttr(cleanUrl)}" title="Video sản phẩm" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
}

function videoEmbedSafeV2(url, thumbnail) {
  const cleanUrl = normalizeVideoUrl(url);
  if (!cleanUrl) {
    return `<div class="video-placeholder"><img src="${escapeAttr(thumbnail || "/assets/app-preview.svg")}" alt="Video preview"><span>Dang hien thi anh san pham</span></div>`;
  }
  const youtubeId = getYouTubeIdSafe(cleanUrl);
  if (youtubeId) {
    return `<iframe src="https://www.youtube.com/embed/${escapeAttr(youtubeId)}?rel=0&playsinline=1&autoplay=1&mute=1&controls=1" title="Video san pham" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;
  }
  if (isVideoFile(cleanUrl)) {
    return `<video src="${escapeAttr(cleanUrl)}" controls autoplay muted loop playsinline preload="auto" poster="${escapeAttr(thumbnail || "")}"></video>`;
  }
  return `<iframe src="${escapeAttr(cleanUrl)}" title="Video san pham" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;
}

function bindVideoFallback(item) {
  const player = byId("videoPlayer");
  if (!player) return;
  const sourceUrl = normalizeVideoUrl(item?.videoUrl);
  const video = player.querySelector("video");
  if (video) {
    video.addEventListener("error", () => renderVideoFallback(item), { once: true });
    video.play?.().catch(() => {});
  }
  const iframe = player.querySelector("iframe");
  if (iframe && sourceUrl) {
    window.setTimeout(() => {
      if (player.querySelector("iframe") !== iframe || byId("videoModal")?.hidden) return;
      if (!player.querySelector(".video-open-fallback")) {
        player.insertAdjacentHTML("beforeend", `
          <a class="video-open-fallback" href="${escapeAttr(sourceUrl)}" target="_blank" rel="noreferrer">M&#7903; video g&#7889;c</a>
        `);
      }
    }, 1200);
  }
}

function renderVideoFallback(item) {
  const player = byId("videoPlayer");
  if (!player) return;
  const sourceUrl = normalizeVideoUrl(item?.videoUrl);
  player.className = "video-player placeholder";
  player.innerHTML = `
    <div class="video-placeholder">
      <img src="${escapeAttr(item?.thumbnail || "/assets/app-preview.svg")}" alt="Video preview">
      <span>Video kh&#244;ng ph&#225;t tr&#7921;c ti&#7871;p tr&#234;n tr&#236;nh duy&#7879;t n&#224;y.</span>
      ${sourceUrl ? `<a class="btn primary" href="${escapeAttr(sourceUrl)}" target="_blank" rel="noreferrer">M&#7903; video g&#7889;c</a>` : ""}
    </div>
  `;
}

function hoverPreviewEmbedSafe(item) {
  const cleanUrl = normalizeVideoUrl(item?.videoUrl);
  if (!cleanUrl) return "";
  const youtubeId = getYouTubeIdSafe(cleanUrl);
  if (youtubeId) {
    return `<iframe class="hover-preview" src="https://www.youtube.com/embed/${escapeAttr(youtubeId)}?autoplay=1&mute=1&controls=0&loop=1&playlist=${escapeAttr(youtubeId)}&playsinline=1&rel=0" title="Preview" allow="autoplay; encrypted-media; picture-in-picture" tabindex="-1"></iframe>`;
  }
  if (isVideoFile(cleanUrl)) {
    return `<video class="hover-preview" src="${escapeAttr(cleanUrl)}" muted autoplay loop playsinline preload="metadata"></video>`;
  }
  return "";
}

function getVideoPlayerModeSafe(item) {
  const url = normalizeVideoUrl(item?.videoUrl);
  if (!url) return "placeholder";
  if (isVideoFile(url)) return "video-file";
  return /youtube\.com\/shorts\//i.test(url) ? "portrait" : "landscape";
}

function getYouTubeIdSafe(url) {
  const match = normalizeVideoUrl(url).match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  return match ? match[1] : "";
}

function hasVideoUrl(url) {
  return Boolean(normalizeVideoUrl(url));
}

function normalizeVideoUrl(url) {
  let cleanUrl = String(url || "").trim();
  if (!cleanUrl) return "";
  cleanUrl = cleanUrl.replace(/^https:\/https:\/\//i, "https://");
  cleanUrl = cleanUrl.replace(/^http:\/http:\/\//i, "http://");
  cleanUrl = cleanUrl.replace(/^https:\/\/https\/\//i, "https://");
  cleanUrl = cleanUrl.replace(/^http:\/\/http\/\//i, "http://");
  cleanUrl = cleanUrl.replace(/^https:\/(?!\/)/i, "https://");
  cleanUrl = cleanUrl.replace(/^http:\/(?!\/)/i, "http://");
  if (/^(www\.)?(youtube\.com|youtu\.be)\//i.test(cleanUrl)) {
    cleanUrl = `https://${cleanUrl.replace(/^www\./i, "")}`;
  }
  if (!/^https?:\/\//i.test(cleanUrl)) return "";
  return cleanUrl;
}

function openAuth(mode = "login") {
  byId("authModal").hidden = false;
  setAuthTab(mode);
}

function setAuthTab(mode) {
  const isRegister = mode === "register";
  byId("loginForm").hidden = isRegister;
  byId("registerForm").hidden = !isRegister;
  byId("authModal")?.querySelector(".auth-card")?.setAttribute("data-auth-mode", isRegister ? "register" : "login");
  document.querySelectorAll("[data-auth-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.authTab === mode);
  });
  setAuthMessage("");
}

function normalizeAuthCopy() {
  const tabs = document.querySelectorAll("[data-auth-tab]");
  tabs.forEach((button) => {
    button.textContent = button.dataset.authTab === "register" ? "Đăng ký" : "Đăng nhập";
  });
  const loginForm = byId("loginForm");
  const registerForm = byId("registerForm");
  if (loginForm) {
    loginForm.querySelector("h2").textContent = "Đăng nhập tài khoản";
    loginForm.querySelector('[name="email"]').placeholder = "email@example.com";
    loginForm.querySelector('[name="password"]').placeholder = "Mật khẩu";
    loginForm.querySelector('button[type="submit"]').textContent = "Đăng nhập";
  }
  if (registerForm) {
    registerForm.querySelector("h2").textContent = "Đăng ký khách hàng";
    registerForm.querySelector('[name="name"]').placeholder = "Tên khách hàng";
    registerForm.querySelector('[name="email"]').placeholder = "email@example.com";
    registerForm.querySelector('[name="phone"]').placeholder = "Số điện thoại hoặc Zalo";
    registerForm.querySelector('[name="password"]').placeholder = "Tối thiểu 6 ký tự";
    registerForm.querySelector('button[type="submit"]').textContent = "Tạo tài khoản";
  }
  const message = byId("authMessage");
  if (message) {
    message.setAttribute("role", "status");
    message.setAttribute("aria-live", "polite");
  }
}

function setAuthMessage(text, type = "info") {
  const message = byId("authMessage");
  if (!message) return;
  message.textContent = text;
  message.dataset.state = type;
}

function setGoogleAuthMessage(text, type = "info") {
  const message = byId("googleAuthMessage");
  if (!message) return;
  message.textContent = text;
  message.dataset.state = type;
}

function getCurrentCustomer() {
  const raw = localStorage.getItem(CURRENT_CUSTOMER_KEY) || "";
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.email) return parsed;
  } catch (error) {
    if (raw.includes("@")) return { email: raw };
  }
  return null;
}

function setCurrentCustomer(customer) {
  if (!customer?.email) return;
  const clean = {
    name: String(customer.name || "").trim(),
    email: String(customer.email || "").trim().toLowerCase(),
    phone: String(customer.phone || "").trim()
  };
  localStorage.setItem(CURRENT_CUSTOMER_KEY, JSON.stringify(clean));
  saveCustomer(clean);
  renderAuthState();
}

function clearCurrentCustomer() {
  localStorage.removeItem(CURRENT_CUSTOMER_KEY);
  renderAuthState();
  showPaymentNotice("Đã đăng xuất tài khoản khách hàng.", "info");
}

function customerInitials(customer) {
  const source = String(customer?.name || customer?.email || "KH").trim();
  const parts = source.includes("@") ? [source[0], source.split("@")[0]?.[1]] : source.split(/\s+/).slice(0, 2).map((part) => part[0]);
  return parts.filter(Boolean).join("").slice(0, 2).toUpperCase() || "KH";
}

function renderAuthState() {
  const customer = getCurrentCustomer();
  const isLoggedIn = Boolean(customer?.email);
  const guest = byId("authGuestActions");
  const chip = byId("customerChip");
  syncVideoAiCustomer(customer);
  if (guest) guest.hidden = isLoggedIn;
  if (chip) chip.hidden = !isLoggedIn;
  if (isLoggedIn) {
    const displayName = customer.name || customer.email.split("@")[0] || "Khách hàng";
    byId("customerAvatar").textContent = customerInitials(customer);
    byId("customerName").textContent = displayName;
    byId("customerEmail").textContent = customer.email;
    byId("accountAvatar").textContent = customerInitials(customer);
    byId("accountName").textContent = displayName;
    byId("accountEmail").textContent = customer.email;
    byId("accountPhone").textContent = customer.phone || "Chưa có số điện thoại";
    byId("accountSummary").hidden = false;
    byId("accountTitle").textContent = "Thông tin tài khoản khách hàng";
    byId("accountDescription").textContent = "Bạn đang đăng nhập. Tài khoản này dùng để nhận sản phẩm, cập nhật mới và thông tin đơn hàng.";
    return;
  }
  if (byId("accountSummary")) byId("accountSummary").hidden = true;
  if (byId("accountTitle")) byId("accountTitle").textContent = "Đăng ký để nhận cập nhật sản phẩm mới";
  if (byId("accountDescription")) byId("accountDescription").textContent = "Tạo tài khoản để nhận sản phẩm qua email, theo dõi cập nhật và lưu thông tin mua hàng.";
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
  const path = String(location.pathname || "").replace(/\/+$/, "");
  switchView(["home", "apps", "workflow", "demo", "create-video", "account"].includes(initialView) ? initialView : "home");
  if (path === "/dang-nhap" || path === "/login") openAuth("login");
  if (path === "/dang-ky" || path === "/register") openAuth("register");
}

async function handleEmailVerificationReturn() {
  const path = String(location.pathname || "").replace(/\/+$/, "");
  const token = new URLSearchParams(location.search).get("token") || "";
  if (path !== "/xac-nhan-email" || !token) return;
  showPaymentNotice("Đang xác nhận email tài khoản...", "loading");
  try {
    const res = await fetch("/api/accounts/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      showPaymentNotice(data.message || "Không xác nhận được email. Vui lòng thử lại hoặc đăng ký lại.", "error");
      openAuth("login");
      return;
    }
    showPaymentNotice("Xác nhận email thành công. Bạn có thể đăng nhập tài khoản.", "success");
    openAuth("login");
    window.history.replaceState(null, "", "/#home");
  } catch (error) {
    showPaymentNotice("Không kết nối được máy chủ xác nhận email.", "error");
  }
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
  const { res, data } = await apiJson("/api/accounts/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(customer)
  });
  if (res.ok && data.ok) {
    saveCustomer(stripPrivateCustomer(customer));
    return data;
  }
  return { ok: false, message: data.message || "Máy chủ chưa lưu được tài khoản. Vui lòng thử lại." };
}

async function loginAccount(email, password) {
  const { res, data } = await apiJson("/api/accounts/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  if (res.ok && data.ok) return data;
  return {
    ok: false,
    needsVerification: Boolean(data?.needsVerification),
    message: data?.message || "Email hoặc mật khẩu chưa đúng."
  };
}

async function initGoogleLogin() {
  const box = byId("googleLoginBox");
  if (!box || googleAuthReady) return;
  try {
    const res = await fetch("/api/auth/config");
    const data = await res.json().catch(() => ({}));
    googleClientId = String(data.googleClientId || "");
    if (!googleClientId) {
      box.innerHTML = "";
      setGoogleAuthMessage("Đăng nhập Google tạm thời chưa sẵn sàng. Vui lòng thử lại sau.", "error");
      return;
    }
    await loadGoogleIdentityScript();
    window.google.accounts.id.initialize({
      client_id: googleClientId,
      callback: handleGoogleCredential
    });
    window.google.accounts.id.renderButton(box, {
      theme: "outline",
      size: "large",
      width: Math.min(360, box.clientWidth || 360),
      text: "signin_with",
      shape: "rectangular"
    });
    googleAuthReady = true;
    setGoogleAuthMessage("");
  } catch (error) {
    setGoogleAuthMessage("Không tải được đăng nhập Google.", "error");
  }
}

function loadGoogleIdentityScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

async function handleGoogleCredential(response) {
  const credential = response?.credential || "";
  if (!credential) return setGoogleAuthMessage("Google chưa trả thông tin đăng nhập.", "error");
  setGoogleAuthMessage("Đang xác thực Google...", "loading");
  try {
    const res = await fetch("/api/accounts/google-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      setGoogleAuthMessage(data.message || "Không đăng nhập được bằng Google.", "error");
      return;
    }
    setCurrentCustomer(data.customer);
    setGoogleAuthMessage("Đăng nhập Google thành công.", "success");
    showPaymentNotice("Đăng nhập Google thành công.", "success");
    window.setTimeout(() => {
      byId("authModal").hidden = true;
    }, 900);
  } catch (error) {
    setGoogleAuthMessage("Không kết nối được máy chủ Google login.", "error");
  }
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

function syncVideoAiCustomer(customer) {
  const emailInput = byId("videoAiEmail");
  if (!emailInput) return;
  if (customer?.email && !emailInput.value) {
    emailInput.value = customer.email;
  }
}

async function createAiVideo(payload) {
  const { res, data } = await apiJson("/api/video/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  }, 60000);
  if (!res.ok || !data.ok) {
    return { ok: false, message: data.message || "Chua tao duoc video." };
  }
  return data;
}

async function loadVideoHistory() {
  const list = byId("videoJobList");
  if (!list) return;
  const customer = getCurrentCustomer();
  const query = customer?.email ? `?email=${encodeURIComponent(customer.email)}` : "";
  const { res, data } = await apiJson(`/api/video/history${query}`, {}, 30000);
  if (!res.ok || !data.ok) {
    list.innerHTML = `<div class="empty-state">Chua tai duoc lich su tao video.</div>`;
    return;
  }
  renderVideoJobs(data.jobs || []);
}

function renderVideoJobs(jobs) {
  const list = byId("videoJobList");
  if (!list) return;
  list.innerHTML = jobs.map((job) => `
    <article class="video-job-card">
      <div>
        <strong>${escapeHtml(job.prompt || "Video AI").slice(0, 120)}</strong>
        <span>${escapeHtml(job.ratio || "9:16")} · ${escapeHtml(String(job.duration || 5))}s · ${escapeHtml(job.status || "")}</span>
      </div>
      ${job.videoUrl ? `<button class="btn ghost" type="button" data-video-job="${escapeAttr(job.id)}">Xem video</button>` : ""}
    </article>
  `).join("") || `<div class="empty-state">Chua co job tao video.</div>`;
  document.querySelectorAll("[data-video-job]").forEach((button) => {
    button.addEventListener("click", async () => {
      const job = jobs.find((item) => item.id === button.dataset.videoJob);
      if (job) renderVideoAiResult(job);
    });
  });
}

function renderVideoAiResult(job) {
  const preview = byId("videoAiPreview");
  const meta = byId("videoAiMeta");
  if (!preview || !meta) return;
  if (job.status === "done" && job.videoUrl) {
    preview.innerHTML = videoEmbedSafeV2(job.videoUrl, job.thumbnail || "");
  } else if (job.status === "failed") {
    preview.innerHTML = `<span>Tao video loi</span>`;
  } else {
    preview.innerHTML = `<span>Dang tao video...</span>`;
  }
  meta.innerHTML = `
    <strong>${escapeHtml(statusLabel(job.status))}</strong>
    <span>${job.demoMode ? "Demo mode - chua cau hinh API tao video that." : escapeHtml(job.provider || "")}</span>
    ${job.videoUrl ? `<a class="btn small primary" href="${escapeAttr(job.videoUrl)}" target="_blank" rel="noreferrer">Mo video</a>` : ""}
    ${job.error ? `<span>${escapeHtml(job.error)}</span>` : ""}
  `;
}

async function pollVideoJob(jobId) {
  for (let index = 0; index < 12; index += 1) {
    const { res, data } = await apiJson(`/api/video/status/${encodeURIComponent(jobId)}`, {}, 30000);
    if (res.ok && data.ok && data.job) {
      renderVideoAiResult(data.job);
      if (data.job.status === "done" || data.job.status === "failed") {
        await loadVideoHistory();
        return data.job;
      }
    }
    await new Promise((resolve) => window.setTimeout(resolve, 4000));
  }
  return null;
}

function statusLabel(status) {
  if (status === "done") return "Video da san sang";
  if (status === "failed") return "Tao video loi";
  return "Dang xu ly";
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

document.querySelectorAll("[data-product-view]").forEach((button) => {
  button.addEventListener("click", () => {
    activeProductView = button.dataset.productView || "all";
    applyProductView();
  });
});

byId("searchForm")?.addEventListener("submit", (event) => {
  event.preventDefault();
  searchTerm = normalizeText(byId("productSearch").value || "");
  renderProducts();
  switchView("apps");
});

byId("refreshVideoJobs")?.addEventListener("click", loadVideoHistory);

byId("videoAiForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formElement = event.currentTarget;
  const form = new FormData(formElement);
  const customer = getCurrentCustomer();
  const payload = {
    prompt: String(form.get("prompt") || ""),
    ratio: String(form.get("ratio") || "9:16"),
    duration: Number(form.get("duration") || 5),
    imageUrl: String(form.get("imageUrl") || ""),
    email: String(form.get("email") || customer?.email || "").toLowerCase()
  };
  const message = byId("videoAiMessage");
  if (message) message.textContent = "Dang tao job video...";
  setFormBusy(formElement, true, "Dang tao...");
  const result = await createAiVideo(payload).finally(() => setFormBusy(formElement, false));
  if (!result.ok) {
    if (message) message.textContent = result.message || "Chua tao duoc video.";
    return;
  }
  if (message) message.textContent = result.job?.demoMode
    ? "Da tao video demo. Them API key de tao video that."
    : "Da gui job tao video.";
  renderVideoAiResult(result.job);
  await loadVideoHistory();
  if (result.job?.status === "processing") await pollVideoJob(result.job.id);
});

byId("modalClose")?.addEventListener("click", () => byId("buyModal").hidden = true);
byId("authClose")?.addEventListener("click", () => byId("authModal").hidden = true);
byId("videoClose")?.addEventListener("click", () => byId("videoModal").hidden = true);
byId("videoCloseBtn")?.addEventListener("click", () => byId("videoModal").hidden = true);
byId("checkoutClose")?.addEventListener("click", () => byId("checkoutModal").hidden = true);
byId("logoutBtn")?.addEventListener("click", clearCurrentCustomer);
byId("accountLogoutBtn")?.addEventListener("click", clearCurrentCustomer);

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
  byId("leadMessage").textContent = "Đã ghi nhận thông tin. DHS MEDIA sẽ gửi cập nhật khi có sản phẩm mới.";
  event.currentTarget.reset();
});

byId("registerForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const currentForm = event.currentTarget;
  const form = new FormData(event.currentTarget);
  const customer = {
    name: String(form.get("name") || ""),
    email: String(form.get("email") || "").toLowerCase(),
    phone: String(form.get("phone") || ""),
    password: String(form.get("password") || ""),
    source: "account"
  };
  setAuthMessage("Đang tạo tài khoản và gửi email xác thực...", "loading");
  setFormBusy(currentForm, true, "Đang tạo...");
  const result = await registerAccount(customer).finally(() => setFormBusy(currentForm, false));
  if (!result?.ok) {
    setAuthMessage(result?.message || "Chưa đăng ký được tài khoản. Vui lòng thử lại.", "error");
    return;
  }
  event.currentTarget.reset();
  setAuthTab("login");
  byId("loginForm").querySelector('[name="email"]').value = customer.email;
  const verifyMessage = "Đăng ký thành công. Vui lòng mở email " + customer.email + " và bấm link xác thực tài khoản trước khi đăng nhập.";
  setAuthMessage(verifyMessage, "success");
  showPaymentNotice(verifyMessage, "success");
});

byId("checkoutForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!activeCheckoutProduct) return;
  const form = new FormData(event.currentTarget);
  byId("inlinePaymentBox").hidden = true;
  byId("inlinePaymentBox").innerHTML = "";
  byId("checkoutMessage").textContent = "Đang tạo link thanh toán...";
  try {
    const res = await fetch("/api/checkout/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: activeCheckoutProduct.id,
        name: String(form.get("name") || ""),
        email: String(form.get("email") || "").toLowerCase(),
        phone: String(form.get("phone") || "")
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok || !data.checkoutUrl) {
      byId("checkoutMessage").textContent = data.message || "Chưa tạo được mã thanh toán. Vui lòng thử lại hoặc liên hệ đội hỗ trợ.";
      return;
    }
    setCurrentCustomer({
      name: String(form.get("name") || ""),
      email: String(form.get("email") || "").toLowerCase(),
      phone: String(form.get("phone") || "")
    });
    renderInlinePayment(data);
    byId("checkoutMessage").textContent = "Mã thanh toán đã sẵn sàng. Quét QR hoặc chuyển khoản theo nội dung hiển thị, sau đó bấm Tôi đã thanh toán.";
  } catch (error) {
    byId("checkoutMessage").textContent = "Không kết nối được cổng thanh toán. Vui lòng thử lại.";
  }
});

byId("loginForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const currentForm = event.currentTarget;
  const form = new FormData(event.currentTarget);
  const email = String(form.get("email") || "").toLowerCase();
  const password = String(form.get("password") || "");
  setAuthMessage("Đang kiểm tra tài khoản trên máy chủ...", "loading");
  setFormBusy(currentForm, true, "Đang kiểm tra...");
  const result = await loginAccount(email, password).finally(() => setFormBusy(currentForm, false));
  if (!result?.ok) {
    setAuthMessage(result?.message || (result?.needsVerification ? "Bạn cần mở email và bấm link xác thực tài khoản trước khi đăng nhập." : "Email hoặc mật khẩu chưa đúng. Nếu chưa có tài khoản, hãy đăng ký trước."), "error");
    return;
  }
  const customer = result.customer || { email };
  setCurrentCustomer({ ...customer, email });
  setAuthMessage("Đăng nhập thành công. Xin chào " + (customer.name || email) + ".", "success");
  showPaymentNotice("Đăng nhập thành công. Xin chào " + (customer.name || email) + ".", "success");
  window.setTimeout(() => {
    byId("authModal").hidden = true;
  }, 1300);
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
