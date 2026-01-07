import express from "express";
import { pool } from "../db.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/savescenarionew", authMiddleware, async (req, res) => {
  const { scenario_id, name, scenario_json, user_id } = req.body;
  try {
    const result=await pool.query(
      "INSERT INTO new_scenarios (scenario_id, user_id, name, scenario_json) VALUES ($1, $2, $3, $4) RETURNING id",
      [scenario_id, user_id, name, scenario_json]
    );
    res.json({ message: "Scenario saved", id: result.rows[0].id});
  } catch (err) {
    console.error(err);
    if (err.code === "23505") {
      return res.status(409).json({
        message: "Scenario id already exists",
      });
    }
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/getscenariosnew", authMiddleware, async (req, res) => {
    const user_id=req.user.userId;
  try {
    const result = await pool.query("SELECT * FROM new_scenarios WHERE user_id = $1 ORDER BY id ASC", [user_id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: "Failed to load scenarios" });
  }
});

router.post("/saveeditedscenarionew", authMiddleware, async (req, res)=>{
  const { id, scenario_id, name, scenario_json, user_id } = req.body;
  try{
     // Validation
    if (!name || !scenario_json || !id || !user_id || !scenario_id) {
      return res.status(400).json({
        message: "page_name, page_json, and page_id are required",
      });
    }

    // Update page
    const result = await pool.query(`
      UPDATE new_scenarios
      SET scenario_id = $1, name = $2, scenario_json = $3
      WHERE id = $4 and user_id = $5
      `,
      [scenario_id, name, scenario_json, id, user_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "Scenario not found",
      });
    }

    res.status(200).json({
      message: "Scenario updated successfully",
      scenario: result.rows[0],
    });
  } catch(err){
    console.error("Save Edited scenario Error:", err);
    if (err.code === "23505") {
      return res.status(409).json({
        message: "Scenario id already exists",
      });
    }
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
