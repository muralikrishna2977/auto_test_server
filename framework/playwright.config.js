import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const TIMEOUT_MIN = Number(process.env.TIMEOUT || 6);

const sharedUseOptions = {
  // Blocks PWA service workers — prevents "New version downloading" banner
  // from intercepting post-login navigation on the server.
  // Safe to block: Playwright creates a fresh profile every run anyway,
  // so you always get the latest version directly from the server.
  // serviceWorkers: "block",

  viewport: { width: 1920, height: 1080 },

  // Capture artifacts only on failure — keeps disk usage low on the server
  screenshot: "only-on-failure",
  trace:      "retain-on-failure",
  video:      "retain-on-failure",

  // Per-action timeout — how long a single click/fill/select can take.
  // Linux server is slower than a local machine — 30s default is too tight.
  // actionTimeout: 60_000,

  // Per-navigation timeout — how long goto/reload/waitForNavigation can take.
  // Recruiter platforms have heavy page loads with many API calls.
  navigationTimeout: 90_000,

  // Ignore self-signed HTTPS certs — common on staging/QA environments
  ignoreHTTPSErrors: true,
};

// Chromium launch args (Linux server)
const chromiumLaunchArgs = [
  // Required on most Linux servers — Chrome refuses to start as root without this
  "--no-sandbox",
  "--disable-setuid-sandbox",

  // Prevents crashes in Docker where /dev/shm is only 64MB by default
  "--disable-dev-shm-usage",

  // No GPU on a headless server
  "--disable-gpu",
  "--disable-gpu-sandbox",
  "--disable-software-rasterizer",

  // Stops CSS animations from causing click/assertion timing issues.
  // e.g. a modal is technically "visible" but still sliding in — click misses.
  //   "--disable-animations",

  // Prevents Chrome from throttling timers in background tabs
  "--disable-background-timer-throttling",
  "--disable-backgrounding-occluded-windows",
  "--disable-renderer-backgrounding",

  // Consistent color rendering across different server hardware
  "--force-color-profile=srgb",

  // Improves font rendering on Linux (no system font hinting service)
  "--font-render-hinting=none",

  // Avoids "DevToolsActivePort file doesn't exist" errors on some Linux setups
  "--remote-debugging-port=0",
];

// Config
export default defineConfig({
  testDir: "./tests",

  // false = test FILES run in parallel, tests within a file run serially.
  // This is the right setting for a metadata-driven framework where all
  // test cases share a single browser session (set up in beforeAll).
  fullyParallel: false,

  // Per-test timeout
  timeout: TIMEOUT_MIN * 60 * 1000,

  // Per expect() / waitFor assertion timeout
  // expect: {
  //   timeout: 30_000,
  // },

  // Playwright artifacts output directory
  outputDir: process.env.PLAYWRIGHT_TEST_RESULTS_DIR || "test-results",

  // Reporters
  reporter: [
    ["list"],

    [
      "allure-playwright",
      {
        resultsDir: process.env.ALLURE_RESULTS_DIR || "allure-results",
        detail:     true,
        suiteTitle: true,
      },
    ],
  ],

  globalSetup:    path.resolve("./scripts/global-setup.js"),
  globalTeardown: path.resolve("./scripts/generate-allure-report.js"),

  // Shared use options — applied as defaults to all projects
  use: sharedUseOptions,

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...sharedUseOptions,
        viewport: { width: 1920, height: 1080 },
        launchOptions: {
          args: chromiumLaunchArgs,
        },
      },
    },

    {
      name: "firefox",
      use: {
        ...devices["Desktop Firefox"],
        ...sharedUseOptions,
        viewport: { width: 1920, height: 1080 },
        launchOptions: {
          firefoxUserPrefs: {
            // Disable telemetry — no need to phone home from a test server
            "toolkit.telemetry.enabled":                false,
            "datareporting.healthreport.uploadEnabled": false,
          },
        },
      },
    },

    {
      name: "webkit",
      use: {
        ...devices["Desktop Safari"],
        ...sharedUseOptions,
        viewport: { width: 1920, height: 1080 },
        // WebKit on Linux requires extra system dependencies.
        // Run once on the server: npx playwright install-deps webkit
      },
    },
  ],
});



// import { defineConfig, devices } from "@playwright/test";
// import path from "path";

// export default defineConfig({
//   testDir: "./tests",

//   fullyParallel: true,
//   timeout: Number(process.env.TIMEOUT || 6) * 60 * 1000,

//   // Playwright artifacts (screenshots/videos/traces) go here
//   outputDir: process.env.PLAYWRIGHT_TEST_RESULTS_DIR || "test-results",

//   reporter: [
//     ["list"],

//     //Allure raw results go here (this is the correct key)
//     [
//       "allure-playwright",
//       {
//         resultsDir: process.env.ALLURE_RESULTS_DIR || "allure-results",
//       },
//     ],

//     // Optional: Playwright HTML report
//     // [
//     //   "html",
//     //   {
//     //     outputFolder: process.env.PLAYWRIGHT_HTML_REPORT || "playwright-report",
//     //     open: "never",
//     //   },
//     // ],
//   ],

//   globalSetup: path.resolve("./scripts/global-setup.js"),
//   globalTeardown: path.resolve("./scripts/generate-allure-report.js"),

//   use: {
//     viewport: { width: 1920, height: 1080 },
//     screen: { width: 1920, height: 1080 },

//     screenshot: "only-on-failure",
//     trace: "retain-on-failure",
//     video: "retain-on-failure",
//   },

//   projects: [
//     { name: "chromium", use: { ...devices["Desktop Chrome"] } },
//     { name: "firefox", use: { ...devices["Desktop Firefox"] } },
//     { name: "webkit", use: { ...devices["Desktop Safari"] } },
//   ],
// });