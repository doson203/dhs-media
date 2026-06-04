let site = null;
let activeTab = "general";

const panels = () => Array.from(document.querySelectorAll("[data-panel]"));
const navButtons = () => Array.from(document.querySelectorAll("[data-tab]"));

document.getElementById("loginBtn").addEventListener("click", login);
document.getElementById("password").addEventListener("keydown", (event) => {
  if (event.key === "Enter") login();
});
document.getElementById("saveBtn").addEventListener("click", save);
document.getElementById("logoutBtn").addEventListener("click", logout);
navButtons().forEach((button) => button.addEventListener("click", () => setTab(button.dataset.tab)));

boot();

async function boot() {
  const res = await fetch("/api/admin/site");
  if (res.status === 401) return;
  site = await res.json();
  showAdmin();
}

async function login() {
  const password = document.getElementById("password").value;
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password })
  });
  if (!res.ok) {
    document.getElementById("loginMsg").textContent = "Sai mat khau.";
    return;
  }
  site = await fetch("/api/admin/site").then((r) => r.json());
  showAdmin();
}

async function logout() {
  await fetch("/api/logout", { method: "POST" });
  location.reload();
}

function showAdmin() {
  document.getElementById("loginBox").hidden = true;
  document.getElementById("adminApp").hidden = false;
  renderAll();
}

function setTab(tab) {
  activeTab = tab;
  navButtons().forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
  panels().forEach((panel) => panel.hidden = panel.dataset.panel !== tab);
  if (tab === "json") renderJson();
}

function renderAll() {
  renderGeneral();
  renderApps();
  renderPricing();
  renderDemos();
  renderFaq();
  renderUpload();
  renderJson();
}

function renderGeneral() {
  panel("general").innerHTML = `
    <h1>Thong tin chung</h1>
    <div class="form-grid">
      ${input("brand.name", "Ten thuong hieu")}
      ${input("brand.logoText", "Chu logo ngan")}
      ${input("brand.tagline", "Tagline")}
      ${input("hero.eyebrow", "Eyebrow hero")}
      ${input("hero.title", "Tieu de hero")}
      ${textarea("hero.description", "Mo ta hero")}
      ${input("hero.primaryCta", "Nut chinh")}
      ${input("hero.secondaryCta", "Nut phu")}
      ${input("hero.image", "Anh hero URL")}
      ${input("contact.zalo", "Zalo")}
      ${input("contact.phone", "So dien thoai")}
      ${input("contact.email", "Email")}
      ${input("contact.telegram", "Telegram")}
    </div>
  `;
  bindInputs(panel("general"));
}

function renderApps() {
  panel("apps").innerHTML = `
    <h1>San pham app</h1>
    <p class="notice">Download URL co the la link file exe/zip upload o tab Upload file.</p>
    <div class="admin-actions"><button onclick="addApp()">Them app</button></div>
    <div class="item-list">
      ${(site.apps || []).map((app, index) => `
        <div class="admin-item">
          <div class="form-grid">
            ${input(`apps.${index}.name`, "Ten app")}
            ${input(`apps.${index}.status`, "Trang thai")}
            ${input(`apps.${index}.version`, "Phien ban")}
            ${input(`apps.${index}.priceFrom`, "Gia tu")}
            ${input(`apps.${index}.cover`, "Anh cover URL")}
            ${input(`apps.${index}.demoUrl`, "Demo URL")}
            ${input(`apps.${index}.downloadUrl`, "Download URL")}
            ${input(`apps.${index}.tagline`, "Mo ta ngan")}
            ${textarea(`apps.${index}.description`, "Mo ta chi tiet")}
            ${textarea(`apps.${index}.featuresText`, "Tinh nang, moi dong 1 muc", (app.features || []).join("\\n"))}
          </div>
          <div class="admin-actions"><button onclick="removeItem('apps', ${index})">Xoa app</button></div>
        </div>
      `).join("")}
    </div>
  `;
  bindInputs(panel("apps"));
}

function renderPricing() {
  panel("pricing").innerHTML = `
    <h1>Bang gia</h1>
    <div class="admin-actions"><button onclick="addPlan()">Them goi gia</button></div>
    <div class="item-list">
      ${(site.pricing || []).map((plan, index) => `
        <div class="admin-item">
          <div class="form-grid">
            ${input(`pricing.${index}.name`, "Ten goi")}
            ${input(`pricing.${index}.price`, "Gia")}
            ${input(`pricing.${index}.period`, "Chu ky")}
            <label class="field">Noi bat
              <select data-path="pricing.${index}.highlight">
                <option value="false" ${!plan.highlight ? "selected" : ""}>Khong</option>
                <option value="true" ${plan.highlight ? "selected" : ""}>Co</option>
              </select>
            </label>
            ${textarea(`pricing.${index}.featuresText`, "Quyen loi, moi dong 1 muc", (plan.features || []).join("\\n"))}
          </div>
          <div class="admin-actions"><button onclick="removeItem('pricing', ${index})">Xoa goi</button></div>
        </div>
      `).join("")}
    </div>
  `;
  bindInputs(panel("pricing"));
}

function renderDemos() {
  panel("demos").innerHTML = `
    <h1>Video demo</h1>
    <div class="admin-actions"><button onclick="addDemo()">Them demo</button></div>
    <div class="item-list">
      ${(site.demos || []).map((demo, index) => `
        <div class="admin-item">
          <div class="form-grid">
            ${input(`demos.${index}.title`, "Tieu de")}
            ${input(`demos.${index}.url`, "Video URL")}
            ${input(`demos.${index}.poster`, "Poster URL")}
            ${textarea(`demos.${index}.description`, "Mo ta")}
          </div>
          <div class="admin-actions"><button onclick="removeItem('demos', ${index})">Xoa demo</button></div>
        </div>
      `).join("")}
    </div>
  `;
  bindInputs(panel("demos"));
}

