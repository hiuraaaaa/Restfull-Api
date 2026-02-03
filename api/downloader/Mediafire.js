import axios from "axios";
import cheerio from "cheerio";

const CONFIG = {
  HEADERS: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  },
  MIME_TYPES: {
    "7z": "application/x-7z-compressed",
    zip: "application/zip",
    rar: "application/x-rar-compressed",
    apk: "application/vnd.android.package-archive",
    exe: "application/x-msdownload",
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    mp3: "audio/mpeg",
    mp4: "video/mp4",
    txt: "text/plain",
    json: "application/json",
    js: "application/javascript",
    html: "text/html",
    css: "text/css",
  },
};

const getMimeType = (url) => {
  if (!url) return "unknown";
  const ext = url.split("/").pop().split("?")[0].split(".").pop().toLowerCase();
  return CONFIG.MIME_TYPES[ext] || "unknown";
};

const scrapeMediafire = async (url) => {
  const { data: html } = await axios.get(url, {
    headers: CONFIG.HEADERS,
    timeout: 15000,
  });
  const $ = cheerio.load(html);

  const title = $('meta[property="og:title"]').attr("content");
  const image = $('meta[property="og:image"]').attr("content");
  const description =
    $('meta[property="og:description"]').attr("content") || "No description";
  const downloadLink = $("#downloadButton").attr("href");
  const rawSize = $("#downloadButton").text().trim();
  const size = rawSize.replace("Download (", "").replace(")", "");
  const mimetype = getMimeType(downloadLink);

  return { title, image, description, downloadLink, size, mimetype };
};

export default {
  name: "Mediafire Scraper",
  description: "Scrape download link dan info file dari Mediafire",
  category: "Scraper",
  methods: ["GET", "POST"],
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

      const { title, image, description, downloadLink, size, mimetype } =
        await scrapeMediafire(url);

      if (!downloadLink) {
        return res.status(404).json({ success: false, error: "Download link tidak ditemukan" });
      }

      res.json({
        success: true,
        data: {
          meta: { title, image, description },
          download: { link: downloadLink, size, mimetype },
        },
        timestamp: new Date().toISOString(),
        attribution: "@synshin9",
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
};
