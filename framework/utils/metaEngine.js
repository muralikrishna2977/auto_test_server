import { expect } from "@playwright/test";
import path from "node:path";
import { dataStore } from "../utils/dataStore.js";
import { dataRequiredActions } from "../constants.js";
import { resolveScenarioData } from "./resolveScenarioData.js";
import { allure } from "allure-playwright";

export class MetaEngine {
  // constructor(page, pagesConfig, context = null, browser = null) {
  //   this.page = page;
  //   this.context = context;
  //   this.browser = browser;

  //   this.pagesConfig = pagesConfig;
  //   this._index = this.buildRuntimeIndex(pagesConfig);
  // }

  // constructor(page, pagesConfig, context = null, browser = null) {
  //   this.page = page;
  //   this.context = context;
  //   this.browser = browser;

  //   this.pagesConfig = pagesConfig;
  //   this._index = this.buildRuntimeIndex(pagesConfig);

  //   // for isolated windows/contexts
  //   this.contexts = context ? [context] : [];
  // }

  constructor(page, pagesConfig, context = null, browser = null) {
    this.page = page;
    this.context = context;
    this.browser = browser;

    this.pagesConfig = pagesConfig;
    this._index = this.buildRuntimeIndex(pagesConfig);

    // track all contexts
    this.contexts = context ? [context] : [];
  }

  getAllContexts() {
    return this.contexts || [];
  }

  getCurrentContextIndex() {
    if (!this.contexts || !this.context) {
      throw new Error("MetaEngine: contexts/context is missing");
    }

    return this.contexts.findIndex((ctx) => ctx === this.context);
  }

  getAllPages() {
    if (!this.context) {
      throw new Error("MetaEngine: context is missing");
    }
    return this.context.pages();
  }

  getCurrentPageIndex() {
    if (!this.context || !this.page) {
      throw new Error("MetaEngine: context/page is missing");
    }

    return this.context.pages().findIndex((p) => p === this.page);
  }

  async switchToPage(index, waitUntil = "domcontentloaded") {
    if (!this.context) {
      throw new Error("MetaEngine: context is missing");
    }

    const pages = this.context.pages();

    if (!Number.isInteger(index) || index < 0 || index >= pages.length) {
      throw new Error(
        `Invalid page index ${index}. Available page indexes: 0 to ${pages.length - 1}`,
      );
    }

    const targetPage = pages[index];
    this.page = targetPage;

    await targetPage.bringToFront().catch(() => {});
    await targetPage.waitForLoadState(waitUntil).catch(() => {});

    return targetPage;
  }

  async switchToContextPage(
    contextIndex,
    pageIndex = 0,
    waitUntil = "domcontentloaded",
  ) {
    if (!this.contexts || this.contexts.length === 0) {
      throw new Error("MetaEngine: no contexts available");
    }

    if (
      !Number.isInteger(contextIndex) ||
      contextIndex < 0 ||
      contextIndex >= this.contexts.length
    ) {
      throw new Error(
        `Invalid context index ${contextIndex}. Available context indexes: 0 to ${this.contexts.length - 1}`,
      );
    }

    const targetContext = this.contexts[contextIndex];
    const pages = targetContext.pages();

    if (
      !Number.isInteger(pageIndex) ||
      pageIndex < 0 ||
      pageIndex >= pages.length
    ) {
      throw new Error(
        `Invalid page index ${pageIndex}. Available page indexes: 0 to ${pages.length - 1}`,
      );
    }

    const targetPage = pages[pageIndex];

    this.context = targetContext;
    this.page = targetPage;

    await targetPage.bringToFront().catch(() => {});
    await targetPage.waitForLoadState(waitUntil).catch(() => {});

    return targetPage;
  }

  // click opens new tab/window in SAME context
  async openNewPageByClick(locator, waitUntil = "domcontentloaded") {
    if (!this.context) {
      throw new Error("MetaEngine: context is missing");
    }

    const [newPage] = await Promise.all([
      this.context.waitForEvent("page"),
      locator.first().click(),
    ]);

    await newPage.waitForLoadState(waitUntil).catch(() => {});
    await newPage.bringToFront().catch(() => {});

    this.page = newPage;

    return newPage;
  }

  // open url in SAME context (shared cookies/session)
  async openNewPageByUrl(url, waitUntil = "domcontentloaded") {
    if (!this.context) {
      throw new Error("MetaEngine: context is missing");
    }

    const finalUrl = String(url || "").trim();
    if (!finalUrl) {
      throw new Error("openNewPageByUrl requires a valid URL");
    }

    const newPage = await this.context.newPage();
    await newPage.goto(finalUrl, { waitUntil });
    await newPage.bringToFront().catch(() => {});

    this.page = newPage;

    return newPage;
  }

  // open url in NEW ISOLATED context (cookies not shared)
  async openNewIsolatedWindowByUrl(url, waitUntil = "domcontentloaded") {
    if (!this.browser) {
      throw new Error(
        "MetaEngine: browser is missing. Pass browser in constructor.",
      );
    }

    const finalUrl = String(url || "").trim();
    if (!finalUrl) {
      throw new Error("openNewIsolatedWindowByUrl requires a valid URL");
    }

    const newContext = await this.browser.newContext();
    const newPage = await newContext.newPage();

    this.contexts.push(newContext);

    await newPage.goto(finalUrl, { waitUntil });
    await newPage.bringToFront().catch(() => {});

    this.context = newContext;
    this.page = newPage;

    return newPage;
  }

  async closeCurrentPage(waitUntil = "domcontentloaded") {
    if (!this.context || !this.page) {
      throw new Error("MetaEngine: context/page is missing");
    }

    const pagesBefore = this.context.pages();

    if (pagesBefore.length <= 1) {
      throw new Error(
        "Cannot close current page because it is the only open page",
      );
    }

    const currentPage = this.page;
    const currentIndex = pagesBefore.findIndex((p) => p === currentPage);

    await currentPage.close();

    const pagesAfter = this.context.pages();
    const nextIndex = Math.min(currentIndex, pagesAfter.length - 1);

    this.page = pagesAfter[nextIndex];

    await this.page.bringToFront().catch(() => {});
    await this.page.waitForLoadState(waitUntil).catch(() => {});

    return this.page;
  }

