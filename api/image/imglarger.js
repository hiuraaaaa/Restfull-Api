import axios from "axios";
import FormData from "form-data";
import { Buffer } from "buffer";

// ─── Config ────────────────────────────────────────────
const CONFIG = {
  BASE_URL: "https://photoai.imglarger.com/api/PhoAi",
  HEADERS: {
    "User-Agent": "Dart/3.9 (dart:io)",
    "Accept-Encoding": "gzip",
  },
};

// ─── Helpers ───────────────────────────────────────────
const generateRandomUser = () =>
  `${Buffer.from(Math.random().toString()).toString("hex").slice(0, 16)}_aiimglarger`;

const TYPE_MAP = {
  upscale: "0",
  sharpen: "1",
  retouch: "3",
};

const fetchImageBuffer = async (url) => {
  const res = await axios.get(url, {
    responseType: "arraybuffer",
    headers: CONFIG.HEADERS,
    timeout: 15000,
  });
  return Buffer.from(res.data);
};

const pollStatus = async (code, type) => {
  const maxAttempts = 20;

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const { data } = await axios.post(
        `${CONFIG.BASE_URL}/CheckStatus`,
        {
          code,
          type: parseInt(type),
          username: generateRandomUser(),
        },
        {
          headers: {
            ...CONFIG.HEADERS,
            "Content-Type": "application/json;charset=UTF-8",
          },
          timeout: 10000,
        }
      );

      if (data.data?.status === "success") {
        return { success: true, url: data.data.downloadUrls[0], data: data.data };
      }

      if (data.data?.status === "failed") {
        return { success: false, msg: "Processing failed on server" };
      }

      await new Promise((r) => setTimeout(r, 3000));
    } catch (e) {
      return { success: false, msg: e.message };
    }
  }

  return { success: false, msg: "Timeout: server tidak merespons" };
};

const uploadImage = async (imageBuffer, type, scale) => {
  const form = new FormData();
  const username = generateRandomUser();

  form.append("type", type);
  form.append("username", username);
  if (type === "0" && scale) {
    form.append("scaleRadio", scale.toString());
  }
  form.append("file", imageBuffer, { filename: "image.jpg", contentType: "image/jpeg" });

  const { data } = await axios.post(`${CONFIG.BASE_URL}/Upload`, form, {
    headers: { ...CONFIG.HEADERS, ...form.getHeaders() },
    timeout: 30000,
  });

  if (data.code === 200 && data.data) {
    return await pollStatus(data.data, type);
  }

  return { success: false, msg: data.msg || "Upload failed" };
};

// ─── Module Export ─────────────────────────────────────
export default {
  name: "PhotoAI Image Enhancer",
  description: "Upscale, Retouch, dan Sharpen gambar menggunakan PhotoAI (imglarger)",
  category: "AI-IMAGE",
  methods: ["GET", "POST"],
  params: ["imageUrl", "action", "scale"],
  paramsSchema: {
    imageUrl: { type: "string", required: true, minLength: 1 },
    action: { type: "string", required: true, minLength: 1 },   // upscale | sharpen | retouch
    scale: { type: "string", required: false },                  // 2 | 4 | 8 (khusus upscale, default: 4)
  },
  async run(req, res) {
    try {
      // ── Ambil params ──
      const imageUrl = req.method === "GET" ? req.query.imageUrl : req.body.imageUrl;
      const action   = req.method === "GET" ? req.query.action   : req.body.action;
      const scale    = req.method === "GET" ? req.query.scale    : req.body.scale;

      // ── Validasi ──
      if (!imageUrl || !action) {
        return res.status(400).json({
          error: 'Parameter "imageUrl" dan "action" diperlukan',
        });
      }

      const normalizedAction = action.toLowerCase().trim();

      if (!TYPE_MAP[normalizedAction]) {
        return res.status(400).json({
          error: 'Action tidak valid. Pilih: "upscale", "sharpen", atau "retouch"',
        });
      }

      if (normalizedAction === "upscale" && scale && !["2", "4", "8"].includes(scale)) {
        return res.status(400).json({
          error: 'Scale tidak valid. Pilih: "2", "4", atau "8"',
        });
      }

      // ── Fetch gambar dari URL ──
      const imageBuffer = await fetchImageBuffer(imageUrl);

      // ── Upload + Poll ──
      const type       = TYPE_MAP[normalizedAction];
      const finalScale = normalizedAction === "upscale" ? (scale || "4") : undefined;
      const result     = await uploadImage(imageBuffer, type, finalScale);

      if (!result.success) {
        return res.status(500).json({ error: result.msg });
      }

      // ── Return ──
      return res.status(200).json({
        results: {
          action:    normalizedAction,
          scale:     finalScale || null,
          outputUrl: result.url,
        },
      });
    } catch (error) {
      return res.status(500).json({
        error: `Gagal memproses gambar: ${error.message}`,
      });
    }
  },
};
