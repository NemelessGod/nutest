import { defineConfig, devices } from "@playwright/test";
import { tmpdir } from "node:os";
import path from "node:path";
const port = process.env.E2E_PORT || "3010";
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30000,
  workers: 1,
  use: {
    baseURL,
    headless: true,
    launchOptions: process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH, args: ["--no-sandbox"] }
      : {},
  },
  webServer: {
    command: "node server/index.js",
    url: baseURL + "/api/health",
    reuseExistingServer: false,
    env: {
      PORT: port,
      BOT_COUNT: "40",
      DATA_DIR: path.join(tmpdir(), "neon-serpents-e2e"),
    },
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 1000 } } },
    { name: "android", use: { ...devices["Pixel 7"] } },
  ],
});
