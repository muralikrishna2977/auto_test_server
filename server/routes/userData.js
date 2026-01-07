import express from "express";
import { pool } from "../db.js";
import authMiddleware from "../middleware/authMiddleware.js";
// import bcrypt from "bcrypt";

const router = express.Router();

router.get("/getmaindata", authMiddleware, async (req, res) => {
  const user_id=req.user.userId;
  try {
    const result = await pool.query("SELECT * FROM main_data WHERE user_id = $1", [user_id]);
    res.json(result.rows[0] || null);
  } catch (err) {
    res.status(500).json({ message: "Failed to load userdata" });
  }
});

router.post("/updatemaindata", async (req, res) => {
  try {
    const { site_url, site_email_id, site_password, user_id } = req.body;

    if (!user_id || !site_url || !site_password) {
      return res.status(400).json({
        message: "user_id, site_url and site_password are required",
      });
    }

    // const passwordHash = await bcrypt.hash(site_password, 10);

    const query = `
      INSERT INTO main_data (user_id, site_url, site_email_id, site_password_hash)
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

export default router;
