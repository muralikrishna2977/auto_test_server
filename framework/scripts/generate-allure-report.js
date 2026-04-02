import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { ConfigLoader } from "../utils/configLoader.js";
import {allureCmd} from "../constants.js";

async function generateAllureReport() {
  console.log("\n========== [Allure Report Generation Started] ==========");

  // Load run config
  const runJsonObj = ConfigLoader.runJson();
  // console.log("[INFO] Loaded runJson:", runJsonObj);

  // Resolve userId
  const userId = process.env.USER_ID || runJsonObj.userId;
  console.log("Resolved userId:", userId);

  if (!userId) {
    console.error("[ERROR] userId is undefined. Cannot generate report.");
    return;
  }

  // Resolve report name
  const reportName = runJsonObj.reportName || "latest";
  console.log("Resolved reportName:", reportName);

  // Resolve Allure results directory
  const allureResultsDir = process.env.ALLURE_RESULTS_DIR || "allure-results";

  // console.log("[INFO] Allure results directory:", allureResultsDir);

  if (!fs.existsSync(allureResultsDir)) {
    console.error(
      `[ERROR] Allure results directory does NOT exist: ${allureResultsDir}`
    );
    return;
  }

  // Resolve framework user directory
  const frameworkUserDir = path.join(
    process.cwd(),
    "users",
    `user_${userId}`
  );

  // console.log("[INFO] Framework user directory:", frameworkUserDir);

  // Resolve final output directory
  const outputDir = path.join(
    frameworkUserDir,
    "allure-report",
    reportName
  );

  // console.log("[INFO] Final Allure report output directory:", outputDir);
  // out of above log            [INFO] Final Allure report output directory: /app/framework/users/user_1/allure-report/08-01-2026_09-32-29_PM

  // Ensure output directory exists
  try {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log("Output directory ensured.");
  } catch (err) {
    console.error("[ERROR] Failed to create output directory:", err);
    return;
  }

  // Resolve Allure CLI path
  // const allureCmd = `"${process.env.APPDATA}\\npm\\allure.cmd"`;
  // const allureCmd = `"/xdata/qaautomation/autobots/framework/node_modules/allure-commandline/bin/allure"`;
  // console.log("[INFO] Allure CLI command path:", allureCmd);

  // Build final command
  // const allureGenerateCommand = `${allureCmd} generate "${allureResultsDir}" --clean -o "${outputDir}"`;
  const allureGenerateCommand = `npx allure generate "${allureResultsDir}" --clean -o "${outputDir}"`;

  console.log("Executing Allure command:");
  console.log("       ", allureGenerateCommand);

  // Execute Allure
  try {
    execSync(allureGenerateCommand, {
      stdio: "inherit",
      shell: true,
    });
    console.log("Allure report generated successfully.");
  } catch (err) {
    console.error("[ERROR] Allure report generation failed.");
    console.error(err);
    return;
  }

  console.log(`========== [Allure Report Ready for User ${userId}] ==========\n`);
}

export default generateAllureReport;