// User dashboard showing personal coding stats
// Displays daily additions, deletions, streak, chart

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { users, dailyStats } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import StatsChart from "./chart";
import RefreshButton from "./refresh";

export default async function Dashboard() {
  const session = await auth();
  const user = session!.user as { id: string; username?: string };

  const stats = await db
    .select()
    .from(dailyStats)
    .where(eq(dailyStats.userId, user.id))
    .orderBy(desc(dailyStats.date))
    .limit(30);

  const totals = stats.reduce(
    (acc, s) => ({
      additions: acc.additions + s.additions,
      deletions: acc.deletions + s.deletions,
      commits: acc.commits + s.commits,
    }),
    { additions: 0, deletions: 0, commits: 0 },
  );

  const streak = calculateStreak(stats.map((s) => s.date));

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
          value={totals.additions.toLocaleString()}
          sub="Last 30 days"
        />
        <StatCard
          title="Deletions"
          value={totals.deletions.toLocaleString()}
          sub="Last 30 days"
        />
        <StatCard
          title="Commits"
          value={totals.commits.toLocaleString()}
          sub="Last 30 days"
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
