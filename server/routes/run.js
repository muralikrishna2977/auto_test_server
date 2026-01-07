// routes/run.js
import express from "express";
import { exec } from "child_process";
import path from "path";
import fs from "fs";
import { pool } from "../db.js";
import { executeRunPipeline, currentRuns } from "../runPipeline.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// RUN STATUS (POLLING API)
router.get("/runStatus", authMiddleware, (req, res) => {
  const userId=req.user.userId;
  res.json({
    status: currentRuns[userId]?.status,
    startedAt: currentRuns[userId]?.startedAt,
    finishedAt: currentRuns[userId]?.finishedAt,
    runtimeDir: currentRuns[userId]?.runtimeDir
  });
});

// TRIGGER TEST RUN
router.post("/runTestcases", authMiddleware, async (req, res) => {
  const { mode, testcase_ids, group_id, tag, selectedBrowsers, runMode, viewMode, time } = req.body;
  const userId=req.user.userId;

  try {
    if (currentRuns[userId]?.status === "running") {
      return res.status(400).json({ message: "A run is already in progress" });
    }

    let idsToRun = [];

    if (mode === "all") {
      const result = await pool.query("SELECT testcase_id FROM new_testcases WHERE user_id = $1 ORDER BY id ASC", [userId]);
      idsToRun = result.rows.map(r => r.testcase_id);
    }

    if (mode === "byTag") {
      const result = await pool.query(
        `SELECT testcase_id
        FROM new_testcases
        WHERE user_id = $1
          AND $2 IN (
            SELECT jsonb_array_elements_text(testcase_json->'tags')
          )`,
        [userId, tag]
      );

      idsToRun = result.rows.map(r => r.testcase_id);
    }

    if (mode === "byIds") {
      idsToRun = testcase_ids || [];
    }

    if (mode === "byGroup") {

      const result = await pool.query(
        `SELECT nt.testcase_id
        FROM testcase_group_items tgi
        INNER JOIN new_testcases nt
          ON tgi.testcase_id = nt.id
        WHERE tgi.group_id = $1`,
        [group_id]
      );

      idsToRun = result.rows.map(r => r.testcase_id);
    }

    if (!idsToRun.length) {
      return res.status(400).json({ message: "No testcases found to run" });
    }

    const insert = await pool.query(
      `INSERT INTO testruns
      (user_id, testCaseRunMode, ranTestCaseIds, group_id, tag, selectedBrowsers, runMode, reportName)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING id
      `,
      [
        userId,
        mode,
        JSON.stringify(idsToRun),
        group_id || null,
        tag || null,
        (selectedBrowsers || []).join(","),
        runMode,
        time
      ]
    );
    const testrunId = insert.rows[0].id;

    // Fire & forget
    executeRunPipeline(idsToRun, selectedBrowsers, runMode, viewMode, time, userId)
      .catch(err => console.error(`Pipeline error for user with id ${userId}: `, err));

    res.json({
      message: `Triggered execution for ${idsToRun.length} testcases`,
      testcase_ids: idsToRun,
      testrunId
    });

  } catch (err) {
    console.error("Run error:", err);
    res.status(500).json({ message: "Run failed", error: err.message });
  }
});

// OPEN PREVIOUS ALLURE REPORT
const FRAMEWORK_PATH = path.join(process.cwd(), "../framework");

function getReportByName(reportName, userId) {
  const userDirName = `user_${userId}`;

  // users/user_<id>/allure-report
  const allureReportDir = path.join(
    FRAMEWORK_PATH,
    "users",
    userDirName,
    "allure-report"
  );

  if (!fs.existsSync(allureReportDir)) return null;

  const reportPath = path.join(allureReportDir, reportName);

  // Ensure it exists and is a directory
  if (
    fs.existsSync(reportPath) &&
    fs.statSync(reportPath).isDirectory()
  ) {
    return reportPath;
  }

  return null;
}


router.get("/previousReport/:reportName", authMiddleware, (req, res) => {
  const userId=req.user.userId;
  const reportPath = getReportByName(req.params.reportName, userId);
  console.log("report path ", reportPath);

  if (!reportPath) {
    return res.status(404).json({ error: "Report not found" });
  }

  exec(`allure open "${reportPath}"`, { cwd: FRAMEWORK_PATH, shell: true }, err => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ status: "opened", folder: reportPath });
  });
});

// LIST TEST RUN HISTORY
router.get("/testruns", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await pool.query(
      `
      SELECT
        tr.id,
        tr.testCaseRunMode,
        tr.ranTestCaseIds,
        tr.tag,
        tr.selectedBrowsers,
        tr.runMode,
        tr.reportName,
        tg.group_name
      FROM testruns tr
      LEFT JOIN testcase_groups tg
        ON tr.group_id = tg.id
      WHERE tr.user_id = $1
      ORDER BY tr.id DESC
      `,
      [userId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching test runs:", err);
    res.status(500).json({ error: "Failed to fetch test runs" });
  }
});


export default router;


