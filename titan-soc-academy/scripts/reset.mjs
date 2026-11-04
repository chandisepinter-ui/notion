/**
 * Deletes the LOCAL development database and rebuilds it from scratch.
 * All local training progress is erased. Never run against production.
 */
import { rmSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";

for (const f of readdirSync("data")) {
  if (f.startsWith("titan-academy.db")) rmSync(`data/${f}`);
}
console.log("Local database removed. Rebuilding…");
execSync("node scripts/setup.mjs", { stdio: "inherit" });
