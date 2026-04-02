// routes/run.js
import express from "express";
import path from "path";
import fs from "fs";
import { pool } from "../db.js";
import { executeRunPipeline, currentRuns, initUserRun } from "../runPipeline.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { stopUserRun } from "../runPipeline.js";
import { FRAMEWORK_PATH } from "../constants.js";

const router = express.Router();

// const getRunStatus = async (req, res) => {
//   const userId = req.user.userId;
//   const requestedRunId = req.params.runId;
//   const run = currentRuns[userId];

//   if (!run) {
//     return res.json({
//       status: "idle",
//       runId: null,
//     });
//   }

//   // same run being polled
//   if (requestedRunId && String(run.runId) !== String(requestedRunId)) {
//     return res.json({
//       status: "idle",
//       runId: requestedRunId,
//     });
//   }
  
//   const status = run.status ?? "idle";
  
//   // reload case: no runId passed
//   if (!requestedRunId) {
//     return res.json({
//       status,
//       runId: run.runId ?? null,
//     });
//   }

//   // older/different runId
//   return res.json({
//     status,
//     runId: requestedRunId,
//   });
// };


const getRunStatus = async (req, res) => {
  const userId = req.user.userId;
  const requestedRunId = req.params.runId; // may be undefined
  const run = currentRuns[userId];
 
  // No run object initialised yet
  if (!run) {
    return res.json({ status: "idle", runId: requestedRunId ?? null });
  }
 
  // Reload case: no runId supplied — just reflect current memory state
  if (!requestedRunId) {
    return res.json({
      status: run.status ?? "idle",
      runId: run.runId ?? null,
    });
  }
 
  // runId is known but the stored runId hasn't been set yet (tiny race window)
  // Treat as "still starting" rather than idle
  if (run.runId === null) {
    return res.json({ status: run.status ?? "running", runId: requestedRunId });
  }
 
  // IDs match → this is an active poll for the current run
  if (String(run.runId) === String(requestedRunId)) {
    return res.json({
      status: run.status ?? "idle",
      runId: requestedRunId,
    });
  }
 
  // IDs differ → the client is polling a run that is no longer the current one
  return res.json({ status: "idle", runId: requestedRunId });
};

router.get("/runStatus", authMiddleware, getRunStatus);
router.get("/runStatus/:runId", authMiddleware, getRunStatus);


router.post("/runTestcases", authMiddleware, async (req, res) => {
  const { mode, testcase_ids, group_id, tag, selectedBrowsers, runMode, viewMode, time, timeout } = req.body;
  const userId=req.user.userId;

  try {
    const userDataRes = await pool.query(
      "SELECT name, email FROM users WHERE id = $1",
      [userId]
    );
    if (!userDataRes.rows.length) {
      return res.status(400).json({ message: "User not found" });
    }
    
    const userData = {
      name: userDataRes.rows[0].name,
      email: userDataRes.rows[0].email,
      userId,
    };

    const mainRes = await pool.query(
      "SELECT site_url, site_email_id, site_password_hash FROM users_data WHERE user_id = $1",
      [userId]
    );

    if (!mainRes.rows.length) {
      return res.status(400).json({ message: "Site Credentials not found" });
    }

    if (
      !mainRes.rows[0].site_url?.trim() ||
      !mainRes.rows[0].site_email_id?.trim() ||
      !mainRes.rows[0].site_password_hash?.trim()
    ){
      return res.status(400).json({ message: "Site Credentials not found" });
    }

    const mainData = {
      url: mainRes.rows[0].site_url,
      email: mainRes.rows[0].site_email_id,
      password: mainRes.rows[0].site_password_hash,
    };



 





    
    if (currentRuns[userId]?.status === "running") {
      return res.status(400).json({ message: "A run is already in progress" });
    }

    let idsToRunOwn = [];
    let idsToRunShared = [];
    let orderedIds = Array.isArray(testcase_ids) ? testcase_ids.map(tc => tc.testcase_id) : [];


    if (mode === "byIds") {
      const own=testcase_ids.filter((tc)=>!tc.isPublic);
      const shared=testcase_ids.filter((tc)=>tc.isPublic);
      idsToRunOwn =own.map((tc)=>tc.testcase_id);
      idsToRunShared = shared.map((tc)=>tc.testcase_id);
    }

    if (mode === "byGroup") {

      const result = await pool.query(
        `SELECT testcase_id, is_public FROM testcase_group_items WHERE group_id = $1 ORDER BY id ASC`,
        [group_id]
      );

      orderedIds = result.rows.map((tc)=>tc.testcase_id);
      const own=result.rows.filter((tc)=>!tc.is_public);
      const shared=result.rows.filter((tc)=>tc.is_public);

      idsToRunOwn =own.map((tc)=>tc.testcase_id);
      idsToRunShared = shared.map((tc)=>tc.testcase_id);
    }

    if (!idsToRunOwn.length && !idsToRunShared.length) {
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
        JSON.stringify([...orderedIds]),
        group_id || null,
        tag || null,
        (selectedBrowsers || []).join(","),
        runMode,
        time
      ]
    );
    const runId = insert.rows[0].id;

    const currentRun = initUserRun(userId);
    currentRun.status = "running";
    currentRun.runId = runId;

    executeRunPipeline({
      runId,
      orderedIds,
      idsToRunOwn,
      idsToRunShared,
      selectedBrowsers,
      runMode,
      viewMode,
      time,
      timeout,
      userId,
      userData,
      mainData
    })
      .catch(err => console.error(`Pipeline error for user with id ${userId}: `, err));

    res.json({
      message: `Triggered execution for testcases`,
      runId,
    });

  } catch (err) {
    console.error("Run error:", err);
    res.status(500).json({ message: "Run failed", error: err.message });
  }
});

