// Syncs repos and commit stats for a user
// Supports incremental (today) and full (yearly) modes

import { db } from "@/db";
import { users, accounts, repositories, dailyStats, repoStats } from "@/db/schema";
import { eq, and, notInArray, sql } from "drizzle-orm";
import { createOctokit, fetchUserRepos, fetchTodaysCommits, fetchRepoWeeklyStats } from "./github";

type ProgressFn = (event: string, data: Record<string, unknown>) => void;
type SyncMode = "incremental" | "full";

export async function syncUserData(userId: string, mode: SyncMode = "incremental", onProgress?: ProgressFn) {
  const emit = onProgress ?? (() => {});

  const [account] = await db.select().from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.provider, "github"))).limit(1);
  if (!account?.accessToken) return { repos: 0, commits: 0 };

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return { repos: 0, commits: 0 };

  const octokit = createOctokit(account.accessToken);
  emit("status", { message: "Fetching repositories..." });

  const ghRepos = await fetchUserRepos(octokit);
  let reposSynced = 0;

  for (const repo of ghRepos) {
    const existing = await db.select().from(repositories)
      .where(eq(repositories.githubRepoId, repo.id)).limit(1);

    if (existing.length === 0) {
      await db.insert(repositories).values({
        userId, githubRepoId: repo.id, name: repo.name, fullName: repo.full_name, language: repo.language,
      });
    } else {
      await db.update(repositories).set({
        name: repo.name, fullName: repo.full_name, language: repo.language,
      }).where(eq(repositories.githubRepoId, repo.id));
    }
    reposSynced++;
  }

  emit("repos", { count: reposSynced, message: `Synced ${reposSynced} repositories` });

  const ghRepoIds = ghRepos.map((r) => r.id);
  if (ghRepoIds.length > 0) {
    const stale = await db.select({ id: repositories.id }).from(repositories)
      .where(and(eq(repositories.userId, userId), notInArray(repositories.githubRepoId, ghRepoIds)));
    if (stale.length > 0) {
      for (const r of stale) {
        await db.delete(repoStats).where(eq(repoStats.repoId, r.id));
        await db.delete(repositories).where(eq(repositories.id, r.id));
      }
      emit("status", { message: `Removed ${stale.length} deleted repos` });
    }
  }

  if (mode === "full") {
    await syncFull(userId, user.githubId, octokit, emit);
  } else {
    await syncIncremental(userId, user.username, octokit, emit);
  }

  await db.update(users).set({ lastSyncedAt: new Date() }).where(eq(users.id, userId));

  const totals = await db.select({
    additions: sql<number>`coalesce(sum(${dailyStats.additions}), 0)`,
    deletions: sql<number>`coalesce(sum(${dailyStats.deletions}), 0)`,
    commits: sql<number>`coalesce(sum(${dailyStats.commits}), 0)`,
  }).from(dailyStats).where(eq(dailyStats.userId, userId));

  emit("done", {
    repos: reposSynced,
    commits: Number(totals[0]?.commits ?? 0),
    additions: Number(totals[0]?.additions ?? 0),
    deletions: Number(totals[0]?.deletions ?? 0),
  });

  return { repos: reposSynced, commits: Number(totals[0]?.commits ?? 0) };
}

async function syncFull(userId: string, githubId: number, octokit: ReturnType<typeof createOctokit>, emit: ProgressFn) {
  emit("status", { message: "Fetching yearly stats (this may take a while)..." });

  const dbRepos = await db.select().from(repositories).where(eq(repositories.userId, userId));

  await db.delete(repoStats).where(eq(repoStats.userId, userId));
  await db.delete(dailyStats).where(eq(dailyStats.userId, userId));

  const dailyAgg = new Map<string, { additions: number; deletions: number; commits: number }>();

  for (let i = 0; i < dbRepos.length; i++) {
    const repo = dbRepos[i];
    const [owner, name] = repo.fullName.split("/");
    emit("repo", {
      name: repo.fullName, index: i + 1, total: dbRepos.length, commits: 0,
      message: `Fetching stats: ${repo.fullName} (${i + 1}/${dbRepos.length})`,
    });

    const weeks = await fetchRepoWeeklyStats(octokit, owner, name, githubId);

    for (const w of weeks) {
      await db.insert(repoStats).values({
        userId, repoId: repo.id, weekStart: w.weekStart,
        additions: w.additions, deletions: w.deletions, commits: w.commits,
      });

      const existing = dailyAgg.get(w.weekStart) ?? { additions: 0, deletions: 0, commits: 0 };
      existing.additions += w.additions;
      existing.deletions += w.deletions;
      existing.commits += w.commits;
      dailyAgg.set(w.weekStart, existing);
    }

    emit("repo-done", {
      name: repo.fullName, additions: weeks.reduce((s, w) => s + w.additions, 0),
      deletions: weeks.reduce((s, w) => s + w.deletions, 0), commits: weeks.reduce((s, w) => s + w.commits, 0),
    });
  }

  for (const [date, agg] of dailyAgg) {
    await db.insert(dailyStats).values({
      userId, date, additions: agg.additions, deletions: agg.deletions,
      netLines: agg.additions - agg.deletions, commits: agg.commits,
    });
  }
}

async function syncIncremental(userId: string, username: string, octokit: ReturnType<typeof createOctokit>, emit: ProgressFn) {
  emit("status", { message: "Searching today's commits..." });

  const todaysCommits = await fetchTodaysCommits(octokit, username);
  const today = new Date().toISOString().split("T")[0];

  if (todaysCommits.size === 0) {
    emit("status", { message: "No commits found today" });
  }

  let totalAdd = 0, totalDel = 0, totalCommits = 0;
  let idx = 0;

  for (const [repoFullName, commits] of todaysCommits) {
    idx++;
    emit("repo", {
      name: repoFullName, index: idx, total: todaysCommits.size, commits: commits.length,
      message: `Fetching ${repoFullName} (${idx}/${todaysCommits.size})`,
    });

    const [repo] = await db.select().from(repositories)
      .where(and(eq(repositories.fullName, repoFullName), eq(repositories.userId, userId))).limit(1);
    if (!repo) continue;

    let repoAdd = 0, repoDel = 0;
    for (const c of commits) { repoAdd += c.additions; repoDel += c.deletions; }

    totalAdd += repoAdd;
    totalDel += repoDel;
    totalCommits += commits.length;

    const existing = await db.select().from(repoStats)
      .where(and(eq(repoStats.repoId, repo.id), eq(repoStats.weekStart, today))).limit(1);
    const repoRow = { additions: repoAdd, deletions: repoDel, commits: commits.length };

    if (existing.length > 0) {
      await db.update(repoStats).set(repoRow).where(and(eq(repoStats.repoId, repo.id), eq(repoStats.weekStart, today)));
    } else {
      await db.insert(repoStats).values({ userId, repoId: repo.id, weekStart: today, ...repoRow });
    }

    emit("repo-done", { name: repoFullName, additions: repoAdd, deletions: repoDel, commits: commits.length });
  }

  const existingDay = await db.select().from(dailyStats)
    .where(and(eq(dailyStats.userId, userId), eq(dailyStats.date, today))).limit(1);
  const dayRow = { additions: totalAdd, deletions: totalDel, netLines: totalAdd - totalDel, commits: totalCommits };

  if (existingDay.length > 0) {
    await db.update(dailyStats).set(dayRow).where(and(eq(dailyStats.userId, userId), eq(dailyStats.date, today)));
  } else {
    await db.insert(dailyStats).values({ userId, date: today, ...dayRow });
  }
}