  async closePageByIndex(index, waitUntil = "domcontentloaded") {
    if (!this.context) {
      throw new Error("MetaEngine: context is missing");
    }

    const pages = this.context.pages();

    if (!Number.isInteger(index) || index < 0 || index >= pages.length) {
      throw new Error(
        `Invalid page index ${index}. Available page indexes: 0 to ${pages.length - 1}`,
      );
    }

    if (pages.length <= 1) {
      throw new Error("Cannot close page because it is the only open page");
    }

    const targetPage = pages[index];
    const isCurrentPage = targetPage === this.page;

    await targetPage.close();

    const remainingPages = this.context.pages();

    if (isCurrentPage) {
      const nextIndex = Math.min(index, remainingPages.length - 1);
      this.page = remainingPages[nextIndex];
      await this.page.bringToFront().catch(() => {});
      await this.page.waitForLoadState(waitUntil).catch(() => {});
    }

    return this.page;
  }

  buildRuntimeIndex(pagesConfig) {
    const byPageId = new Map();
    const byPageName = new Map();

    // new format: array
    if (Array.isArray(pagesConfig)) {
      for (const p of pagesConfig) {
        if (p?.id) byPageId.set(p.id, p);
        if (p?.pageName) byPageName.set(p.pageName, p);
      }
      return { byPageId, byPageName, mode: "array" };
    }

    // old format: object map
    const obj = pagesConfig || {};
    for (const [pageName, p] of Object.entries(obj)) {
      if (p?.id) byPageId.set(p.id, p);
      byPageName.set(pageName, p);
      if (p?.page) byPageName.set(p.page, p);
    }
    return { byPageId, byPageName, mode: "object" };
  }

  getPageConfigByStep(step) {
    if (step?.pageId) {
      const p = this._index.byPageId.get(step.pageId);
      if (!p) throw new Error(`Page not found for pageId: ${step.pageId}`);
      return p;
    }

    throw new Error(`Step has no pageId/page: ${JSON.stringify(step)}`);
  }

  getElementByStep(pageConfig, step) {
    if (step?.action === "timeDelay") return { name: "Time Delay" };
    // if(step?.action==="openUrlIncognito") return {name: "URL to open in Incognito"};
    // if(step?.action==="switchBackContext") return {name: "Switch back from Incognito"};
    if (step?.action === "openUrlNewTab")
      return { name: "Open URL in new tab" };
    if (step?.action === "switchPage") return { name: "Switch page" };
    if (step?.action === "switchContextPage")
      return { name: "Switch context page" };
    if (step?.action === "closeCurrentPage")
      return { name: "Close current page" };
    if (step?.action === "closePage") return { name: "Close page" };
    if (step?.action === "openUrlNewWindow")
      return { name: "Open URL in new window" };
    if (step?.action === "reload") return { name: "Reload page" };
    if (step?.action === "screenshot") return { name: "Take screenshot" };
    if (step?.action === "networkidle")
      return { name: "Wait for network idle" };

    const isIf = step?.type === "if";
    const isLoop = step?.type === "loop";
    const elementId = isIf
      ? step?.condition?.elementId
      : isLoop
        ? step?.target?.elementId
        : step?.elementId;
    // const elementName = isIf
    //   ? step?.condition?.element
    //   : isLoop
    //     ? step?.target?.element
    //     : step?.element;

    if (elementId) {
      const el = (pageConfig.elements || []).find((e) => e.id === elementId);
      if (!el) {
        throw new Error(
          `Element not found by elementId: ${elementId} in page '${
            pageConfig.pageName || pageConfig.page || "?"
          }'`,
        );
      }
      return el;
    }

    throw new Error(`Step has no elementId/element (type=${step?.type})`);
  }

  async waitForElement(locator) {
    await locator
      .first()
      .waitFor({ state: "visible", timeout: 30000 })
      .catch(() => {
        throw new Error(`Element not visible in time: ${locator}`);
      });
  }

