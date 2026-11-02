import { defineConfig } from "@playwright/test";
import principal from "./playwright.config";

// Mantém as mesmas proteções de banco e notificações da suíte principal.
export default defineConfig({
  ...principal,
  testDir: "./e2e/compatibilidade",
  testIgnore: [],
  projects: [
    ...[320, 390, 430].map((width) => ({
      name: `webkit-${width}`,
      testMatch: "**/webkit.spec.ts",
      use: {
        browserName: "webkit" as const,
        viewport: { width, height: 844 },
        isMobile: true,
        hasTouch: true,
        launchOptions: {},
      },
    })),
    {
      name: "pwa-chromium",
      testMatch: "**/service-worker.spec.ts",
      use: { serviceWorkers: "allow" },
    },
  ],
});
