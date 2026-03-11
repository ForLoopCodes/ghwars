// Syncs repos and today's commit stats for user
// Supports progress callback for real-time streaming

import { db } from "@/db";
import { users, accounts, repositories, dailyStats, repoStats } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { createOctokit, fetchUserRepos, fetchTodaysCommits } from "./github";

type ProgressFn = (event: string, data: Record<string, unknown>) => void;

export async function syncUserData(userId: string, onProgress?: ProgressFn) {
  const emit = onProgress ?? (() => {});

  const [account] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.provider, "github")))
    .limit(1);

  if (!account?.accessToken) return { repos: 0, commits: 0 };

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return { repos: 0, commits: 0 };

  const octokit = createOctokit(account.accessToken);

  emit("status", { message: "Fetching repositories..." });

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

  emit("repos", { count: reposSynced, message: `Synced ${reposSynced} repositories` });
  emit("status", { message: "Searching today's commits..." });

  const todaysCommits = await fetchTodaysCommits(octokit, user.username);
  const today = new Date().toISOString().split("T")[0];

  if (todaysCommits.size === 0) {
    emit("status", { message: "No commits found today" });
  }

  let totalAdditions = 0, totalDeletions = 0, totalCommits = 0;
  let repoIndex = 0;

  for (const [repoFullName, commits] of todaysCommits) {
    repoIndex++;
    emit("repo", {
      name: repoFullName,
      index: repoIndex,
      total: todaysCommits.size,
      commits: commits.length,
      message: `Fetching ${repoFullName} (${repoIndex}/${todaysCommits.size})`,
    });

    const [repo] = await db.select().from(repositories)
      .where(and(eq(repositories.fullName, repoFullName), eq(repositories.userId, userId)))
      .limit(1);

    if (!repo) continue;

    let repoAdd = 0, repoDel = 0;
    for (const c of commits) {
      repoAdd += c.additions;
      repoDel += c.deletions;
    }

    totalAdditions += repoAdd;
    totalDeletions += repoDel;
    totalCommits += commits.length;

    const existingRepo = await db.select().from(repoStats)
      .where(and(eq(repoStats.repoId, repo.id), eq(repoStats.weekStart, today)))
      .limit(1);

    const repoRow = { additions: repoAdd, deletions: repoDel, commits: commits.length };

    if (existingRepo.length > 0) {
      await db.update(repoStats).set(repoRow)
        .where(and(eq(repoStats.repoId, repo.id), eq(repoStats.weekStart, today)));
    } else {
      await db.insert(repoStats).values({ userId, repoId: repo.id, weekStart: today, ...repoRow });
    }

    emit("repo-done", {
      name: repoFullName,
      additions: repoAdd,
      deletions: repoDel,
      commits: commits.length,
    });
  }

  const existingStats = await db.select().from(dailyStats)
    .where(and(eq(dailyStats.userId, userId), eq(dailyStats.date, today)))
    .limit(1);

  const row = { additions: totalAdditions, deletions: totalDeletions, netLines: totalAdditions - totalDeletions, commits: totalCommits };

  if (existingStats.length > 0) {
    await db.update(dailyStats).set(row).where(and(eq(dailyStats.userId, userId), eq(dailyStats.date, today)));
  } else {
    await db.insert(dailyStats).values({ userId, date: today, ...row });
  }

  await db.update(users).set({ lastSyncedAt: new Date() }).where(eq(users.id, userId));

  emit("done", { repos: reposSynced, commits: totalCommits, additions: totalAdditions, deletions: totalDeletions });

  return { repos: reposSynced, commits: totalCommits };
}