  escapeRegex(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  async evaluateCondition(
    pageConfig,
    ifStep,
    scenarioData,
    userId,
    testCaseId,
    resolvedData,
  ) {
    const condition = ifStep?.condition || {};
    const kind = condition.kind;
    const timeoutMs = Number(condition.timeoutMs ?? 5) * 1000;
    const stepId = ifStep?.stepId;
    const value = scenarioData && scenarioData[stepId];
    const resolvedValue = resolveScenarioData(userId, testCaseId, value);

    if (
      (resolvedValue === undefined ||
        resolvedValue === null ||
        resolvedValue === "") &&
      (kind === "textContains" || kind === "textEquals")
    ) {
      console.log(`returning false ${kind} (no data) stepId=${stepId}`);
      return false;
    }

    if (kind === "textContains" || kind === "textEquals") {
      resolvedData[stepId] = resolvedValue;
    }

    const element = this.getElementByStep(pageConfig, ifStep);
    const locator = this.page.locator(element.locator);

    const start = Date.now();
    const poll = 150;

    const checkOnce = async () => {
      switch (kind) {
        case "visible":
          return await locator
            .first()
            .isVisible()
            .catch(() => false);

        case "exists": {
          const c = await locator.count().catch(() => 0);
          return c > 0;
        }

        case "enabled":
          return await locator
            .first()
            .isEnabled()
            .catch(() => false);

        case "disabled":
          return await locator
            .first()
            .isDisabled()
            .catch(() => false);

        case "textContains": {
          const txt = await locator
            .first()
            .innerText()
            .catch(() => "");
          return txt.includes(resolvedValue);
        }

        case "textEquals": {
          const txt = await locator
            .first()
            .innerText()
            .catch(() => "");
          return txt.trim() === String(resolvedValue).trim();
        }

        default:
          throw new Error(`Unknown IF condition kind: ${kind}`);
      }
    };

    while (Date.now() - start < timeoutMs) {
      const ok = await checkOnce();
      if (ok) return true;
      await this.page.waitForTimeout(poll);
    }

    return await checkOnce();
  }

  // --- LOOP helpers ---
  loopKindNeedsElement(kind) {
    return kind === "whileExists" || kind === "whileNotExists";
  }

  async runLoop(
    userId,
    testCaseId,
    scenario,
    loopStep,
    scenarioData,
    resolvedData,
  ) {
    const kind = loopStep?.kind;
    const maxIterations = Number(loopStep?.maxIterations ?? 200);
    const delayMs = Number(loopStep?.delayMs ?? 5) * 1000;

    const body = loopStep?.body || [];

    if (!kind) throw new Error("Loop step missing kind");
    if (!Array.isArray(body)) throw new Error("Loop body must be an array");
    if (!Number.isFinite(maxIterations) || maxIterations <= 0) {
      throw new Error(`Invalid loop maxIterations: ${loopStep?.maxIterations}`);
    }

    // Some loops need a target locator
    let targetLocator = null;
    if (this.loopKindNeedsElement(kind)) {
      const pageConfig = this.getPageConfigByStep(loopStep);
      const el = this.getElementByStep(pageConfig, loopStep);
      targetLocator = this.page.locator(el.locator);
      // targetLocator = this.applyLoopTextFilter(targetLocator, loopStep);
    }

    // 1) repeat
    if (kind === "repeat") {
      // Prefer testcase scenarioData override (by stepId) for repeat count
      const injected = scenarioData?.[loopStep.stepId];
      const rawCount = injected !== undefined ? injected : loopStep?.count;
      const resolvedCount = resolveScenarioData(userId, testCaseId, rawCount);
      resolvedData[loopStep.stepId] = resolvedCount;

      const count = Number(resolvedCount ?? 1);

      if (!Number.isFinite(count) || count < 0) {
        throw new Error(
          `repeat loop requires count > 0, got: ${resolvedCount}`,
        );
      }

      const n = Math.min(count, maxIterations);
      console.log("resolvedCount", n);

      for (let i = 0; i < n; i++) {
        await this.runFlow(
          userId,
          testCaseId,
          scenario,
          body,
          scenarioData,
          resolvedData,
        );
        if (delayMs) await this.page.waitForTimeout(delayMs);
      }

      return;
    }

    // 2) whileExists (delete-all)
    if (kind === "whileExists") {
      if (!targetLocator)
        throw new Error("whileExists requires target.elementId");

      for (let iter = 1; iter <= maxIterations; iter++) {
        const before = await targetLocator.count().catch(() => 0);
        if (before === 0) return;

        await this.runFlow(
          userId,
          testCaseId,
          scenario,
          body,
          scenarioData,
          resolvedData,
        );

        if (delayMs) {
          console.log("wait for ", delayMs);
          await this.page.waitForTimeout(delayMs);
        }

        const after = await targetLocator.count().catch(() => 0);
        // Safety: prevent infinite loop if nothing changes
        if (after >= before) {
          throw new Error(
            `whileExists made no progress (before=${before}, after=${after}). ` +
              `Possible infinite loop. Check that loop body actually removes target elements.`,
          );
        }
      }

      throw new Error(`whileExists exceeded maxIterations=${maxIterations}`);
    }

    // 3) whileNotExists
    if (kind === "whileNotExists") {
      if (!targetLocator)
        throw new Error("whileNotExists requires target.elementId");

      for (let iter = 1; iter <= maxIterations; iter++) {
        const c = await targetLocator.count().catch(() => 0);
        if (c > 0) return;

        await this.runFlow(
          userId,
          testCaseId,
          scenario,
          body,
          scenarioData,
          resolvedData,
        );
        if (delayMs) await this.page.waitForTimeout(delayMs);
      }

      throw new Error(`whileNotExists exceeded maxIterations=${maxIterations}`);
    }

    throw new Error(`Unknown loop kind: ${kind}`);
  }

  async performAction(userId, testCaseId, element, action, data) {
    const locator = this.page.locator(element.locator);

    if (
      action !== "clickInRow" &&
      action !== "enterTextInRow" &&
      action !== "timeDelay" &&
      action !== "openUrlNewTab" &&
      action !== "openUrlNewWindow" &&
      action !== "switchPage" &&
      action !== "switchContextPage" &&
      action !== "closeCurrentPage" &&
      action !== "closePage" &&
      action !== "reload" &&
      action !== "screenshot" &&
      action !== "networkidle" &&
      action !== "clickPerticularJobTitle" &&
      action !== "waitForVisible" &&
      action !== "waitForHidden"
    ) {
      await this.waitForElement(locator);
    }

    switch (action) {
      case "waitForVisible": {
        await locator.first().waitFor({ state: "visible", timeout: 120000 });
        break;
      }

      case "waitForHidden": {
        await locator.first().waitFor({ state: "hidden", timeout: 120000 });
        break;
      }

      case "networkidle": {
        await this.page.waitForLoadState("networkidle");
        break;
      }

      case "reload": {
        await this.page.reload({ waitUntil: "domcontentloaded" });
        break;
      }

      case "openNewTab": {
        // click -> new page in same context
        await this.openNewPageByClick(locator, "domcontentloaded");
        break;
      }

      case "openNewWindow": {
        // click-based popup/window still belongs to same context in Playwright
        await this.openNewPageByClick(locator, "domcontentloaded");
        break;
      }

      case "openUrlNewTab": { 
        const url = String(data || "").trim();
        if (!url) {
          throw new Error("openUrlNewTab requires a URL in step data");
        }

        // same context => shared cookies/session
        await this.openNewPageByUrl(url, "domcontentloaded");
        break;
      }

      case "openUrlNewWindow": {
        const url = String(data || "").trim();
        if (!url) {
          throw new Error("openUrlNewWindow requires a URL in step data");
        }

        // new context => isolated cookies/session
        await this.openNewIsolatedWindowByUrl(url, "domcontentloaded");
        break;
      }

      case "switchPage": {
        const index = Number(data);
        await this.switchToPage(index, "domcontentloaded");
        break;
      }

      case "switchContextPage": {
        const [contextIndexRaw, pageIndexRaw] = String(data || "").split("||");
        const contextIndex = Number(contextIndexRaw);
        const pageIndex = Number(pageIndexRaw ?? 0);

        await this.switchToContextPage(
          contextIndex,
          pageIndex,
          "domcontentloaded",
        );
        break;
      }

      case "closeCurrentPage": {
        await this.closeCurrentPage("domcontentloaded");
        break;
      }

      case "closePage": {
        const index = Number(data);
        await this.closePageByIndex(index, "domcontentloaded");
        break;
      }

      // case "getCurrentPageIndex": {
      //   const currentIndex = this.getCurrentPageIndex();
      //   console.log(`[CURRENT PAGE INDEX]: ${currentIndex}`);
      //   return currentIndex;
      // }

      // case "getCurrentContextIndex": {
      //   const currentContextIndex = this.getCurrentContextIndex();
      //   console.log(`[CURRENT CONTEXT INDEX]: ${currentContextIndex}`);
      //   return currentContextIndex;
      // }

      case "timeDelay": {
        const seconds = Number(data);
        const milliseconds = seconds * 1000;
        console.log(`[TIME DELAY] Waiting for ${seconds} second(s)`);
        await this.page.waitForTimeout(milliseconds);
        break;
      }

      case "click":
        await locator.first().click();
        break;

      case "input":
        await locator.fill(data);
        break;

      case "select":
        await this.handleSelect(locator, data);
        break;

      case "toggle":
        await locator.click();
        break;

      case "upload": {
        const uploadDir = path.join(
          process.cwd(),
          "uploadFiles",
          `user_${userId}`,
        );
        if (Array.isArray(data)) {
          const resolved = data.map((fileName) =>
            path.join(uploadDir, fileName),
          );
          await locator.setInputFiles(resolved);
        } else {
          await locator.setInputFiles(path.join(uploadDir, data));
        }
        break;
      }

      case "date":
        await locator.fill(data);
        break;

      case "editor":
        await locator.fill(data);
        break;

      case "autocomplete":
        await this.handleAutocomplete(element, data);
        break;

      case "toggleState":
        await this.handleToggleState(element, data);
        break;

      case "multiSelectCreate":
        await this.handleMultiSelectCreate(element, data);
        break;

      case "checkbox":
        await this.handleCheckbox(element, data);
        break;

      case "clickPerticularJobTitle":
        await this.handleClickPerticularJobTitle(element, data);
        break;

      case "clickInRow": {
        const allRowsSelector = element.allRowsSelector;
        const childSelector = element.childSelector;
        const allRows = this.page.locator(allRowsSelector);
        const row = allRows.filter({ hasText: data }).first();
        await row.waitFor({ state: "visible", timeout: 120000 });
        await row.locator(childSelector).click();
        break;
      }

      case "enterTextInRow": {
        const [rowTextRaw, valueRaw] = String(data || "").split("||");
        const rowText = (rowTextRaw || "").trim();
        const resolved = resolveScenarioData(userId, testCaseId, rowText);

        if (resolved === undefined || resolved === null || resolved === "") {
          throw new Error(
            `enterTextInRow: rowText not found for userId=${userId} testCaseId=${testCaseId} rowText=${rowText}`,
          );
        }

        const value = (valueRaw || "").trim();
        const allRowsSelector = element.allRowsSelector;
        const childSelector = element.childSelector;
        const allRows = this.page.locator(allRowsSelector);
        const row = allRows.filter({ hasText: resolved }).first();

        await row.waitFor({ state: "visible", timeout: 120000 });
        await row.locator(childSelector).fill(value);
        break;
      }

      case "screenshot": {
        const screenshot = await this.page.screenshot({ fullPage: true });
        // fullpage is best for debugging
        await allure.attachment("Page Screenshot", screenshot, "image/png");
        break;
      }

      default:
        console.warn(`⚠ Unknown action: ${action}`);
    }
  }

  // Open new tab/window by clicking an element
  // async openNewPageByClick(locator, waitUntil = "domcontentloaded") {
  //   if (!this.context) {
  //     throw new Error("MetaEngine: context is missing");
  //   }

  //   const [newPage] = await Promise.all([
  //     this.context.waitForEvent("page"),
  //     locator.first().click(),
  //   ]);

  //   await newPage.waitForLoadState(waitUntil).catch(() => {});
  //   await newPage.bringToFront().catch(() => {});

  //   this.page = newPage;

  //   return newPage;
  // }

  // // Open new tab/window directly by URL
  // async openNewPageByUrl(url, waitUntil = "domcontentloaded") {
  //   if (!this.context) {
  //     throw new Error("MetaEngine: context is missing");
  //   }

  //   if (!url || !String(url).trim()) {
  //     throw new Error("openNewPageByUrl requires a URL");
  //   }

  //   const newPage = await this.context.newPage();

  //   await newPage.goto(String(url).trim(), { waitUntil });
  //   await newPage.bringToFront().catch(() => {});

  //   this.page = newPage;

  //   return newPage;
  // }

  // Close current active tab/window
  // async closeCurrentPage(waitUntil = "domcontentloaded") {
  //   if (!this.page || !this.context) {
  //     throw new Error("MetaEngine: page/context missing");
  //   }

  //   const pagesBefore = this.context.pages();

  //   if (pagesBefore.length <= 1) {
  //     throw new Error("Cannot close last remaining page");
  //   }

  //   const closingPage = this.page;

  //   await closingPage.close();

  //   const pagesAfter = this.context.pages();

  //   this.page = pagesAfter[0];

  //   await this.page.bringToFront().catch(() => {});
  //   await this.page.waitForLoadState(waitUntil).catch(() => {});

  //   return this.page;
  // }

  // // Close a specific page by index
  // async closePageByIndex(index, waitUntil = "domcontentloaded") {
  //   if (!this.context) {
  //     throw new Error("MetaEngine: context missing");
  //   }

  //   const pages = this.context.pages();

  //   if (!Number.isInteger(index) || index < 0 || index >= pages.length) {
  //     throw new Error(
  //       `Invalid page index ${index}. Available pages: 0 to ${pages.length - 1}`,
  //     );
  //   }

  //   if (pages.length <= 1) {
  //     throw new Error("Cannot close the only open page");
  //   }

  //   const targetPage = pages[index];
  //   const isCurrent = targetPage === this.page;

  //   await targetPage.close();

  //   const remainingPages = this.context.pages();

  //   if (isCurrent) {
  //     this.page = remainingPages[0];

  //     await this.page.bringToFront().catch(() => {});
  //     await this.page.waitForLoadState(waitUntil).catch(() => {});
  //   }

  //   return this.page;
  // }

  async handleClickPerticularJobTitle(element, jobId) {
    await this.page.waitForTimeout(5000);
    const jobTitleLocatorStr = element.requiredJobTitleLocator.replace(
      "${jobId}",
      jobId,
    );

    // Read total pages from pagination
    const paginationText = this.page.locator(element.numberOfPages);
    const text = await paginationText.innerText(); // e.g. "of 4 page"
    const totalPages = parseInt(text.match(/\d+/)[0]);

    console.log(`Total pages: ${totalPages}`);

    for (let i = 1; i <= totalPages; i++) {
      const jobTitle = this.page.locator(jobTitleLocatorStr);

      if (await jobTitle.isVisible()) {
        console.log(`Found Job ID ${jobId} on page ${i}, clicking...`);
        await jobTitle.click();
        return;
      }

      if (i < totalPages) {
        console.log(`➡ Going to page ${i + 1}...`);
        await this.page.locator(element.nextPage).click();
        await this.page.waitForTimeout(1000);
      }
    }

    throw new Error(
      `Job ID ${jobId} not found after checking ${totalPages} pages`,
    );
  }

  async handleToggleState(element, desiredState) {
    const toggle = this.page.locator(element.locator);
    const onLabel = this.page.locator(element.onLocator);
    const offLabel = this.page.locator(element.offLocator);

    desiredState = desiredState.toLowerCase();
    const wantOn = ["yes", "private", "on", "true"].includes(desiredState);
    const wantOff = ["no", "public", "off", "false"].includes(desiredState);

    await this.waitForElement(toggle);

    const isOn = await onLabel.isVisible();
    const isOff = await offLabel.isVisible();

    if (wantOn && isOn) return;
    if (wantOff && isOff) return;

    await toggle.click();

    if (wantOn) {
      await expect(onLabel).toBeVisible();
    } else {
      await expect(offLabel).toBeVisible();
    }
  }

  // async handleCheckbox(element, desiredState) {
  //   const box = this.page.locator(element.locator).first();
  //   desiredState = desiredState.toLowerCase().trim();

  //   await this.waitForElement(box);
  //   const isChecked = await box.isChecked();

  //   if (desiredState === "check") {
  //     if (!isChecked) await box.check();
  //     await expect(box).toBeChecked();
  //     return;
  //   }

  //   if (desiredState === "uncheck") {
  //     if (isChecked) await box.uncheck();
  //     await expect(box).not.toBeChecked();
  //     return;
  //   }

  //   throw new Error(`Invalid checkbox action: ${desiredState}`);
  // }

  async handleCheckbox(element, desiredState, index = 0) {
    desiredState = String(desiredState).toLowerCase().trim();

    if (!["check", "uncheck"].includes(desiredState)) {
      throw new Error(`Invalid checkbox action: ${desiredState}`);
    }

    let box = this.page.locator(element.locator);

    const count = await box.count();
    if (count === 0) {
      throw new Error(
        `Checkbox locator matched 0 elements: ${element.locator}`,
      );
    }

    box = box.nth(index);

    await box.waitFor({ state: "attached" });

    try {
      await box.scrollIntoViewIfNeeded();
    } catch {}

    const type = await box.getAttribute("type");
    const tagName = await box.evaluate((el) => el.tagName.toLowerCase());

    if (tagName !== "input" || type !== "checkbox") {
      throw new Error(
        `handleCheckbox expects locator to point to checkbox input, but got <${tagName} type="${type || ""}"> for locator: ${element.locator}`,
      );
    }

    const setStateByInputMethod = async () => {
      const isChecked = await box.isChecked();

      if (desiredState === "check" && !isChecked) {
        await box.check({ force: true });
      }

      if (desiredState === "uncheck" && isChecked) {
        await box.uncheck({ force: true });
      }
    };

    const setStateByClickingLabel = async () => {
      const id = await box.getAttribute("id");
      if (!id)
        throw new Error(
          `Checkbox has no id, cannot find label for fallback click.`,
        );

      const label = this.page.locator(`label[for="${id}"]`).first();
      await label.waitFor({ state: "visible" });

      const isChecked = await box.isChecked();

      if (desiredState === "check" && !isChecked) {
        await label.click();
      }

      if (desiredState === "uncheck" && isChecked) {
        await label.click();
      }
    };

    try {
      await setStateByInputMethod();
    } catch {
      await setStateByClickingLabel();
    }

    if (desiredState === "check") {
      await expect(box).toBeChecked();
    } else {
      await expect(box).not.toBeChecked();
    }
  }

  async handleMultiSelectCreate(element, skills) {
    const input = this.page.locator(element.locator);
    const optionsLocator = this.page.locator(element.dropdownLocator);

    console.log(`\n=== multiSelectCreate Debug Start ===`);


    for (const skill of skills) {
      await this.waitForElement(input);
      await input.pressSequentially(skill, { delay: 120 });

      await optionsLocator.first().waitFor({
        state: "visible",
        timeout: 10000,
      });

      const options = await optionsLocator.allInnerTexts();
      const cleaned = options.map((o) => o.trim().toLowerCase());
      const exactMatch = cleaned.includes(skill.toLowerCase());
      console.log("exactMatch", exactMatch);

      function escapeRegex(text) {
        return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      }

      const safeSkill = escapeRegex(skill);

      if (exactMatch) {
        const matchedOptions = optionsLocator.filter({
          hasText: new RegExp(`^${safeSkill}$`, "i"),
        });

        const count = await matchedOptions.count();
        console.log(`Exact match count for "${skill}":`, count);

        if (count === 0) {
          const allOptions = await optionsLocator.allInnerTexts();
          console.log(
            "No exact match found. Available options:",
            allOptions,
          );
          throw new Error(`No exact match found for "${skill}"`);
        }

        const texts = await matchedOptions.allInnerTexts();
        console.log("Matching exact options:", texts);

        await matchedOptions.first().click();
      } else {
        const matchedOptions = optionsLocator.filter({
          hasText: new RegExp(`Create\\s*["']?${safeSkill}["']?`, "i"),
        });

        const count = await matchedOptions.count();
        console.log(`Create option count for "${skill}":`, count);

        if (count === 0) {
          const allOptions = await optionsLocator.allInnerTexts();
          console.log(
            "No create option found. Available options:",
            allOptions,
          );
          throw new Error(`No 'Create ${skill}' option found`);
        }

        const texts = await matchedOptions.allInnerTexts();
        console.log("Matching create options:", texts);

        await matchedOptions.first().click();
      }

      await this.page.waitForTimeout(500);
    }

    console.log(`=== multiSelectCreate Debug End ===\n`);
  }

  async handleAutocomplete(element, value) {
    await this.page.waitForTimeout(1000);
    console.log(`\n=== Autocomplete Debug Start ===`);
    console.log("Input value:", value);

    const input = this.page.locator(element.locator);
    const dropdown = this.page.locator(element.dropdownLocator);

    await this.waitForElement(input);
    await input.pressSequentially(value, { delay: 120 });

    console.log("Waiting for dropdown options...");
    await dropdown.first().waitFor({ state: "visible", timeout: 10000 });

    const items = await dropdown.allInnerTexts();
    const cleaned = items.map((i) => i.trim());
    console.log("items:", items);
    console.log("cleaned:", cleaned);

    const exactMatch = cleaned.find(
      (i) => i.toLowerCase() === value.toLowerCase(),
    );
    console.log("exactMatch:", exactMatch);

    if (exactMatch) {
      const safe = this.escapeRegex(exactMatch);
      const strictPattern = new RegExp(`^\\s*${safe}\\s*$`, "i");

      console.log("strictPattern:", strictPattern);

      const exactLocator = dropdown.filter({ hasText: strictPattern });
      const exactCount = await exactLocator.count();

      console.log("exactLocator count:", exactCount);

      if (exactCount > 0) {
        console.log("Clicking exact match option...");
        await exactLocator.first().scrollIntoViewIfNeeded();
        await exactLocator.first().click({ force: true });
        await this.page.waitForTimeout(300);
        console.log("=== Autocomplete Debug End (exact match) ===\n");
        return;
      }
    }

    const total = await dropdown.count();
    console.log("No exact match. Total options:", total);

    if (total > 0) {
      console.log("Clicking first option as fallback...");
      await dropdown.first().scrollIntoViewIfNeeded();
      await dropdown.first().click({ force: true });
    }

    await this.page.waitForTimeout(300);
    console.log("=== Autocomplete Debug End (fallback) ===\n");
  }

  async handleSelect(locator, value) {
    console.log(`\n=== Select Debug Start ===`);
    await this.waitForElement(locator);

    const normalizedValue = String(value ?? "").trim();
    console.log("Normalized value:", normalizedValue);

    const tagName = await locator.evaluate((el) => el.tagName.toLowerCase());
    console.log("Element tag:", tagName);

    if (tagName === "select") {
      console.log("Detected native <select>");

      // get all options
      const options = await locator.locator("option").evaluateAll((opts) =>
        opts.map((o) => ({
          label: (o.label || o.textContent || "").trim(),
          value: o.value,
        })),
      );

      // match label (case-insensitive, exact)
      const target = options.find(
        (o) =>
          o.label.localeCompare(normalizedValue, undefined, {
            sensitivity: "accent",
          }) === 0,
      );

      if (!target) {
        const available = options.map((o) => o.label).filter(Boolean);
        throw new Error(
          `Select option not found for "${normalizedValue}". Available: ${available
            .slice(0, 20)
            .join(" | ")}`,
        );
      }

      console.log("Matched option:", target);

      // select by value (string)
      await locator.selectOption({ value: target.value });

      console.log("Option selected successfully");
      console.log("=== Select Debug End (native) ===\n");
      return;
    }

    // Custom dropdown fallback
    await locator.click();

    const optionRegex = new RegExp(
      `^${this.escapeRegex(normalizedValue)}$`,
      "i",
    );
    console.log("Looking for option using regex:", optionRegex);

    const option = this.page.getByText(optionRegex);
    await this.waitForElement(option);

    console.log("Option found, clicking");
    await option.first().click();

    console.log("Option clicked successfully");
    console.log("=== Select Debug End (fallback) ===\n");
  }

  async performAssert(element, assertType, expected) {
    const locator = this.page.locator(element.locator);

    if (
      assertType !== "visible" &&
      assertType !== "hidden" &&
      assertType !== "enabled" &&
      assertType !== "disabled"
    ) {
      await this.waitForElement(locator);
    }
    // await this.waitForElement(locator);

    switch (assertType) {
      case "enabled":
        await expect(locator).toBeEnabled({ timeout: 120000 });
        break;
      case "disabled":
        await expect(locator).toBeDisabled({ timeout: 120000 });
        break;
      case "visible":
        await expect(locator).toBeVisible({ timeout: 120000 });
        break;
      case "hidden":
        await expect(locator).toBeHidden({ timeout: 120000 });
        break;

      case "text":
        await expect(locator).toHaveText(expected);
        break;
      case "contains": {
        const one = await locator.innerText();
        expect(one.toLowerCase()).toContain(expected.toLowerCase());
        break;
      }
      case "arrayContains":
        for (let i = 0; i < 5; i++) {
          const items = await locator.allInnerTexts();
          const cleaned = items
            .map((t) => t.trim().toLowerCase())
            .filter((t) => t.length > 0);
          if (cleaned.includes(expected.toLowerCase())) return;
          await this.page.waitForTimeout(300);
        }
        throw new Error(`Expected '${expected}' not found in list`);

      case "checkoruncheck": {
        const state = String(expected).toLowerCase().trim();

        if (state === "check" || state === "checked" || state === "true") {
          await expect(locator).toBeChecked();
          break;
        }

        if (state === "uncheck" || state === "unchecked" || state === "false") {
          await expect(locator).not.toBeChecked();
          break;
        }

        throw new Error(
          `Invalid expected value for checkoruncheck: ${expected}. Use check/checked/true or uncheck/unchecked/false`,
        );
      }

      case "toggleCheck": {
        const normalizedExpected = String(expected).toLowerCase().trim();
        console.log(`normalizedExpected ${normalizedExpected}`);

        if (
          ["on", "checked", "true", "yes", "private"].includes(
            normalizedExpected,
          )
        ) {
          await expect(locator).toBeChecked();
          break;
        }

        if (
          ["off", "unchecked", "false", "no", "public"].includes(
            normalizedExpected,
          )
        ) {
          await expect(locator).not.toBeChecked();
          break;
        }

        throw new Error(
          `Invalid toggleState expected value: ${expected}. Use on/off/private/public/checked/unchecked`,
        );
      }

      case "value": {
        const val = await locator.inputValue();
        expect(val).toBe(expected);
        break;
      }

      case "listEqualsArray": {
        // element.locator must match ALL items whose text you want
        const loc = this.page.locator(element.locator);

        // Read UI list
        const uiTexts = await loc.allInnerTexts();
        const actual = uiTexts
          .map((t) => String(t ?? "").trim())
          .filter(Boolean);
        console.log("UI list: ", actual);

        // Expected list (array OR comma-separated string)

        const expectedArr = Array.isArray(expected)
          ? expected.map((x) => String(x ?? "").trim())
          : String(expected ?? "")
              .split(",")
              .map((v) => v.trim())
              .filter(Boolean);
        console.log("Expected list: ", expectedArr);

        // Compare lengths first
        if (actual.length !== expectedArr.length) {
          throw new Error(
            `listEqualsArray length mismatch: actual=${actual.length}, expected=${expectedArr.length}\n` +
              `Actual: ${JSON.stringify(actual)}\nExpected: ${JSON.stringify(expectedArr)}`,
          );
        }

        for (let i = 0; i < actual.length; i++) {
          const a = String(actual[i] ?? "")
            .trim()
            .toLowerCase();
          const e = String(expectedArr[i] ?? "")
            .trim()
            .toLowerCase();

          // expected must be found inside actual
          if (!a.includes(e)) {
            throw new Error(
              `listContainsArray mismatch at index ${i}: actual="${a}" does not contain expected="${e}"\n` +
                `Actual: ${JSON.stringify(actual)}\nExpected: ${JSON.stringify(expectedArr)}`,
            );
          }
        }

        // Passed
        return;
      }

      default:
        throw new Error(`Unknown assert type: ${assertType}`);
    }
  }

  async executeOutputAction(action, element) {
    switch (action) {
      case "saveJobID": {
        const currentUrl = this.page.url();
        const match = currentUrl.match(/\/j\/(\d+)\//);
        if (!match) throw new Error("Job ID not found in URL: " + currentUrl);
        return match[1];
      }

      case "getText": {
        const locator = element.locator;
        const text = await this.page.locator(locator).innerText();
        return text;
      }

      case "addInArray": {
        const locator = element.locator;
        const typeOfText = element.typeOfText;
        let text = null;
        if (typeOfText === "select") {
          const select = this.page.locator(locator);
          text = await select.locator("option:checked").textContent();
        } else if (typeOfText === "input") {
          text = await this.page.locator(locator).inputValue();
        } else {
          text = await this.page.locator(locator).innerText();
        }
        return text;
      }

      case "locatorCount": {
        const locatorObj = this.page.locator(element.locator);
        try {
          await locatorObj
            .first()
            .waitFor({ state: "attached", timeout: 3000 });
        } catch {}
        return locatorObj.count();
      }

      default:
        throw new Error(`Unknown outputData action: ${action}`);
    }
  }

  async runFlow(
    userId,
    testCaseId,
    scenario,
    flow,
    scenarioData,
    resolvedData,
  ) {
    for (const step of flow || []) {
      const pageConfig = this.getPageConfigByStep(step);

      if (step.type === "if") {
        const ok = await this.evaluateCondition(
          pageConfig,
          step,
          scenarioData,
          userId,
          testCaseId,
          resolvedData,
        );
        const element = this.getElementByStep(pageConfig, step);
        console.log(
          `IF (${step.condition?.kind}) on element = ${element?.name} => ${ok}`,
        );

        if (ok) {
          await this.runFlow(
            userId,
            testCaseId,
            scenario,
            step.then || [],
            scenarioData,
            resolvedData,
          );
        } else {
          await this.runFlow(
            userId,
            testCaseId,
            scenario,
            step.else || [],
            scenarioData,
            resolvedData,
          );
        }
        continue;
      }

      if (step.type === "loop") {
        console.log(
          `LOOP (${step.kind}) pageId=${step.pageId} maxIterations=${step.maxIterations ?? 200}`,
        );

        await this.runLoop(
          userId,
          testCaseId,
          scenario,
          step,
          scenarioData,
          resolvedData,
        );

        continue;
      }

      if (step.type === "step") {
        const element = this.getElementByStep(pageConfig, step);
        const action = step.action;
        let data = null;

        if (dataRequiredActions.has(action)) {
          const stepId = step.stepId;

          if (scenarioData && scenarioData[stepId] !== undefined) {
            const resolved = resolveScenarioData(
              userId,
              testCaseId,
              scenarioData[stepId],
            );
            resolvedData[stepId] = resolved;
            if (
              step.action === "multiSelectCreate" ||
              step.action === "upload"
            ) {
              if (Array.isArray(resolved)) {
                data = resolved;
              } else if (typeof resolved === "string") {
                data = resolved
                  .split(",")
                  .map((v) => v.trim())
                  .filter(Boolean);
              } else {
                data = [resolved];
              }
            } else {
              data = resolved;
            }
          }

          if (data === undefined || data === null || data === "") {
            console.log(`Skipping ${action} (no data) stepId=${stepId}`);
            continue;
          }
        }

        console.log(`Action: ${action} → ${element?.name} → ${data}`);
        await this.performAction(userId, testCaseId, element, action, data);
        continue;
      }

      if (step.type === "assert") {
        const assertId = step.stepId;
        const element = this.getElementByStep(pageConfig, step);

        let expected = null;
        if (
          step.assert === "text" ||
          step.assert === "value" ||
          step.assert === "contains" ||
          step.assert === "arrayContains" ||
          step.assert === "listEqualsArray" ||
          step.assert === "checkoruncheck" ||
          step.assert === "toggleCheck"
        ) {
          expected = scenarioData && scenarioData[assertId];
          expected = resolveScenarioData(userId, testCaseId, expected);
          resolvedData[assertId] = expected;
          if (expected === undefined || expected === null || expected === "") {
            console.log(
              `Skipping assert ${step.assert} (no data) assertId=${assertId}`,
            );
            continue;
          }
        }

        console.log(`Assert: ${step.assert} → ${element?.name} → ${expected}`);
        await this.performAssert(element, step.assert, expected);
        continue;
      }

      if (step.type === "output") {
        const action = step.action;
        const outputId = step.stepId;

        // key variable name to store in datastore (ex: "studentLink", "jobTitleText")
        const kVariable = scenarioData && scenarioData[outputId];
        const keyVariable = resolveScenarioData(userId, testCaseId, kVariable);
        resolvedData[outputId] = keyVariable;

        if (
          keyVariable === undefined ||
          keyVariable === null ||
          keyVariable === ""
        ) {
          console.log(`Skipping output ${action} (no data) stepId=${outputId}`);
          continue;
        }

        const keyVariableTrimmed = String(keyVariable).trim();

        // ACTION: saveJobID (no element required)
        if (action === "saveJobID") {
          console.log(`Saving output → ${keyVariableTrimmed} via ${action}`);

          const value = await this.executeOutputAction(action); // no element

          dataStore.setScenarioOutput(
            userId,
            testCaseId,
            scenario.scenario_id,
            keyVariableTrimmed,
            value,
          );

          console.log(
            `Stored: testcaseId ${testCaseId} → ${scenario.scenario_id}.${keyVariableTrimmed} = ${value} for user ${userId}`,
          );

          continue;
        }

        // ACTION: getText (element required)
        if (action === "getText") {
          const element = this.getElementByStep(pageConfig, step);

          console.log(
            `Saving output → ${keyVariableTrimmed} via ${action} on ${element?.name}`,
          );

          const value = await this.executeOutputAction(action, element);

          dataStore.setScenarioOutput(
            userId,
            testCaseId,
            scenario.scenario_id,
            keyVariableTrimmed,
            value,
          );

          console.log(
            `Stored: testcaseId ${testCaseId} → ${scenario.scenario_id}.${keyVariableTrimmed} = ${value} for user ${userId}`,
          );

          continue;
        }

        // ACTION: addInArray (element required)
        if (action === "addInArray") {
          const element = this.getElementByStep(pageConfig, step);

          console.log(
            `Saving output to array → ${keyVariableTrimmed} via ${action} on ${element?.name}`,
          );

          const value = await this.executeOutputAction(action, element);

          // Append logic handled in dataStore (recommended)
          dataStore.appendScenarioOutputArray(
            userId,
            testCaseId,
            scenario.scenario_id,
            keyVariableTrimmed,
            value,
          );

          console.log(
            `Stored (append): testcaseId ${testCaseId} → ${scenario.scenario_id}.${keyVariableTrimmed} = ${value} for user ${userId}`,
          );

          continue;
        }

        if (action === "addInArrayDirect") {
          const [arrayName, value] = String(keyVariableTrimmed || "").split(
            "||",
          );
          const key = arrayName.trim();
          const valueToAdd = value.trim();
          if (!key || !valueToAdd) continue;
          dataStore.appendScenarioOutputArray(
            userId,
            testCaseId,
            scenario.scenario_id,
            key,
            valueToAdd,
          );

          console.log(
            `Stored (append): testcaseId ${testCaseId} → ${scenario.scenario_id}.${key} = ${valueToAdd} for user ${userId}`,
          );
          continue;
        }

        // ACTION: locatorCount (element required)
        if (action === "locatorCount") {
          const element = this.getElementByStep(pageConfig, step);

          console.log(
            `Saving output → ${keyVariableTrimmed} via ${action} on ${element?.name}`,
          );

          const value = await this.executeOutputAction(action, element);

          dataStore.setScenarioOutput(
            userId,
            testCaseId,
            scenario.scenario_id,
            keyVariableTrimmed,
            value,
          );

          console.log(
            `Stored: testcaseId ${testCaseId} → ${scenario.scenario_id}.${keyVariableTrimmed} = ${value} for user ${userId}`,
          );

          continue;
        }
      }

      throw new Error(`Unknown step type: ${step?.type}`);
    }
  }

  async runScenario(userId, testCaseId, scenario, scenarioData = {}) {
    console.log("unresolved data ", scenarioData);
    const resolvedData = {};
    await this.runFlow(
      userId,
      testCaseId,
      scenario,
      scenario.flow || [],
      scenarioData,
      resolvedData,
    );
    console.log("resolvedData ", resolvedData);
    return resolvedData;
  }
}
