const money = (value) => value || "Lien he";

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
  renderDemos(site);
  renderFaq(site);
  renderContact(site);
}

function renderProducts() {
  const apps = currentSite?.apps || [];
  const filtered = apps.filter((app) => {
    const haystack = `${app.name} ${app.tagline} ${app.description} ${(app.features || []).join(" ")}`.toLowerCase();
    const matchesSearch = !searchTerm || haystack.includes(searchTerm);
    const status = String(app.status || "").toLowerCase();
    const matchesFilter = activeFilter === "all"
      || (activeFilter === "ready" && status.includes("dang"))
      || (activeFilter === "soon" && (status.includes("sap") || status.includes("phat trien")));
    return matchesSearch && matchesFilter;
  });

  byId("featuredGrid").innerHTML = apps.slice(0, 3).map(productCard).join("");
  byId("appGrid").innerHTML = filtered.map(productCard).join("") || `
    <div class="empty-state">Khong tim thay san pham phu hop.</div>
  `;

  document.querySelectorAll(".buy-btn").forEach((button) => {
    button.addEventListener("click", () => openBuyModal(apps[Number(button.dataset.index)]));
  });
}

function productCard(app) {
  const apps = currentSite?.apps || [];
  const index = apps.indexOf(app);
  const firstPlan = (app.prices || [])[0];
  const price = firstPlan?.price || app.priceFrom || "Lien he";
  const plan = firstPlan?.name || "Gia tu";
  const status = app.status || "Dang ban";
  const tag = status.toLowerCase().includes("sap") ? "Sap ra mat" : "Dang ban";
  const discount = app.prices && app.prices.length > 1 ? "Nhieu goi" : "Ban quyen";

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
          ${app.demoUrl ? `<a class="btn ghost" href="${escapeAttr(app.demoUrl)}" target="_blank" rel="noreferrer">Demo</a>` : `<a class="btn ghost" href="#demo">Demo</a>`}
        </div>
      </div>
    </article>
  `;
}

function renderDemos(site) {
  byId("demoList").innerHTML = (site.demos || []).map((demo) => `
    <article class="demo-card">
      <div class="demo-thumb">${demo.poster ? `<img src="${escapeAttr(demo.poster)}" alt="${escapeAttr(demo.title)}">` : "<span>DEMO</span>"}</div>
      <h3>${escapeHtml(demo.title || "Demo san pham")}</h3>
      <p class="muted">${escapeHtml(demo.description || "Cap nhat link demo trong cau hinh web.")}</p>
      ${demo.url ? `<a href="${escapeAttr(demo.url)}" target="_blank" rel="noreferrer">Mo demo</a>` : "<span class=\"muted\">Chua co link demo</span>"}
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
  const prices = app.prices && app.prices.length ? app.prices : [{ name: "Lien he", price: app.priceFrom || "Lien he" }];
  byId("modalTitle").textContent = `Chon goi mua ${app.name}`;
  byId("modalDesc").textContent = app.description || app.tagline || "";
  byId("planSelect").innerHTML = prices.map((plan, index) => `<option value="${index}">${escapeHtml(plan.price)} - ${escapeHtml(plan.name)}</option>`).join("");
  const updateAmount = () => {
    const plan = prices[Number(byId("planSelect").value)] || prices[0];
    byId("payAmount").textContent = `${plan.price} / ${plan.name}`;
  };
  byId("planSelect").onchange = updateAmount;
  updateAmount();
  const zalo = currentSite?.contact?.zalo || currentSite?.contact?.phone || "";
  byId("zaloBuy").href = zalo.startsWith("http") ? zalo : "#contact";
  byId("buyModal").hidden = false;
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

function saveCustomer(customer) {
  const customers = JSON.parse(localStorage.getItem("dhsCustomers") || "[]");
  const exists = customers.some((item) => item.email === customer.email);
  const next = exists
    ? customers.map((item) => item.email === customer.email ? { ...item, ...customer } : item)
    : [...customers, { ...customer, createdAt: new Date().toISOString() }];
  localStorage.setItem("dhsCustomers", JSON.stringify(next));
}

async function sendLead(customer) {
  saveCustomer(customer);
  try {
    await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(customer)
    });
  } catch {}
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

document.querySelectorAll("[data-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach((item) => item.classList.toggle("active", item === button));
    renderProducts();
  });
});

byId("searchForm")?.addEventListener("submit", (event) => {
  event.preventDefault();
  searchTerm = String(byId("productSearch").value || "").trim().toLowerCase();
  renderProducts();
  byId("apps").scrollIntoView({ behavior: "smooth" });
});

byId("modalClose")?.addEventListener("click", () => byId("buyModal").hidden = true);
byId("authClose")?.addEventListener("click", () => byId("authModal").hidden = true);

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
  byId("leadMessage").textContent = "Da ghi nhan thong tin. Admin se gui cap nhat khi co san pham moi.";
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
  await sendLead(customer);
  localStorage.setItem("dhsCurrentCustomer", customer.email);
  byId("authMessage").textContent = "Dang ky thanh cong. Thong tin da duoc ghi nhan tren thiet bi nay.";
  event.currentTarget.reset();
});

byId("loginForm")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const email = String(form.get("email") || "").toLowerCase();
  const password = String(form.get("password") || "");
  const customers = JSON.parse(localStorage.getItem("dhsCustomers") || "[]");
  const customer = customers.find((item) => item.email === email && item.password === password);
  if (!customer) {
    byId("authMessage").textContent = "Chua co tai khoan tren thiet bi nay. Hay dang ky truoc.";
    return;
  }
  localStorage.setItem("dhsCurrentCustomer", email);
  byId("authMessage").textContent = `Xin chao ${customer.name || email}.`;
});

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

loadSite().catch((error) => {
  document.body.innerHTML = `<main class="section"><h1>Khong tai duoc du lieu web</h1><p>${escapeHtml(error.message)}</p></main>`;
});
