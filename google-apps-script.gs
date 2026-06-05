// DHS MEDIA Google Sheet backend.
// Deploy as Web App: Execute as "Me", Who has access "Anyone".
// Add Script Property: DHS_SECRET = the same value as GOOGLE_SHEETS_SECRET on Vercel.

const PRODUCTS_SHEET = "Products";
const LEADS_SHEET = "Leads";
const ACCOUNTS_SHEET = "Accounts";
const SPREADSHEET_ID = "1HpQjV0XgVUTmNgpWQFSQPnlQrwRiV6WMnY69FOergGQ";

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || "{}");
    const secret = PropertiesService.getScriptProperties().getProperty("DHS_SECRET") || "";
    if (secret && body.secret !== secret) return json({ ok: false, message: "Unauthorized" }, 401);

    if (body.action === "lead") return json(saveLead(body.lead || {}));
    if (body.action === "register") return json(registerAccount(body.account || {}, body.verificationUrl || ""));
    if (body.action === "registerWithVerification") return json(registerAccount(body.account || {}, body.verificationUrl || ""));
    if (body.action === "login") return json(loginAccount(body.email || "", body.password || ""));
    if (body.action === "verifyAccount") return json(verifyAccount(body.token || ""));
    if (body.action === "googleLogin") return json(googleLogin(body.profile || {}));
    if (body.action === "upsertProduct") return json(upsertProduct(body.product || {}));
    if (body.action === "deleteProduct") return json(deleteProduct(body.id || ""));
    if (body.action === "sendDeliveryEmail") return json(sendDeliveryEmail(body.order || {}));
    if (body.action === "initProducts") return json(initProductsSheet());
    return json({ ok: false, message: "Unknown action" }, 400);
  } catch (error) {
    return json({ ok: false, message: String(error && error.message || error) }, 500);
  }
}

function initProductsSheet() {
  const headers = productHeaders();
  ensureSheet(PRODUCTS_SHEET, headers);
  return { ok: true, sheet: PRODUCTS_SHEET, headers };
}

function upsertProduct(product) {
  const headers = productHeaders();
  const sheet = ensureSheet(PRODUCTS_SHEET, headers);
  const id = String(product.id || slug(product.title || product.name || "")).trim();
  if (!id) return { ok: false, message: "Missing product id or title" };
  const row = {
    active: String(product.active || "TRUE"),
    type: String(product.type || "prompt"),
    id,
    title: String(product.title || product.name || ""),
    description: String(product.description || ""),
    category: String(product.category || "Prompt AI"),
    format: String(product.format || "Video + Prompt"),
    status: String(product.status || "Đang bán"),
    price: String(product.price || "Liên hệ"),
    pricingType: String(product.pricingType || product.priceType || ""),
    license: String(product.license || "1 bộ prompt/tài liệu"),
    thumbnail: String(product.thumbnail || product.cover || ""),
    videoUrl: String(product.videoUrl || ""),
    promptUrl: String(product.promptUrl || "")
  };
  upsertByColumn(sheet, "id", id, row, headers);
  return { ok: true, product: row };
}

function deleteProduct(idValue) {
  const sheet = ensureSheet(PRODUCTS_SHEET, productHeaders());
  const id = String(idValue || "").trim();
  if (!id) return { ok: false, message: "Missing product id" };
  const found = findByColumn(sheet, "id", id);
  if (!found) return { ok: true, deleted: false };
  sheet.deleteRow(found.index);
  return { ok: true, deleted: true };
}

