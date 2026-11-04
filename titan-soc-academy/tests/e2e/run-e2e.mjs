/**
 * End-to-end test runner:  npm run test:e2e
 *
 * Uses a SEPARATE throwaway database (data/e2e-test.db) so your local training
 * data is never touched. Builds the app if needed, starts it on port 3210,
 * runs the browser tests, then shuts it down.
 *
 * Requires Playwright's Chromium:  npx playwright install chromium
 */
import { spawn, execSync } from "node:child_process";
import { existsSync, rmSync, readdirSync, mkdirSync } from "node:fs";

const PORT = process.env.E2E_PORT ?? "3210";
const DB = "file:./data/e2e-test.db";
// Default suite: built-in fictional content only (TITAN_CONTENT=off).
// `npm run test:content`: checks the imported Titan content on this computer.
const SUITE = process.argv[2] === "content" ? "content" : "core";
const env = { ...process.env, DATABASE_URL: DB, AUTH_MODE: "demo", PORT, TITAN_CONTENT: SUITE === "content" ? "on" : "off" };
if (SUITE === "content" && !existsSync("content-import/generated/titan-catalog.json")) {
  console.error("✖ No imported Titan content. Run `npm run content:import` first.");
  process.exit(1);
}

try {
  await fetch(`http://localhost:${PORT}/login`);
  console.error(`✖ Port ${PORT} is already in use. Stop the other server (or set E2E_PORT) and try again.`);
  process.exit(1);
} catch {}

for (const f of readdirSync("data")) if (f.startsWith("e2e-test.db")) rmSync(`data/${f}`);
mkdirSync("tests/e2e/screenshots", { recursive: true });

console.log("▶ Preparing test database");
if (!existsSync(".env")) execSync("node scripts/setup.mjs", { stdio: "inherit" });
execSync("npx drizzle-kit push --force", { stdio: "inherit", env });
execSync("npx tsx scripts/seed.ts", { stdio: "inherit", env });

if (!existsSync(".next/BUILD_ID") || process.env.E2E_REBUILD) {
  console.log("▶ Building app");
  execSync("npx next build", { stdio: "inherit", env });
}

console.log(`▶ Starting app on port ${PORT}`);
const server = spawn(process.platform === "win32" ? "npx.cmd" : "npx", ["next", "start", "--port", PORT], { env, stdio: "pipe", shell: process.platform === "win32" });
let serverLog = "";
server.stdout.on("data", (d) => (serverLog += d));
server.stderr.on("data", (d) => (serverLog += d));

const base = `http://localhost:${PORT}`;
for (let i = 0; i < 60; i++) {
  try {
    const r = await fetch(`${base}/login`);
    if (r.ok) break;
  } catch {}
  await new Promise((r) => setTimeout(r, 500));
}

let code = 1;
try {
  const { run } = await import(SUITE === "content" ? "./titan-content.mjs" : "./flows.mjs");
  code = await run(base);
} catch (e) {
  console.error(e);
} finally {
  server.kill();
  if (code !== 0) console.log("\n--- server log (tail) ---\n" + serverLog.split("\n").slice(-40).join("\n"));
}
process.exit(code);
