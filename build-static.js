const fs = require("fs");
const path = require("path");

const root = __dirname;
const publicDir = path.join(root, "public");
const dataFile = path.join(root, "data", "site.json");
const distDir = path.join(root, "dist");

function copyDir(source, target) {
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    if (entry.isDirectory()) {
      copyDir(sourcePath, targetPath);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

fs.rmSync(distDir, { recursive: true, force: true });
copyDir(publicDir, distDir);
fs.copyFileSync(dataFile, path.join(distDir, "site.json"));
fs.writeFileSync(
  path.join(distDir, "index.js"),
  `const express = require("express");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("path");

const app = express();
const root = __dirname;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const SESSION_SECRET = process.env.SESSION_SECRET || "change-this-secret";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
const GITHUB_OWNER = process.env.GITHUB_OWNER || "doson203";
const GITHUB_REPO = process.env.GITHUB_REPO || "dhs-media";
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || "main";

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/api/site", (req, res) => {
  res.sendFile(path.join(root, "site.json"));
});

app.post("/api/leads", async (req, res) => {
  const lead = normalizeLead(req.body || {});
  if (!lead.email) return res.status(400).json({ ok: false, message: "Thiếu email" });
  if (!GITHUB_TOKEN) return res.json({ ok: true, storage: "browser-only" });
  const leads = await readRepoJson("data/leads.json", []);
  const filtered = array(leads).filter((item) => item.email !== lead.email);
  filtered.push({ ...lead, createdAt: new Date().toISOString() });
  await writeRepoJson("data/leads.json", filtered, "Update customer leads");
  res.json({ ok: true, storage: "github" });
});

app.post("/api/login", (req, res) => {
  if (String(req.body?.password || "") !== ADMIN_PASSWORD) {
    return res.status(401).json({ ok: false, message: "Sai mật khẩu" });
  }
  res.setHeader("Set-Cookie", cookie("admin_token", signToken("admin")));
  res.json({ ok: true });
});

app.post("/api/logout", (_req, res) => {
  res.setHeader("Set-Cookie", "admin_token=; Path=/; Max-Age=0; SameSite=Lax; Secure");
  res.json({ ok: true });
});

app.get("/api/admin/site", requireAdmin, async (_req, res) => {
  if (!GITHUB_TOKEN) return res.sendFile(path.join(root, "site.json"));
  res.json(await readRepoJson("data/site.json", await readBundledSite()));
});

app.put("/api/admin/site", requireAdmin, async (req, res) => {
  if (!GITHUB_TOKEN) {
    return res.status(501).json({
      ok: false,
      message: "Admin online cần cấu hình GITHUB_TOKEN trên Vercel để lưu thay đổi."
    });
  }
  await writeRepoJson("data/site.json", req.body || {}, "Update site content from admin");
  res.json({ ok: true, site: req.body || {} });
});

app.get("/api/admin/leads", requireAdmin, async (_req, res) => {
  if (!GITHUB_TOKEN) return res.json([]);
  res.json(await readRepoJson("data/leads.json", []));
});

app.get("/api/admin/status", requireAdmin, (_req, res) => {
  res.json({
    ok: true,
    mode: "vercel",
    siteStorage: GITHUB_TOKEN ? "GitHub data/site.json" : "bundled site.json",
    leadsStorage: GITHUB_TOKEN ? "GitHub data/leads.json" : "browser-only",
    uploadStorage: "external-link",
    canSaveSite: Boolean(GITHUB_TOKEN),
    canSaveLeads: Boolean(GITHUB_TOKEN),
    canUpload: false,
    missing: GITHUB_TOKEN ? [] : ["GITHUB_TOKEN"],
    message: GITHUB_TOKEN
      ? "Admin online da co GitHub storage de luu cau hinh va khach dang ky."
      : "Admin online dang thieu GITHUB_TOKEN nen chi xem duoc du lieu mau; chua luu thay doi len web."
  });
});

app.post("/api/admin/upload", requireAdmin, (_req, res) => {
  res.status(501).json({
    ok: false,
    message: "Upload online cần cấu hình storage riêng. Tạm thời hãy dùng link YouTube/Google Drive hoặc upload local rồi deploy lại."
  });
});

app.use(express.static(root));

app.get("/admin", (req, res) => {
  res.sendFile(path.join(root, "admin.html"));
});

app.use((req, res) => {
  res.sendFile(path.join(root, "index.html"));
});

module.exports = app;

async function readBundledSite() {
  return JSON.parse(await fs.readFile(path.join(root, "site.json"), "utf8"));
}

async function readRepoJson(filePath, fallback) {
  try {
    const file = await githubFile(filePath);
    return JSON.parse(Buffer.from(file.content || "", "base64").toString("utf8"));
  } catch (error) {
    if (error.status === 404) return fallback;
    throw error;
  }
}

async function writeRepoJson(filePath, value, message) {
  const current = await githubFile(filePath).catch((error) => {
    if (error.status === 404) return null;
    throw error;
  });
  const body = {
    message,
    branch: GITHUB_BRANCH,
    content: Buffer.from(JSON.stringify(value, null, 2), "utf8").toString("base64")
  };
  if (current?.sha) body.sha = current.sha;
  const response = await fetch(githubUrl(filePath), {
    method: "PUT",
    headers: githubHeaders(),
    body: JSON.stringify(body)
  });
  if (!response.ok) throw await githubError(response);
  return response.json();
}

async function githubFile(filePath) {
  const response = await fetch(githubUrl(filePath), { headers: githubHeaders() });
  if (!response.ok) throw await githubError(response);
  return response.json();
}

function githubUrl(filePath) {
  return "https://api.github.com/repos/" + GITHUB_OWNER + "/" + GITHUB_REPO + "/contents/" + encodeURIComponent(filePath).replace(/%2F/g, "/") + "?ref=" + encodeURIComponent(GITHUB_BRANCH);
}

function githubHeaders() {
  return {
    "Accept": "application/vnd.github+json",
    "Authorization": "Bearer " + GITHUB_TOKEN,
    "User-Agent": "DHS-MEDIA-admin"
  };
}

async function githubError(response) {
  const error = new Error("GitHub API error " + response.status);
  error.status = response.status;
  try {
    error.details = await response.json();
  } catch {}
  return error;
}

function requireAdmin(req, res, next) {
  const cookies = parseCookies(req.headers.cookie || "");
  if (verifyToken(cookies.admin_token)) return next();
  res.status(401).json({ ok: false, message: "Cần đăng nhập admin" });
}

function normalizeLead(value) {
  return {
    name: String(value.name || "").slice(0, 120),
    email: String(value.email || "").trim().toLowerCase().slice(0, 160),
    phone: String(value.phone || "").slice(0, 80),
    interest: String(value.interest || "").slice(0, 160),
    source: String(value.source || "website").slice(0, 80)
  };
}

function signToken(value) {
  const payload = Buffer.from(value + "." + Date.now()).toString("base64url");
  const sig = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
  return payload + "." + sig;
}

function verifyToken(token) {
  if (!token || !token.includes(".")) return false;
  const [payload, sig] = token.split(".");
  const expected = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  const decoded = Buffer.from(payload, "base64url").toString("utf8");
  const issuedAt = Number(decoded.split(".").pop());
  return Number.isFinite(issuedAt) && Date.now() - issuedAt < 1000 * 60 * 60 * 24 * 7;
}

function cookie(name, value) {
  return name + "=" + value + "; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=" + (60 * 60 * 24 * 7);
}

function parseCookies(raw) {
  return Object.fromEntries(raw.split(";").map((part) => {
    const [key, ...rest] = part.trim().split("=");
    return [key, rest.join("=")];
  }).filter(([key]) => key));
}

function array(value) {
  return Array.isArray(value) ? value : [];
}
`,
  "utf8"
);

console.log(`Static site built: ${distDir}`);
