import { defineConfig } from "drizzle-kit";
import { loadEnvFile } from "node:process";
import { existsSync } from "node:fs";

if (existsSync(".env")) loadEnvFile(".env");

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: { url: process.env.DATABASE_URL ?? "file:./data/titan-academy.db" },
});
