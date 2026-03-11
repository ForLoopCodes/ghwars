// Syncs repos and commit stats for a user
// Supports incremental (today) and full (yearly) modes

import { db } from "@/db";
import { users, accounts, repositories, dailyStats, repoStats } from "@/db/schema";
import { eq, and, notInArray, sql, ne } from "drizzle-orm";
import { createOctokit, fetchUserRepos, fetchTodaysCommits, fetchRecentDailyCommits, fetchRepoWeeklyStats, fetchPRCounts, fetchStarHistory, fetchPRHistory } from "./github";

type ProgressFn = (event: string, data: Record<string, unknown>) => void;
type SyncMode = "incremental" | "full";

export async function syncUserData(userId: string, mode: SyncMode = "incremental", onProgress?: ProgressFn) {
  const emit = onProgress ?? (() => { });

  const [account] = await db.select().from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.provider, "github"))).limit(1);
  if (!account?.accessToken) return { repos: 0, commits: 0 };

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return { repos: 0, commits: 0 };

  const octokit = createOctokit(account.accessToken);

  let repoCount: number;

  if (mode === "full") {
    emit("status", { message: "Fetching repositories..." });
    const ghRepos = await fetchUserRepos(octokit);

    const existingRepos = await db.select({ id: repositories.id, githubRepoId: repositories.githubRepoId })
      .from(repositories).where(eq(repositories.userId, userId));
    const existingMap = new Map(existingRepos.map((r) => [r.githubRepoId, r.id]));

    const toInsert = ghRepos.filter((r) => !existingMap.has(r.id));
    const toUpdate = ghRepos.filter((r) => existingMap.has(r.id));

    if (toInsert.length > 0) {
      await db.insert(repositories).values(
        toInsert.map((r) => ({ userId, githubRepoId: r.id, name: r.name, fullName: r.full_name, language: r.language, stars: r.stargazers_count }))
      );
    }

    for (const r of toUpdate) {
      await db.update(repositories).set({ name: r.name, fullName: r.full_name, language: r.language, stars: r.stargazers_count })
        .where(eq(repositories.githubRepoId, r.id));
    }

    emit("repos", { count: ghRepos.length, message: `Synced ${ghRepos.length} repositories` });

    const ghRepoIds = ghRepos.map((r) => r.id);
    if (ghRepoIds.length > 0) {
      const stale = await db.select({ id: repositories.id }).from(repositories)
        .where(and(eq(repositories.userId, userId), notInArray(repositories.githubRepoId, ghRepoIds)));
      if (stale.length > 0) {
        const staleIds = stale.map((r) => r.id);
        await db.delete(repoStats).where(sql`${repoStats.repoId} IN (${sql.join(staleIds.map(id => sql`${id}`), sql`, `)})`);
        await db.delete(repositories).where(sql`${repositories.id} IN (${sql.join(staleIds.map(id => sql`${id}`), sql`, `)})`);
        emit("status", { message: `Removed ${stale.length} deleted repos` });
      }
    }

    repoCount = ghRepos.length;
  } else {
    emit("status", { message: "Using cached repositories..." });
    const cached = await db.select({ id: repositories.id }).from(repositories).where(eq(repositories.userId, userId));
    repoCount = cached.length;
  }

  if (mode === "full") {
    await syncFull(userId, user.username, octokit, emit);
  } else {
    await syncIncremental(userId, user.username, octokit, emit);
  }

  emit("status", { message: "Fetching PR stats..." });
  const prCounts = await fetchPRCounts(octokit, user.username);

  await db.update(users).set({
    lastSyncedAt: new Date(),
    prsRaised: prCounts.raised,
    prsMerged: prCounts.merged,
  }).where(eq(users.id, userId));

  const today = new Date().toISOString().split("T")[0];
  const [starTotal] = await db.select({ total: sql<number>`coalesce(sum(${repositories.stars}), 0)` })
    .from(repositories).where(eq(repositories.userId, userId));

  await db.update(dailyStats).set({
    totalStars: Number(starTotal.total),
    totalPrsRaised: prCounts.raised,
    totalPrsMerged: prCounts.merged,
  }).where(and(eq(dailyStats.userId, userId), eq(dailyStats.date, today)));

  const totals = await db.select({
    additions: sql<number>`coalesce(sum(${dailyStats.additions}), 0)`,
    deletions: sql<number>`coalesce(sum(${dailyStats.deletions}), 0)`,
    commits: sql<number>`coalesce(sum(${dailyStats.commits}), 0)`,
  }).from(dailyStats).where(eq(dailyStats.userId, userId));

  emit("done", {
    repos: repoCount,
    commits: Number(totals[0]?.commits ?? 0),
    additions: Number(totals[0]?.additions ?? 0),
    deletions: Number(totals[0]?.deletions ?? 0),
  });

  return { repos: repoCount, commits: Number(totals[0]?.commits ?? 0) };
}

