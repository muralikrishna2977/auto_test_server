// runPipeline.js
import path from "path";
import { spawn } from "child_process";
import { pool } from "./db.js";
import { writeRuntimeFiles } from "./runtimeWriter.js";
import fs from "fs";



export const currentRuns = {};
// Initialize run object for a user (if not exists)

function initUserRun(userId) {
  if (!currentRuns[userId]) {
    currentRuns[userId] = {
      status: "idle",
      startedAt: null,
      finishedAt: null,
      runtimeDir: null,
      process: null,
    };
  }
  return currentRuns[userId];
}

export async function executeRunPipeline( testcaseIds, selectedBrowsers, runMode, viewMode, time, userId ) {
  const currentRun = initUserRun(userId);

  try {
    console.log(`Starting run pipeline for user with id ${userId}: `, testcaseIds);

    // MARK RUN START
    currentRun.status = "running";
    currentRun.startedAt = new Date();
    currentRun.finishedAt = null;
    currentRun.runtimeDir = null;
    currentRun.process = null;

    // STEP 1: FETCH TESTCASES
    const testcaseRes = await pool.query(
      "SELECT testcase_json FROM new_testcases WHERE testcase_id = ANY($1) AND user_id = $2",
      [testcaseIds, userId]
    );

    const testcases = testcaseRes.rows.map(r => r.testcase_json);

    if (!testcases.length) {
      throw new Error("No testcases found for given IDs");
    }

    // STEP 2: FETCH SCENARIOS
    const scenarioIds = [
      ...new Set(testcases.flatMap(tc => tc.scenarios.map(s => s)))
    ];

    const scenarioRes = await pool.query(
      "SELECT scenario_json FROM new_scenarios WHERE scenario_id = ANY($1) AND user_id = $2",
      [scenarioIds, userId]
    );

    const scenarios = scenarioRes.rows.map(r => r.scenario_json);

    // STEP 3: FETCH PAGES
    const pageNames = [
      ...new Set(scenarios.flatMap(sc => sc.flow.map(b => b.page)))
    ];

    const pagesRes = await pool.query(
      "SELECT page_json FROM pages WHERE page_name = ANY($1) AND user_id = $2",
      [pageNames, userId]
    );

    const pages = pagesRes.rows.map(r => r.page_json);

    // STEP 3.1: FETCH TEST DATA
    const dataRes = await pool.query(
      `SELECT td.rows, td.row_used, nt.testcase_id
       FROM test_data td
       JOIN new_testcases nt
         ON nt.id = td.testcase_id
       WHERE nt.testcase_id = ANY($1)
         AND nt.user_id = $2`,
      [testcaseIds, userId]
    );

    const testData = dataRes.rows.map(tc => ({
      testcase_id: tc.testcase_id,
      data: tc.rows[tc.row_used - 1],
    }));

    // STEP 3.2: FETCH MAIN DATA
    const mainRes = await pool.query(
      "SELECT * FROM main_data WHERE user_id = $1",
      [userId]
    );

    if (!mainRes.rows.length) {
      throw new Error("Main data not found for user");
    }

    const mainData = {
      url: mainRes.rows[0].site_url,
      email: mainRes.rows[0].site_email_id,
      password: mainRes.rows[0].site_password_hash,
    };

    // STEP 4: WRITE RUNTIME FILES
    const runtimeDir = await writeRuntimeFiles({
      testData,
      testcases,
      scenarios,
      pages,
      runMode,
      viewMode,
      time,
      mainData,
      userId,
    });

    currentRun.runtimeDir = runtimeDir;

    

    // STEP 5: SPAWN PLAYWRIGHT
    const FRAMEWORK_PATH =
      process.env.FRAMEWORK_PATH || path.join(process.cwd(), "../framework");

    const frameworkUserDir = path.join(FRAMEWORK_PATH, "users", `user_${userId}`);

    ["test-results", "playwright-report", "allure-results"].forEach((p) => {
      fs.mkdirSync(path.join(frameworkUserDir, p), { recursive: true });
    });

    const browserArgs = selectedBrowsers.map((b) => `--project=${b}`);
    console.log(`Launching Playwright for user ${userId}:`, browserArgs.join(" "));

    return new Promise((resolve, reject) => {
      const child = spawn("npx", ["playwright", "test", ...browserArgs], {
        cwd: FRAMEWORK_PATH,
        shell: true,
        env: {
          ...process.env,
          RUNTIME_DIR: runtimeDir,

          PLAYWRIGHT_TEST_RESULTS_DIR: path.join(frameworkUserDir, "test-results"),
          PLAYWRIGHT_HTML_REPORT: path.join(frameworkUserDir, "playwright-report"),
          ALLURE_RESULTS_DIR: path.join(frameworkUserDir, "allure-results"),

          USER_ID: String(userId),
        },
      });

      currentRun.process = child;

      const logFile = fs.createWriteStream(
        path.join(frameworkUserDir, "execution.log"),
        { flags: "a" }
      );

      function logBoth(stream, data, type = "log") {
        const text = data.toString();
        stream.write(text);
        if (type === "error") console.error(text.trim());
        else console.log(text.trim());
      }

      child.stdout.on("data", (d) => logBoth(logFile, d, "log"));
      child.stderr.on("data", (d) => logBoth(logFile, d, "error"));

      child.on("close", (code) => {
        logFile.end();
        currentRun.finishedAt = new Date();
        currentRun.status = code === 0 ? "idle" : "failed";
        currentRun.process = null;
        console.log(`Playwright finished for user ${userId} with exit code ${code}`);
        resolve(code);
      });

      child.on("error", (err) => {
        logFile.end();
        currentRun.finishedAt = new Date();
        currentRun.status = "failed";
        currentRun.process = null;
        console.error(`Playwright spawn error for user ${userId}:`, err);
        reject(err);
      });

    });

  } catch (err) {
    console.error(`Pipeline error for user with id ${userId}:`, err);

    currentRun.finishedAt = new Date();
    currentRun.status = "failed";
    currentRun.process = null;

    throw err;
  }


}
