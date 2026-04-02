import express from "express";
import { pool } from "../db.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/testdata", authMiddleware, async (req, res) => {
  const user_id = req.user.userId;

  try {
    const result = await pool.query(
      `
      SELECT * FROM test_data
      WHERE user_id = $1
      `,
      [user_id]
    );
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error("Fetch test data error:", err);
    return res.status(500).json({ error: "Failed to fetch testcase data" });
  }
});

router.post("/savesharedtestdata", authMiddleware, async (req, res) => {
  const user_id = req.user.userId;
  const { testcase_id, rows } = req.body;
  console.log("testcase_id", testcase_id);
  console.log("rows", rows);

  if (!testcase_id || rows == null) {
    return res.status(400).json({ message: "testcase_id and rows are required" }); 
  }

  try {
    // const tc = await pool.query(
    //   `
    //   SELECT 1
    //   FROM testcases
    //   WHERE user_id = $1 AND testcase_id = $2
    //   `,
    //   [user_id, testcase_id]
    // );

    // if (tc.rowCount === 0) {
    //   return res.status(404).json({ message: "Testcase not found for this user" });
    // }

    await pool.query(
      `
      INSERT INTO test_data (user_id, testcase_id, rows)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, testcase_id)
      DO UPDATE SET rows = EXCLUDED.rows
      `,
      [user_id, testcase_id, JSON.stringify(rows)]
    );

    return res.status(200).json({ message: "Test data saved" });
  } catch (err) {
    console.log("Save test data error:", err);
    return res.status(500).json({ error: "Failed to save test data" });
  }
});

router.post("/savetestdata", authMiddleware, async (req, res) => {
  const user_id = req.user.userId;
  const { testcase_id, rows } = req.body;

  if (!testcase_id || rows == null) {
    return res.status(400).json({ message: "testcase_id and rows are required" });
  }

  try {
    const tc = await pool.query(
      `
      SELECT 1
      FROM testcases
      WHERE user_id = $1 AND testcase_id = $2
      `,
      [user_id, testcase_id]
    );

    if (tc.rowCount === 0) {
      return res.status(404).json({ message: "Testcase not found for this user" });
    }

    await pool.query(
      `
      INSERT INTO test_data (user_id, testcase_id, rows)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, testcase_id)
      DO UPDATE SET rows = EXCLUDED.rows
      `,
      [user_id, testcase_id, JSON.stringify(rows)]
    );

    return res.status(200).json({ message: "Test data saved" });
  } catch (err) {
    console.error("Save test data error:", err);
    return res.status(500).json({ error: "Failed to save test data" });
  }
});

router.put("/sharedactiverow", authMiddleware, async (req, res) => {
  const user_id = req.user.userId;
  const { testcase_id, row_used } = req.body;

  console.log("testcase_id", testcase_id);
  console.log("row_used", row_used);

  if (!testcase_id || row_used == null) {
    return res.status(400).json({ message: "testcase_id and row_used are required" });
  }

  const rowUsedInt = Number(row_used);
  if (!Number.isInteger(rowUsedInt) || rowUsedInt < 1) {
    return res.status(400).json({ message: "row_used must be an integer >= 1" });
  }

  try {

    await pool.query(
      `
      INSERT INTO test_data (user_id, testcase_id, rows, row_used)
      VALUES ($1, $2, '[]'::jsonb, $3)
      ON CONFLICT (user_id, testcase_id)
      DO UPDATE SET row_used = EXCLUDED.row_used
      `,
      [user_id, testcase_id, rowUsedInt]
    );

    return res.status(200).json({ message: "row_used updated successfully" });
  } catch (err) {
    console.log("Update current row error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

router.put("/activerow", authMiddleware, async (req, res) => {
  const user_id = req.user.userId;
  const { testcase_id, row_used } = req.body;

  if (!testcase_id || row_used == null) {
    return res.status(400).json({ message: "testcase_id and row_used are required" });
  }

  const rowUsedInt = Number(row_used);
  if (!Number.isInteger(rowUsedInt) || rowUsedInt < 1) {
    return res.status(400).json({ message: "row_used must be an integer >= 1" });
  }

  try {
    const tc = await pool.query(
      `
      SELECT 1
      FROM testcases
      WHERE user_id = $1 AND testcase_id = $2
      `,
      [user_id, testcase_id]
    );

    if (tc.rowCount === 0) {
      return res.status(404).json({ message: "Testcase not found for this user" });
    }

    await pool.query(
      `
      INSERT INTO test_data (user_id, testcase_id, rows, row_used)
      VALUES ($1, $2, '[]'::jsonb, $3)
      ON CONFLICT (user_id, testcase_id)
      DO UPDATE SET row_used = EXCLUDED.row_used
      `,
      [user_id, testcase_id, rowUsedInt]
    );

    return res.status(200).json({ message: "row_used updated successfully" });
  } catch (err) {
    console.error("Update current row error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
