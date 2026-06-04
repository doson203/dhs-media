const crypto = require("node:crypto");

const PAYOS_API = "https://api-merchant.payos.vn/v2/payment-requests";

function paymentConfig() {
  return {
    payosClientId: process.env.PAYOS_CLIENT_ID || process.env.PAYOS_CLIENT_ID_ALT || "",
    payosApiKey: process.env.PAYOS_API_KEY || "",
    payosChecksumKey: process.env.PAYOS_CHECKSUM_KEY || "",
    publicUrl: normalizePublicUrl(process.env.PUBLIC_SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || "http://localhost:8080"),
    resendApiKey: process.env.RESEND_API_KEY || "",
    mailFrom: process.env.MAIL_FROM || "DHS MEDIA <onboarding@resend.dev>",
    googleSheetsWebappUrl: process.env.GOOGLE_SHEETS_WEBAPP_URL || "https://script.google.com/macros/s/AKfycbxQqU0LtlKofxuDpxFpNfZtJ_eeuCLADE5aSvDyTUHNkjbHQBQgA1xkUHA6vQlqPUSf/exec",
    googleSheetsSecret: process.env.GOOGLE_SHEETS_SECRET || ""
  };
}

async function createCheckout(body, deps) {
  const config = paymentConfig();
  const missingPayosEnv = [
    ["PAYOS_CLIENT_ID", config.payosClientId],
    ["PAYOS_API_KEY", config.payosApiKey],
    ["PAYOS_CHECKSUM_KEY", config.payosChecksumKey]
  ].filter(([, value]) => !value).map(([name]) => name);
  if (missingPayosEnv.length) {
    return {
      ok: false,
      status: 501,
      message: "Chua cau hinh PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY.",
      missing: missingPayosEnv
    };
  }
  const site = await deps.readSite();
  const product = findProduct(site, body.productId);
  if (!product) return { ok: false, status: 404, message: "Khong tim thay san pham." };
  if (!product.promptUrl) return { ok: false, status: 400, message: "San pham chua co link prompt/app de gui sau thanh toan." };

  const buyerEmail = String(body.email || "").trim().toLowerCase();
  if (!buyerEmail || !buyerEmail.includes("@")) return { ok: false, status: 400, message: "Vui long nhap email nhan san pham." };

  const amount = parseAmount(product.price);
  if (!amount || amount < 1000) return { ok: false, status: 400, message: "Gia san pham chua hop le. Hay cap nhat cot price tren Sheet." };

  const orderCode = Number(String(Date.now()).slice(-10));
  const description = `DHS${orderCode}`.slice(0, 25);
  const returnUrl = `${config.publicUrl}/?payment=success&orderCode=${orderCode}`;
  const cancelUrl = `${config.publicUrl}/?payment=cancel&orderCode=${orderCode}`;
  const payload = {
    orderCode,
    amount,
    description,
    buyerName: String(body.name || ""),
    buyerEmail,
    buyerPhone: String(body.phone || ""),
    items: [{ name: product.title || product.name || "DHS MEDIA product", quantity: 1, price: amount }],
    returnUrl,
    cancelUrl
  };
  payload.signature = payosSignature({
    amount: payload.amount,
    cancelUrl: payload.cancelUrl,
    description: payload.description,
    orderCode: payload.orderCode,
    returnUrl: payload.returnUrl
  }, config.payosChecksumKey);

  await deps.saveOrder({
    orderCode,
    status: "PENDING",
    productId: product.id,
    productTitle: product.title || product.name || "",
    promptUrl: product.promptUrl,
    amount,
    buyerEmail,
    buyerName: payload.buyerName,
    buyerPhone: payload.buyerPhone,
    createdAt: new Date().toISOString()
  });

  const response = await fetch(PAYOS_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-client-id": config.payosClientId,
      "x-api-key": config.payosApiKey
    },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.code !== "00") {
    return { ok: false, status: response.status || 502, message: data.desc || "Khong tao duoc link thanh toan payOS.", details: data };
  }
  await deps.updateOrder(orderCode, {
    paymentLinkId: data.data?.paymentLinkId || "",
    checkoutUrl: data.data?.checkoutUrl || "",
    qrCode: data.data?.qrCode || ""
  });
  return { ok: true, orderCode, checkoutUrl: data.data?.checkoutUrl, qrCode: data.data?.qrCode };
}

