const money = (value) => value || "Lien he";

let currentSite = null;

async function loadSite() {
  const site = await loadSiteData();
  currentSite = site;
  document.title = `${site.brand.name || "App"} - San pham`;
  byId("brandName").textContent = site.brand.name || "App Store";
  byId("brandLogo").textContent = site.brand.logoText || "AP";
  byId("heroEyebrow").textContent = site.hero.eyebrow || "";
  byId("heroTitle").textContent = site.hero.title || "";
  byId("heroDescription").textContent = site.hero.description || "";
  byId("primaryCta").textContent = site.hero.primaryCta || "Lien he";
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
            <div class="price-line"><strong>${escapeHtml(plan.price)}</strong><span>/ ${escapeHtml(plan.name)}</span></div>
          `).join("") || `<div class="price-line"><strong>${escapeHtml(app.priceFrom || "Lien he")}</strong></div>`}
        </div>
        <ul class="features">${(app.features || []).map((f) => `<li>${escapeHtml(f)}</li>`).join("")}</ul>
        <div class="hero-actions">
          <button class="btn primary buy-btn" data-index="${index}">Mua</button>
          ${app.guideUrl ? `<a class="btn secondary" href="${escapeAttr(app.guideUrl)}" target="_blank" rel="noreferrer">i HDSD</a>` : `<a class="btn secondary" href="#demo">i HDSD</a>`}
        </div>
      </div>
    </article>
  `).join("");
  document.querySelectorAll(".buy-btn").forEach((button) => {
    button.addEventListener("click", () => openBuyModal(site.apps[Number(button.dataset.index)]));
  });

  byId("priceGrid").innerHTML = (site.pricing || []).map((plan) => `
    <article class="price-card ${plan.highlight ? "highlight" : ""}">
      <h3>${escapeHtml(plan.name)}</h3>
      <strong>${escapeHtml(money(plan.price))}</strong>
      <p class="muted">${escapeHtml(plan.period)}</p>
      <ul class="features">${(plan.features || []).map((f) => `<li>${escapeHtml(f)}</li>`).join("")}</ul>
    </article>
  `).join("");

  byId("demoList").innerHTML = (site.demos || []).map((demo) => `
    <article class="demo-card">
      <h3>${escapeHtml(demo.title)}</h3>
      <p class="muted">${escapeHtml(demo.description)}</p>
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
  byId("planSelect").innerHTML = prices.map((plan, index) => `<option value="${index}">${escapeHtml(plan.price)} / ${escapeHtml(plan.name)}</option>`).join("");
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

function byId(id) {
  return document.getElementById(id);
}

byId("modalClose")?.addEventListener("click", () => byId("buyModal").hidden = true);
byId("cancelBuy")?.addEventListener("click", () => byId("buyModal").hidden = true);

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

loadSite().catch((error) => {
  document.body.innerHTML = `<main class="section"><h1>Khong tai duoc du lieu web</h1><p>${escapeHtml(error.message)}</p></main>`;
});
