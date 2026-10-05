import { defineConfig } from "@playwright/test";
import { randomBytes } from "node:crypto";
process.env.E2E_ADMIN_PASSWORD ||= randomBytes(24).toString("hex");
export default defineConfig({
  testDir: "./tests",
  timeout: 60000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3011",
    headless: true,
    actionTimeout: 10000,
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    viewport: { width: 1440, height: 1000 },
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "node server/tests/web-server.js",
    url: "http://127.0.0.1:3011",
    reuseExistingServer: false,
    timeout: 15000,
    env: { E2E_ADMIN_PASSWORD: process.env.E2E_ADMIN_PASSWORD },
  },
  reporter: "list",
});
