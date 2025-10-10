import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import axios from "axios";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { promisify } from "util";
import { exec as childExec } from "child_process";

const exec = promisify(childExec);

export default {
  name: "Animated Text Sticker",
  description: "Create animated text sticker with typewriter effect",
  category: "Canvas",
  methods: ["GET"],
  params: ["text"],
  paramsSchema: {
    text: { type: "string", required: true, minLength: 1, }
  },
  async run(req, res) {
    let tempFiles = [];
    
    try {
      const { text } = req.method === "GET" ? req.query.text : req.body.text;;

      if (!text) {
        return res.status(400).json({
          success: false,
          error: 'Parameter "text" is required'
        });
      }

      console.log(`Generating animated sticker with text: "${text}"`);

      const imagePathLocal = path.join(process.cwd(), "src", "services", "canvas", "brat_nime.jpg");
      
      if (!fs.existsSync(imagePathLocal)) {
        return res.status(500).json({
          success: false,
          error: "Base image not found. Please ensure brat_nime.jpg exists in src/services/canvas/ directory"
        });
      }

      const fontUrl = "https://github.com/googlefonts/noto-emoji/raw/main/fonts/NotoColorEmoji.ttf";

      // Base directory untuk files
      const filesDir = path.join(process.cwd(), "files");
      if (!fs.existsSync(filesDir)) {
        fs.mkdirSync(filesDir, { recursive: true });
      }

      // Generate unique names untuk file temporary
      const sessionId = crypto.randomBytes(8).toString("hex");
      const fontPath = path.join(filesDir, `font_${sessionId}.ttf`);
      const outputMp4 = path.join(filesDir, `video_${sessionId}.mp4`);
      const outputWebP = path.join(filesDir, `sticker_${sessionId}.webp`);
      const frameDir = path.join(filesDir, `frames_${sessionId}`);

      // Simpan ke array untuk cleanup
      tempFiles.push(fontPath, outputMp4, outputWebP, frameDir);

      // Buat frame directory
      if (!fs.existsSync(frameDir)) {
        fs.mkdirSync(frameDir, { recursive: true });
      }

      // Download font jika belum ada
      if (!fs.existsSync(fontPath)) {
        try {
          const fontData = await axios.get(fontUrl, {
            responseType: "arraybuffer",
            timeout: 30000
          });
          fs.writeFileSync(fontPath, Buffer.from(fontData.data));
          console.log("Font downloaded successfully");
        } catch (fontError) {
          console.error("Failed to download font:", fontError);
          return res.status(500).json({
            success: false,
            error: "Failed to download required font"
          });
        }
      }

      // Load base image dari lokal
      const baseImage = await loadImage(fs.readFileSync(imagePathLocal));
      const canvas = createCanvas(baseImage.width, baseImage.height);
      const ctx = canvas.getContext("2d");

      // Register font
      GlobalFonts.registerFromPath(fontPath, "EmojiFont");

      const boardX = canvas.width * 0.15;
      const boardY = canvas.height * 0.6;
      const boardWidth = canvas.width * 0.7;
      const boardHeight = canvas.height * 0.3;

      ctx.fillStyle = "#FFFFFF";
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 2;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const maxFontSize = 36;
      const minFontSize = 14;
      let fontSize = maxFontSize;

      function isTextFit(text, fontSize) {
        ctx.font = `bold ${fontSize}px EmojiFont`;
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

      ctx.font = `bold ${fontSize}px EmojiFont`;
      const words = text.split(" ");
      const lineHeight = fontSize * 1.2;
      const maxWidth = boardWidth * 0.9;

      const frames = [];
      for (let i = 1; i <= words.length; i++) {
        const tempText = words.slice(0, i).join(" ");
        const frameCanvas = createCanvas(baseImage.width, baseImage.height);
        const frameCtx = frameCanvas.getContext("2d");

        frameCtx.drawImage(baseImage, 0, 0, frameCanvas.width, frameCanvas.height);

        frameCtx.fillStyle = "#FFFFFF";
        frameCtx.strokeStyle = "#000000";
        frameCtx.lineWidth = 2;
        frameCtx.textAlign = "center";
        frameCtx.textBaseline = "middle";
        frameCtx.font = `bold ${fontSize}px EmojiFont`;

        const lines = [];
        let currentLine = "";
        tempText.split(" ").forEach(word => {
          const testLine = currentLine ? currentLine + " " + word : word;
          const testWidth = frameCtx.measureText(testLine).width;
          if (testWidth > maxWidth) {
            lines.push(currentLine);
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        });
        lines.push(currentLine);

        // Calculate text position
        const startY = boardY + boardHeight / 2 - (lines.length - 1) * lineHeight / 2;

        // Draw text lines dengan outline
        lines.forEach((line, index) => {
          const yPos = startY + index * lineHeight;
          frameCtx.strokeText(line, boardX + boardWidth / 2, yPos); // Outline
          frameCtx.fillText(line, boardX + boardWidth / 2, yPos);   // Fill
        });

        // Save frame
        const framePath = path.join(frameDir, `frame${i.toString().padStart(3, '0')}.png`);
        fs.writeFileSync(framePath, frameCanvas.toBuffer("image/png"));
        frames.push(framePath);
        tempFiles.push(framePath);
      }

      console.log(`Generated ${frames.length} frames, creating video...`);

      // Create video from frames menggunakan FFmpeg
      try {
        await exec(`ffmpeg -y -framerate 2 -i ${frameDir}/frame%03d.png -c:v libx264 -pix_fmt yuv420p ${outputMp4}`);
        
        // Convert to WebP sticker
        await exec(`ffmpeg -i ${outputMp4} -vf "scale=512:512:flags=lanczos,format=rgba" -loop 0 -preset default -an -vsync 0 ${outputWebP}`);

        // Baca file WebP sebagai buffer
        const webpBuffer = fs.readFileSync(outputWebP);
        
        // Generate final filename
        const finalFileName = `sticker_${crypto.randomBytes(8).toString("hex")}.webp`;
        const finalFilePath = path.join(filesDir, finalFileName);
        fs.writeFileSync(finalFilePath, webpBuffer);
        
        const fileUrl = `${req.protocol}://${req.get("host")}/files/${finalFileName}`;

        // Auto cleanup temporary files
        setTimeout(() => {
          // Cleanup temp files
          tempFiles.forEach(file => {
            try {
              if (fs.existsSync(file)) {
                if (fs.statSync(file).isDirectory()) {
                  fs.rmSync(file, { recursive: true, force: true });
                } else {
                  fs.unlinkSync(file);
                }
              }
            } catch (err) {
              console.error(`Error cleaning up ${file}:`, err);
            }
          });

          setTimeout(() => {
            try {
              if (fs.existsSync(finalFilePath)) {
                fs.unlinkSync(finalFilePath);
              }
            } catch (err) {
              console.error("Error deleting final file:", err);
            }
          }, 5 * 60 * 1000);

        }, 10000);

        res.json({
          results: {
            url: fileUrl,
            filename: finalFileName,
            mimetype: "image/webp",
            size: webpBuffer.length,
            frames: frames.length,
          },
          text: text,
          message: "Animated sticker created successfully!"
        });

      } catch (ffmpegError) {
        console.error("FFmpeg error:", ffmpegError);
        throw new Error("Video processing failed: " + ffmpegError.message);
      }

    } catch (err) {
      console.error("Animated sticker generation error:", err);

      tempFiles.forEach(file => {
        try {
          if (fs.existsSync(file)) {
            if (fs.statSync(file).isDirectory()) {
              fs.rmSync(file, { recursive: true, force: true });
            } else {
              fs.unlinkSync(file);
            }
          }
        } catch (cleanupErr) {
          console.error(`Cleanup error for ${file}:`, cleanupErr);
        }
      });

      res.status(500).json({
        error: "Failed to create animated sticker",
        details: err.message
      });
    }
  },
};