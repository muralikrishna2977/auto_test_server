import { test } from "@playwright/test";
import { ConfigLoader } from "../utils/configLoader.js";
import { MetaEngine } from "../utils/metaEngine.js";
import { resolveScenarioData } from "../utils/resolveScenarioData.js";
import { dataStore } from "../utils/dataStore.js";
import { allure } from "allure-playwright";

const pagesConfig = ConfigLoader.loadPages();
const allScenarios = ConfigLoader.loadScenarios();
const allTestCases = ConfigLoader.loadTestCases();
const runJsonObj = ConfigLoader.runJson();
const testdataArr = ConfigLoader.loadTestData();

const scenarioMap = {};
for (const s of allScenarios) {
  scenarioMap[s.scenario_id] = s; 
}

test.describe.configure({ mode: runJsonObj.runMode });

test.describe("Metadata Driven Framework (Runtime Mode)", () => {
  let page;
  let context;
  let engine;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    dataStore.resetUser(runJsonObj.userId);

    if (runJsonObj.url === "https://tronstag.x0pa.ai/") {
      console.log("\nNavigating to:", runJsonObj.url);
      await page.goto(runJsonObj.url);
      await page.locator("#recruitment-login-btn").click();
      await page
        .locator("//input[@placeholder='Email']")
        .fill(runJsonObj.email);
      await page.locator("button[type='submit']").click();
      await page
        .locator("input[placeholder='Password']")
        .fill(runJsonObj.password);
      await page.locator("button[type='submit']").click();
      await page.waitForSelector(".bx--header__menu-bar b");
    }

    engine = new MetaEngine(page, pagesConfig);
  });

  test.afterAll(async () => {
    if (context) await context.close();
  });

  const dataRequiredActions = new Set([
    "clickPerticularJobTitle",
    "checkbox",
    "multiSelectCreate",
    "toggleState",
    "autocomplete",
    "editor",
    "date",
    "upload",
    "select",
    "input",
    "text",
    "arrayContains"
  ]);

  for (const tc of allTestCases) {
    test(`${tc.name}  (Id: ${tc.testcase_id})`, async () => {
      let injected0 = {};
      let resolvedData={};
      const allTestcaseData = testdataArr.find((testdata) => testdata.testcase_id === tc.testcase_id);  
      // console.log("all t data ", allTestcaseData); 
      for (const item of allTestcaseData.data) {
        injected0[item.id] = item.value;
      }
      // console.log("all data ", injected0);
      // try {
        for (const scId of tc.scenarios) {
          const scenarioObj = scenarioMap[scId];
          // console.log("scenario ", scenarioObj);
          if (!scenarioObj) throw new Error(`Scenario not found: ${scId}`);

          let injected1 = {};
          for (const [index, step] of scenarioObj.flow.entries()) {
            if (dataRequiredActions.has(step.action) || dataRequiredActions.has(step.assert)) {
              const stepId=`${scenarioObj.scenario_id}_${index}`;
              injected1[stepId]=injected0[stepId];
            }
          }
          // console.log("scenario data ", injected1);

          const injected2=resolveScenarioData(runJsonObj.userId, tc.testcase_id, injected1 || {});
          resolvedData[scId]={scenarioName: scenarioObj.name, data: injected2}; 
          await engine.runScenario(runJsonObj.userId, tc.testcase_id, scenarioObj, injected2);
                // }
              // } finally {
              //   // attach resolved data + output
              //   allure.attachment(
              //     `Resolved Data for ${tc.testcase_id}`,
              //     JSON.stringify(resolvedData, null, 2),
              //     "application/json"
              //   );

              //   allure.attachment(
              //     `Output from ${tc.testcase_id}`,
              //     JSON.stringify(dataStore.getTestcaseAll(runJsonObj.userId, tc.testcase_id) || {}, null, 2),
              //     "application/json"
              //   );
              //   await page.waitForTimeout(200);
        }
    });
  }
});


