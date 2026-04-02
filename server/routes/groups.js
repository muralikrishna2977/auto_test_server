import express from "express";
import { pool } from "../db.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/getgroups", authMiddleware, async (req, res) => {
  const user_id = req.user.userId;
  try {
    const result = await pool.query(
      "SELECT * FROM testcase_groups WHERE user_id = $1 ORDER BY id ASC",
      [user_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ err: err, message: "Internal server error" });
  }
});

router.post("/savegroup", authMiddleware, async (req, res) => {
  const user_id = req.user.userId;
  try {
    const { group_name, group_description } = req.body;
    await pool.query(
      "INSERT INTO testcase_groups (user_id, group_name, comment) VALUES ($1, $2, $3)",
      [user_id, group_name, group_description]
    );
    res.json({ message: "Group created" });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({
        message: "group name already exists",
      });
    }
    res.status(500).json({ message: "Internal server error" });
  }
});

// group items
router.get("/groups/:id", authMiddleware, async (req, res) => {
  const groupId = Number(req.params.id);

  if (!groupId) return res.status(400).json({ message: "Invalid group id" });

  try {
    const groupRes = await pool.query(
      "SELECT * FROM testcase_groups WHERE id = $1",
      [groupId]
    );

    if (groupRes.rowCount === 0) {
      return res.status(404).json({ message: "Group not found" });
    }

    const itemsRes = await pool.query(
      `
      SELECT 
        tgi.group_id,
        tgi.testcase_id,
        tgi.is_public,
        t.name AS testcase_name
      FROM testcase_group_items tgi
      JOIN testcases t
        ON t.testcase_id = tgi.testcase_id
      WHERE tgi.group_id = $1
      ORDER BY tgi.id ASC
      `,
      [groupId]
    );

    res.json({ ...groupRes.rows[0], items: itemsRes.rows });
  } catch (err) {
    console.error("GET /groups/:id error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});


router.post("/groups/addMultiple", authMiddleware, async (req, res) => {
  try {
    const group_id = Number(req.body.group_id);
    const selectedTestcases = req.body.selectedTestcases;

    if (!group_id) {
      return res.status(400).json({ message: "group_id is required" });
    }

    if (!Array.isArray(selectedTestcases) || selectedTestcases.length === 0) {
      return res.status(400).json({ message: "selectedTestcases is required" });
    }

    const testcaseIds = selectedTestcases
      .map((t) => String(t?.testcase_id || "").trim())
      .filter(Boolean);

    const isPublicArr = selectedTestcases
      .map((t) => Boolean(t?.isPublic));

    if (testcaseIds.length === 0) {
      return res.status(400).json({ message: "No valid testcase_id found" });
    }

    const sql = `
      INSERT INTO testcase_group_items (group_id, testcase_id, is_public)
      SELECT $1, x.testcase_id, x.is_public
      FROM unnest($2::text[], $3::boolean[]) AS x(testcase_id, is_public)
      ON CONFLICT (group_id, testcase_id) DO UPDATE
        SET is_public = EXCLUDED.is_public
    `;

    await pool.query(sql, [group_id, testcaseIds, isPublicArr]);

    return res.status(200).json({ message: "Added to group" });
  } catch (err) {
    console.error("Add multiple testcases error:", err);
    return res.status(500).json({ message: err.message });
  }
});



router.delete("/groups/item/:groupId/:testcaseId", authMiddleware, async (req, res) => {
  const groupId = Number(req.params.groupId);
  const testcaseId = req.params.testcaseId;

  if (!groupId || !testcaseId) {
    return res.status(400).json({ message: "Invalid group id or testcase id" });
  }

  try {
    await pool.query("DELETE FROM testcase_group_items WHERE group_id = $1 AND testcase_id = $2", [groupId, testcaseId]);
    return res.json({ message: "Removed" });
  } catch (err) {
    console.error("DELETE /groups/item/:groupId/:testcaseId error:", err);
    return res.status(500).json({ message: err.message });
  }
});

router.post("/deletegroup", authMiddleware, async (req, res) => {
  const { group_id } = req.body;
  const user_id = req.user.userId;
  try {
    await pool.query("DELETE FROM testcase_groups WHERE id = $1 AND user_id = $2", [group_id, user_id]);
    return res.json({ message: "Group deleted" });
  } catch (err) {
    console.error("DELETE /groups/item/:groupId/:testcaseId error:", err);
    return res.status(500).json({ message: err.message });
  }
});

export default router;

