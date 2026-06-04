const money = (value) => value || "Lien he";

let currentSite = null;

async function loadSite() {
  const site = await loadSiteData();
  currentSite = site;
  document.title = `${site.brand.name || "DHS MEDIA"} - Kho app automation`;
  byId("brandName").textContent = site.brand.name || "DHS MEDIA";
  byId("brandLogo").textContent = site.brand.logoText || "DM";
  byId("heroEyebrow").textContent = site.hero.eyebrow || "";
  byId("heroTitle").textContent = site.hero.title || "";
  byId("heroDescription").textContent = site.hero.description || "";
  byId("primaryCta").textContent = site.hero.primaryCta || "Xem san pham";
  byId("secondaryCta").textContent = site.hero.secondaryCta || "Xem demo";
  byId("heroImage").src = site.hero.image || "/assets/app-preview.svg";

  byId("stats").innerHTML = (site.stats || []).map((item) => `
    <div class="stat"><strong>${escapeHtml(item.value)}</strong><span>${escapeHtml(item.label)}</span></div>
  `).join("");

  byId("appGrid").innerHTML = (site.apps || []).map((app, index) => `
    <article class="app-card shop-card">
      <img src="${escapeAttr(app.cover || "/assets/app-preview.svg")}" alt="${escapeAttr(app.name)}">
      <div class="app-body">
        <div class="app-meta"><span>${escapeHtml(app.status)}</span><span>${escapeHtml(app.version)}</span></div>
        <h3>${escapeHtml(app.name)}</h3>
        <p class="muted">${escapeHtml(app.tagline)}</p>
        <div class="price-list">
          ${(app.prices || []).map((plan) => `
            <div class="price-line"><strong>${escapeHtml(plan.price)}</strong><span>${escapeHtml(plan.name)}</span></div>
          `).join("") || `<div class="price-line"><strong>${escapeHtml(app.priceFrom || "Lien he")}</strong><span>Gia tu</span></div>`}
        </div>
        <ul class="features">${(app.features || []).slice(0, 5).map((f) => `<li>${escapeHtml(f)}</li>`).join("")}</ul>
        <div class="hero-actions">
          <button class="btn primary buy-btn" data-index="${index}">Mua ngay</button>
          ${app.demoUrl ? `<a class="btn secondary" href="${escapeAttr(app.demoUrl)}" target="_blank" rel="noreferrer">Xem demo</a>` : `<a class="btn secondary" href="#demo">Xem demo</a>`}
        </div>
      </div>
    </article>
  `).join("");

  document.querySelectorAll(".buy-btn").forEach((button) => {
    button.addEventListener("click", () => openBuyModal(site.apps[Number(button.dataset.index)]));
  });

  byId("demoList").innerHTML = (site.demos || []).map((demo) => `
    <article class="demo-card">
      <h3>${escapeHtml(demo.title || "Demo san pham")}</h3>
      <p class="muted">${escapeHtml(demo.description || "Cap nhat link demo trong cau hinh web.")}</p>
      ${demo.url ? `<a href="${escapeAttr(demo.url)}" target="_blank" rel="noreferrer">Mo demo</a>` : "<span class=\"muted\">Chua co link demo</span>"}
    </article>
  `).join("");

  byId("faqList").innerHTML = (site.faq || []).map((item) => `
    <article class="faq-item"><h3>${escapeHtml(item.question)}</h3><p class="muted">${escapeHtml(item.answer)}</p></article>
  `).join("");

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
