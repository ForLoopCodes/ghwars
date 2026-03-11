// Syncs repos and daily stats for a single user
// Called on signup and from refresh button

import { db } from "@/db";
import { accounts, repositories, dailyStats } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { createOctokit, fetchUserRepos, fetchDailyCommitStats } from "./github";

export async function syncUserData(userId: string) {
  const [account] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.provider, "github")))
    .limit(1);

  if (!account?.accessToken) return { repos: 0, stats: null };

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

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const since = today.toISOString();
  const until = new Date(today.getTime() + 86400000).toISOString();
  const dateStr = today.toISOString().split("T")[0];

  let totalAdditions = 0, totalDeletions = 0, totalCommits = 0;

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
    .where(and(eq(dailyStats.userId, userId), eq(dailyStats.date, dateStr)))
    .limit(1);

  const statsData = {
    additions: totalAdditions,
    deletions: totalDeletions,
    netLines: totalAdditions - totalDeletions,
    commits: totalCommits,
  };

  if (existing.length > 0) {
    await db.update(dailyStats).set(statsData).where(and(eq(dailyStats.userId, userId), eq(dailyStats.date, dateStr)));
  } else {
    await db.insert(dailyStats).values({ userId, date: dateStr, ...statsData });
  }

  return { repos: reposSynced, stats: statsData };
}
