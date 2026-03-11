// Drizzle Kit configuration for migrations
// Uses PostgreSQL with postgres.js driver

import { defineConfig } from "drizzle-kit";
import "dotenv/config";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
  schemaFilter: ["public"],
  tablesFilter: ["users", "accounts", "repositories", "daily_stats"],
});