function renderFaq() {
  panel("faq").innerHTML = `
    <h1>FAQ</h1>
    <div class="admin-actions"><button onclick="addFaq()">Them cau hoi</button></div>
    <div class="item-list">
      ${(site.faq || []).map((item, index) => `
        <div class="admin-item">
          <div class="form-grid">
            ${input(`faq.${index}.question`, "Cau hoi")}
            ${textarea(`faq.${index}.answer`, "Cau tra loi")}
          </div>
          <div class="admin-actions"><button onclick="removeItem('faq', ${index})">Xoa cau hoi</button></div>
        </div>
      `).join("")}
    </div>
  `;
  bindInputs(panel("faq"));
}

function renderUpload() {
  panel("upload").innerHTML = `
    <h1>Upload file</h1>
    <p class="notice">Upload file app exe/zip, anh cover hoac video demo. Sau khi upload, copy URL de gan vao san pham/demo.</p>
    <div class="upload-row">
      <input id="fileInput" type="file">
      <button onclick="uploadFile()">Upload</button>
    </div>
    <p class="notice" id="uploadResult"></p>
  `;
}

function renderJson() {
  panel("json").innerHTML = `
    <h1>JSON nang cao</h1>
    <p class="notice">Dung khi can copy/sua nhanh toan bo cau hinh web.</p>
    <label class="field">Site JSON
      <textarea id="jsonEditor" style="min-height:520px">${escapeHtml(JSON.stringify(site, null, 2))}</textarea>
    </label>
    <div class="admin-actions"><button onclick="applyJson()">Ap dung JSON</button></div>
  `;
}

async function save() {
  if (activeTab === "json") applyJson(false);
  normalizeTextareaLists();
  const res = await fetch("/api/admin/site", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(site)
  });
  if (!res.ok) return status("Luu loi. Hay dang nhap lai.");
  site = (await res.json()).site;
  status("Da luu thanh cong.");
  renderAll();
  setTab(activeTab);
}

async function uploadFile() {
  const input = document.getElementById("fileInput");
  if (!input.files.length) return;
  const form = new FormData();
  form.append("file", input.files[0]);
  const res = await fetch("/api/admin/upload", { method: "POST", body: form });
  const data = await res.json();
  document.getElementById("uploadResult").innerHTML = data.ok
    ? `Upload OK: <code>${escapeHtml(data.file.url)}</code>`
    : escapeHtml(data.message || "Upload loi");
}

function addApp() {
  site.apps.push({ id: `app-${Date.now()}`, name: "App moi", status: "Dang ban", version: "1.0.0", priceFrom: "Lien he", cover: "/assets/app-preview.svg", demoUrl: "", downloadUrl: "", tagline: "", description: "", features: [] });
  renderApps();
}

function addPlan() {
  site.pricing.push({ id: `plan-${Date.now()}`, name: "Goi moi", price: "Lien he", period: "", highlight: false, features: [] });
  renderPricing();
}

function addDemo() {
  site.demos.push({ title: "Demo moi", description: "", url: "", poster: "" });
  renderDemos();
}

function addFaq() {
  site.faq.push({ question: "Cau hoi moi", answer: "" });
  renderFaq();
}

function removeItem(collection, index) {
  site[collection].splice(index, 1);
  renderAll();
  setTab(activeTab);
}

function bindInputs(scope) {
  Array.from(scope.querySelectorAll("[data-path]")).forEach((element) => {
    element.addEventListener("input", () => {
      let value = element.value;
      if (value === "true") value = true;
      if (value === "false") value = false;
      setValue(element.dataset.path, value);
    });
  });
}

function normalizeTextareaLists() {
  (site.apps || []).forEach((app) => {
    if (app.featuresText !== undefined) {
      app.features = lines(app.featuresText);
      delete app.featuresText;
    }
  });
  (site.pricing || []).forEach((plan) => {
    if (plan.featuresText !== undefined) {
      plan.features = lines(plan.featuresText);
      delete plan.featuresText;
    }
  });
}

function applyJson(rerender = true) {
  try {
    site = JSON.parse(document.getElementById("jsonEditor").value);
    status("JSON da ap dung, bam Luu thay doi de ghi file.");
    if (rerender) renderAll();
  } catch (error) {
    status(`JSON loi: ${error.message}`);
  }
}

function input(path, label, override) {
  const value = override ?? getValue(path) ?? "";
  return `<label class="field">${label}<input data-path="${path}" value="${escapeAttr(value)}"></label>`;
}

function textarea(path, label, override) {
  const value = override ?? getValue(path) ?? "";
  return `<label class="field">${label}<textarea data-path="${path}">${escapeHtml(value)}</textarea></label>`;
}

function getValue(path) {
  return path.split(".").reduce((obj, key) => obj?.[key], site);
}

function setValue(path, value) {
  const parts = path.split(".");
  let obj = site;
  while (parts.length > 1) obj = obj[parts.shift()];
  obj[parts[0]] = value;
}

function panel(name) {
  return document.querySelector(`[data-panel="${name}"]`);
}

function status(message) {
  document.getElementById("statusMsg").textContent = message;
}

function lines(value) {
  return String(value || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}
