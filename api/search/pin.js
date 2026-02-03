import axios from "axios";

const CONFIG = {
  BASE_URL: "https://api-faa.my.id/faa/pinterest",
  HEADERS: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "application/json",
  },
};

const fetchPinterest = async (query) => {
  const { data } = await axios.get(CONFIG.BASE_URL, {
    params: { q: query },
    headers: CONFIG.HEADERS,
    timeout: 15000,
  });
  return data;
};

export default {
  name: "Pinterest",
  description: "Pin",
  category: "Search",
  methods: ["GET", "POST"],
  params: ["query", "limit"],
  paramsSchema: {
    query: { type: "string", required: true, minLength: 1 },
    limit: { type: "string", required: false },
  },

  async run(req, res) {
    try {
      const query = req.method === "GET" ? req.query.query : req.body.query;
      const limit = req.method === "GET" ? req.query.limit : req.body.limit;

      if (!query) {
        return res.status(400).json({ success: false, error: 'Parameter "query" diperlukan' });
      }

      const parsedLimit = limit ? parseInt(limit) : null;
      if (limit && (isNaN(parsedLimit) || parsedLimit < 1)) {
        return res.status(400).json({ success: false, error: '"limit" harus berupa angka positif' });
      }

      const data = await fetchPinterest(query.trim());

      if (!data?.status || !Array.isArray(data?.result) || data.result.length === 0) {
        return res.status(404).json({ success: false, error: "Tidak ditemukan gambar untuk query ini" });
      }

      const results = parsedLimit ? data.result.slice(0, parsedLimit) : data.result;

      res.json({
        success: true,
        data: { query: query.trim(), total: results.length, images: results },
        timestamp: new Date().toISOString(),
        attribution: "@synshin9",
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
};
