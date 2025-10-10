import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import fs from "fs";
import path from "path";
import crypto from "crypto";

export default {
  name: "Text on Image",
  description: "Create static image with text overlay on brat_nime background",
  category: "Canvas",
  methods: ["GET"],
  params: ["text"],
  paramsSchema: {
    text: { type: "string", required: true, minLength: 1, }
  },

  async run(req, res) {
    try {
      const text = req.method === "GET" ? req.query.text : req.body.text;

      if (!text) {
        return res.status(400).json({
          success: false,
          error: 'Parameter "text" is required'
        });
      }

      console.log(`Generating image with text: "${text}"`);

      const imagePathLocal = path.join(process.cwd(), "src", "services", "canvas", "brat_nime.jpg");
      const fontPath = path.join(process.cwd(), "src", "services", "canvas", "font", "NotoColorEmoji.ttf");
      
      if (!fs.existsSync(imagePathLocal)) {
        return res.status(500).json({
          success: false,
          error: "Base image not found. Please ensure brat_nime.jpg exists in src/services/canvas/ directory"
        });
      }

      if (!fs.existsSync(fontPath)) {
        return res.status(500).json({
          success: false,
          error: "Font not found. Please ensure noto.ttf exists in src/services/canvas/font/ directory"
        });
      }

      const filesDir = path.join(process.cwd(), "files");
      if (!fs.existsSync(filesDir)) {
        fs.mkdirSync(filesDir, { recursive: true });
      }

      const baseImage = await loadImage(fs.readFileSync(imagePathLocal));
      const canvas = createCanvas(baseImage.width, baseImage.height);
      const ctx = canvas.getContext("2d");

      GlobalFonts.registerFromPath(fontPath, "NotoFont");

      const boardX = canvas.width * 0.15;
      const boardY = canvas.height * 0.6;
      const boardWidth = canvas.width * 0.7;
      const boardHeight = canvas.height * 0.3;

      ctx.drawImage(baseImage, 0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "#FFFFFF";
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 3;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const maxFontSize = 36;
      const minFontSize = 14;
      let fontSize = maxFontSize;

      function isTextFit(text, fontSize) {
        ctx.font = `bold ${fontSize}px NotoFont`;
        const words = text.split(" ");
        const lineHeight = fontSize * 1.2;
        const maxWidth = boardWidth * 0.9;
        const lines = [];
        let currentLine = words[0];

        for (let i = 1; i < words.length; i++) {
          const testLine = currentLine + " " + words[i];
          const testWidth = ctx.measureText(testLine).width;
          if (testWidth > maxWidth) {
            lines.push(currentLine);
            currentLine = words[i];
          } else {
            currentLine = testLine;
          }
        }
        lines.push(currentLine);

        const textHeight = lines.length * lineHeight;
        return textHeight <= boardHeight * 0.9;
      }

      while (!isTextFit(text, fontSize) && fontSize > minFontSize) {
        fontSize -= 2;
      }

      ctx.font = `bold ${fontSize}px NotoFont`;
      
      const lineHeight = fontSize * 1.2;
      const maxWidth = boardWidth * 0.9;

      const lines = [];
      let currentLine = "";
      text.split(" ").forEach(word => {
        const testLine = currentLine ? currentLine + " " + word : word;
        const testWidth = ctx.measureText(testLine).width;
        if (testWidth > maxWidth) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      });
      lines.push(currentLine);

      const startY = boardY + boardHeight / 2 - (lines.length - 1) * lineHeight / 2;

      lines.forEach((line, index) => {
        const yPos = startY + index * lineHeight;
        const xPos = boardX + boardWidth / 2;
        
        ctx.strokeText(line, xPos, yPos);
        ctx.fillText(line, xPos, yPos);
      });

      const buffer = canvas.toBuffer("image/png");

      const finalFileName = `image_${crypto.randomBytes(8).toString("hex")}.png`;
      const finalFilePath = path.join(filesDir, finalFileName);
      fs.writeFileSync(finalFilePath, buffer);
      
      const fileUrl = `${req.protocol}://${req.get("host")}/files/${finalFileName}`;

      setTimeout(() => {
        try {
          if (fs.existsSync(finalFilePath)) {
            fs.unlinkSync(finalFilePath);
          }
        } catch (err) {
          console.error("Error deleting final file:", err);
        }
      }, 5 * 60 * 1000);

      res.json({
        results: {
          url: fileUrl,
          filename: finalFileName,
          mimetype: "image/png",
          size: buffer.length,
        },
        dimensions: {
          width: canvas.width,
          height: canvas.height
        },
        text: text,
        fontSize: fontSize,
        lines: lines.length,
        message: "Image created successfully!"
      });

    } catch (err) {
      console.error("Image generation error:", err);
      
      res.status(500).json({
        error: "Failed to create image",
        details: err.message
      });
    }
  },
};