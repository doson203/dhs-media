const crypto = require("node:crypto");

const DEFAULT_DEMO_VIDEO = "https://youtube.com/shorts/YOTLyKnz_8k?feature=share";

async function createVideoJob(payload = {}, context = {}) {
  const prompt = String(payload.prompt || "").trim();
  if (prompt.length < 8) {
    return { ok: false, status: 400, message: "Prompt qua ngan. Vui long mo ta video ro hon." };
  }

  const now = new Date().toISOString();
  const job = {
    id: "vid_" + crypto.randomBytes(8).toString("hex"),
    createdAt: now,
    updatedAt: now,
    status: "processing",
    provider: providerName(),
    prompt: prompt.slice(0, 2000),
    ratio: normalizeRatio(payload.ratio),
    duration: normalizeDuration(payload.duration),
    imageUrl: normalizeUrl(payload.imageUrl),
    customerEmail: String(payload.email || "").trim().toLowerCase().slice(0, 160),
    videoUrl: "",
    thumbnail: "",
    error: "",
    demoMode: false
  };

  const jobs = await context.readJobs();
  jobs.unshift(job);
  await context.writeJobs(jobs.slice(0, 500));

  const result = await runProvider(job, context).catch((error) => ({
    status: "failed",
    error: error.message || "Khong tao duoc video."
  }));

  const nextJob = {
    ...job,
    ...result,
    updatedAt: new Date().toISOString()
  };
  await updateStoredJob(nextJob.id, nextJob, context);

  return { ok: true, job: publicJob(nextJob) };
}

async function getVideoJob(id, context = {}) {
  const jobs = await context.readJobs();
  let job = jobs.find((item) => item.id === id);
  if (!job) return { ok: false, status: 404, message: "Khong tim thay job tao video." };

  if (job.status === "processing" && job.provider === "fal") {
    const checked = await checkFalJob(job).catch(() => null);
    if (checked) {
      job = { ...job, ...checked, updatedAt: new Date().toISOString() };
      await updateStoredJob(job.id, job, context);
    }
  }

  return { ok: true, job: publicJob(job) };
}

async function listVideoJobs(query = {}, context = {}) {
  const email = String(query.email || "").trim().toLowerCase();
  const jobs = await context.readJobs();
  const filtered = email ? jobs.filter((job) => String(job.customerEmail || "") === email) : jobs;
  return { ok: true, jobs: filtered.slice(0, 30).map(publicJob) };
}

async function runProvider(job, context = {}) {
  if (providerName() === "fal" && process.env.FAL_KEY && process.env.FAL_MODEL) {
    return createFalJob(job);
  }

  const demoVideo = await getDemoVideo(context);
  return {
    status: "done",
    videoUrl: demoVideo,
    thumbnail: "",
    provider: "demo",
    demoMode: true
  };
}

async function createFalJob(job) {
  const model = String(process.env.FAL_MODEL || "").replace(/^\/+|\/+$/g, "");
  const endpoint = process.env.FAL_MODEL_ENDPOINT || `https://queue.fal.run/${model}`;
  const input = {
    prompt: job.prompt,
    aspect_ratio: job.ratio,
    duration: job.duration,
    image_url: job.imageUrl || undefined
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": "Key " + process.env.FAL_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ input })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || data.message || "fal.ai khong nhan job tao video.");
  }

  const videoUrl = extractVideoUrl(data);
  if (videoUrl) return { status: "done", provider: "fal", videoUrl };

  return {
    status: "processing",
    provider: "fal",
    providerRequestId: data.request_id || data.requestId || "",
    statusUrl: data.status_url || data.statusUrl || ""
  };
}

async function checkFalJob(job) {
  if (!process.env.FAL_KEY) return null;
  const model = String(process.env.FAL_MODEL || "").replace(/^\/+|\/+$/g, "");
  const statusUrl = job.statusUrl || (job.providerRequestId ? `https://queue.fal.run/${model}/requests/${job.providerRequestId}/status` : "");
  if (!statusUrl) return null;

  const statusResponse = await fetch(statusUrl, {
    headers: { "Authorization": "Key " + process.env.FAL_KEY }
  });
  const statusData = await statusResponse.json().catch(() => ({}));
  if (!statusResponse.ok) return null;

  const statusText = String(statusData.status || "").toUpperCase();
  if (statusText.includes("COMPLETED")) {
    const resultUrl = statusData.response_url || statusData.responseUrl || statusUrl.replace(/\/status$/, "");
    const resultResponse = await fetch(resultUrl, {
      headers: { "Authorization": "Key " + process.env.FAL_KEY }
    });
    const resultData = await resultResponse.json().catch(() => ({}));
    const videoUrl = extractVideoUrl(resultData);
    return videoUrl ? { status: "done", videoUrl, error: "" } : null;
  }
  if (statusText.includes("FAILED") || statusText.includes("ERROR")) {
    return { status: "failed", error: statusData.error || "Provider bao loi tao video." };
  }
  return { status: "processing" };
}

function extractVideoUrl(data) {
  return String(
    data?.video?.url ||
    data?.output?.video?.url ||
    data?.output?.url ||
    data?.url ||
    data?.data?.video?.url ||
    ""
  ).trim();
}

async function getDemoVideo(context = {}) {
  const site = context.readSite ? await context.readSite().catch(() => null) : null;
  const product = (site?.videoProducts || []).find((item) => item.videoUrl);
  return normalizeUrl(product?.videoUrl) || DEFAULT_DEMO_VIDEO;
}

async function updateStoredJob(id, patch, context = {}) {
  const jobs = await context.readJobs();
  const next = jobs.map((job) => job.id === id ? { ...job, ...patch } : job);
  await context.writeJobs(next);
}

function publicJob(job) {
  return {
    id: job.id,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    status: job.status,
    provider: job.provider,
    prompt: job.prompt,
    ratio: job.ratio,
    duration: job.duration,
    imageUrl: job.imageUrl,
    customerEmail: job.customerEmail,
    videoUrl: job.videoUrl,
    thumbnail: job.thumbnail,
    error: job.error,
    demoMode: Boolean(job.demoMode)
  };
}

function providerName() {
  return String(process.env.VIDEO_PROVIDER || "").trim().toLowerCase() || "demo";
}

function normalizeRatio(value) {
  const ratio = String(value || "9:16").trim();
  return ["9:16", "16:9", "1:1"].includes(ratio) ? ratio : "9:16";
}

function normalizeDuration(value) {
  const duration = Number(value || 5);
  return [5, 8, 10].includes(duration) ? duration : 5;
}

function normalizeUrl(value) {
  const url = String(value || "").trim();
  return /^https?:\/\//i.test(url) ? url : "";
}

module.exports = {
  createVideoJob,
  getVideoJob,
  listVideoJobs
};
