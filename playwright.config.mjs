import { defineConfig } from "@playwright/test";

// e2e against a production build of this app and the fake Aplication_server
// (tests/e2e/lazni-server.mjs). Ports differ from dev (3120) so both can run.
const LAZNI = 3199;
const APP = 3125;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: { baseURL: `http://127.0.0.1:${APP}`, trace: "off" },
  webServer: [
    {
      command: `node tests/e2e/lazni-server.mjs`,
      env: { LAZNI_PORT: String(LAZNI) },
      url: `http://127.0.0.1:${LAZNI}/__zdravlje`,
      reuseExistingServer: false,
    },
    {
      command: `pnpm build && pnpm exec next start -H 127.0.0.1 -p ${APP}`,
      env: { APLICATION_SERVER_URL: `http://127.0.0.1:${LAZNI}`, NEXT_TELEMETRY_DISABLED: "1" },
      url: `http://127.0.0.1:${APP}/admin/prijava`,
      timeout: 240_000,
      reuseExistingServer: false,
    },
  ],
});
