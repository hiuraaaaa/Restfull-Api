import { createCanvas } from "@napi-rs/canvas";
import path from "path";
import fs from "fs";
import crypto from "crypto";

export default {
  name: "Text to Image (White BG, Black Stroke)",
  description: "Create white background image with white text and black stroke",
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

      // Create canvas
      const size = 400;
      const canvas = createCanvas(size, size);
      const context = canvas.getContext("2d");

      // Draw WHITE background
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, size, size);

      // Set text fill color to WHITE (Invisible)
      context.fillStyle = "#ffffff";
      context.font = "bold 42px 'Times New Roman', Times, serif";
      context.textAlign = "center";
      context.textBaseline = "middle";

      // Set text stroke color to BLACK (Visible outline)
      context.strokeStyle = "#000000";
      context.lineWidth = 2;
      
      // Calculate position
      const x = size / 2;
      const y = size / 2;

      // Draw the black stroke (outline)
      context.strokeText(text, x, y);
      // Draw the white fill (same as background, making it invisible)
      context.fillText(text, x, y);

      // Convert to buffer
      const buffer = canvas.toBuffer("image/png");

      // Generate filename and save
      const uploadDir = path.join(process.cwd(), "files");
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const randomName = crypto.randomBytes(16).toString("hex") + ".png";
      const filePath = path.join(uploadDir, randomName);
      fs.writeFileSync(filePath, buffer);

      const fileUrl = `${req.protocol}://${req.get("host")}/files/${randomName}`;

      // Auto delete after 5 minutes
      setTimeout(() => {
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
          } catch (err) {
            console.error("Error deleting file:", err);
          }
        }
      }, 5 * 60 * 1000);

      res.json({
        results: {
          url: fileUrl,
          filename: randomName,
          mimetype: "image/png",
          size: buffer.length,
        },
        dimensions: {
          width: size,
          height: size
        },
        message: "Text image created successfully!"
      });

    } catch (err) {
      console.error("Text image generation error:", err);
      
      res.status(500).json({
        error: "Failed to create text image",
        details: err.message
      });
    }
  },
};
