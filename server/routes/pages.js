// routes/pages.js
import express from "express";
import { pool } from "../db.js";
import authMiddleware from "../middleware/authMiddleware.js";


const router = express.Router();

router.get("/getpages", authMiddleware, async (req, res) => {
  const user_id=req.user.userId;
  try {
    const result = await pool.query("SELECT * FROM pages WHERE user_id = $1 ORDER BY id DESC", [user_id]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load pages" });
  }
});

router.post("/savepage", authMiddleware, async (req, res) => {
  const { page_name, page_json, user_id } = req.body;
  try {
    const result=await pool.query(
      "INSERT INTO pages (user_id, page_name, page_json) VALUES ($1, $2, $3) RETURNING id",
      [user_id, page_name, page_json]
    );
    res.json({ message: "Page saved", id: result.rows[0].id});
  } catch (err) {
    console.error(err);
    if (err.code === "23505") {
      return res.status(409).json({
        message: "Page name already exists",
      });
    }
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/saveeditedpage", authMiddleware, async (req, res) => {
  try {
    const { page_name, page_json, id, user_id} = req.body;

    // Validation
    if (!page_name || !page_json || !id || !user_id) {
      return res.status(400).json({
        message: "page_name, page_json, user_id and id are required",
      });
    }

    // Update page
    const result = await pool.query(`
      UPDATE pages
      SET page_name = $1, page_json = $2
      WHERE id = $3 and user_id = $4
      `,
      [page_name, page_json, id, user_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "Page not found", 
      });
    }

    res.status(200).json({
      message: "Page updated successfully",
      page: result.rows[0],
    });

  } catch (error) {
    console.error(error);
    if (error.code === "23505") {
      return res.status(409).json({
        message: "Page name already exists",
      });
    }
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
