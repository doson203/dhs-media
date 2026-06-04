let site = null;
let leads = [];
let adminStatus = null;
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
  await loadAdminStatus();
  await loadLeads();
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
    document.getElementById("loginMsg").textContent = "Sai mật khẩu.";
    return;
  }
  site = await fetch("/api/admin/site").then((r) => r.json());
  await loadAdminStatus();
  await loadLeads();
  showAdmin();
}

async function loadAdminStatus() {
  const res = await fetch("/api/admin/status");
  adminStatus = res.ok ? await res.json() : null;
}

async function loadLeads() {
  const res = await fetch("/api/admin/leads");
  leads = res.ok ? await res.json() : [];
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
  if (tab === "leads") renderLeads();
}

function renderAll() {
  site.apps ||= [];
  site.videoProducts ||= [];
  site.workflows ||= [];
  site.pricing ||= [];
  site.demos ||= [];
  site.faq ||= [];
  renderGeneral();
  renderApps();
  renderVideoProducts();
  renderWorkflows();
  renderPricing();
  renderDemos();
  renderLeads();
  renderFaq();
  renderUpload();
  renderJson();
}

function renderGeneral() {
  panel("general").innerHTML = `
    <h1>Thông tin chung</h1>
    ${renderAdminStatus()}
    <div class="form-grid">
      ${input("brand.name", "Tên thương hiệu")}
      ${input("brand.logoText", "Chữ logo ngắn")}
      ${input("brand.tagline", "Tagline")}
      ${input("hero.eyebrow", "Dòng nhấn hero")}
      ${input("hero.title", "Tiêu đề hero")}
      ${textarea("hero.description", "Mô tả hero")}
      ${input("hero.primaryCta", "Nút chính")}
      ${input("hero.secondaryCta", "Nút phụ")}
      ${input("hero.image", "Ảnh hero URL")}
      ${input("contact.zalo", "Zalo")}
      ${input("contact.phone", "Số điện thoại")}
      ${input("contact.email", "Email")}
      ${input("contact.telegram", "Telegram")}
    </div>
  `;
  bindInputs(panel("general"));
}

function renderAdminStatus() {
  if (!adminStatus) return "";
  const good = adminStatus.canSaveSite && adminStatus.canSaveLeads;
  return `
    <div class="admin-item">
      <strong>${good ? "Trạng thái lưu dữ liệu: OK" : "Trạng thái lưu dữ liệu: Cần cấu hình thêm"}</strong>
      <p class="notice">
        Chế độ: <code>${escapeHtml(adminStatus.mode || "-")}</code><br>
        Cấu hình web: <code>${escapeHtml(adminStatus.siteStorage || "-")}</code><br>
        Khách đăng ký: <code>${escapeHtml(adminStatus.leadsStorage || "-")}</code><br>
        Upload file: <code>${escapeHtml(adminStatus.uploadStorage || "-")}</code><br>
        ${escapeHtml(adminStatus.message || "")}
      </p>
    </div>
  `;
}

function renderApps() {
  panel("apps").innerHTML = `
    <h1>Tool Reup / Automation</h1>
    <p class="notice">Khu này chỉ quản lý app/tool của bạn. Link tải có thể là file exe/zip upload ở tab Upload file.</p>
    <div class="admin-actions"><button onclick="addApp()">Thêm tool</button></div>
    <div class="item-list">
      ${(site.apps || []).map((app, index) => `
        <div class="admin-item">
          <div class="form-grid">
            ${input(`apps.${index}.name`, "Tên tool")}
            ${input(`apps.${index}.status`, "Trạng thái")}
            ${input(`apps.${index}.version`, "Phiên bản")}
            ${input(`apps.${index}.priceFrom`, "Giá từ")}
            ${input(`apps.${index}.cover`, "Ảnh cover URL")}
            ${input(`apps.${index}.demoUrl`, "Demo URL")}
            ${input(`apps.${index}.downloadUrl`, "Download URL")}
            ${input(`apps.${index}.tagline`, "Mô tả ngắn")}
            ${textarea(`apps.${index}.description`, "Mô tả chi tiết")}
            ${textarea(`apps.${index}.featuresText`, "Tính năng, mỗi dòng 1 mục", (app.features || []).join("\n"))}
          </div>
          <div class="admin-actions"><button onclick="removeItem('apps', ${index})">Xóa tool</button></div>
        </div>
      `).join("")}
    </div>
  `;
  bindInputs(panel("apps"));
}

