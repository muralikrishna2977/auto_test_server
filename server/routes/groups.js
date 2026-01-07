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
  const groupId = req.params.id;
  const user_id = req.user.userId;
  try{
    const groupRes = await pool.query(
      "SELECT * FROM testcase_groups WHERE id = $1",
      [groupId]
    );
  
    const itemsRes = await pool.query(
      `SELECT tgi.id, tgi.testcase_id, nt.name AS testcase_name, nt.testcase_id
      FROM testcase_group_items tgi
      JOIN new_testcases nt 
      ON nt.id = tgi.testcase_id
      WHERE 
      tgi.group_id = $1
      AND nt.user_id = $2`,
      [groupId, user_id]
    );
  
    res.json({ ...groupRes.rows[0], items: itemsRes.rows });
  } catch(err){
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/groups/addMultiple", authMiddleware, async (req, res) => {
  const { group_id, testcase_ids } = req.body; // testcase_ids = array of testcase_id (business ids)
  const user_id = req.user.userId;
  console.log("tcids ",testcase_ids);

  if (!Array.isArray(testcase_ids) || testcase_ids.length === 0) {
    return res.status(400).json({ message: "No testcases provided" });
  }

  try {
    await pool.query(
      `
      INSERT INTO testcase_group_items (group_id, testcase_id)
      SELECT $1, nt.id
      FROM new_testcases nt
      WHERE nt.testcase_id = ANY($2)
        AND nt.user_id = $3
      ON CONFLICT (group_id, testcase_id) DO NOTHING
      `,
      [group_id, testcase_ids, user_id]
    );

    res.status(200).json({ message: "Testcases added to group" });
  } catch (err) {
    console.error("Add multiple testcases error:", err.message);
    res.status(500).json({ message: "Internal server error" });
  }
});


router.delete("/groups/item/:itemId", async (req, res) => {
  await pool.query("DELETE FROM testcase_group_items WHERE id = $1", [
    req.params.itemId,
  ]);
  res.json({ message: "Removed" });
});

export default router;