// OPEN PREVIOUS ALLURE REPORT
// const FRAMEWORK_PATH = path.join(process.cwd(), "../framework");
// const FRAMEWORK_PATH= "/xdata/qaautomation/autobots/framework";

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

// router.get("/previousReport/:reportName", authMiddleware, (req, res) => {
//   const userId=req.user.userId;
//   const reportPath = getReportByName(req.params.reportName, userId);
//   console.log("report path ", reportPath);

//   if (!reportPath) {
//     return res.status(404).json({ error: "Report not found" });
//   }

//   exec(`allure open "${reportPath}"`, { cwd: FRAMEWORK_PATH, shell: true }, err => {
//     if (err) {
//       return res.status(500).json({ error: err.message });
//     }
//     res.json({ status: "opened", folder: reportPath });
//   });
// });

router.get("/previousReport/:reportName", authMiddleware, (req, res) => {
  const userId = req.user.userId;
  const reportName = req.params.reportName;

  const reportPath = getReportByName(reportName, userId);
  if (!reportPath) return res.status(404).json({ error: "Report not found" });

  const baseUrl = `${req.protocol}://${req.get("host")}`; // backend host
  const reportUrl = `${baseUrl}/reports/user_${userId}/allure-report/${reportName}/index.html`;

  return res.json({ success: true, reportUrl });
});


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
        tg.group_name,
        COALESCE(tcn.ranTestCaseNames, ARRAY[]::text[]) AS ranTestCaseNames
      FROM testruns tr
      LEFT JOIN testcase_groups tg
        ON tr.group_id = tg.id

      LEFT JOIN LATERAL (
        SELECT ARRAY_AGG(tc.name ORDER BY x.ord) AS ranTestCaseNames
        FROM JSONB_ARRAY_ELEMENTS_TEXT(tr.ranTestCaseIds) WITH ORDINALITY AS x(testcase_id, ord)
        LEFT JOIN testcases tc
          ON tc.testcase_id = x.testcase_id
         AND (tc.user_id = tr.user_id OR tc.is_shared = true)
      ) tcn ON true

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


router.post("/stopchildprecess", authMiddleware, (req, res) => {
  const userId = req.user.userId;
  const result = stopUserRun(userId, "SIGTERM");
  if (!result.ok) return res.status(409).json(result); // 409 = nothing running

  return res.json(result);
});

export default router;