function renderVideoProducts() {
  panel("videoProducts").innerHTML = `
    <h1>Video/Prompt AI</h1>
    <p class="notice">Khu này dành riêng cho sản phẩm tạo bằng app AI khác: thumbnail, video xem thử và link prompt/tài liệu bán kèm.</p>
    <div class="admin-actions"><button onclick="addVideoProduct()">Thêm video/prompt</button></div>
    <div class="item-list">
      ${(site.videoProducts || []).map((item, index) => `
        <div class="admin-item">
          <div class="form-grid">
            ${input(`videoProducts.${index}.title`, "Tên sản phẩm")}
            ${input(`videoProducts.${index}.category`, "Danh mục")}
            ${input(`videoProducts.${index}.format`, "Định dạng")}
            ${input(`videoProducts.${index}.status`, "Trạng thái")}
            ${input(`videoProducts.${index}.price`, "Giá")}
            ${input(`videoProducts.${index}.license`, "Gói/quyền sử dụng")}
            ${input(`videoProducts.${index}.thumbnail`, "Thumbnail URL")}
            ${input(`videoProducts.${index}.videoUrl`, "Video URL")}
            ${input(`videoProducts.${index}.promptUrl`, "Link prompt/file bán")}
            ${textarea(`videoProducts.${index}.description`, "Mô tả")}
          </div>
          <div class="admin-actions"><button onclick="removeItem('videoProducts', ${index})">Xóa video/prompt</button></div>
        </div>
      `).join("")}
    </div>
  `;
  bindInputs(panel("videoProducts"));
}

function renderWorkflows() {
  panel("workflows").innerHTML = `
    <h1>Workflow</h1>
    <p class="notice">Workflow là sản phẩm quy trình riêng, tách khỏi tool và video/prompt AI.</p>
    <div class="admin-actions"><button onclick="addWorkflow()">Thêm workflow</button></div>
    <div class="item-list">
      ${(site.workflows || []).map((item, index) => `
        <div class="admin-item">
          <div class="form-grid">
            ${input(`workflows.${index}.title`, "Tên workflow")}
            ${input(`workflows.${index}.level`, "Cấp độ")}
            ${input(`workflows.${index}.duration`, "Thời lượng")}
            ${input(`workflows.${index}.price`, "Giá")}
            ${input(`workflows.${index}.cover`, "Ảnh cover URL")}
            ${textarea(`workflows.${index}.description`, "Mô tả")}
            ${textarea(`workflows.${index}.stepsText`, "Các bước, mỗi dòng 1 bước", (item.steps || []).join("\n"))}
          </div>
          <div class="admin-actions"><button onclick="removeItem('workflows', ${index})">Xóa workflow</button></div>
        </div>
      `).join("")}
    </div>
  `;
  bindInputs(panel("workflows"));
}

function renderPricing() {
  panel("pricing").innerHTML = `
    <h1>Bảng giá chung</h1>
    <div class="admin-actions"><button onclick="addPlan()">Thêm gói giá</button></div>
    <div class="item-list">
      ${(site.pricing || []).map((plan, index) => `
        <div class="admin-item">
          <div class="form-grid">
            ${input(`pricing.${index}.name`, "Tên gói")}
            ${input(`pricing.${index}.price`, "Giá")}
            ${input(`pricing.${index}.period`, "Chu kỳ")}
            <label class="field">Nổi bật
              <select data-path="pricing.${index}.highlight">
                <option value="false" ${!plan.highlight ? "selected" : ""}>Không</option>
                <option value="true" ${plan.highlight ? "selected" : ""}>Có</option>
              </select>
            </label>
            ${textarea(`pricing.${index}.featuresText`, "Quyền lợi, mỗi dòng 1 mục", (plan.features || []).join("\n"))}
          </div>
          <div class="admin-actions"><button onclick="removeItem('pricing', ${index})">Xóa gói</button></div>
        </div>
      `).join("")}
    </div>
  `;
  bindInputs(panel("pricing"));
}

function renderDemos() {
  panel("demos").innerHTML = `
    <h1>Video demo chung</h1>
    <div class="admin-actions"><button onclick="addDemo()">Thêm demo</button></div>
    <div class="item-list">
      ${(site.demos || []).map((demo, index) => `
        <div class="admin-item">
          <div class="form-grid">
            ${input(`demos.${index}.title`, "Tiêu đề")}
            ${input(`demos.${index}.url`, "Video URL")}
            ${input(`demos.${index}.poster`, "Poster URL")}
            ${textarea(`demos.${index}.description`, "Mô tả")}
          </div>
          <div class="admin-actions"><button onclick="removeItem('demos', ${index})">Xóa demo</button></div>
        </div>
      `).join("")}
    </div>
  `;
  bindInputs(panel("demos"));
}

