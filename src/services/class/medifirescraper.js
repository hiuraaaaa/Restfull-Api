import axios from "axios";
import cheerio from "cheerio";

const MIME_TYPES = {
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
};

export default class MediafireScraper {
  constructor() {
    this.headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    };
  }

  getMimeType(url) {
    if (!url) return "unknown";
    const ext = url.split("/").pop().split("?")[0].split(".").pop().toLowerCase();
    return MIME_TYPES[ext] || "unknown";
  }

  async download(url) {
    const { data: html } = await axios.get(url, {
      headers: this.headers,
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
    const mimetype = this.getMimeType(downloadLink);

    return {
      meta: { title, image, description },
      download: { link: downloadLink, size, mimetype },
    };
  }
}
