// Cron endpoint to sync daily commit stats
// Fetches commits for all tracked repos per user

import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, accounts, repositories, dailyStats } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { createOctokit, fetchDailyCommitStats } from "@/lib/github";

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const allUsers = await db.select().from(users);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const since = today.toISOString();
  const until = new Date(today.getTime() + 86400000).toISOString();
  const dateStr = today.toISOString().split("T")[0];

  let synced = 0;

  for (const user of allUsers) {
    const [account] = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, user.id), eq(accounts.provider, "github")))
      .limit(1);

    if (!account?.accessToken) continue;

    const trackedRepos = await db
      .select()
      .from(repositories)
      .where(and(eq(repositories.userId, user.id), eq(repositories.isTracked, true)));

    let totalAdditions = 0, totalDeletions = 0, totalCommits = 0;

    const octokit = createOctokit(account.accessToken);

    for (const repo of trackedRepos) {
      const [owner, repoName] = repo.fullName.split("/");
      const stats = await fetchDailyCommitStats(octokit, owner, repoName, since, until);
      totalAdditions += stats.additions;
      totalDeletions += stats.deletions;
      totalCommits += stats.commits;
    }

    const existing = await db
      .select()
      .from(dailyStats)
      .where(and(eq(dailyStats.userId, user.id), eq(dailyStats.date, dateStr)))
      .limit(1);

    if (existing.length > 0) {
      await db.update(dailyStats).set({
        additions: totalAdditions,
        deletions: totalDeletions,
        netLines: totalAdditions - totalDeletions,
        commits: totalCommits,
      }).where(and(eq(dailyStats.userId, user.id), eq(dailyStats.date, dateStr)));
    } else {
      await db.insert(dailyStats).values({
        userId: user.id,
        date: dateStr,
        additions: totalAdditions,
        deletions: totalDeletions,
        netLines: totalAdditions - totalDeletions,
        commits: totalCommits,
      });
    }

    synced++;
  }

  return NextResponse.json({ synced, date: dateStr });
}