function sendDeliveryEmail(order) {
  const email = String(order.buyerEmail || "").trim().toLowerCase();
  const promptUrl = String(order.promptUrl || "").trim();
  if (!email) return { ok: false, message: "Missing buyer email" };
  if (!promptUrl) return { ok: false, message: "Missing product link" };

  const productTitle = String(order.productTitle || u("S\u1ea3n ph\u1ea9m DHS MEDIA"));
  const orderCode = String(order.orderCode || "");
  const subject = u("DHS MEDIA - Link s\u1ea3n ph\u1ea9m ") + productTitle;
  const plainBody = [
    u("C\u1ea3m \u01a1n b\u1ea1n \u0111\u00e3 mua s\u1ea3n ph\u1ea9m t\u1ea1i DHS MEDIA."),
    "",
    u("S\u1ea3n ph\u1ea9m: ") + productTitle,
    u("M\u00e3 \u0111\u01a1n: ") + orderCode,
    u("Link nh\u1eadn s\u1ea3n ph\u1ea9m/prompt:"),
    promptUrl,
    "",
    u("N\u1ebfu c\u1ea7n h\u1ed7 tr\u1ee3, vui l\u00f2ng ph\u1ea3n h\u1ed3i email n\u00e0y.")
  ].join("\n");
  const htmlBody = [
    "<meta charset=\"UTF-8\">",
    "<h2>" + u("C\u1ea3m \u01a1n b\u1ea1n \u0111\u00e3 mua s\u1ea3n ph\u1ea9m t\u1ea1i DHS MEDIA") + "</h2>",
    "<p>" + u("S\u1ea3n ph\u1ea9m:") + " <strong>" + escapeHtml(productTitle) + "</strong></p>",
    "<p>" + u("M\u00e3 \u0111\u01a1n:") + " <strong>" + escapeHtml(orderCode) + "</strong></p>",
    "<p>" + u("Link nh\u1eadn s\u1ea3n ph\u1ea9m/prompt:") + "</p>",
    "<p><a href=\"" + escapeHtml(promptUrl) + "\">" + escapeHtml(promptUrl) + "</a></p>",
    "<p>" + u("N\u1ebfu c\u1ea7n h\u1ed7 tr\u1ee3, vui l\u00f2ng ph\u1ea3n h\u1ed3i email n\u00e0y.") + "</p>"
  ].join("");

  MailApp.sendEmail({
    to: email,
    subject: subject,
    body: plainBody,
    htmlBody: htmlBody
  });
  return { ok: true, provider: "gmail" };
}

function authorizeMailApp() {
  MailApp.sendEmail({
    to: Session.getActiveUser().getEmail(),
    subject: "DHS MEDIA - Kich hoat gui email",
    body: "Google Apps Script da duoc cap quyen gui email cho DHS MEDIA."
  });
  return { ok: true };
}

function u(value) {
  return value;
}

function productHeaders() {
  return ["active", "type", "id", "title", "description", "category", "format", "status", "price", "pricingType", "license", "thumbnail", "videoUrl", "promptUrl"];
}

function saveLead(lead) {
  const sheet = ensureSheet(LEADS_SHEET, ["createdAt", "name", "email", "phone", "interest", "source"]);
  const email = String(lead.email || "").trim().toLowerCase();
  if (!email) return { ok: false, message: "Missing email" };
  upsertByEmail(sheet, {
    createdAt: new Date().toISOString(),
    name: String(lead.name || ""),
    email,
    phone: String(lead.phone || ""),
    interest: String(lead.interest || ""),
    source: String(lead.source || "website")
  });
  return { ok: true };
}

function accountHeaders() {
  return ["createdAt", "updatedAt", "name", "email", "phone", "salt", "passwordHash", "verified", "verificationToken", "verificationSentAt", "provider", "googleSub"];
}

