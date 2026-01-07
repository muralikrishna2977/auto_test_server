import express from "express";
import { pool } from "../db.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/testdata/:testcaseId", authMiddleware, async (req, res) => {
  const { testcaseId } = req.params;
  const user_id = req.user.userId;

  try {
    const result = await pool.query(
      `SELECT td.rows, td.row_used
      FROM test_data td
      JOIN new_testcases nt
        ON nt.id = td.testcase_id
      WHERE nt.testcase_id = $1
        AND nt.user_id = $2`,
      [testcaseId, user_id]
    );
    if (result.rows.length === 0) {
      return res.status(200).json(null);
    }
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch testcase data" });
  }
});


router.post("/savetestdata", authMiddleware, async (req, res) => {
  try {
    const user_id = req.user.userId;
    const { rows, selectedTestcaseId } = req.body;

    await pool.query(
      `
      INSERT INTO test_data (user_id, testcase_id, rows)
      SELECT $1, nt.id, $2
      FROM new_testcases nt
      WHERE nt.testcase_id = $3
        AND nt.user_id = $1
      ON CONFLICT (user_id, testcase_id)
      DO UPDATE SET rows = EXCLUDED.rows
      `,
      [user_id, JSON.stringify(rows), selectedTestcaseId]
    );

    res.status(200).json({ message: "Test data saved" });
  } catch (err) {
    console.error("Save test data error:", err.message);
    res.status(500).json({ error: "Failed to save test data" });
  }
});


router.put("/activerow", authMiddleware, async (req, res) => {
  const user_id = req.user.userId;
  const { testcase_id, row_used } = req.body;

  try {

    if (testcase_id == null || row_used == null) {
      return res.status(400).json({
        message: "testcase_id and row_used are required",
      });
    }

    const result = await pool.query(
      `UPDATE test_data td
      SET row_used = $1
      FROM new_testcases nt
      WHERE td.testcase_id = nt.id
        AND nt.testcase_id = $2
        AND nt.user_id = $3
      RETURNING td.row_used
      `,
      [row_used, testcase_id, user_id]
    );


    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "Testcase data not found",
      });
    }

    res.json({
      message: "row_used is updated successfully",
    });
  } catch (err) {
    console.error("Update current row error:", err);
    res.status(500).json({ message: "Server error" });
  }
});


export default router;


