import { test, expect } from "@playwright/test";
import { ConfigLoader } from "../utils/configLoader.js";
import { allure } from "allure-playwright";
import { dataRequiredActions } from "../constants.js";

import { MetaEngine } from "../utils/metaEngine.js";
import { dataStore } from "../utils/dataStore.js";

const pagesConfigObj = ConfigLoader.loadPages();
const allScenariosArr = ConfigLoader.loadScenarios();
const allTestCasesArr = ConfigLoader.loadTestCases();
const runJsonObj = ConfigLoader.runJson();
const testdataArr = ConfigLoader.loadTestData();

function collectDataRequiredStepIds(flow, out = []) {
  if (!Array.isArray(flow)) return out;

  for (const step of flow) {
    if (!step) continue;

    if (step.type === "step") {
      if (dataRequiredActions.has(step.action) && step.stepId) out.push(step.stepId);
      continue;
    }

    if (step.type === "assert") {
      if (dataRequiredActions.has(step.assert) && step.stepId) out.push(step.stepId);
      continue;
    }

    if (step.type === "output") {
      if (dataRequiredActions.has(step.action) && step.stepId) out.push(step.stepId);
      continue;
    }

    if (step.type === "if") {
      if (dataRequiredActions.has(step?.condition?.kind) && step.stepId) out.push(step.stepId);
      collectDataRequiredStepIds(step.then, out);
      collectDataRequiredStepIds(step.else, out);
      continue;
    }

    if (step.type === "loop") {
      if (step.kind === "repeat") out.push(step.stepId);
      collectDataRequiredStepIds(step.body, out);
      continue;
    }
  }

  return out;
}

// build map using scenario_id (UUID)
const scenarioMap = {};
for (const scenario of allScenariosArr) {
  if (scenario.scenario_id && scenario.name) {
    scenarioMap[scenario.scenario_id] = scenario;
  }
}


// Window/Tab Manager
function createWindowManager({ getContext, getEngine, getMainPageRef }) {
  const state = {
    pages: [],
    mainPage: null,
    currentPage: null,
  };

  const syncPages = () => {
    const ctx = getContext();
    state.pages = ctx.pages();
    if (!state.mainPage) state.mainPage = getMainPageRef();
    if (!state.currentPage) state.currentPage = getMainPageRef();
  };

  const setCurrentPage = async (p) => {
    if (!p) return;
    state.currentPage = p;
    try {
      await p.bringToFront();
    } catch (e) {
      // ignore bringToFront failures in headless or certain environments
    }

    const engine = getEngine();
    if (engine) {
      // IMPORTANT: keep MetaEngine always using the active page
      engine.page = p;

      // if your MetaEngine supports setPage(), use it too
      if (typeof engine.setPage === "function") engine.setPage(p);
    }
  };

  const waitForAnyNewPage = async (timeout = 15000) => {
    const ctx = getContext();
    const p = await ctx.waitForEvent("page", { timeout });
    await p.waitForLoadState("domcontentloaded").catch(() => {});
    syncPages();
    await setCurrentPage(p);
    return p;
  };

  const switchToPage = async ({ index, title, urlIncludes, timeout = 15000 } = {}) => {
    const start = Date.now();

    while (Date.now() - start < timeout) {
      syncPages();

      let target = null;

      if (Number.isInteger(index)) {
        target = state.pages[index];
      } else if (title) {
        for (const p of state.pages) {
          const t = await p.title().catch(() => "");
          if (t?.includes(title)) {
            target = p;
            break;
          }
        }
      } else if (urlIncludes) {
        for (const p of state.pages) {
          const u = p.url();
          if (u?.includes(urlIncludes)) {
            target = p;
            break;
          }
        }
      }

      if (target) {
        await setCurrentPage(target);
        return target;
      }

      // wait a bit and retry (tab might not be created yet)
      await new Promise((r) => setTimeout(r, 200));
    }

    throw new Error(
      `switchToPage failed. index=${index}, title=${title}, urlIncludes=${urlIncludes}`
    );
  };

  const switchToMain = async () => {
    syncPages();
    if (!state.mainPage) state.mainPage = getMainPageRef();
    await setCurrentPage(state.mainPage);
    return state.mainPage;
  };

  const closeOtherPages = async () => {
    syncPages();
    const main = state.mainPage || getMainPageRef();

    for (const p of state.pages) {
      if (p !== main && !p.isClosed()) {
        await p.close().catch(() => {});
      }
    }

    syncPages();
    await setCurrentPage(main);
  };

  return {
    state,
    syncPages,
    setCurrentPage,
    waitForAnyNewPage,
    switchToPage,
    switchToMain,
    closeOtherPages,
  };
}