function registerAccount(account, verificationUrl) {
  const sheet = ensureSheet(ACCOUNTS_SHEET, accountHeaders());
  const headers = ensureHeaders(sheet, accountHeaders());
  const email = String(account.email || "").trim().toLowerCase();
  const password = String(account.password || "");
  if (!email || !password) return { ok: false, message: "Missing email or password" };

  const existing = findByEmail(sheet, email);
  const salt = existing ? existing.row.salt : Utilities.getUuid().replace(/-/g, "");
  const now = new Date().toISOString();
  const token = Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, "");
  const keepVerified = String(existing && existing.row.verified || "").toUpperCase() === "TRUE";
  const saved = {
    createdAt: existing ? existing.row.createdAt : now,
    updatedAt: now,
    name: String(account.name || ""),
    email,
    phone: String(account.phone || ""),
    salt,
    passwordHash: hashPassword(password, salt),
    verified: keepVerified ? "TRUE" : "FALSE",
    verificationToken: keepVerified ? "" : token,
    verificationSentAt: keepVerified ? "" : now,
    provider: "password",
    googleSub: existing ? String(existing.row.googleSub || "") : ""
  };
  upsertByEmailWithHeaders(sheet, saved, headers);
  saveLead({ name: saved.name, email: saved.email, phone: saved.phone, interest: "Tai khoan khach hang", source: "account" });
  if (!keepVerified) sendVerificationEmail(saved, verificationUrl || "https://dhs-media.vercel.app/xac-nhan-email");
  return { ok: true, requiresVerification: !keepVerified, customer: publicAccount(saved) };
}

function loginAccount(emailValue, passwordValue) {
  const sheet = ensureSheet(ACCOUNTS_SHEET, accountHeaders());
  ensureHeaders(sheet, accountHeaders());
  const email = String(emailValue || "").trim().toLowerCase();
  const found = findByEmail(sheet, email);
  if (!found) return { ok: false, message: "Email hoac mat khau khong dung" };
  const actual = hashPassword(String(passwordValue || ""), found.row.salt);
  if (actual !== found.row.passwordHash) return { ok: false, message: "Email hoac mat khau khong dung" };
  const verified = String(found.row.verified || "").toUpperCase();
  if (verified && verified !== "TRUE") {
    return { ok: false, needsVerification: true, message: "Can xac nhan email truoc khi dang nhap." };
  }
  return { ok: true, customer: publicAccount(found.row) };
}

function verifyAccount(tokenValue) {
  const token = String(tokenValue || "").trim();
  if (!token) return { ok: false, message: "Missing verification token" };
  const sheet = ensureSheet(ACCOUNTS_SHEET, accountHeaders());
  const headers = ensureHeaders(sheet, accountHeaders());
  const found = findByColumn(sheet, "verificationToken", token);
  if (!found) return { ok: false, message: "Token khong hop le hoac da het han." };
  const row = Object.assign({}, found.row, {
    updatedAt: new Date().toISOString(),
    verified: "TRUE",
    verificationToken: "",
    verificationSentAt: ""
  });
  sheet.getRange(found.index, 1, 1, headers.length).setValues([headers.map((header) => row[header] || "")]);
  return { ok: true, customer: publicAccount(row) };
}

function googleLogin(profile) {
  const email = String(profile.email || "").trim().toLowerCase();
  const emailVerified = profile.email_verified === true || String(profile.email_verified || "").toLowerCase() === "true";
  if (!email || !emailVerified) return { ok: false, message: "Google email chua duoc xac minh" };
  const sheet = ensureSheet(ACCOUNTS_SHEET, accountHeaders());
  const headers = ensureHeaders(sheet, accountHeaders());
  const existing = findByEmail(sheet, email);
  const now = new Date().toISOString();
  const row = {
    createdAt: existing ? existing.row.createdAt : now,
    updatedAt: now,
    name: String(profile.name || (existing && existing.row.name) || ""),
    email,
    phone: existing ? String(existing.row.phone || "") : "",
    salt: existing ? String(existing.row.salt || "") : "",
    passwordHash: existing ? String(existing.row.passwordHash || "") : "",
    verified: "TRUE",
    verificationToken: "",
    verificationSentAt: "",
    provider: "google",
    googleSub: String(profile.sub || "")
  };
  upsertByEmailWithHeaders(sheet, row, headers);
  saveLead({ name: row.name, email: row.email, phone: row.phone, interest: "Google account", source: "google" });
  return { ok: true, customer: publicAccount(row) };
}

