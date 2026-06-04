const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");

const express = require("express");
const multer = require("multer");

const app = express();
const rootDir = __dirname;
const dataDir = path.join(rootDir, "data");
const uploadDir = path.join(rootDir, "uploads");
const sitePath = path.join(dataDir, "site.json");
const leadsPath = path.join(dataDir, "leads.json");
const accountsPath = path.join(dataDir, "accounts.json");

const PORT = Number(process.env.PORT || 8080);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const SESSION_SECRET = process.env.SESSION_SECRET || "change-this-secret";
const PUBLIC_BASE_URL = String(process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "");
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB || 2048);

const upload = multer({
  storage: multer.diskStorage({
    destination: async (_req, _file, cb) => {
      const folder = path.join(uploadDir, new Date().toISOString().slice(0, 10));
      await fs.mkdir(folder, { recursive: true });
      cb(null, folder);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      const base = path.basename(file.originalname, ext).replace(/[^\w.-]+/g, "-").slice(0, 80);
      cb(null, `${Date.now()}-${base || "file"}${ext}`);
    }
  }),
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 }
});

app.disable("x-powered-by");
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(uploadDir, { fallthrough: false }));
app.use(express.static(path.join(rootDir, "public")));

app.get("/api/site", async (_req, res) => {
  res.json(await readSite());
});

app.post("/api/leads", async (req, res) => {
  const lead = normalizeLead(req.body || {});
  if (!lead.email) return res.status(400).json({ ok: false, message: "Thieu email" });
  await appendLead(lead);
  res.json({ ok: true });
});

app.post("/api/accounts/register", async (req, res) => {
  const account = normalizeAccount(req.body || {});
  if (!account.email || !account.password) {
    return res.status(400).json({ ok: false, message: "Thieu email hoac mat khau" });
  }
  const saved = await saveAccount(account);
  await appendLead({
    name: saved.name,
    email: saved.email,
    phone: saved.phone,
    interest: "Tai khoan khach hang",
    source: "account"
  });
  res.json({ ok: true, customer: publicAccount(saved) });
});

app.post("/api/accounts/login", async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const account = await findAccount(email);
  if (!account || !verifyPassword(password, account.passwordHash)) {
    return res.status(401).json({ ok: false, message: "Email hoac mat khau khong dung" });
  }
  res.json({ ok: true, customer: publicAccount(account) });
});

app.post("/api/login", async (req, res) => {
  if (String(req.body?.password || "") !== ADMIN_PASSWORD) {
    return res.status(401).json({ ok: false, message: "Sai mat khau" });
  }
  const token = signToken("admin");
  res.setHeader("Set-Cookie", cookie("admin_token", token));
  res.json({ ok: true });
});

app.post("/api/logout", (_req, res) => {
  res.setHeader("Set-Cookie", "admin_token=; Path=/; Max-Age=0; SameSite=Lax");
  res.json({ ok: true });
});

app.get("/api/admin/site", requireAdmin, async (_req, res) => {
  res.json(await readSite());
});

app.get("/api/admin/leads", requireAdmin, async (_req, res) => {
  res.json(await readLeads());
});

app.get("/api/admin/status", requireAdmin, (_req, res) => {
  res.json({
    ok: true,
    mode: "local-node",
    siteStorage: "data/site.json",
    leadsStorage: "data/leads.json",
    uploadStorage: "uploads/",
    canSaveSite: true,
    canSaveLeads: true,
    canUpload: true,
    message: "Admin local dang luu truc tiep tren may chu Node."
  });
});

app.put("/api/admin/site", requireAdmin, async (req, res) => {
  const clean = normalizeSite(req.body || {});
  await writeSite(clean);
  res.json({ ok: true, site: clean });
});

app.post("/api/admin/upload", requireAdmin, upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, message: "Chua chon file" });
  const relative = `/uploads/${path.relative(uploadDir, req.file.path).replace(/\\/g, "/")}`;
  res.json({
    ok: true,
    file: {
      name: req.file.originalname,
      storedName: req.file.filename,
      size: req.file.size,
      type: req.file.mimetype,
      url: PUBLIC_BASE_URL ? `${PUBLIC_BASE_URL}${relative}` : relative
    }
  });
});

app.get("/admin", (_req, res) => {
  res.sendFile(path.join(rootDir, "public", "admin.html"));
});

app.use((_req, res) => {
  res.sendFile(path.join(rootDir, "public", "index.html"));
});

app.listen(PORT, async () => {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.mkdir(uploadDir, { recursive: true });
  console.log(`Sales web running: http://localhost:${PORT}`);
  console.log(`Admin: http://localhost:${PORT}/admin`);
});

async function readSite() {
  const raw = await fs.readFile(sitePath, "utf8");
  return normalizeSite(JSON.parse(raw));
}

async function writeSite(site) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(sitePath, JSON.stringify(site, null, 2), "utf8");
}

