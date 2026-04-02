import express from "express";
import { pool } from "../db.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/getnewtestcases", authMiddleware, async (req, res) => {
  const user_id = req.user.userId;
  try {
    const result = await pool.query(
      "SELECT * FROM testcases WHERE user_id=$1 ORDER BY id DESC",
      [user_id],
    );

    res.json(result.rows);

  } catch (err) {
    res.status(500).json({ message: "Failed to load testcases" });
  }
});

router.post("/savenewtestcase", authMiddleware, async (req, res) => {
  const { testcase_id, name, testcase_json } = req.body;
  if (!testcase_id) return res.status(400).json({ message: "Testcase ID is required" });

  const user_id = req.user.userId;

  try {
    await pool.query(
      "INSERT INTO testcases (testcase_id, user_id, name, testcase_json) VALUES ($1, $2, $3, $4)",
      [testcase_id, user_id, name, testcase_json],
    );
    res.json({ message: "Testcase saved" });
  } catch (err) {
    res.status(500).json({ message: "Insert failed" });
  }
});

router.post("/edittestcase", authMiddleware, async (req, res) => {
  const { testcase_id, name, testcase_json } = req.body;
  const user_id = req.user.userId;
  try {
    await pool.query(
      "UPDATE testcases SET name = $1, testcase_json = $2 WHERE testcase_id = $3 and user_id = $4",
      [name, testcase_json, testcase_id, user_id],
    );
    res.json({ message: "Testcase updated successfully" });
  } catch (err) {
    res.status(500).json({ message: "Update failed" });
  }
}); 

router.delete("/deletetestcase/:testcaseId", authMiddleware, async (req, res) => {
    const { testcaseId } = req.params;
    const user_id = req.user.userId;

    try {
      const result = await pool.query(
        `
      DELETE FROM testcases
      WHERE testcase_id = $1 AND user_id = $2
      RETURNING testcase_id
      `,
        [testcaseId, user_id],
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: "Testcase not found or not authorized",
        });
      }

      return res.json({
        success: true,
        message: "Testcase deleted successfully",
        testcaseId,
      });
    } catch (error) {
      console.error("Delete testcase error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to delete testcase",
      });
    }
  },
);

router.post("/makeaspublic", authMiddleware, async (req, res) => {
  const { testcase_id, is_shared } = req.body;
  const user_id = req.user.userId;

  try {
    await pool.query(
      "UPDATE testcases SET is_shared = $1 WHERE testcase_id = $2 and user_id = $3",
      [is_shared, testcase_id, user_id],
    );

    res.json({ success: true, message: "Testcase shared/unshared successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to share testcase" });
  }
});


function collectPageIdsFromFlow(flow, out = new Set()) {
  if (!Array.isArray(flow)) return out;

  for (const step of flow) {
    if (!step || typeof step !== "object") continue;

    const pageId = step.pageId;
    if (typeof pageId === "string" && pageId.trim()) out.add(pageId.trim());

    if (step.type === "if") {
      collectPageIdsFromFlow(step.then, out);
      collectPageIdsFromFlow(step.else, out);
    }
  }

  return out;
}


function extractScenarioIdsFromTestcases(testcaseRows) {
  const out = new Set();

  for (const tc of testcaseRows || []) {

    const scenarios = tc?.testcase_json?.scenarios;

    if (Array.isArray(scenarios)) {
      for (const id of scenarios) {
        out.add(id);
      }
    }
  }

  return [...out];
}

router.get("/getSharedTestcases", authMiddleware, async (req, res) => {
  const user_id = req.user.userId;

  if (!user_id) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const tcRes = await pool.query(
      `
      SELECT *
      FROM testcases
      WHERE is_shared = true AND user_id <> $1
      ORDER BY id ASC
      `,
      [user_id]
    );

    const sharedTestcases = Array.isArray(tcRes.rows) ? tcRes.rows : [];

    if (sharedTestcases.length === 0) {
      return res.json({ testcases: [], scenarios: [], pages: [] });
    }

    const uniqueScenarioIds = extractScenarioIdsFromTestcases(sharedTestcases);

    if (uniqueScenarioIds.length === 0) {
      return res.json({ testcases: sharedTestcases, scenarios: [], pages: [] });
    }

    const scRes = await pool.query(
      `
      SELECT *
      FROM scenarios
      WHERE scenario_id = ANY($1)
      `,
      [uniqueScenarioIds]
    );

    const scenarioRows = Array.isArray(scRes.rows) ? scRes.rows : [];

    if (scenarioRows.length === 0) {
      return res.json({ testcases: sharedTestcases, scenarios: [], pages: [] });
    }

    const allFlows = [];
    for (const sc of scenarioRows) {
      const flow = sc?.scenario_json?.flow;
      if (Array.isArray(flow)) allFlows.push(...flow);
    }

    const pageIdSet = collectPageIdsFromFlow(allFlows);
    const pageIds = [...pageIdSet];

    if (pageIds.length === 0) {
      return res.json({ testcases: sharedTestcases, scenarios: scenarioRows, pages: [] });
    }

    const pageRes = await pool.query(
      `
      SELECT *
      FROM pages
      WHERE page_id = ANY($1)
      `,
      [pageIds]
    );

    const pages = Array.isArray(pageRes.rows) ? pageRes.rows : [];

    return res.json({
      testcases: sharedTestcases,
      scenarios: scenarioRows,
      pages,
    });
  } catch (err) {
    console.error("getSharedTestcases error:", err);
    return res.status(500).json({ message: "Failed to load shared testcases" });
  }
});

export default router;
