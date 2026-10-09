import { defineConfig } from "@playwright/test";

if (process.env.E2E_TEST !== "1") throw new Error("Use E2E_TEST=1 com o banco local de testes.");
const database = new URL(process.env.DATABASE_URL ?? "postgresql://invalid/");
if (!["127.0.0.1", "localhost", "[::1]"].includes(database.hostname) || !["/ci", "/garagem_e2e"].includes(database.pathname)) throw new Error("Browser E2E aceita apenas o banco local dedicado.");
if (process.env.LEAD_WEBHOOK_URL || process.env.RESEND_API_KEY || process.env.LEAD_NOTIFY_TO || process.env.LEAD_NOTIFY_EMAIL) throw new Error("Desligue notificações externas no E2E.");

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3362",
    browserName: "chromium",
    serviceWorkers: "block",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {},
  },
  projects: [
    { name: "mobile-320", use: { viewport: { width: 320, height: 740 }, isMobile: true, hasTouch: true } },
    { name: "mobile-390", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: "mobile-430", use: { viewport: { width: 430, height: 932 }, isMobile: true, hasTouch: true } },
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: "npm run start -- --hostname 127.0.0.1 --port 3362",
    url: "http://127.0.0.1:3362",
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