test.describe.configure({ mode: runJsonObj.runMode });

test.describe("Metadata Driven Framework", () => {
  let page;
  let context;
  let engine;
  let win; // window manager

  test.beforeAll(async ({ browser }) => {
    // context = await browser.newContext({serviceWorkers: "block"});
    context = await browser.newContext();
    page = await context.newPage();
    dataStore.resetUser(runJsonObj.userId);

    // Create engine first (will be updated by window manager when new tabs appear)
    engine = new MetaEngine(page, pagesConfigObj, context, browser);

    // Setup window manager
    win = createWindowManager({
      getContext: () => context,
      getEngine: () => engine,
      getMainPageRef: () => page,
    });
    win.syncPages();
    await win.setCurrentPage(page);

    // Any new tab/window created anywhere in the run will be captured here
    context.on("page", async (newPage) => {
      try {
        await newPage.waitForLoadState("domcontentloaded");
      } catch (e) {}
      win.syncPages();
      await win.setCurrentPage(newPage);
    });

    if (
      runJsonObj.url.toLowerCase() === "https://tronstag.x0pa.ai/" ||
      runJsonObj.url.toLowerCase() === "https://tronstag.x0pa.ai"
    ) {
      console.log("Navigating to:", runJsonObj.url);
      await page.goto(runJsonObj.url, { waitUntil: 'domcontentloaded' });
      await page.locator("#recruitment-login-btn").waitFor({ state: "visible", timeout: 120000 });
      await page.locator("#recruitment-login-btn").click();
      await page.locator("//input[@placeholder='Email']").fill(runJsonObj.siteEmail);
      console.log("Email entered");
      await page.locator("button[type='submit']").click();
      await page.locator("input[placeholder='Password']").fill(runJsonObj.password);
      console.log("Password entered");
      await page.locator("button[type='submit']").click();
      console.log("waiting for login to complete");
      await page.locator(".bx--header__menu-bar").waitFor({ state: "visible", timeout: 120000 });
      await expect(page.locator(".bx--header__menu-bar")).toBeVisible();
      console.log("Login successful\n");
    }
  });

  test.afterAll(async () => {
    if (context) await context.close();
  });

  for (const tc of allTestCasesArr) {
    test(`${tc.name}`, async () => {
      const injected0 = {};
      const resolvedData = {};

      const allTestcaseData = testdataArr.find(
        (testdata) => testdata.testcase_id === tc.testcase_id
      );

      for (const item of allTestcaseData?.data || []) {
        injected0[item.id] = item.value;
      }

      // snapshot current pages before testcase (for cleanup)
      const mainPageAtStart = page;

      try {
        for (const scId of tc.scenarios) {
          const scenarioObj = scenarioMap[scId];
          if (!scenarioObj) throw new Error(`Scenario not found: ${scId}`);

          // Ensure MetaEngine is always operating on the latest current page
          win.syncPages();
          await win.setCurrentPage(win.state.currentPage || mainPageAtStart);

          const requiredStepIds = collectDataRequiredStepIds(scenarioObj.flow);

          const injected1 = {};
          for (const stepId of requiredStepIds) {
            if (injected0[stepId] !== undefined) injected1[stepId] = injected0[stepId];
          }

          const resolvedScenarioData = await engine.runScenario(
            runJsonObj.userId,
            tc.testcase_id,
            scenarioObj,
            injected1
          );
          resolvedData[scId] = resolvedScenarioData;

          // If scenario opened a new window/tab and we want to go back to main
          // await win.switchToMain();
        }
      } finally {
        allure.attachment(
          `Resolved Data for ${tc.testcase_id}`,
          JSON.stringify(resolvedData, null, 2),
          "application/json"
        );

        allure.attachment(
          `Output from ${tc.testcase_id}`,
          JSON.stringify(
            dataStore.getTestcaseAll(runJsonObj.userId, tc.testcase_id) || {},
            null,
            2
          ),
          "application/json"
        );

        /**
         * OPTIONAL CLEANUP:
         * Close all extra windows/tabs opened during this testcase
         * and switch back to main page.
         */
        // await win.closeOtherPages();

        // // keep runner variables consistent too
        // page = mainPageAtStart;
        // engine.page = page;

        await page.waitForTimeout(200);
      }
    });
  }
});