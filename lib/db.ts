import { Pool } from "pg";

const globalForDb = globalThis as typeof globalThis & { aideckPool?: Pool };

export function db() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured");
  globalForDb.aideckPool ??= new Pool({ connectionString, max: 5 });
  return globalForDb.aideckPool;
}
