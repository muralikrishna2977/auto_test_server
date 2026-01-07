import express from "express";
import { pool } from "../db.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();


router.get("/getnewtestcases", authMiddleware, async (req, res) => {
  const user_id=req.user.userId;
  try {
    const result = await pool.query("SELECT * FROM new_testcases WHERE user_id=$1 ORDER BY id ASC", [user_id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: "Failed to load testcases" });
  }
}); 

router.post("/savenewtestcase", authMiddleware, async (req, res) => {
  const { testcase_id, name, testcase_json } = req.body;
  const user_id=req.user.userId;

  try {
    await pool.query(
      "INSERT INTO new_testcases (testcase_id, user_id, name, testcase_json) VALUES ($1, $2, $3, $4)",
      [testcase_id, user_id, name, testcase_json]
    );
    res.json({ message: "Testcase saved" });
  } catch (err) {
    res.status(500).json({ message: "Insert failed" });
  }
});

export default router;
