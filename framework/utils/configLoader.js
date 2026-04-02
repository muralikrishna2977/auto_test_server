import fs from "fs";
import path from "path";

export class ConfigLoader {

  static runJson() {
    const runtime = process.env.RUNTIME_DIR;
    if (!runtime) {
      throw new Error("RUNTIME_DIR is not set — runtime mode required.");
    }

    const file = path.join(runtime, "run.json");
    // console.log("Loading RunJson from:", file);

    return JSON.parse(fs.readFileSync(file, "utf-8"));
  }

  static loadPages() {
    const runtime = process.env.RUNTIME_DIR;
    if (!runtime) {
      throw new Error("RUNTIME_DIR is not set — runtime mode required.");
    }

    const file = path.join(runtime, "pages.json");
    // console.log("Loading Pages from:", file);
    const raw = JSON.parse(fs.readFileSync(file, "utf-8"));

    if (!Array.isArray(raw)) {
      throw new Error("pages.json must be an array");
    }


    const pagesByID = {};
    for(const page of raw){
      if(page.id && page.pageName){ 
        pagesByID[page.id] = page;  
      }
    }

    return pagesByID;
  }

  static loadScenarios() {
    const runtime = process.env.RUNTIME_DIR;
    if (!runtime) {
      throw new Error("RUNTIME_DIR is not set — runtime mode required.");
    }

    const file = path.join(runtime, "scenarios.json");
    // console.log("Loading Scenarios from:", file);

    const arr = JSON.parse(fs.readFileSync(file, "utf-8"));
    if (!Array.isArray(arr)) {
      throw new Error("scenarios.json must be an array");
    }

    return arr;
  }

  static loadTestCases() {
    const runtime = process.env.RUNTIME_DIR;
    if (!runtime) {
      throw new Error("RUNTIME_DIR is not set — runtime mode required.");
    }

    const file = path.join(runtime, "testcases.json");
    // console.log("Loading Testcases from:", file);

    const arr = JSON.parse(fs.readFileSync(file, "utf-8"));
    if (!Array.isArray(arr)) {
      throw new Error("testcases.json must be an array");
    }

    return arr;
  }

  static loadTestData() {
    const runtime = process.env.RUNTIME_DIR;
    if (!runtime) {
      throw new Error("RUNTIME_DIR is not set — runtime mode required.");
    }

    const file = path.join(runtime, "testdata.json");
    // console.log("Loading testdata from:", file);

    const arr = JSON.parse(fs.readFileSync(file, "utf-8"));
    if (!Array.isArray(arr)) {
      throw new Error("testdata.json must be an array");
    }

    return arr;
  }
}


