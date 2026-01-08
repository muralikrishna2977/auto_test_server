import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { ConfigLoader } from "../utils/configLoader.js";

async function generateAllureReport() {
  console.log("\n========== [Allure Report Generation Started] ==========\n");

  const runJsonObj = ConfigLoader.runJson();
  console.log("[INFO] Loaded runJson:", runJsonObj);

  const userId = process.env.USER_ID || runJsonObj.userId;
  console.log("[INFO] Resolved userId:", userId);

  if (!userId) {
    console.error("[ERROR] userId is undefined. Cannot generate report.");
    return;
  }

  const reportName = runJsonObj.reportName || "latest";
  console.log("[INFO] Resolved reportName:", reportName);

  const allureResultsDir = process.env.ALLURE_RESULTS_DIR || "allure-results";
  console.log("[INFO] Allure results directory:", allureResultsDir);

  if (!fs.existsSync(allureResultsDir)) {
    console.error(`[ERROR] Allure results directory does NOT exist: ${allureResultsDir}`);
    return;
  }

  const frameworkUserDir = path.join(process.cwd(), "users", `user_${userId}`);
  console.log("[INFO] Framework user directory:", frameworkUserDir);

  const outputDir = path.join(frameworkUserDir, "allure-report", reportName);
  console.log("[INFO] Final Allure report output directory:", outputDir);

  try {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log("[SUCCESS] Output directory ensured.");
  } catch (err) {
    console.error("[ERROR] Failed to create output directory:", err);
    return;
  }

  // Cross-platform Allure command (works on Railway Linux too)
  const allureGenerateCommand =
    `npx allure generate "${allureResultsDir}" --clean -o "${outputDir}"`;

  console.log("[INFO] Executing Allure command:");
  console.log("       ", allureGenerateCommand);

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



