// User dashboard showing personal coding stats
// Displays profile, activity, per-repo logs, charts

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { dailyStats, repositories, repoStats, users } from "@/db/schema";
import { eq, desc, sql, and, gte } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import StatsChart from "./chart";
import DashboardFilter from "./filter";
import SyncPanel from "./sync-panel";
import RepoList from "./repo-list";
import Image from "next/image";

function periodToDate(period: string): string | null {
  const d = new Date();
  if (period === "today") return d.toISOString().split("T")[0];
  if (period === "7d") { d.setDate(d.getDate() - 7); return d.toISOString().split("T")[0]; }
  if (period === "30d") { d.setDate(d.getDate() - 30); return d.toISOString().split("T")[0]; }
  if (period === "1y") { d.setFullYear(d.getFullYear() - 1); return d.toISOString().split("T")[0]; }
  return null;
}

const periodLabels: Record<string, string> = {
  today: "Today",
  "7d": "Last 7 Days",
  "30d": "Last 30 Days",
  "1y": "Last Year",
  lifetime: "Lifetime",
};

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ period?: string; sync?: string }> }) {
  const session = await auth();
  const userId = (session!.user as { id: string }).id;
  const params = await searchParams;
  const period = params.period || "today";
  const syncMode = params.sync as "incremental" | "full" | undefined;
  const fromDate = periodToDate(period);

  const dateFilter = period === "today"
    ? and(eq(dailyStats.userId, userId), eq(dailyStats.date, fromDate!))
    : fromDate
      ? and(eq(dailyStats.userId, userId), gte(dailyStats.date, fromDate))
      : eq(dailyStats.userId, userId);

  const repoDateFilter = period === "today"
    ? and(eq(repoStats.userId, userId), eq(repoStats.weekStart, fromDate!))
    : fromDate
      ? and(eq(repoStats.userId, userId), gte(repoStats.weekStart, fromDate))
      : eq(repoStats.userId, userId);

  const chartQuery = db
    .select({
      date: dailyStats.date,
      additions: sql<number>`coalesce(sum(${dailyStats.additions}), 0)`.as("additions"),
      deletions: sql<number>`coalesce(sum(${dailyStats.deletions}), 0)`.as("deletions"),
    })
    .from(dailyStats)
    .where(fromDate ? and(eq(dailyStats.userId, userId), gte(dailyStats.date, fromDate)) : eq(dailyStats.userId, userId))
    .groupBy(dailyStats.date)
    .orderBy(desc(dailyStats.date));

  const [profileRows, periodStats, chartStats, streakDates, repoLogs, starCountRows] = await Promise.all([
    db.select().from(users).where(eq(users.id, userId)).limit(1),
    db.select({
      additions: sql<number>`coalesce(sum(${dailyStats.additions}), 0)`,
      deletions: sql<number>`coalesce(sum(${dailyStats.deletions}), 0)`,
      commits: sql<number>`coalesce(sum(${dailyStats.commits}), 0)`,
    }).from(dailyStats).where(dateFilter),
    period === "lifetime"
      ? chartQuery
      : chartQuery.limit(period === "1y" ? 365 : period === "30d" ? 30 : period === "7d" ? 7 : 1),
    db.selectDistinct({ date: dailyStats.date }).from(dailyStats).where(eq(dailyStats.userId, userId)).orderBy(desc(dailyStats.date)).limit(365),
    db.select({
      repoName: repositories.fullName,
      language: repositories.language,
      stars: repositories.stars,
      totalAdditions: sql<number>`sum(${repoStats.additions})`.as("total_additions"),
      totalDeletions: sql<number>`sum(${repoStats.deletions})`.as("total_deletions"),
      totalCommits: sql<number>`sum(${repoStats.commits})`.as("total_commits"),
    }).from(repoStats)
      .innerJoin(repositories, eq(repoStats.repoId, repositories.id))
      .where(repoDateFilter)
      .groupBy(repositories.id, repositories.fullName, repositories.language, repositories.stars)
      .orderBy(desc(sql`sum(${repoStats.commits})`)),
    db.select({ total: sql<number>`coalesce(sum(${repositories.stars}), 0)` }).from(repositories).where(eq(repositories.userId, userId)),
  ]);

  const [profile] = profileRows;
  const streak = calculateStreak(streakDates.map((s) => s.date));
  const [starCount] = starCountRows;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {profile.avatarUrl && (
            <Image src={profile.avatarUrl} alt="" width={56} height={56} className="rounded-full border border-border" />
          )}
          <div>
            <h1 className="text-xl font-bold">{profile.name || profile.username}</h1>
            <p className="text-sm text-muted-foreground">@{profile.username}</p>
            {profile.bio && <p className="mt-0.5 max-w-md text-xs text-muted-foreground">{profile.bio}</p>}
          </div>
        </div>
      </div>

      {syncMode && <SyncPanel mode={syncMode} />}

      <div className="mt-4 flex items-center justify-between">
        <DashboardFilter current={period} />
      </div>

      <div className="mt-4 grid grid-cols-4 gap-4">
        <StatCard title="Additions" value={Number(periodStats[0].additions).toLocaleString("en-US")} sub={periodLabels[period] || period} />
        <StatCard title="Deletions" value={Number(periodStats[0].deletions).toLocaleString("en-US")} sub={periodLabels[period] || period} />
        <StatCard title="Commits" value={Number(periodStats[0].commits).toLocaleString("en-US")} sub={periodLabels[period] || period} />
        <StatCard title="Streak" value={`${streak}d`} sub="Consecutive days" />
        <StatCard title="Stars" value={Number(starCount.total).toLocaleString("en-US")} sub="Across all repos" />
        <StatCard title="PRs Raised" value={profile.prsRaised.toLocaleString("en-US")} sub="All time" />
        <StatCard title="PRs Merged" value={profile.prsMerged.toLocaleString("en-US")} sub="All time" />
        <StatCard title="Repos" value={String(repoLogs.length)} sub="With activity" />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Activity ({periodLabels[period] || period})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <StatsChart
            data={chartStats.reverse().map((s) => ({
              date: s.date,
              additions: s.additions,
              deletions: s.deletions,
            }))}
          />
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Repository Activity ({periodLabels[period] || period})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RepoList repos={repoLogs.map((r) => ({
            repoName: r.repoName,
            language: r.language,
            stars: r.stars,
            totalAdditions: Number(r.totalAdditions),
            totalDeletions: Number(r.totalDeletions),
            totalCommits: Number(r.totalCommits),
          }))} />
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  title,
  value,
  sub,
}: {
  title: string;
  value: string;
  sub: string;
}) {
  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-xs text-muted-foreground">{title}</p>
        <p className="mt-1 text-2xl font-bold">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}

function calculateStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < dates.length; i++) {
    const expected = new Date(today);
    expected.setDate(expected.getDate() - i);
    if (dates[i] === expected.toISOString().split("T")[0]) streak++;
    else break;
  }
  return streak;
}
