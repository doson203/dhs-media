const PRODUCTS_SHEET = "Products";
const LEADS_SHEET = "Leads";
const ACCOUNTS_SHEET = "Accounts";
const SPREADSHEET_ID = "1HpQjV0XgVUTmNgpWQFSQPnlQrwRiV6WMnY69FOergGQ";

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || "{}");
    const secret = PropertiesService.getScriptProperties().getProperty("DHS_SECRET") || "";
    if (secret && body.secret !== secret) return json({ ok: false, message: "Unauthorized" });

    if (body.action === "lead") return json(saveLead(body.lead || {}));
    if (body.action === "register") return json(registerAccount(body.account || {}));
    if (body.action === "login") return json(loginAccount(body.email || "", body.password || ""));
    if (body.action === "initProducts") return json(initProductsSheet());
    if (body.action === "upsertProduct") return json(upsertProduct(body.product || {}));
    if (body.action === "deleteProduct") return json(deleteProduct(body.id || ""));
    if (body.action === "replaceProducts") return json(replaceProducts(body.products || []));
    return json({ ok: false, message: "Unknown action" });
  } catch (error) {
    return json({ ok: false, message: String(error && error.message || error) });
  }
}

function initProductsSheet() {
  const headers = productHeaders();
  ensureSheet(PRODUCTS_SHEET, headers);
  return { ok: true, sheet: PRODUCTS_SHEET, headers: headers };
}

function upsertProduct(product) {
  const headers = productHeaders();
  const sheet = ensureSheet(PRODUCTS_SHEET, headers);
  const id = String(product.id || slug(product.title || product.name || "")).trim();
  if (!id) return { ok: false, message: "Missing product id or title" };
  const row = {
    active: String(product.active || "TRUE"),
    type: String(product.type || "prompt"),
    id: id,
    title: String(product.title || product.name || ""),
    description: String(product.description || ""),
    category: String(product.category || "Prompt AI"),
    format: String(product.format || "Video + Prompt"),
    status: String(product.status || "Dang ban"),
    price: String(product.price || "Lien he"),
    license: String(product.license || "1 bo prompt/tai lieu"),
    thumbnail: String(product.thumbnail || product.cover || ""),
    videoUrl: String(product.videoUrl || ""),
    promptUrl: String(product.promptUrl || "")
  };
  upsertByColumn(sheet, "id", id, row, headers);
  return { ok: true, product: row };
}

function replaceProducts(products) {
  const headers = productHeaders();
  const sheet = ensureSheet(PRODUCTS_SHEET, headers);
  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  const rows = products.map(function(product) {
    const id = String(product.id || slug(product.title || product.name || "")).trim();
    return {
      active: String(product.active || "TRUE"),
      type: String(product.type || "prompt"),
      id: id,
      title: String(product.title || product.name || ""),
      description: String(product.description || ""),
      category: String(product.category || "Prompt AI"),
      format: String(product.format || "Video + Prompt"),
      status: String(product.status || "Dang ban"),
      price: String(product.price || "Lien he"),
      license: String(product.license || "1 bo prompt/tai lieu"),
      thumbnail: String(product.thumbnail || product.cover || ""),
      videoUrl: String(product.videoUrl || ""),
      promptUrl: String(product.promptUrl || "")
    };
  }).filter(function(product) {
    return product.id && product.title;
  }).map(function(product) {
    return headers.map(function(header) { return product[header] || ""; });
  });
  if (rows.length) sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  return { ok: true, count: rows.length };
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

function productHeaders() {
  return ["active", "type", "id", "title", "description", "category", "format", "status", "price", "license", "thumbnail", "videoUrl", "promptUrl"];
}

function saveLead(lead) {
  const sheet = ensureSheet(LEADS_SHEET, ["createdAt", "name", "email", "phone", "interest", "source"]);
  const email = String(lead.email || "").trim().toLowerCase();
  if (!email) return { ok: false, message: "Missing email" };
  upsertByEmail(sheet, {
    createdAt: new Date().toISOString(),
    name: String(lead.name || ""),
    email: email,
    phone: String(lead.phone || ""),
    interest: String(lead.interest || ""),
    source: String(lead.source || "website")
  });
  return { ok: true };
}

function registerAccount(account) {
  const sheet = ensureSheet(ACCOUNTS_SHEET, ["createdAt", "updatedAt", "name", "email", "phone", "salt", "passwordHash"]);
  const email = String(account.email || "").trim().toLowerCase();
  const password = String(account.password || "");
  if (!email || !password) return { ok: false, message: "Missing email or password" };
  const existing = findByEmail(sheet, email);
  const salt = existing ? existing.row.salt : Utilities.getUuid().replace(/-/g, "");
  const now = new Date().toISOString();
  const saved = {
    createdAt: existing ? existing.row.createdAt : now,
    updatedAt: now,
    name: String(account.name || ""),
    email: email,
    phone: String(account.phone || ""),
    salt: salt,
    passwordHash: hashPassword(password, salt)
  };
  upsertByEmail(sheet, saved);
  saveLead({ name: saved.name, email: saved.email, phone: saved.phone, interest: "Tai khoan khach hang", source: "account" });
  return { ok: true, customer: publicAccount(saved) };
}

function loginAccount(emailValue, passwordValue) {
  const sheet = ensureSheet(ACCOUNTS_SHEET, ["createdAt", "updatedAt", "name", "email", "phone", "salt", "passwordHash"]);
  const email = String(emailValue || "").trim().toLowerCase();
  const found = findByEmail(sheet, email);
  if (!found) return { ok: false, message: "Email hoac mat khau khong dung" };
  const actual = hashPassword(String(passwordValue || ""), found.row.salt);
  if (actual !== found.row.passwordHash) return { ok: false, message: "Email hoac mat khau khong dung" };
  return { ok: true, customer: publicAccount(found.row) };
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
  const row = headers.map(function(header) { return object[header] || ""; });
  if (found) sheet.getRange(found.index, 1, 1, headers.length).setValues([row]);
  else sheet.appendRow(row);
}

function upsertByColumn(sheet, columnName, columnValue, object, preferredHeaders) {
  const headers = ensureHeaders(sheet, preferredHeaders);
  const found = findByColumn(sheet, columnName, columnValue);
  const row = headers.map(function(header) { return object[header] || ""; });
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
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][columnIndex] || "").trim().toLowerCase() === String(value || "").trim().toLowerCase()) {
      const row = {};
      headers.forEach(function(header, index) { row[header] = rows[i][index]; });
      return { index: i + 1, row: row };
    }
  }
  return null;
}

function getHeaders(sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
}

function ensureHeaders(sheet, preferredHeaders) {
  const headers = getHeaders(sheet);
  const missing = preferredHeaders.filter(function(header) { return !headers.includes(header); });
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
  return bytes.map(function(byte) {
    return ("0" + (byte < 0 ? byte + 256 : byte).toString(16)).slice(-2);
  }).join("");
}

function publicAccount(account) {
  return {
    name: String(account.name || ""),
    email: String(account.email || ""),
    phone: String(account.phone || "")
  };
}

function json(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
