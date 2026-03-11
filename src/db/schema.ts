// Drizzle ORM schema for GHWars database
// Tables: users, accounts, repositories, dailyStats

import { pgTable, uuid, bigint, varchar, text, boolean, timestamp, date, integer, primaryKey } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  githubId: bigint("github_id", { mode: "number" }).unique().notNull(),
  username: varchar("username", { length: 255 }).unique().notNull(),
  name: text("name"),
  avatarUrl: varchar("avatar_url", { length: 500 }),
  bio: text("bio"),
  email: varchar("email", { length: 320 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastSyncedAt: timestamp("last_synced_at"),
});

export const accounts = pgTable("accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  provider: varchar("provider", { length: 50 }).notNull(),
  providerAccountId: varchar("provider_account_id", { length: 255 }).notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  expiresAt: integer("expires_at"),
  tokenType: varchar("token_type", { length: 50 }),
  scope: varchar("scope", { length: 500 }),
});

export const repositories = pgTable("repositories", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  githubRepoId: bigint("github_repo_id", { mode: "number" }).unique().notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  fullName: varchar("full_name", { length: 500 }).notNull(),
  language: varchar("language", { length: 100 }),
  isTracked: boolean("is_tracked").default(true).notNull(),
  lastFetched: timestamp("last_fetched"),
});

export const dailyStats = pgTable("daily_stats", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  date: date("date").notNull(),
  additions: integer("additions").default(0).notNull(),
  deletions: integer("deletions").default(0).notNull(),
  netLines: integer("net_lines").default(0).notNull(),
  commits: integer("commits").default(0).notNull(),
});
