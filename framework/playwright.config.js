import { defineConfig, devices } from "@playwright/test";
import path from "path";

export default defineConfig({
  testDir: "./tests",

  fullyParallel: true,
  timeout: 240000,

  // Playwright artifacts (screenshots/videos/traces) go here
  outputDir: process.env.PLAYWRIGHT_TEST_RESULTS_DIR || "test-results",

  reporter: [
    ["list"],

    //Allure raw results go here (this is the correct key)
    [
      "allure-playwright",
      {
        resultsDir: process.env.ALLURE_RESULTS_DIR || "allure-results",
      },
    ],

    // Optional: Playwright HTML report
    // [
    //   "html",
    //   {
    //     outputFolder: process.env.PLAYWRIGHT_HTML_REPORT || "playwright-report",
    //     open: "never",
    //   },
    // ],
  ],

  globalSetup: path.resolve("./scripts/global-setup.js"),
  // globalTeardown: path.resolve("./scripts/generate-allure-report.js"),

  use: {
    viewport: { width: 1920, height: 1080 },
    screen: { width: 1920, height: 1080 },

    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
