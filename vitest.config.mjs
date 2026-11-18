import { defineConfig } from "vitest/config";

// Playwright specs in tests/e2e run with `pnpm e2e`, not here.
export default defineConfig({
  test: { include: ["tests/**/*.test.{js,jsx}"], exclude: ["tests/e2e/**", "node_modules/**"] },
});
