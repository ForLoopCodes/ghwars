// API route for leaderboard data
// Returns top 100 users by additions for a period

import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, dailyStats } from "@/db/schema";
import { eq, desc, sql, gte } from "drizzle-orm";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") ?? "today";

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const thresholds: Record<string, Date> = {
    today: now,
    week: new Date(now.getTime() - 7 * 86400000),
    month: new Date(now.getTime() - 30 * 86400000),
    alltime: new Date("2020-01-01"),
  };

  const rankings = await db
    .select({
      username: users.username,
      avatarUrl: users.avatarUrl,
      additions: sql<number>`sum(${dailyStats.additions})`.as("additions"),
      deletions: sql<number>`sum(${dailyStats.deletions})`.as("deletions"),
      commits: sql<number>`sum(${dailyStats.commits})`.as("commits"),
    })
    .from(dailyStats)
    .innerJoin(users, eq(dailyStats.userId, users.id))
    .where(gte(dailyStats.date, (thresholds[period] ?? now).toISOString().split("T")[0]))
    .groupBy(users.username, users.avatarUrl)
    .orderBy(desc(sql`sum(${dailyStats.additions})`))
    .limit(100);

  return NextResponse.json(rankings);
}
