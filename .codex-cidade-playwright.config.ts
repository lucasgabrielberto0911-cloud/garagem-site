import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
export default defineConfig({ ...base, timeout: 90000, webServer: { ...base.webServer, command: `npm run dev -- --hostname 127.0.0.1 --port ${process.env.E2E_PORT}`, timeout: 180000 } });
