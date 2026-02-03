import axios from "axios";

// ─── Config ────────────────────────────────────────────
const CONFIG = {
  BASE_URL: "https://api-faa.my.id/faa/pinterest",
  HEADERS: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept-Encoding": "gzip",
  },
};

// ─── Helpers ───────────────────────────────────────────
const fetchPinterest = async (query) => {
  const { data } = await axios.get(CONFIG.BASE_URL, {
    params: { q: query },
    headers: CONFIG.HEADERS,
    timeout: 15000,
  });
  return data;
};

const validateResponse = (data) => {
  if (!data?.status || !Array.isArray(data?.result)) {
    return { valid: false, msg: "Response tidak valid dari API" };
  }
  if (data.result.length === 0) {
    return { valid: false, msg: "Tidak ditemukan hasil untuk query ini" };
  }
  return { valid: true };
};

// ─── Module Export ─────────────────────────────────────
export default {
  name: "Pinterest Scraper",
  description: "Scrape gambar dari Pinterest menggunakan Faa API",
  category: "Search",
  methods: ["GET", "POST"],
  params: ["query", "limit"],
  paramsSchema: {
    query: { type: "string", required: true, minLength: 1 },  // Kata pencarian
    limit: { type: "string", required: false },                // Jumlah hasil (optional)
  },
  async run(req, res) {
    try {
      // ── Ambil params ──
      const query = req.method === "GET" ? req.query.query : req.body.query;
      const limit = req.method === "GET" ? req.query.limit : req.body.limit;

      // ── Validasi ──
      if (!query) {
        return res.status(400).json({
          error: 'Parameter "query" diperlukan',
        });
      }

      const parsedLimit = limit ? parseInt(limit) : null;

      if (limit && (isNaN(parsedLimit) || parsedLimit < 1)) {
        return res.status(400).json({
          error: '"limit" harus berupa angka positif',
        });
      }

      // ── Fetch dari API ──
      const data = await fetchPinterest(query.trim());

      // ── Validasi Response ──
      const check = validateResponse(data);
      if (!check.valid) {
        return res.status(404).json({ error: check.msg });
      }

      // ── Slice jika ada limit ──
      const results = parsedLimit ? data.result.slice(0, parsedLimit) : data.result;

      // ── Return ──
      return res.status(200).json({
        results: {
          query: query.trim(),
          total: results.length,
          images: results,
        },
      });
    } catch (error) {
      return res.status(500).json({
        error: `Gagal mengambil data: ${error.message}`,
      });
    }
  },
};
