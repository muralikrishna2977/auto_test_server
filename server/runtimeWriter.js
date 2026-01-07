// runtimeWriter.js
import fs from "fs";
import path from "path";

export async function writeRuntimeFiles({ testData, testcases, scenarios, pages, runMode, time, mainData, userId}) {
  if (!Array.isArray(testcases) || !Array.isArray(scenarios) || !Array.isArray(pages)) {
    throw new Error("Invalid input to writeRuntimeFiles");
  }
  
  if (!userId) {
    throw new Error("userId is required");
  }

  // path of previous folder of the user
  const userRuntimeDir = path.join(
    process.cwd(),
    "runtime",
    `user_${userId}`
  );

  // delete the previous folder
  fs.rmSync(userRuntimeDir, {
    recursive: true,
    force: true,
  });

  // Create fresh runtime folder
  fs.mkdirSync(userRuntimeDir, {
    recursive: true,
  });

  // Write JSON files
  fs.writeFileSync(
    path.join(userRuntimeDir, "testcases.json"),
    JSON.stringify(testcases, null, 2)
  );

  fs.writeFileSync(
    path.join(userRuntimeDir, "scenarios.json"),
    JSON.stringify(scenarios, null, 2)
  );

  fs.writeFileSync(
    path.join(userRuntimeDir, "pages.json"),
    JSON.stringify(pages, null, 2)
  );

  fs.writeFileSync(
    path.join(userRuntimeDir, "testdata.json"),
    JSON.stringify(testData, null, 2)
  );

  // Write meta
  const meta = {
    testcaseCount: testcases.length,
    scenarioCount: scenarios.length,
    pageCount: pages.length,
    // testcaseIds: testcases.map(t => t.id),
    // scenarioIds: scenarios.map(s => s.id),
    runMode,
    reportName: time,
    createdAt: new Date().toISOString(),
    url: mainData.url,
    email: mainData.email,
    password: mainData.password,
    userId: userId
  };

  fs.writeFileSync(
    path.join(userRuntimeDir, "run.json"),
    JSON.stringify(meta, null, 2)
  );

  console.log("Runtime files written to:", userRuntimeDir);

  return userRuntimeDir;
}


