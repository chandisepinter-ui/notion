/**
 * One-command setup:  npm run setup
 *  1. creates .env from .env.example (with a random SESSION_SECRET) if missing
 *  2. creates/updates the database tables
 *  3. loads the curriculum and demo accounts
 * Works on Windows, macOS and Linux.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { execSync } from "node:child_process";

const step = (msg) => console.log(`\n▶ ${msg}`);

step("Checking environment file (.env)");
if (!existsSync(".env")) {
  const example = readFileSync(".env.example", "utf8");
  const secret = randomBytes(48).toString("base64url");
  writeFileSync(".env", example.replace(/^SESSION_SECRET=.*$/m, `SESSION_SECRET=${secret}`));
  console.log("  Created .env with a new random SESSION_SECRET.");
} else {
  console.log("  .env already exists — left unchanged.");
}

mkdirSync("data", { recursive: true });

step("Creating database tables");
execSync("npx drizzle-kit push --force", { stdio: "inherit" });

step("Loading curriculum and demonstration accounts");
execSync("npx tsx scripts/seed.ts", { stdio: "inherit" });

console.log("\n✔ Setup finished. Start the app with:  npm run dev\n  Then open http://localhost:3000\n");
