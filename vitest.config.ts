import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./test/setup.ts"],
    globals: false,
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json"],
      include: ["src/**/*.ts"],
      exclude: ["src/_legacy_index.ts.bak", "src/**/*.test.ts"],
      thresholds: {
        lines: 0, // raised to 80% as we add coverage week by week
        functions: 0,
        branches: 0,
        statements: 0,
      },
    },
  },
});
