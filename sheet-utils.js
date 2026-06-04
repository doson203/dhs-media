const DEFAULT_SHEET_ID = "1HpQjV0XgVUTmNgpWQFSQPnlQrwRiV6WMnY69FOergGQ";
const DEFAULT_SHEETS_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbxQqU0LtlKofxuDpxFpNfZtJ_eeuCLADE5aSvDyTUHNkjbHQBQgA1xkUHA6vQlqPUSf/exec";

const SHEET_NAMES = {
  products: ["Products", "products", "SanPham", "san_pham", "Sản phẩm", "Sản phẩm"],
  apps: ["Apps", "apps", "Tools", "tools", "Tool", "tool"],
  workflows: ["Workflows", "workflows", "Workflow", "workflow"],
  demos: ["Demos", "demos", "Demo", "demo"],
  faq: ["FAQ", "faq"]
};

async function readSheetSite(baseSite, options = {}) {
  const sheetId = options.sheetId || process.env.GOOGLE_SHEET_ID || DEFAULT_SHEET_ID;
  if (!sheetId) return baseSite;
  const fetcher = options.fetch || fetch;
  const site = clone(baseSite);

  const productRows = await firstNonEmptyRows(sheetId, SHEET_NAMES.products, fetcher);
  if (productRows.length) {
    const grouped = splitProductRows(productRows);
    if (grouped.videoProducts.length) site.videoProducts = grouped.videoProducts;
    if (grouped.apps.length) site.apps = grouped.apps;
    if (grouped.workflows.length) site.workflows = grouped.workflows;
  }

  const appRows = await firstNonEmptyRows(sheetId, SHEET_NAMES.apps, fetcher);
  if (appRows.length) site.apps = appRows.map(mapAppRow).filter(Boolean);

  const workflowRows = await firstNonEmptyRows(sheetId, SHEET_NAMES.workflows, fetcher);
  if (workflowRows.length) site.workflows = workflowRows.map(mapWorkflowRow).filter(Boolean);

  const demoRows = await firstNonEmptyRows(sheetId, SHEET_NAMES.demos, fetcher);
  if (demoRows.length) site.demos = demoRows.map(mapDemoRow).filter(Boolean);

  const faqRows = await firstNonEmptyRows(sheetId, SHEET_NAMES.faq, fetcher);
  if (faqRows.length) site.faq = faqRows.map(mapFaqRow).filter(Boolean);

  return site;
}

async function firstNonEmptyRows(sheetId, names, fetcher) {
  for (const name of names) {
    const rows = await readSheetRows(sheetId, name, fetcher).catch(() => []);
    if (rows.length) return rows;
  }
  return [];
}

async function readSheetRows(sheetId, sheetName, fetcher = fetch) {
  const url = "https://docs.google.com/spreadsheets/d/" + encodeURIComponent(sheetId)
    + "/gviz/tq?tqx=out:csv&sheet=" + encodeURIComponent(sheetName);
  const response = await fetcher(url, { headers: { "User-Agent": "DHS-MEDIA-sheet-reader" } });
  if (!response.ok) return [];
  const text = await response.text();
  if (!text.trim() || text.trimStart().startsWith("<")) return [];
  return csvToObjects(text);
}

function splitProductRows(rows) {
  const grouped = { videoProducts: [], apps: [], workflows: [] };
  rows.forEach((row, index) => {
    const type = normalizeKey(cell(row, ["type", "loai", "loại", "nhom", "nhóm"]));
    if (type.includes("tool") || type.includes("app") || type.includes("phanmem") || type.includes("software")) {
      const app = mapAppRow(row, index);
      if (app) grouped.apps.push(app);
      return;
    }
    if (type.includes("workflow") || type.includes("wordflow") || type.includes("quytrinh")) {
      const workflow = mapWorkflowRow(row, index);
      if (workflow) grouped.workflows.push(workflow);
      return;
    }
    const product = mapVideoProductRow(row, index);
    if (product) grouped.videoProducts.push(product);
  });
  return grouped;
}

function mapVideoProductRow(row, index = 0) {
  const title = cell(row, ["title", "ten", "tên", "name", "sanpham", "san pham", "sản phẩm", "product"]);
  if (!title) return null;
  return {
    id: cell(row, ["id", "ma", "mã"]) || slug(title) || `video-product-${index + 1}`,
    title,
    description: cell(row, ["description", "mota", "mo ta", "mô tả", "desc"]) || "Sản phẩm prompt/video AI dùng để tạo nội dung bán hàng.",
    category: cell(row, ["category", "danhmuc", "danh muc", "danh mục"]) || "Prompt AI",
    format: cell(row, ["format", "dinhdang", "định dạng"]) || "Video + Prompt",
    status: cell(row, ["status", "trangthai", "trạng thái"]) || "Đang bán",
    price: cell(row, ["price", "gia", "giá"]) || "Liên hệ",
    license: cell(row, ["license", "banquyen", "bản quyền"]) || "1 bộ prompt/tài liệu",
    thumbnail: cell(row, ["thumbnail", "thumb", "image", "anh", "ảnh", "cover"]),
    videoUrl: cell(row, ["videoUrl", "video url", "video", "linkvideo", "link video"]),
    promptUrl: cell(row, ["promptUrl", "prompt url", "prompt", "linkprompt", "link prompt", "link app", "app"])
  };
}

