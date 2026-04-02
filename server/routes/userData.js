// routes/mainDataAndUpload.js
import express from "express";
import { pool } from "../db.js";
import authMiddleware from "../middleware/authMiddleware.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import { FRAMEWORK_PATH } from "../constants.js";

const router = express.Router();

// const FRAMEWORK_PATH = path.join(process.cwd(), "../framework");
// const FRAMEWORK_PATH= "/xdata/qaautomation/autobots/framework";

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function getUserUploadsDir(userId) {
  const uploadsDir = path.join(FRAMEWORK_PATH, "uploadFiles", `user_${userId}`);
  ensureDir(uploadsDir);
  return uploadsDir;
}

router.get("/getmaindata", authMiddleware, async (req, res) => {
  const user_id=req.user.userId;
  try {
    const result = await pool.query("SELECT * FROM users_data WHERE user_id = $1", [user_id]);
    res.json(result.rows[0] || null);
  } catch (err) {
    res.status(500).json({ message: "Failed to load userdata" });
  }
});

router.post("/updatemaindata", authMiddleware, async (req, res) => {
  const user_id=req.user.userId;
  try {
    const { site_url, site_email_id, site_password } = req.body;

    if (!user_id || !site_url || !site_password) {
      return res.status(400).json({
        message: "user_id, site_url and site_password are required",
      });
    }

    const query = `
      INSERT INTO users_data (user_id, site_url, site_email_id, site_password_hash)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id)
      DO UPDATE SET
        site_url = EXCLUDED.site_url,
        site_email_id = EXCLUDED.site_email_id,
        site_password_hash = EXCLUDED.site_password_hash
      RETURNING id, user_id, site_url, site_email_id;
    `;

    const values = [
      user_id,
      site_url,
      site_email_id || null,
      site_password,
    ];

    const result = await pool.query(query, values);

    res.status(200).json({
      message: "Main data inserted/updated successfully",
    });
  } catch (err) {
    console.error("UPSERT error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// blocked some dangerous extensions 
const blockedExt = new Set([
  ".exe",
  ".msi",
  ".bat",
  ".cmd",
  ".sh",
  ".ps1",
  ".dll",
  ".jar",
  ".com",
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userId = req.user.userId;
    cb(null, getUserUploadsDir(userId));
  },
  filename: (req, file, cb) => {
    const safeName = path
      .basename(file.originalname)
      .replace(/[^a-zA-Z0-9._-]/g, "_");

    cb(null, safeName); // overwrite
  },
});

// allow ANY type, just block dangerous extensions
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (blockedExt.has(ext)) {
    return cb(new Error(`File type not allowed: ${ext}`), false);
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB each (change if needed)
    files: 10, // max 10 files
  },
});

router.post("/upload-multiple", authMiddleware, upload.array("files", 10), (req, res) => {
    const files = (req.files || []).map((f) => ({
      originalname: f.originalname,
      filename: f.filename,
      path: f.path,
      size: f.size,
      mimetype: f.mimetype,
    }));

    res.json({ message: "Uploaded", files });
  }
);

router.get("/files", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const uploadsDir = getUserUploadsDir(userId);

    const files = fs.readdirSync(uploadsDir, { withFileTypes: true })
      .filter((d) => d.isFile())
      .map((d) => d.name);

    res.json({
      count: files.length,
      files,
    });
  } catch (err) {
    console.error("Fetch files error:", err);
    res.status(500).json({ message: "Failed to read files" });
  }
});

router.use((err, req, res, next) => {
  if (err?.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ message: "File too large (max 50MB)" });
  }
  if (err?.code === "LIMIT_FILE_COUNT") {
    return res.status(400).json({ message: "Too many files (max 10)" });
  }
  if (err) {
    return res.status(400).json({ message: err.message || "Upload failed" });
  }
  next();
});

router.delete("/files/:filename", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { filename } = req.params;

    // prevent path traversal
    if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
      return res.status(400).json({ message: "Invalid filename" });
    }

    const uploadsDir = getUserUploadsDir(userId);
    const filePath = path.join(uploadsDir, filename);

    // file does not exist
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "File not found" });
    }

    // delete file
    fs.unlinkSync(filePath);

    res.json({ message: "File deleted successfully", filename });
  } catch (err) {
    console.error("Delete file error:", err);
    res.status(500).json({ message: "Failed to delete file" });
  }
});

export default router;
