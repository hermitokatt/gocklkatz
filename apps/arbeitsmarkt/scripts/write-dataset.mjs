/**
 * One-shot writer for data/listings.json.
 * Loads the TypeScript generator via Vite SSR so the committed file and the source stay one path.
 *
 * Usage: node scripts/write-dataset.mjs
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const server = await createServer({
  configFile: join(root, "vitest.config.mts"),
  server: { middlewareMode: true },
  appType: "custom",
});

try {
  const mod = await server.ssrLoadModule("/lib/dataset/generate.ts");
  const raw = mod.serializeDataset(mod.generateDataset(mod.DEFAULT_SEED));
  const out = join(root, "data", "listings.json");
  writeFileSync(out, raw);
  console.log("wrote", out, "bytes", raw.length);
} finally {
  await server.close();
}