function sendVerificationEmail(account, verificationUrl) {
  const link = String(verificationUrl || "https://dhs-media.vercel.app/xac-nhan-email").replace(/\?+$/, "") + "?token=" + encodeURIComponent(account.verificationToken);
  const subject = "DHS MEDIA - Xac nhan tai khoan";
  const plainBody = [
    "Cam on ban da dang ky tai khoan DHS MEDIA.",
    "",
    "Vui long bam link duoi day de xac nhan email truoc khi dang nhap:",
    link,
    "",
    "Neu ban khong dang ky tai khoan, hay bo qua email nay."
  ].join("\n");
  const htmlBody = [
    "<meta charset=\"UTF-8\">",
    "<h2>DHS MEDIA - Xác nhận tài khoản</h2>",
    "<p>Cảm ơn bạn đã đăng ký tài khoản DHS MEDIA.</p>",
    "<p>Vui lòng bấm nút bên dưới để xác nhận email trước khi đăng nhập.</p>",
    "<p><a href=\"" + escapeHtml(link) + "\" style=\"display:inline-block;padding:12px 18px;background:#0f172a;color:#fff;border-radius:10px;text-decoration:none;font-weight:700\">Xác nhận tài khoản</a></p>",
    "<p>Hoặc mở link này: <a href=\"" + escapeHtml(link) + "\">" + escapeHtml(link) + "</a></p>"
  ].join("");
  MailApp.sendEmail({ to: account.email, subject: subject, body: plainBody, htmlBody: htmlBody });
}

function ensureSheet(name, headers) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  const firstRow = sheet.getRange(1, 1, 1, Math.max(headers.length, sheet.getLastColumn() || 1)).getValues()[0];
  const hasHeaders = firstRow.some(Boolean);
  if (!hasHeaders) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  return sheet;
}

function upsertByEmail(sheet, object) {
  const headers = getHeaders(sheet);
  const found = findByEmail(sheet, object.email);
  const row = headers.map((header) => object[header] || "");
  if (found) sheet.getRange(found.index, 1, 1, headers.length).setValues([row]);
  else sheet.appendRow(row);
}

function upsertByEmailWithHeaders(sheet, object, headers) {
  const found = findByEmail(sheet, object.email);
  const row = headers.map((header) => object[header] || "");
  if (found) sheet.getRange(found.index, 1, 1, headers.length).setValues([row]);
  else sheet.appendRow(row);
}

function upsertByColumn(sheet, columnName, columnValue, object, preferredHeaders) {
  const headers = ensureHeaders(sheet, preferredHeaders);
  const found = findByColumn(sheet, columnName, columnValue);
  const row = headers.map((header) => object[header] || "");
  if (found) sheet.getRange(found.index, 1, 1, headers.length).setValues([row]);
  else sheet.appendRow(row);
}

function findByEmail(sheet, email) {
  return findByColumn(sheet, "email", email);
}

function findByColumn(sheet, columnName, value) {
  const rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return null;
  const headers = rows[0].map(String);
  const columnIndex = headers.indexOf(columnName);
  if (columnIndex < 0) return null;
  for (let i = 1; i < rows.length; i += 1) {
    if (String(rows[i][columnIndex] || "").trim().toLowerCase() === String(value || "").trim().toLowerCase()) {
      const row = {};
      headers.forEach((header, index) => row[header] = rows[i][index]);
      return { index: i + 1, row };
    }
  }
  return null;
}

function getHeaders(sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
}

function ensureHeaders(sheet, preferredHeaders) {
  const headers = getHeaders(sheet);
  const missing = preferredHeaders.filter((header) => !headers.includes(header));
  if (!missing.length) return headers;
  const next = headers.concat(missing);
  sheet.getRange(1, 1, 1, next.length).setValues([next]);
  return next;
}

function slug(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function hashPassword(password, salt) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(salt || "") + ":" + String(password || ""));
  return bytes.map((byte) => ("0" + (byte < 0 ? byte + 256 : byte).toString(16)).slice(-2)).join("");
}

function publicAccount(account) {
  return {
    name: String(account.name || ""),
    email: String(account.email || ""),
    phone: String(account.phone || "")
  };
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function json(value, status) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
