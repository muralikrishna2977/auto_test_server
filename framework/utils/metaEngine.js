import { expect } from "@playwright/test";
import path from "node:path";
import { dataStore } from "../utils/dataStore.js";

export class MetaEngine {
  constructor(page, pagesConfig) {
    this.page = page;
    this.pagesConfig = pagesConfig;
  }

  // PAGE + ELEMENT METADATA
  getPageConfig(pageName) {
    const page = this.pagesConfig[pageName];
    if (!page) throw new Error(`Page not found: ${pageName}`);
    return page;
  }

  getElement(pageConfig, elementName) {
    const el = pageConfig.elements.find((e) => e.name === elementName);
    if (!el)
      throw new Error(
        `Element '${elementName}' not found in page '${pageConfig.page}'`
      );
    return el;
  }

  // UNIVERSAL WAIT WRAPPER
  async waitForElement(locator) {
    await locator
      .first()
      .waitFor({
        state: "visible",
        timeout: 70000,
      })
      .catch(() => {
        throw new Error(`Element not visible in time: ${locator}`);
      });
  }

  // PERFORM ACTION
  async performAction(element, action, data) {
    const locator = this.page.locator(element.locator);

    if (element.name && element.name !== "JobTitle") {
      await this.waitForElement(locator);
    }

    switch (action) {
      case "click":
        await locator.click();
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
          "uploadFiles"
        );
        if (Array.isArray(data)) {
          const resolved = data.map((fileName) =>
            path.join(uploadDir, fileName)
          );
          await locator.setInputFiles(resolved);
        } else {
          await locator.setInputFiles(
            path.join(uploadDir, data)
          );
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

      default:
        console.warn(`⚠ Unknown action: ${action}`);
    }
  }

  // HANDLERS
  async handleClickPerticularJobTitle(element, jobId) {
    const jobTitleLocatorStr = element.requiredJobTitleLocator.replace(
      "${jobId}",
      jobId
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
      `Job ID ${jobId} not found after checking ${totalPages} pages`
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

  async handleCheckbox(element, desiredState) {
    const box = this.page.locator(element.locator);
    desiredState = desiredState.toLowerCase().trim();

    await this.waitForElement(box);
    const isChecked = await box.isChecked();

    if (desiredState === "check") {
      if (!isChecked) await box.check();
      await expect(box).toBeChecked();
      return;
    }

    if (desiredState === "uncheck") {
      if (isChecked) await box.uncheck();
      await expect(box).not.toBeChecked();
      return;
    }

    throw new Error(`Invalid checkbox action: ${desiredState}`);
  }

  async handleMultiSelectCreate(element, skills) {
    const input = this.page.locator(element.locator);
    const optionsLocator = this.page.locator(element.dropdownLocator);

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

      if (exactMatch) {
        await optionsLocator
          .filter({ hasText: new RegExp(`^${skill}$`, "i") })
          .first()
          .click();
      } else {
        await optionsLocator
          .filter({ hasText: new RegExp(`Create\\s*["']?${skill}["']?`, "i") })
          .first()
          .click();
      }

      await this.page.waitForTimeout(500);
    }
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
      (i) => i.toLowerCase() === value.toLowerCase()
    );
    console.log("exactMatch:", exactMatch);

    if (exactMatch) {
      const safe = escapeRegex(exactMatch);
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
    await this.waitForElement(locator);

    await locator.click();

    try {
      await locator.fill(value);
    } catch {}

    const option = this.page.locator(`text=${value}`);
    await this.waitForElement(option);
    await option.first().click();
  }

  // ASSERTION ENGINE
  async performAssert(element, assertType, expected) {
    const locator = this.page.locator(element.locator);
    await this.waitForElement(locator);

    switch (assertType) {
      case "visible":
        await expect(locator).toBeVisible();
        break;

      case "hidden":
        await expect(locator).toBeHidden();
        break;

      case "text":
        await expect(locator).toHaveText(expected);
        break;

      case "contains":
        const one = await locator.innerText();
        expect(one).toContain(expected);
        break;

      case "arrayContains":
        for (let i = 0; i < 5; i++) {
          const items = await locator.allInnerTexts();
          const cleaned = items
            .map((t) => t.trim().toLowerCase())
            .filter((t) => t.length > 0);

          if (cleaned.includes(expected)) return;

          await this.page.waitForTimeout(300);
        }
        throw new Error(`Expected '${expected}' not found in list`);

      case "value":
        const val = await locator.inputValue();
        expect(val).toBe(expected);
        break;

      default:
        console.warn(`⚠ Unknown assert type: ${assertType}`);
    }
  }

  async executeOutputAction(action) { 
    switch (action) {
      // Save jobId from URL
      case "saveJobID": {
        const currentUrl = this.page.url();
        const match = currentUrl.match(/\/j\/(\d+)\//);

        if (!match) {
          throw new Error("Job ID not found in URL: " + currentUrl);
        }

        return match[1]; // return jobId
      }

      default:
        throw new Error(`Unknown outputData action: ${action}`);
    }
  }

  async runScenario(userId, testCaseId, scenario, scenarioData = {}) {

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

    let currentPage = null;
    let pageConfig = null;

    for (const [index, step] of scenario.flow.entries()) {


      // PAGE CHANGE HANDLING
      if (step.page && step.page !== currentPage) {
        currentPage = step.page;
        pageConfig = this.getPageConfig(currentPage);
      }

      if (step.type === "step") {
        const element = this.getElement(pageConfig, step.element);
        const action = step.action;
        let data = null;

        // Actions requiring data
        if (dataRequiredActions.has(action)) {
          const stepId=`${scenario.scenario_id}_${index}`


          if (scenarioData && scenarioData[stepId] !== undefined) {
            if (step.action === "multiSelectCreate" || step.action === "upload") {
              if (Array.isArray(scenarioData[stepId])) {
                data = scenarioData[stepId];
              } else if (typeof scenarioData[stepId] === "string") {
                data = scenarioData[stepId]
                  .split(",")
                  .map((v) => v.trim())
                  .filter(Boolean);
              } else {
                data = [scenarioData[stepId]];
              }
            } else {
              data = scenarioData[stepId];
            }
          } 
        
          if (data === undefined || data === null || data === "") {
            console.log(`Skipping ${action} on ${step.element} (no data)`);
            continue;
          }
        }

        console.log(`Action: ${action} → ${step.element} → ${data}`);
        await this.performAction(element, action, data);
      }

      /* =====================
            PROCESS ASSERTS
            ===================== */
      if (step.type === "assert") {
        const assertId=`${scenario.scenario_id}_${index}`
        const element = this.getElement(pageConfig, step.element);
        const expected =scenarioData && scenarioData[assertId] !== undefined ? scenarioData[assertId] : step.expected;
        console.log(`Assert: ${step.assert} → ${step.element}`);
        await this.performAssert(element, step.assert, expected);
      }

      /* =====================
            PROCESS OUTPUT
            ===================== */
      if (step.type === "output") {
        const { key, action } = step;

        console.log(`Saving output → ${key} via ${action}`);

        const value = await this.executeOutputAction(action);

        // ALWAYS store under testcaseId → scenarioId
        dataStore.setScenarioOutput(userId, testCaseId, scenario.scenario_id, key, value);

        console.log(`Stored: ${testCaseId} → ${scenario.scenario_id}.${key} = ${value} for user with id ${userId}`);
      }
    }
  }
}

export function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
