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
      downloadUrl: String(item.downloadUrl || ""),
      features: array(item.features).map(String)
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
