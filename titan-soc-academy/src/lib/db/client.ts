import "server-only";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { __titanDbClient?: Client };

function makeClient(): Client {
  const url = process.env.DATABASE_URL ?? "file:./data/titan-academy.db";
  const client = createClient({ url });
  // Enforce relational integrity on SQLite (PostgreSQL does this natively).
  void client.execute("PRAGMA foreign_keys = ON").catch(() => {});
  return client;
}

const client = globalForDb.__titanDbClient ?? makeClient();
if (process.env.NODE_ENV !== "production") globalForDb.__titanDbClient = client;

export const db = drizzle(client, { schema });
export { schema };
