import { createCanvas } from "@napi-rs/canvas";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { spawn } from "child_process";
import { promisify } from "util";

const writeFileAsync = promisify(fs.writeFile);
const unlinkAsync = promisify(fs.unlink);
const existsAsync = promisify(fs.exists);

export default {
  name: "ATT&P Video Generator",
  description: "Create animated text video with color changing effect using FFmpeg",
  category: "Canvas",
  methods: ["GET"],
  params: ["text"],
  paramsSchema: {
    text: { type: "string", required: true, minLength: 1, }
  },

  async run(req, res) {
    let tempDir = '';
    let frameFiles = [];

    try {
      const text = req.method === "GET" ? req.query.text : req.body.text;

      if (!text) {
        return res.status(400).json({
          success: false,
          error: 'Parameter "text" is required'
        });
      }

      console.log(`Generating ATT&P video with text: "${text}"`);

      const width = 400;
      const height = 400;
      const fontSize = 48;
      const frames = 30;
      const duration = 3;
      const fps = frames / duration;

      const colors = [
        '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#00FFFF', '#FF00FF',
        '#FFA500', '#800080', '#008080', '#FFC0CB', '#FFD700', '#00BFFF',
        '#8A2BE2', '#FF69B4', '#B22222'
      ];

      tempDir = path.join(process.cwd(), "files", crypto.randomBytes(8).toString("hex"));
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      for (let i = 0; i < frames; i++) {
        const canvas = createCanvas(width, height);
        const context = canvas.getContext("2d");

        context.fillStyle = "#000000";
        context.fillRect(0, 0, width, height);

        const colorIndex = Math.floor((i / frames) * colors.length);
        context.fillStyle = colors[colorIndex % colors.length];
        context.font = `bold ${fontSize}px Arial, Helvetica, sans-serif`;
        context.textAlign = "center";
        context.textBaseline = "middle";

        const words = text.split(" ");
        let line = "";
        let lines = [];
        
        for (let n = 0; n < words.length; n++) {
          let testLine = line + words[n] + " ";
          let metrics = context.measureText(testLine);
          let testWidth = metrics.width;
          
          if (testWidth > width - 40 && n > 0) {
            lines.push(line.trim());
            line = words[n] + " ";
          } else {
            line = testLine;
          }
        }
        lines.push(line.trim());

        const x = width / 2;
        let y = height / 2 - ((lines.length - 1) * fontSize) / 2;

        context.strokeStyle = '#000000';
        context.lineWidth = 3;

        for (let j = 0; j < lines.length; j++) {
          if (lines[j].trim() !== "") {
            context.strokeText(lines[j], x, y);
            context.fillText(lines[j], x, y);
          }
          y += fontSize;
        }

        const buffer = canvas.toBuffer("image/png");
        const framePath = path.join(tempDir, `frame_${i.toString().padStart(4, '0')}.png`);
        await writeFileAsync(framePath, buffer);
        frameFiles.push(framePath);
      }

      console.log(`Generated ${frames} frames, creating video...`);

      const uploadDir = path.join(process.cwd(), "files");
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const outputFileName = crypto.randomBytes(16).toString("hex") + ".mp4";
      const outputPath = path.join(uploadDir, outputFileName);

      return new Promise((resolve, reject) => {
        const ffmpegArgs = [
          '-y',
          '-framerate', fps.toString(),
          '-i', path.join(tempDir, 'frame_%04d.png'),
          '-c:v', 'libx264',
          '-pix_fmt', 'yuv420p',
          '-crf', '23',
          '-preset', 'fast',
          outputPath
        ];

        const ffmpeg = spawn('ffmpeg', ffmpegArgs);

        let stderr = '';

        ffmpeg.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        ffmpeg.on('close', async (code) => {
          try {
            for (const file of frameFiles) {
              if (await existsAsync(file)) {
                await unlinkAsync(file);
              }
            }
            if (await existsAsync(tempDir)) {
              fs.rmdirSync(tempDir, { recursive: true });
            }
          } catch (cleanupErr) {
            console.error('Cleanup error:', cleanupErr);
          }

          if (code === 0) {
            const fileUrl = `${req.protocol}://${req.get("host")}/files/${outputFileName}`;
            
            setTimeout(async () => {
              if (await existsAsync(outputPath)) {
                try {
                  await unlinkAsync(outputPath);
                } catch (err) {
                  console.error("Error deleting video:", err);
                }
              }
            }, 5 * 60 * 1000);

            res.json({
              results: {
                url: fileUrl,
                filename: outputFileName,
                mimetype: "video/mp4",
              },
              dimensions: { 
                width, 
                height 
              },
              animation: {
                frames: frames,
                duration: `${duration} seconds`,
                fps: fps,
                colors: colors.length
              },
              text: text,
              message: "ATT&P video created successfully!"
            });
            resolve();
          } else {
            console.error('FFmpeg error:', stderr);
            reject(new Error(`FFmpeg failed with code ${code}: ${stderr}`));
          }
        });

        ffmpeg.on('error', (error) => {
          reject(new Error(`FFmpeg execution failed: ${error.message}`));
        });
      });

    } catch (err) {
      console.error("ATT&P video generation error:", err);
      
      try {
        for (const file of frameFiles) {
          if (fs.existsSync(file)) {
            fs.unlinkSync(file);
          }
        }
        if (tempDir && fs.existsSync(tempDir)) {
          fs.rmdirSync(tempDir, { recursive: true });
        }
      } catch (cleanupErr) {
        console.error('Cleanup error:', cleanupErr);
      }

      res.status(500).json({
        error: "Failed to create animated video",
        details: err.message
      });
    }
  },
};