async function syncFull(userId: string, username: string, octokit: ReturnType<typeof createOctokit>, emit: ProgressFn) {
  const today = new Date().toISOString().split("T")[0];
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentCutoff = sevenDaysAgo.toISOString().split("T")[0];

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const dbRepos = await db.select().from(repositories).where(eq(repositories.userId, userId));
  const repoNameToId = new Map(dbRepos.map((r) => [r.fullName, r.id]));

  await db.delete(repoStats).where(and(eq(repoStats.userId, userId), ne(repoStats.weekStart, today)));
  await db.delete(dailyStats).where(and(eq(dailyStats.userId, userId), ne(dailyStats.date, today)));

  emit("status", { message: "Fetching recent daily commits + star/PR history..." });
  const [recentDaily, starHistory, prHistory] = await Promise.all([
    fetchRecentDailyCommits(octokit, username, 7),
    fetchStarHistory(octokit, dbRepos, (done, total) => {
      emit("status", { message: `Star history: ${done}/${total} repos` });
    }),
    fetchPRHistory(octokit, username),
  ]);

  emit("status", { message: "Fetching weekly stats per repo..." });
  const weeklyAgg = new Map<string, { additions: number; deletions: number; commits: number }>();
  let repoDone = 0;

  const concurrency = 50;
  for (let i = 0; i < dbRepos.length; i += concurrency) {
    const batch = dbRepos.slice(i, i + concurrency);
    const results = await Promise.allSettled(
      batch.map(async (repo) => {
        const [owner, name] = repo.fullName.split("/");
        return { repoId: repo.id, fullName: repo.fullName, weeks: await fetchRepoWeeklyStats(octokit, owner, name, user.githubId) };
      }),
    );

    for (const r of results) {
      if (r.status !== "fulfilled") continue;
      for (const w of r.value.weeks) {
        if (w.weekStart >= recentCutoff || w.weekStart === today) continue;

        await db.insert(repoStats).values({
          userId, repoId: r.value.repoId, weekStart: w.weekStart,
          additions: w.additions, deletions: w.deletions, commits: w.commits,
        });

        const existing = weeklyAgg.get(w.weekStart) ?? { additions: 0, deletions: 0, commits: 0 };
        existing.additions += w.additions;
        existing.deletions += w.deletions;
        existing.commits += w.commits;
        weeklyAgg.set(w.weekStart, existing);
      }
    }

    repoDone += batch.length;
    emit("status", { message: `Weekly stats: ${repoDone}/${dbRepos.length} repos` });
  }

  for (const [date, agg] of weeklyAgg) {
    const newStars = starHistory.get(date) ?? 0;
    const newPrsRaised = prHistory.raised.get(date) ?? 0;
    const newPrsMerged = prHistory.merged.get(date) ?? 0;

    await db.insert(dailyStats).values({
      userId, date, additions: agg.additions, deletions: agg.deletions,
      netLines: agg.additions - agg.deletions, commits: agg.commits,
      newStars, newPrsRaised, newPrsMerged,
    });
  }

  for (const [date, repoMap] of recentDaily) {
    if (date === today) continue;

    let dayAdd = 0, dayDel = 0, dayCommits = 0;
    for (const [repoName, stats] of repoMap) {
      const repoId = repoNameToId.get(repoName);
      if (!repoId) continue;

      await db.insert(repoStats).values({
        userId, repoId, weekStart: date,
        additions: stats.additions, deletions: stats.deletions, commits: stats.commits,
      });

      dayAdd += stats.additions;
      dayDel += stats.deletions;
      dayCommits += stats.commits;
    }

    const newStars = starHistory.get(date) ?? 0;
    const newPrsRaised = prHistory.raised.get(date) ?? 0;
    const newPrsMerged = prHistory.merged.get(date) ?? 0;

    if (dayCommits > 0 || dayAdd > 0 || dayDel > 0 || newStars > 0 || newPrsRaised > 0 || newPrsMerged > 0) {
      await db.insert(dailyStats).values({
        userId, date, additions: dayAdd, deletions: dayDel,
        netLines: dayAdd - dayDel, commits: dayCommits,
        newStars, newPrsRaised, newPrsMerged,
      });
    }
  }

  emit("status", { message: "Fetching today's commits..." });
  await syncIncremental(userId, username, octokit, emit);
}

async function syncIncremental(userId: string, username: string, octokit: ReturnType<typeof createOctokit>, emit: ProgressFn) {
  emit("status", { message: "Searching today's commits..." });

  const todaysCommits = await fetchTodaysCommits(octokit, username);
  const today = new Date().toISOString().split("T")[0];

  if (todaysCommits.size === 0) {
    emit("status", { message: "No commits found today" });
  }

  const userRepos = await db.select().from(repositories).where(eq(repositories.userId, userId));
  const repoMap = new Map(userRepos.map((r) => [r.fullName, r]));

  const existingRepoStats = await db.select().from(repoStats)
    .where(and(eq(repoStats.userId, userId), eq(repoStats.weekStart, today)));
  const existingStatsMap = new Map(existingRepoStats.map((s) => [s.repoId, s]));

  let totalAdd = 0, totalDel = 0, totalCommits = 0;
  let idx = 0;

  for (const [repoFullName, commits] of todaysCommits) {
    idx++;
    emit("repo", {
      name: repoFullName, index: idx, total: todaysCommits.size, commits: commits.length,
      message: `Fetching ${repoFullName} (${idx}/${todaysCommits.size})`,
    });

    const repo = repoMap.get(repoFullName);
    if (!repo) continue;

    let repoAdd = 0, repoDel = 0;
    for (const c of commits) { repoAdd += c.additions; repoDel += c.deletions; }

    totalAdd += repoAdd;
    totalDel += repoDel;
    totalCommits += commits.length;

    const repoRow = { additions: repoAdd, deletions: repoDel, commits: commits.length };

    if (existingStatsMap.has(repo.id)) {
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
