// runPipeline.js
import path from "path";
import { spawn } from "child_process";
import { pool } from "./db.js";
import { writeRuntimeFiles } from "./runtimeWriter.js";
import fs from "fs";
import treeKill from "tree-kill";
import { FRAMEWORK_PATH } from "./constants.js";
import stripAnsi from "strip-ansi";


export const currentRuns = {};

export function initUserRun(userId) {
    currentRuns[userId] = {
      status: "idle",
      runId: null,
      process: null,
    };
  return currentRuns[userId];
}

function uniqStrings(arr) {
  return [...new Set((Array.isArray(arr) ? arr : []).map(String).map((s) => s.trim()).filter(Boolean))];
}

function safeJson(val, fallback = null) {
  if (val == null) return fallback;
  if (typeof val === "object") return val;
  if (typeof val === "string") {
    try {
      return JSON.parse(val);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function safeArray(val) {
  return Array.isArray(val) ? val : [];
}

function collectPageIdsFromFlow(flow, out = new Set()) {
  if (!Array.isArray(flow)) return out;

  for (const step of flow) {
    if (!step || typeof step !== "object") continue;

    if (typeof step.pageId === "string" && step.pageId.trim()) {
      out.add(step.pageId.trim());
    }

    if (step.type === "if") {
      collectPageIdsFromFlow(step.then, out);
      collectPageIdsFromFlow(step.else, out);
    }
  }
  return out;
}

// Avoid ANY($1) with empty arrays
async function queryIfAny(sql, paramsArray, clientPool = pool) {
  // convention: first param is the array used in ANY($1)
  const arr = paramsArray?.[0];
  if (!Array.isArray(arr) || arr.length === 0) return { rows: [] };
  return clientPool.query(sql, paramsArray);
}

function clamp(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, x));
}

export function stopUserRun(userId, signal = "SIGTERM") {
  const run = currentRuns[userId];
  if (!run?.process) {
    return { ok: false, message: "No running process for this user" };
  }

  const pid = run.process.pid;
  run.status = "stopping";

  treeKill(pid, signal, (err) => {
    if (err) {
      run.process = null;
      run.status = "failed";
      console.error(`Failed to stop run for user ${userId}:`, err);
    }
  });

  return { ok: true, message: `Stopping run (pid ${pid})` };
}

export async function executeRunPipeline(
 { runId,
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
  mainData}
) {

  const currentRun = currentRuns[userId];
  if (!currentRun) {
    throw new Error(`No run object found for user ${userId}. initUserRun must be called before executeRunPipeline.`);
  }

  try {
    // ---------- SAFETY: normalize inputs ----------
    const ownIds = uniqStrings(idsToRunOwn);
    const sharedIds = uniqStrings(idsToRunShared);

    const allIds = uniqStrings([...ownIds, ...sharedIds]);
    if (allIds.length === 0) {
      throw new Error("No testcase IDs provided");
    }

    const browsers = uniqStrings(selectedBrowsers);
    if (browsers.length === 0) {
      throw new Error("At least one browser must be selected");
    }

    const safeRunMode = runMode === "parallel" ? "parallel" : "serial";
    const safeViewMode = viewMode === "headed" ? "headed" : "hidden";

    console.log(`Starting run pipeline for user ${userId}:`, orderedIds);
    currentRun.process = null;

    // ---------- STEP 1: FETCH TESTCASES ----------
    // own testcases must match user
    const ownTestcaseRes = await queryIfAny(
      "SELECT testcase_json, testcase_id FROM testcases WHERE testcase_id = ANY($1) AND user_id = $2",
      [ownIds, userId]
    );

    // shared testcases: you probably want is_shared = true (IMPORTANT)
    const sharedTestcaseRes = await queryIfAny(
      "SELECT testcase_json, testcase_id FROM testcases WHERE testcase_id = ANY($1) AND is_shared = true",
      [sharedIds]
    );

    const ownTestcases = ownTestcaseRes.rows
      .map((r) => safeJson(r.testcase_json, null))
      .filter(Boolean);

    const sharedTestcases = sharedTestcaseRes.rows
      .map((r) => safeJson(r.testcase_json, null))
      .filter(Boolean);

    if (ownTestcases.length === 0 && sharedTestcases.length === 0) {
      throw new Error("No testcases found for given IDs (or not accessible)");
    }

    // ---------- STEP 2: FETCH SCENARIOS ----------
    // Be defensive: tc.scenarios may be missing or not array
    const ownScenarioIds = uniqStrings(
      ownTestcases.flatMap((tc) => safeArray(tc?.scenarios))
    );

    const sharedScenarioIds = uniqStrings(
      sharedTestcases.flatMap((tc) => safeArray(tc?.scenarios))
    );

    const ownScenarioRes = await queryIfAny(
      "SELECT scenario_json, scenario_id FROM scenarios WHERE scenario_id = ANY($1) AND user_id = $2",
      [ownScenarioIds, userId]
    );

    // shared scenarios: no user filter
    const sharedScenarioRes = await queryIfAny(
      "SELECT scenario_json, scenario_id FROM scenarios WHERE scenario_id = ANY($1)",
      [sharedScenarioIds]
    );

    const ownScenarios = ownScenarioRes.rows
      .map((r) => safeJson(r.scenario_json, null))
      .filter(Boolean);

    const sharedScenarios = sharedScenarioRes.rows
      .map((r) => safeJson(r.scenario_json, null))
      .filter(Boolean);

    // It’s possible some scenarioIds were deleted; don’t crash.
    if (ownScenarios.length === 0 && sharedScenarios.length === 0) {
      throw new Error("Scenarios not found for selected testcases");
    }

    // ---------- STEP 3: FETCH PAGES (recursive by pageId) ----------
    const ownFlows = ownScenarios.flatMap((sc) => safeArray(sc?.flow));
    const sharedFlows = sharedScenarios.flatMap((sc) => safeArray(sc?.flow));

    const ownPageIds = uniqStrings([...collectPageIdsFromFlow(ownFlows)]);
    const sharedPageIds = uniqStrings([...collectPageIdsFromFlow(sharedFlows)]);

    // Because ANY is $2, do manual empty guard:
    const ownPageRows =
      ownPageIds.length > 0
        ? await pool.query(
            `SELECT page_json, page_id FROM pages WHERE user_id = $1 AND page_id = ANY($2)`,
            [userId, ownPageIds]
          )
        : { rows: [] };

    const sharedPageRows =
      sharedPageIds.length > 0
        ? await pool.query(
            `SELECT page_json, page_id FROM pages WHERE page_id = ANY($1)`,
            [sharedPageIds]
          )
        : { rows: [] };

    const ownPages = ownPageRows.rows
      .map((r) => safeJson(r.page_json, null))
      .filter(Boolean);

    const sharedPages = sharedPageRows.rows
      .map((r) => safeJson(r.page_json, null))
      .filter(Boolean);


    // ---------- STEP 3.1: FETCH TEST DATA ----------
    const ownDataRows =
      ownIds.length > 0
        ? await pool.query(
            `SELECT testcase_id, rows, row_used FROM test_data WHERE testcase_id = ANY($1) AND user_id = $2`,
            [ownIds, userId]
          )
        : { rows: [] };

    let sharedDataRows={rows:[]};
    
    sharedDataRows =
      sharedIds.length > 0
        ? await pool.query(
            `SELECT testcase_id, rows, row_used FROM test_data WHERE testcase_id = ANY($1) AND user_id = $2`,
            [sharedIds, userId]
          )
        : { rows: [] };

    if(sharedDataRows.rows.length == 0){
      sharedDataRows = await pool.query(
        `SELECT testcase_id, rows, row_used FROM test_data WHERE testcase_id = ANY($1)`,
        [sharedIds]
      );
    }

    function mapTestData(rowsFromDb) {
      return (rowsFromDb?.rows || []).map((tc) => {
        const rowsArr = safeArray(safeJson(tc.rows, []));
        const idx = clamp(tc.row_used, 1, Math.max(1, rowsArr.length)) - 1;
        const picked = rowsArr[idx] ?? null; // may be null if no rows exist
        return { testcase_id: String(tc.testcase_id), data: picked };
      });
    }

    const ownTestData = mapTestData(ownDataRows);
    const sharedTestData = mapTestData(sharedDataRows);

    // ---------- STEP 4: WRITE RUNTIME FILES ----------

    const tcMap = new Map(
      [...ownTestcases, ...sharedTestcases].map(tc => [tc.testcase_id, tc])
    );

    const orderedTestcases = orderedIds.map(id => tcMap.get(id)).filter(Boolean);

    const runtimeDir = await writeRuntimeFiles({
      testData: [...ownTestData, ...sharedTestData],
      testcases: orderedTestcases,
      scenarios: [...ownScenarios, ...sharedScenarios],
      pages: [...ownPages, ...sharedPages],
      runMode: safeRunMode,
      viewMode: safeViewMode,
      time,
      mainData,
      userData,
    });

    // ---------- STEP 5: SPAWN PLAYWRIGHT ----------
    // const FRAMEWORK_PATH = path.join(process.cwd(), "../framework");
    const frameworkUserDir = path.join(FRAMEWORK_PATH, "users", `user_${userId}`);

    for (const p of ["test-results", "playwright-report", "allure-results"]) {
      fs.mkdirSync(path.join(frameworkUserDir, p), { recursive: true });
    }

    const browserArgs = browsers.map((b) => `--project=${b}`);
    const args = ["playwright", "test", ...browserArgs];

    if (safeViewMode === "headed") args.push("--headed");

    console.log(`Launching Playwright for user ${userId}:`, args.join(" "));

    return new Promise((resolve, reject) => {
      const child = spawn("npx", args, {
        cwd: FRAMEWORK_PATH,
        shell: true,
        env: {
          ...process.env,
          RUNTIME_DIR: runtimeDir,
          TIMEOUT: String(timeout),

          PLAYWRIGHT_TEST_RESULTS_DIR: `users/user_${userId}/test-results`,
          PLAYWRIGHT_HTML_REPORT: `users/user_${userId}/playwright-report`,
          ALLURE_RESULTS_DIR: `users/user_${userId}/allure-results`,

          USER_ID: String(userId),
        },
      });

      currentRun.process = child;

      const logFilePath = path.join(frameworkUserDir, "execution.log");
      const logFile = fs.createWriteStream(logFilePath);

      child.stdout.on("data", (d) => {
        const text = stripAnsi(d.toString());
        logFile.write(text);
        console.log(text.trim());
      });

      child.stderr.on("data", (d) => {
        const text = stripAnsi(d.toString());
        logFile.write(text);
        console.error(text.trim());
      });

      child.on("close", (code, signal) => {
        currentRun.process = null;

        if (currentRun.status === "stopping" || signal) {
          currentRun.status = "stopped";
        } else {
          currentRun.status = code === 0 ? "completed" : "failed";
        }

        const logText=`Playwright finished for user ${userId} with exit code ${code}`;
        console.log(logText);
        logFile.write(logText);
        logFile.end();

        resolve(code);
      });

      child.on("error", (err) => {
        const text = stripAnsi(`[SPAWN ERROR]\n${err.stack || err.message || err}\n`);
        logFile.write(text);
        logFile.end();
        currentRun.status = "failed";
        currentRun.process = null;
        console.error(`Playwright spawn error for user ${userId}:`, err);
        reject(err);
      });

    });

  } catch (err) {
    console.error(`Pipeline error for user ${userId}:`, err);
    currentRun.status = "failed";
    currentRun.process = null;
    throw err;
  }
}
