import fs from "fs";
import path from "path";

export class ConfigLoader {

  static runJson() {
    const runtime = process.env.RUNTIME_DIR;
    if (!runtime) {
      throw new Error("RUNTIME_DIR is not set — runtime mode required.");
    }

    const file = path.join(runtime, "run.json");
    console.log("Loading RunJson from:", file);

    const runJsonObj = JSON.parse(fs.readFileSync(file, "utf-8"));

    return runJsonObj;
  }

  /** Load Pages ONLY from runtime/pages.json */
  static loadPages() {
    const runtime = process.env.RUNTIME_DIR;
    if (!runtime) {
      throw new Error("RUNTIME_DIR is not set — runtime mode required.");
    }

    const file = path.join(runtime, "pages.json");
    console.log("Loading Pages from:", file);

    const arr = JSON.parse(fs.readFileSync(file, "utf-8"));

    // Convert array → object keyed by page name
    const pagesByName = {};
    for (const page of arr) {
      if (!page.page) {
        console.warn("⚠ Page object missing 'page' field:", page);
        continue;
      }
      pagesByName[page.page] = page;
    }

    return pagesByName;
  }

  /** Load Scenarios ONLY from runtime/scenarios.json */
  static loadScenarios() {
    const runtime = process.env.RUNTIME_DIR;
    if (!runtime) {
      throw new Error("RUNTIME_DIR is not set — runtime mode required.");
    }

    const file = path.join(runtime, "scenarios.json");
    console.log("Loading Scenarios from:", file);

    const arr = JSON.parse(fs.readFileSync(file, "utf-8"));
    console.log("Loaded scenario count:", arr.length);

    return arr;
  }

  /** Load Testcases ONLY from runtime/testcases.json */
  static loadTestCases() {
    const runtime = process.env.RUNTIME_DIR;
    if (!runtime) {
      throw new Error("RUNTIME_DIR is not set — runtime mode required.");
    }

    const file = path.join(runtime, "testcases.json");
    console.log("Loading Testcases from:", file);

    const arr = JSON.parse(fs.readFileSync(file, "utf-8"));
    console.log("Loaded testcase count:", arr.length);

    return arr;
  }

  static loadTestData(){
    const runtime=process.env.RUNTIME_DIR;
    if (!runtime) {
      throw new Error("RUNTIME_DIR is not set — runtime mode required.");
    }

    const file=path.join(runtime, "testdata.json");
    console.log("Loading testdata from: ", file);

    const testdataArr=JSON.parse(fs.readFileSync(file, "utf-8"));
    return testdataArr;
  }
}


