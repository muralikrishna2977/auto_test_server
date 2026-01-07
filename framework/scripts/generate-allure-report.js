import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { ConfigLoader } from "../utils/configLoader.js";

async function generateAllureReport() {
  console.log("\n========== [Allure Report Generation Started] ==========\n");

  // Load run config
  const runJsonObj = ConfigLoader.runJson();
  console.log("[INFO] Loaded runJson:", runJsonObj);

  // Resolve userId
  const userId = process.env.USER_ID || runJsonObj.userId;
  console.log("[INFO] Resolved userId:", userId);

  if (!userId) {
    console.error("[ERROR] userId is undefined. Cannot generate report.");
    return;
  }

  // Resolve report name
  const reportName = runJsonObj.reportName || "latest";
  console.log("[INFO] Resolved reportName:", reportName);

  // Resolve Allure results directory
  const allureResultsDir =
    process.env.ALLURE_RESULTS_DIR || "allure-results";

  console.log("[INFO] Allure results directory:", allureResultsDir);

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

  console.log("[INFO] Framework user directory:", frameworkUserDir);

  // Resolve final output directory
  const outputDir = path.join(
    frameworkUserDir,
    "allure-report",
    reportName
  );

  console.log("[INFO] Final Allure report output directory:", outputDir);

  // Ensure output directory exists
  try {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log("[SUCCESS] Output directory ensured.");
  } catch (err) {
    console.error("[ERROR] Failed to create output directory:", err);
    return;
  }

  // Resolve Allure CLI path
  const allureCmd = `"${process.env.APPDATA}\\npm\\allure.cmd"`;
  console.log("[INFO] Allure CLI command path:", allureCmd);

  // Build final command
  const allureGenerateCommand =
    `${allureCmd} generate "${allureResultsDir}" --clean -o "${outputDir}"`;

  console.log("[INFO] Executing Allure command:");
  console.log("       ", allureGenerateCommand);

  // Execute Allure
  try {
    execSync(allureGenerateCommand, {
      stdio: "inherit",
      shell: true,
    });
    console.log("\n[SUCCESS] Allure report generated successfully.");
  } catch (err) {
    console.error("\n[ERROR] Allure report generation failed.");
    console.error(err);
    return;
  }

  console.log(`\n========== [Allure Report Ready for User ${userId}] ==========\n`);
}

export default generateAllureReport;