function mapAppRow(row, index = 0) {
  const name = cell(row, ["name", "ten", "tên", "title", "sanpham", "sản phẩm"]);
  if (!name) return null;
  return {
    id: cell(row, ["id", "ma", "mã"]) || slug(name) || `app-${index + 1}`,
    name,
    tagline: cell(row, ["tagline", "subtitle", "mota ngan", "mô tả ngắn"]),
    description: cell(row, ["description", "mota", "mô tả", "desc"]),
    version: cell(row, ["version", "phienban", "phiên bản"]),
    status: cell(row, ["status", "trangthai", "trạng thái"]) || "Đang bán",
    priceFrom: cell(row, ["priceFrom", "price", "gia", "giá"]) || "Liên hệ",
    cover: cell(row, ["cover", "thumbnail", "image", "anh", "ảnh"]),
    demoUrl: cell(row, ["demoUrl", "demo", "link demo"]),
    guideUrl: cell(row, ["guideUrl", "guide", "huongdan", "hướng dẫn"]),
    downloadUrl: cell(row, ["downloadUrl", "download", "link tải", "link tai"]),
    prices: parsePlans(cell(row, ["prices", "goi", "gói", "banggia", "bảng giá"])),
    features: splitList(cell(row, ["features", "tinhnang", "tính năng"]))
  };
}

function mapWorkflowRow(row, index = 0) {
  const title = cell(row, ["title", "ten", "tên", "name", "workflow"]);
  if (!title) return null;
  return {
    id: cell(row, ["id", "ma", "mã"]) || slug(title) || `workflow-${index + 1}`,
    title,
    description: cell(row, ["description", "mota", "mô tả", "desc"]),
    level: cell(row, ["level", "capdo", "cấp độ"]),
    duration: cell(row, ["duration", "thoiluong", "thời lượng"]),
    price: cell(row, ["price", "gia", "giá"]),
    cover: cell(row, ["cover", "thumbnail", "image", "anh", "ảnh"]),
    steps: splitList(cell(row, ["steps", "buoc", "bước"]))
  };
}

function mapDemoRow(row) {
  const title = cell(row, ["title", "ten", "tên", "name"]);
  if (!title) return null;
  return {
    title,
    description: cell(row, ["description", "mota", "mô tả", "desc"]),
    url: cell(row, ["url", "link", "demo"]),
    poster: cell(row, ["poster", "thumbnail", "image", "anh", "ảnh"])
  };
}

function mapFaqRow(row) {
  const question = cell(row, ["question", "cauhoi", "câu hỏi", "hoi", "hỏi"]);
  const answer = cell(row, ["answer", "traloi", "trả lời"]);
  if (!question && !answer) return null;
  return { question, answer };
}

async function postSheetAction(action, payload, options = {}) {
  const url = options.url || process.env.GOOGLE_SHEETS_WEBAPP_URL || DEFAULT_SHEETS_WEBAPP_URL;
  if (!url) return null;
  const secret = options.secret || process.env.GOOGLE_SHEETS_SECRET || "";
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, secret, ...payload })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    const error = new Error(data.message || "Google Sheet action failed");
    error.status = response.status;
    error.details = data;
    throw error;
  }
  return data;
}

function csvToObjects(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const headers = rows[0].map((header) => normalizeKey(header));
  return rows.slice(1).map((row) => {
    const object = {};
    headers.forEach((header, index) => {
      if (header) object[header] = String(row[index] || "").trim();
    });
    return object;
  }).filter((row) => Object.values(row).some(Boolean));
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted) {
      if (char === "\"" && next === "\"") {
        value += "\"";
        index += 1;
      } else if (char === "\"") {
        quoted = false;
      } else {
        value += char;
      }
      continue;
    }
    if (char === "\"") quoted = true;
    else if (char === ",") {
      row.push(value);
      value = "";
    } else if (char === "\n") {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else if (char !== "\r") {
      value += char;
    }
  }
  row.push(value);
  rows.push(row);
  return rows;
}

function cell(row, aliases) {
  for (const alias of aliases) {
    const value = row[normalizeKey(alias)];
    if (value) return String(value).trim();
  }
  return "";
}

function normalizeKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function parsePlans(value) {
  return splitList(value).map((item) => {
    const [name, price] = item.includes(":") ? item.split(":") : ["Gói", item];
    return { name: String(name || "").trim(), price: String(price || "").trim() };
  }).filter((item) => item.name || item.price);
}

function splitList(value) {
  return String(value || "").split(/\n|;|\|/).map((item) => item.trim()).filter(Boolean);
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

function clone(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

module.exports = {
  DEFAULT_SHEET_ID,
  DEFAULT_SHEETS_WEBAPP_URL,
  readSheetSite,
  readSheetRows,
  postSheetAction,
  csvToObjects
};
