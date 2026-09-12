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
    // under an assertion framework they were not written for. tests/licence-audit.test.mjs is
    // the exception: it is a Vitest suite (GOC-38) and is named here, not via a tests/ glob.
    include: ["src/**/*.test.ts", "scripts/**/*.test.mjs", "tests/licence-audit.test.mjs"],
  },
});
