import MediafireScraper from "../../src/services/class/medifirescraper.js";

export default {
  name: "Mediafire Scraper",
  description: "Scrape download link dan info file dari Mediafire",
  category: "Downloader",
  methods: ["GET"],
  params: ["url"],
  paramsSchema: {
    url: { type: "string", required: true, minLength: 1 },
  },

  async run(req, res) {
    try {
      const url = req.method === "GET" ? req.query.url : req.body.url;

      if (!url) {
        return res.status(400).json({ success: false, error: 'Parameter "url" diperlukan' });
      }

      if (!url.includes("mediafire.com")) {
        return res.status(400).json({ success: false, error: "URL harus dari mediafire.com" });
      }

      const scraper = new MediafireScraper();
      const results = await scraper.download(url);

      res.json({
        success: true,
        data: results,
        timestamp: new Date().toISOString(),
        attribution: "@synshin9",
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
};
