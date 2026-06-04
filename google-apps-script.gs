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
    if (body.action === "register") return json(registerAccount(body.account || {}));
    if (body.action === "login") return json(loginAccount(body.email || "", body.password || ""));
    return json({ ok: false, message: "Unknown action" }, 400);
  } catch (error) {
    return json({ ok: false, message: String(error && error.message || error) }, 500);
  }
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
    email,
    phone: String(account.phone || ""),
    salt,
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
  const row = headers.map((header) => object[header] || "");
  if (found) sheet.getRange(found.index, 1, 1, headers.length).setValues([row]);
  else sheet.appendRow(row);
}

function findByEmail(sheet, email) {
  const rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return null;
  const headers = rows[0].map(String);
  const emailIndex = headers.indexOf("email");
  for (let i = 1; i < rows.length; i += 1) {
    if (String(rows[i][emailIndex] || "").trim().toLowerCase() === email) {
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

function json(value, status) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
