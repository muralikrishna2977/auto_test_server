// runtimeWriter.js
import fs from "fs";
import path from "path";

export async function writeRuntimeFiles({ testData, testcases, scenarios, pages, runMode, time, mainData, userData}) {
  if (!Array.isArray(testcases) || !Array.isArray(scenarios) || !Array.isArray(pages)) {
    throw new Error("Invalid input to writeRuntimeFiles");
  }
  
  if (!userData?.userId) {
    throw new Error("userId is required");
  }

  // path of previous folder of the user
  const userRuntimeDir = path.join(
    process.cwd(),
    "runtime",
    `user_${userData?.userId}`
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
    runMode,
    reportName: time,
    url: mainData.url,
    siteEmail: mainData.email,
    password: mainData.password,
    userId: userData?.userId,
    name: userData?.name,
    email: userData?.email,
  };

  fs.writeFileSync(
    path.join(userRuntimeDir, "run.json"),
    JSON.stringify(meta, null, 2)
  );

  console.log("Runtime files written to:", userRuntimeDir);

  return userRuntimeDir;
}


