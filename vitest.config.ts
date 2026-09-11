import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // Scoped deliberately: the repository harness in tests/ is a set of standalone shell and
    // Node scripts with their own runners, and sweeping them into Vitest would run them twice
    // under an assertion framework they were not written for.
    include: ["src/**/*.test.ts", "scripts/**/*.test.mjs"],
  },
});
