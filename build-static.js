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
const path = require("path");

const app = express();
const root = __dirname;

app.get("/api/site", (req, res) => {
  res.sendFile(path.join(root, "site.json"));
});

app.post("/api/leads", express.json({ limit: "1mb" }), (req, res) => {
  res.json({ ok: true, storage: "browser" });
});

app.use("/api/admin", (req, res) => {
  res.status(404).json({ error: "Admin API chi chay trong server quan tri local." });
});

app.use(express.static(root));

app.get("/admin", (req, res) => {
  res.sendFile(path.join(root, "admin.html"));
});

app.use((req, res) => {
  res.sendFile(path.join(root, "index.html"));
});

module.exports = app;
`,
  "utf8"
);

console.log(`Static site built: ${distDir}`);
