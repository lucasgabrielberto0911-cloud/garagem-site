import { defineConfig } from "@playwright/test";

const live = process.env.CHAT_QA_LIVE === "1";
if (live && !process.env.PLAYWRIGHT_BASE_URL) throw new Error("Modo ao vivo exige PLAYWRIGHT_BASE_URL de preview autorizado.");
if (!live) {
  const database = new URL(process.env.DATABASE_URL ?? "postgresql://invalid/");
  if (process.env.E2E_TEST !== "1" || !["127.0.0.1", "localhost", "[::1]"].includes(database.hostname) || !["/ci", "/garagem_e2e"].includes(database.pathname)) throw new Error("QA local exige banco local dedicado e E2E_TEST=1.");
  if (process.env.LEAD_WEBHOOK_URL || process.env.RESEND_API_KEY || process.env.LEAD_NOTIFY_TO || process.env.LEAD_NOTIFY_EMAIL) throw new Error("Desligue notificações externas no QA local.");
}
export default defineConfig({
  testDir: "./e2e",
  testMatch: "chat-ao-vivo.spec.ts",
  workers: 1,
  retries: 0,
  timeout: 120_000,
  use: {
    baseURL: live ? process.env.PLAYWRIGHT_BASE_URL : "http://127.0.0.1:3365",
    browserName: "chromium",
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
    trace: "retain-on-failure",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {},
  },
  webServer: live ? undefined : { command: "npm run start -- --hostname 127.0.0.1 --port 3365", url: "http://127.0.0.1:3365", reuseExistingServer: false, timeout: 60_000 },
});
