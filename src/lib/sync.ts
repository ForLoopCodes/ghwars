// Syncs repos and daily stats for a single user
// Called on signup and from refresh button

import { db } from "@/db";
import { users, accounts, repositories, dailyStats } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { createOctokit, fetchUserRepos, fetchCommitStatsGrouped } from "./github";

export async function syncUserData(userId: string) {
  const [account] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.provider, "github")))
    .limit(1);

  if (!account?.accessToken) return { repos: 0, days: 0 };

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return { repos: 0, days: 0 };

  const octokit = createOctokit(account.accessToken);

  const ghRepos = await fetchUserRepos(octokit);
  let reposSynced = 0;

  for (const repo of ghRepos) {
    const existing = await db
      .select()
      .from(repositories)
      .where(eq(repositories.githubRepoId, repo.id))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(repositories).values({
        userId,
        githubRepoId: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        language: repo.language,
      });
    } else {
      await db.update(repositories).set({
        name: repo.name,
        fullName: repo.full_name,
        language: repo.language,
      }).where(eq(repositories.githubRepoId, repo.id));
    }
    reposSynced++;
  }

  const trackedRepos = await db
    .select()
    .from(repositories)
    .where(and(eq(repositories.userId, userId), eq(repositories.isTracked, true)));

  const since = new Date();
  since.setDate(since.getDate() - 30);
  since.setHours(0, 0, 0, 0);

  const aggregated = new Map<string, { additions: number; deletions: number; commits: number }>();

  for (const repo of trackedRepos) {
    const [owner, repoName] = repo.fullName.split("/");
    const repoStats = await fetchCommitStatsGrouped(octokit, owner, repoName, user.username, since.toISOString());

    for (const [date, stats] of repoStats) {
      const entry = aggregated.get(date) ?? { additions: 0, deletions: 0, commits: 0 };
      entry.additions += stats.additions;
      entry.deletions += stats.deletions;
      entry.commits += stats.commits;
      aggregated.set(date, entry);
    }
  }

  let daysSynced = 0;
  for (const [date, stats] of aggregated) {
    const existing = await db
      .select()
      .from(dailyStats)
      .where(and(eq(dailyStats.userId, userId), eq(dailyStats.date, date)))
      .limit(1);

    const row = { additions: stats.additions, deletions: stats.deletions, netLines: stats.additions - stats.deletions, commits: stats.commits };

    if (existing.length > 0) {
      await db.update(dailyStats).set(row).where(and(eq(dailyStats.userId, userId), eq(dailyStats.date, date)));
    } else {
      await db.insert(dailyStats).values({ userId, date, ...row });
    }
    daysSynced++;
  }

  await db.update(users).set({ lastSyncedAt: new Date() }).where(eq(users.id, userId));

  return { repos: reposSynced, days: daysSynced };
}
