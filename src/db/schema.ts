// Drizzle ORM schema for GHWars database
// Tables: users, accounts, repositories, dailyStats, repoStats, adminLogs

import { pgTable, uuid, bigint, varchar, text, boolean, timestamp, date, integer, primaryKey } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  githubId: bigint("github_id", { mode: "number" }).unique().notNull(),
  username: varchar("username", { length: 255 }).unique().notNull(),
  name: text("name"),
  avatarUrl: varchar("avatar_url", { length: 500 }),
  bio: text("bio"),
  email: varchar("email", { length: 320 }),
  isAdmin: boolean("is_admin").default(false).notNull(),
  isBanned: boolean("is_banned").default(false).notNull(),
  banReason: text("ban_reason"),
  prsRaised: integer("prs_raised").default(0).notNull(),
  prsMerged: integer("prs_merged").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastSyncedAt: timestamp("last_synced_at"),
  syncCountDate: date("sync_count_date"),
  incrementalSyncs: integer("incremental_syncs").default(0).notNull(),
  fullSyncs: integer("full_syncs").default(0).notNull(),
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
  stars: integer("stars").default(0).notNull(),
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

export const repoStats = pgTable("repo_stats", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  repoId: uuid("repo_id").references(() => repositories.id, { onDelete: "cascade" }).notNull(),
  weekStart: date("week_start").notNull(),
  additions: integer("additions").default(0).notNull(),
  deletions: integer("deletions").default(0).notNull(),
  commits: integer("commits").default(0).notNull(),
});

export const adminLogs = pgTable("admin_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  adminId: uuid("admin_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  action: varchar("action", { length: 100 }).notNull(),
  targetId: uuid("target_id"),
  details: text("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
