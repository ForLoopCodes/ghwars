// User dashboard showing personal coding stats
// Displays today's activity, per-repo logs, charts

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { dailyStats, repositories, repoStats } from "@/db/schema";
import { eq, desc, sql, and } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import StatsChart from "./chart";
import RefreshButton from "./refresh";

export default async function Dashboard() {
  const session = await auth();
  const user = session!.user as { id: string; username?: string };

  const today = new Date().toISOString().split("T")[0];

  const [todayStats] = await db
    .select()
    .from(dailyStats)
    .where(and(eq(dailyStats.userId, user.id), eq(dailyStats.date, today)))
    .limit(1);

  const stats = await db
    .select()
    .from(dailyStats)
    .where(eq(dailyStats.userId, user.id))
    .orderBy(desc(dailyStats.date))
    .limit(30);

  const streak = calculateStreak(stats.map((s) => s.date));

  const repoLogs = await db
    .select({
      repoName: repositories.fullName,
      language: repositories.language,
      totalAdditions: sql<number>`sum(${repoStats.additions})`.as("total_additions"),
      totalDeletions: sql<number>`sum(${repoStats.deletions})`.as("total_deletions"),
      totalCommits: sql<number>`sum(${repoStats.commits})`.as("total_commits"),
    })
    .from(repoStats)
    .innerJoin(repositories, eq(repoStats.repoId, repositories.id))
    .where(and(eq(repoStats.userId, user.id), eq(repoStats.weekStart, today)))
    .groupBy(repositories.id, repositories.fullName, repositories.language)
    .orderBy(desc(sql`sum(${repoStats.commits})`));

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">@{user.username}</p>
        </div>
        <RefreshButton />
      </div>

      <div className="mt-6 grid grid-cols-4 gap-4">
        <StatCard
          title="Additions"
          value={(todayStats?.additions ?? 0).toLocaleString()}
          sub="Today"
        />
        <StatCard
          title="Deletions"
          value={(todayStats?.deletions ?? 0).toLocaleString()}
          sub="Today"
        />
        <StatCard
          title="Commits"
          value={(todayStats?.commits ?? 0).toLocaleString()}
          sub="Today"
        />
        <StatCard title="Streak" value={`${streak}d`} sub="Consecutive days" />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Daily Activity (30 days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <StatsChart
            data={stats.reverse().map((s) => ({
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
            Today&apos;s Repository Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {repoLogs.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No repo data yet — click Refresh Data
            </p>
          ) : (
            <div className="space-y-3">
              {repoLogs.map((repo) => (
                <div key={repo.repoName} className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0">
                  <div>
                    <p className="text-sm font-medium">{repo.repoName}</p>
                    {repo.language && (
                      <p className="text-xs text-muted-foreground">{repo.language}</p>
                    )}
                  </div>
                  <div className="flex gap-6 text-right">
                    <div>
                      <p className="text-sm font-bold text-green-400">+{Number(repo.totalAdditions).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">added</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-red-400">-{Number(repo.totalDeletions).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">deleted</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold">{Number(repo.totalCommits).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">commits</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
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