async function handlePayosWebhook(body, deps) {
  const config = paymentConfig();
  if (!verifyPayosWebhook(body, config.payosChecksumKey)) return { ok: false, status: 400, message: "Invalid signature" };
  const orderCode = Number(body?.data?.orderCode || 0);
  if (!body.success || !orderCode) return { ok: true, ignored: true };
  const order = await deps.getOrder(orderCode);
  if (!order) return { ok: false, status: 404, message: "Order not found" };
  if (order.status === "PAID" && order.emailSentAt) return { ok: true, duplicate: true };
  await deps.updateOrder(orderCode, { status: "PAID", paidAt: new Date().toISOString(), payosData: body.data });
  const email = await sendDeliveryEmailV2({ ...order, status: "PAID" });
  await deps.updateOrder(orderCode, { emailSentAt: new Date().toISOString(), emailStatus: email.ok ? "SENT" : "FAILED", emailError: email.message || "" });
  return { ok: true };
}

async function sendDeliveryEmail(order) {
  const config = paymentConfig();
  if (!config.resendApiKey) return { ok: false, message: "Chua cau hinh RESEND_API_KEY." };
  const html = `
    <h2>Cảm ơn bạn đã mua sản phẩm tại DHS MEDIA</h2>
    <p>Sản phẩm: <strong>${escapeHtml(order.productTitle)}</strong></p>
    <p>Mã đơn: <strong>${escapeHtml(order.orderCode)}</strong></p>
    <p>Link nhận sản phẩm/prompt:</p>
    <p><a href="${escapeHtml(order.promptUrl)}">${escapeHtml(order.promptUrl)}</a></p>
  `;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${config.resendApiKey}` },
    body: JSON.stringify({
      from: config.mailFrom,
      to: [order.buyerEmail],
      subject: `DHS MEDIA - Link sản phẩm ${order.productTitle}`,
      html
    })
  });
  const data = await response.json().catch(() => ({}));
  return response.ok ? { ok: true, data } : { ok: false, message: data.message || "Gui email that bai", data };
}

async function sendDeliveryEmailV2(order) {
  const config = paymentConfig();
  if (!config.resendApiKey) return sendDeliveryViaSheet(order, config);
  const html = `
    <h2>Cảm ơn bạn đã mua sản phẩm tại DHS MEDIA</h2>
    <p>Sản phẩm: <strong>${escapeHtml(order.productTitle)}</strong></p>
    <p>Mã đơn: <strong>${escapeHtml(order.orderCode)}</strong></p>
    <p>Link nhận sản phẩm/prompt:</p>
    <p><a href="${escapeHtml(order.promptUrl)}">${escapeHtml(order.promptUrl)}</a></p>
  `;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${config.resendApiKey}` },
    body: JSON.stringify({
      from: config.mailFrom,
      to: [order.buyerEmail],
      subject: `DHS MEDIA - Link sản phẩm ${order.productTitle}`,
      html
    })
  });
  const data = await response.json().catch(() => ({}));
  if (response.ok) return { ok: true, data };
  const fallback = await sendDeliveryViaSheet(order, config);
  return fallback.ok ? fallback : { ok: false, message: data.message || fallback.message || "Gui email that bai", data };
}

async function sendDeliveryViaSheet(order, config = paymentConfig()) {
  if (!config.googleSheetsWebappUrl) return { ok: false, message: "Chua cau hinh GOOGLE_SHEETS_WEBAPP_URL." };
  const response = await fetch(config.googleSheetsWebappUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "sendDeliveryEmail",
      secret: config.googleSheetsSecret,
      order: {
        orderCode: order.orderCode,
        productTitle: order.productTitle,
        promptUrl: order.promptUrl,
        buyerEmail: order.buyerEmail,
        buyerName: order.buyerName
      }
    })
  });
  const data = await response.json().catch(() => ({}));
  return response.ok && data.ok !== false
    ? { ok: true, data, provider: "google-apps-script" }
    : { ok: false, message: data.message || "Google Apps Script gui email that bai", data };
}

function findProduct(site, productId) {
  const all = [...(site.videoProducts || []), ...(site.apps || []), ...(site.workflows || [])];
  return all.find((item) => String(item.id) === String(productId));
}

function parseAmount(value) {
  const text = String(value || "").replace(/[^\d]/g, "");
  return Number(text || 0);
}

function payosSignature(data, key) {
  const raw = Object.keys(data).sort().map((name) => `${name}=${data[name]}`).join("&");
  return crypto.createHmac("sha256", key).update(raw).digest("hex");
}

function verifyPayosWebhook(body, key) {
  if (!key || !body?.data || !body?.signature) return false;
  return payosSignature(body.data, key) === body.signature;
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

function normalizePublicUrl(value) {
  const text = String(value || "").trim().replace(/\/$/, "");
  if (!text) return "http://localhost:8080";
  return /^https?:\/\//i.test(text) ? text : `https://${text}`;
}

module.exports = { createCheckout, handlePayosWebhook, parseAmount };