function renderLeads() {
  panel("leads").innerHTML = `
    <h1>Khách đăng ký</h1>
    <p class="notice">Danh sách khách để bạn gửi mail/cập nhật sản phẩm. Trên hosting serverless cần nối thêm database để lưu lâu dài.</p>
    <div class="admin-actions"><button onclick="refreshLeads()">Tải lại danh sách</button></div>
    <div class="item-list">
      ${leads.length ? leads.map((lead) => `
        <div class="admin-item">
          <strong>${escapeHtml(lead.name || "Khách chưa nhập tên")}</strong>
          <p class="notice">
            Email: <code>${escapeHtml(lead.email)}</code><br>
            SĐT/Zalo: <code>${escapeHtml(lead.phone || "-")}</code><br>
            Quan tâm: ${escapeHtml(lead.interest || "-")}<br>
            Nguồn: ${escapeHtml(lead.source || "-")}<br>
            Thời gian: ${escapeHtml(formatDate(lead.createdAt))}
          </p>
        </div>
      `).join("") : `<div class="empty-state">Chưa có khách đăng ký.</div>`}
    </div>
  `;
}

function renderFaq() {
  panel("faq").innerHTML = `
    <h1>FAQ</h1>
    <div class="admin-actions"><button onclick="addFaq()">Thêm câu hỏi</button></div>
    <div class="item-list">
      ${(site.faq || []).map((item, index) => `
        <div class="admin-item">
          <div class="form-grid">
            ${input(`faq.${index}.question`, "Câu hỏi")}
            ${textarea(`faq.${index}.answer`, "Câu trả lời")}
          </div>
          <div class="admin-actions"><button onclick="removeItem('faq', ${index})">Xóa câu hỏi</button></div>
        </div>
      `).join("")}
    </div>
  `;
  bindInputs(panel("faq"));
}

function renderUpload() {
  panel("upload").innerHTML = `
    <h1>Upload file</h1>
    <p class="notice">Upload file app exe/zip, ảnh cover, thumbnail hoặc video demo. Sau khi upload, copy URL để gắn vào đúng sản phẩm.</p>
    <div class="upload-row">
      <input id="fileInput" type="file">
      <button onclick="uploadFile()">Upload</button>
    </div>
    <p class="notice" id="uploadResult"></p>
  `;
}

function renderJson() {
  panel("json").innerHTML = `
    <h1>JSON nâng cao</h1>
    <p class="notice">Dùng khi cần copy/sửa nhanh toàn bộ cấu hình web.</p>
    <label class="field">Site JSON
      <textarea id="jsonEditor" style="min-height:520px">${escapeHtml(JSON.stringify(site, null, 2))}</textarea>
    </label>
    <div class="admin-actions"><button onclick="applyJson()">Áp dụng JSON</button></div>
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
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return status(data.message || "Lưu lỗi. Hãy đăng nhập lại.");
  }
  site = (await res.json()).site;
  status("Đã lưu thành công.");
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
    : escapeHtml(data.message || "Upload lỗi");
}

async function refreshLeads() {
  await loadLeads();
  renderLeads();
}

function addApp() {
  site.apps.push({
    id: `app-${Date.now()}`,
    name: "Tool mới",
    status: "Đang bán",
    version: "1.0.0",
    priceFrom: "Liên hệ",
    cover: "/assets/app-preview.svg",
    demoUrl: "",
    downloadUrl: "",
    tagline: "",
    description: "",
    features: []
  });
  renderApps();
}

function addVideoProduct() {
  site.videoProducts.push({
    id: `video-product-${Date.now()}`,
    title: "Video/Prompt mới",
    description: "",
    category: "Prompt AI",
    format: "Video + Prompt",
    status: "Đang bán",
    price: "Liên hệ",
    license: "",
    thumbnail: "/assets/app-preview.svg",
    videoUrl: "",
    promptUrl: ""
  });
  renderVideoProducts();
}

function addWorkflow() {
  site.workflows.push({
    id: `workflow-${Date.now()}`,
    title: "Workflow mới",
    description: "",
    level: "Cơ bản",
    duration: "",
    price: "Liên hệ",
    cover: "/assets/app-preview.svg",
    steps: []
  });
  renderWorkflows();
}

function addPlan() {
  site.pricing.push({ id: `plan-${Date.now()}`, name: "Gói mới", price: "Liên hệ", period: "", highlight: false, features: [] });
  renderPricing();
}

function addDemo() {
  site.demos.push({ title: "Demo mới", description: "", url: "", poster: "" });
  renderDemos();
}

function addFaq() {
  site.faq.push({ question: "Câu hỏi mới", answer: "" });
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
  (site.workflows || []).forEach((workflow) => {
    if (workflow.stepsText !== undefined) {
      workflow.steps = lines(workflow.stepsText);
      delete workflow.stepsText;
    }
  });
}

function applyJson(rerender = true) {
  try {
    site = JSON.parse(document.getElementById("jsonEditor").value);
    status("JSON đã áp dụng, bấm Lưu thay đổi để ghi file.");
    if (rerender) renderAll();
  } catch (error) {
    status(`JSON lỗi: ${error.message}`);
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
  while (parts.length > 1) {
    const part = parts.shift();
    obj[part] ??= {};
    obj = obj[part];
  }
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

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("vi-VN");
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}