function normalizeSite(site) {
  return {
    brand: object(site.brand),
    hero: object(site.hero),
    stats: array(site.stats),
    apps: array(site.apps).map((item, index) => ({
      id: String(item.id || slug(item.name) || `app-${index + 1}`),
      name: String(item.name || "San pham moi"),
      tagline: String(item.tagline || ""),
      description: String(item.description || ""),
      version: String(item.version || ""),
      status: String(item.status || "Dang ban"),
      priceFrom: String(item.priceFrom || ""),
      cover: String(item.cover || ""),
      demoUrl: String(item.demoUrl || ""),
      guideUrl: String(item.guideUrl || ""),
      downloadUrl: String(item.downloadUrl || ""),
      prices: array(item.prices).map((plan) => ({
        name: String(plan.name || ""),
        price: String(plan.price || "")
      })),
      features: array(item.features).map(String)
    })),
    videoProducts: array(site.videoProducts).map((item, index) => ({
      id: String(item.id || slug(item.title) || `video-product-${index + 1}`),
      title: String(item.title || "Video/Prompt moi"),
      description: String(item.description || ""),
      category: String(item.category || "Prompt AI"),
      format: String(item.format || "Video + Prompt"),
      status: String(item.status || "Dang ban"),
      price: String(item.price || ""),
      license: String(item.license || ""),
      thumbnail: String(item.thumbnail || ""),
      videoUrl: String(item.videoUrl || ""),
      promptUrl: String(item.promptUrl || "")
    })),
    workflows: array(site.workflows).map((item, index) => ({
      id: String(item.id || slug(item.title) || `workflow-${index + 1}`),
      title: String(item.title || "Workflow moi"),
      description: String(item.description || ""),
      level: String(item.level || ""),
      duration: String(item.duration || ""),
      price: String(item.price || ""),
      cover: String(item.cover || ""),
      steps: array(item.steps).map(String)
    })),
    pricing: array(site.pricing).map((item, index) => ({
      id: String(item.id || slug(item.name) || `plan-${index + 1}`),
      name: String(item.name || "Goi moi"),
      price: String(item.price || ""),
      period: String(item.period || ""),
      highlight: Boolean(item.highlight),
      features: array(item.features).map(String)
    })),
    demos: array(site.demos).map((item) => ({
      title: String(item.title || ""),
      description: String(item.description || ""),
      url: String(item.url || ""),
      poster: String(item.poster || "")
    })),
    contact: object(site.contact),
    faq: array(site.faq).map((item) => ({
      question: String(item.question || ""),
      answer: String(item.answer || "")
    }))
  };
}

function requireAdmin(req, res, next) {
  const cookies = parseCookies(req.headers.cookie || "");
  if (verifyToken(cookies.admin_token)) return next();
  res.status(401).json({ ok: false, message: "Can dang nhap admin" });
}

async function appendLead(lead) {
  await fs.mkdir(dataDir, { recursive: true });
  const leads = await readLeads();
  const filtered = array(leads).filter((item) => item.email !== lead.email);
  filtered.push({ ...lead, createdAt: new Date().toISOString() });
  await fs.writeFile(leadsPath, JSON.stringify(filtered, null, 2), "utf8");
}

async function readLeads() {
  try {
    return array(JSON.parse(await fs.readFile(leadsPath, "utf8"))).map((lead) => ({
      name: String(lead.name || ""),
      email: String(lead.email || ""),
      phone: String(lead.phone || ""),
      interest: String(lead.interest || ""),
      source: String(lead.source || ""),
      createdAt: String(lead.createdAt || "")
    }));
  } catch {
    return [];
  }
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

async function readAccounts() {
  try {
    return array(JSON.parse(await fs.readFile(accountsPath, "utf8"))).map((account) => ({
      name: String(account.name || ""),
      email: String(account.email || "").trim().toLowerCase(),
      phone: String(account.phone || ""),
      passwordHash: String(account.passwordHash || ""),
      createdAt: String(account.createdAt || ""),
      updatedAt: String(account.updatedAt || "")
    })).filter((account) => account.email && account.passwordHash);
  } catch {
    return [];
  }
}

async function writeAccounts(accounts) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(accountsPath, JSON.stringify(accounts, null, 2), "utf8");
}

async function findAccount(email) {
  const accounts = await readAccounts();
  return accounts.find((account) => account.email === String(email || "").trim().toLowerCase());
}

async function saveAccount(account) {
  const accounts = await readAccounts();
  const now = new Date().toISOString();
  const existing = accounts.find((item) => item.email === account.email);
  const saved = {
    name: account.name,
    email: account.email,
    phone: account.phone,
    passwordHash: hashPassword(account.password),
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
  const next = existing
    ? accounts.map((item) => item.email === account.email ? saved : item)
    : [...accounts, saved];
  await writeAccounts(next);
  return saved;
}

function normalizeAccount(value) {
  return {
    name: String(value.name || "").trim().slice(0, 120),
    email: String(value.email || "").trim().toLowerCase().slice(0, 160),
    phone: String(value.phone || "").trim().slice(0, 80),
    password: String(value.password || "").slice(0, 200)
  };
}

function publicAccount(account) {
  return {
    name: account.name,
    email: account.email,
    phone: account.phone
  };
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(password || ""), salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

function verifyPassword(password, encoded) {
  const parts = String(encoded || "").split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, expected] = parts;
  const actual = crypto.scryptSync(String(password || ""), salt, 64).toString("hex");
  return expected.length === actual.length && crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}

function signToken(value) {
  const payload = Buffer.from(`${value}.${Date.now()}`).toString("base64url");
  const sig = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function verifyToken(token) {
  if (!token || !token.includes(".")) return false;
  const [payload, sig] = token.split(".");
  const expected = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  const decoded = Buffer.from(payload, "base64url").toString("utf8");
  const issuedAt = Number(decoded.split(".").pop());
  return Number.isFinite(issuedAt) && Date.now() - issuedAt < 1000 * 60 * 60 * 24 * 7;
}

function cookie(name, value) {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}`;
}

function parseCookies(raw) {
  return Object.fromEntries(raw.split(";").map((part) => {
    const [key, ...rest] = part.trim().split("=");
    return [key, rest.join("=")];
  }).filter(([key]) => key));
}

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function slug(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
