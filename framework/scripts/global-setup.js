import fs from "fs";

export default async function globalSetup() {
  const allureResultsDir = process.env.ALLURE_RESULTS_DIR || "allure-results";

  try {
    fs.rmSync(allureResultsDir, {
      recursive: true,
      force: true,
    });

    fs.mkdirSync(allureResultsDir, { recursive: true });

    console.log(`\nCleaned Allure results at: ${allureResultsDir}\n`);
  } catch (err) {
    console.error("Failed to clean Allure results:", err);
  }
}
