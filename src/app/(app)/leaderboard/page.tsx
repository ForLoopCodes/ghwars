// Top 100 leaderboard with period filters
// Ranks users by additions, commits, stars, PRs

import { db } from "@/db";
import { users, dailyStats, repositories } from "@/db/schema";
import { eq, desc, sql, gte } from "drizzle-orm";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import PeriodFilter from "./filter";

type Period = "today" | "week" | "month" | "alltime";

function dateThreshold(period: Period): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  if (period === "today") return now;
  if (period === "week") return new Date(now.setDate(now.getDate() - 7));
  if (period === "month") return new Date(now.setDate(now.getDate() - 30));
  return new Date("2020-01-01");
}

export default async function Leaderboard({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const params = await searchParams;
  const period = (
    ["today", "week", "month", "alltime"].includes(params.period ?? "")
      ? params.period
      : "today"
  ) as Period;
  const threshold = dateThreshold(period);

  const dateStr = threshold.toISOString().split("T")[0];

  const [rankings, starsByUser, latestSnapshots, earliestSnapshots] = await Promise.all([
    db
      .select({
        userId: dailyStats.userId,
        username: users.username,
        avatarUrl: users.avatarUrl,
        totalAdditions: sql<number>`sum(${dailyStats.additions})`.as("total_additions"),
        totalDeletions: sql<number>`sum(${dailyStats.deletions})`.as("total_deletions"),
        totalCommits: sql<number>`sum(${dailyStats.commits})`.as("total_commits"),
      })
      .from(dailyStats)
      .innerJoin(users, eq(dailyStats.userId, users.id))
      .where(gte(dailyStats.date, dateStr))
      .groupBy(dailyStats.userId, users.username, users.avatarUrl)
      .orderBy(desc(sql`sum(${dailyStats.additions})`))
      .limit(100),
    db
      .select({
        userId: repositories.userId,
        totalStars: sql<number>`coalesce(sum(${repositories.stars}), 0)`.as("total_stars"),
      })
      .from(repositories)
      .groupBy(repositories.userId),
    db.execute(sql`
      SELECT DISTINCT ON (user_id) user_id, total_stars, total_prs_raised, total_prs_merged
      FROM daily_stats WHERE date >= ${dateStr}
      ORDER BY user_id, date DESC
    `),
    db.execute(sql`
      SELECT DISTINCT ON (user_id) user_id, total_stars, total_prs_raised, total_prs_merged
      FROM daily_stats WHERE date >= ${dateStr}
      ORDER BY user_id, date ASC
    `),
  ]);

  const starsMap = new Map(starsByUser.map((s) => [s.userId, Number(s.totalStars)]));
  type Snapshot = { user_id: string; total_stars: number; total_prs_raised: number; total_prs_merged: number };
  const latestMap = new Map((latestSnapshots as unknown as Snapshot[]).map((s) => [s.user_id, s]));
  const earliestMap = new Map((earliestSnapshots as unknown as Snapshot[]).map((s) => [s.user_id, s]));

  const rankedWithStars = rankings.map((r) => {
    const latest = latestMap.get(r.userId);
    const earliest = earliestMap.get(r.userId);
    const hasSnapshots = latest && earliest && (latest.total_stars > 0 || latest.total_prs_raised > 0);
    return {
      ...r,
      totalStars: hasSnapshots ? Number(latest.total_stars) - Number(earliest.total_stars) : starsMap.get(r.userId) ?? 0,
      prsRaised: hasSnapshots ? Number(latest.total_prs_raised) - Number(earliest.total_prs_raised) : 0,
      prsMerged: hasSnapshots ? Number(latest.total_prs_merged) - Number(earliest.total_prs_merged) : 0,
    };
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Leaderboard</h1>
        <PeriodFilter current={period} />
      </div>

      <Table className="mt-6">
        <TableHeader>
          <TableRow>
            <TableHead className="w-12 text-xs">#</TableHead>
            <TableHead className="text-xs">Developer</TableHead>
            <TableHead className="text-right text-xs">Additions</TableHead>
            <TableHead className="text-right text-xs">Deletions</TableHead>
            <TableHead className="text-right text-xs">Commits</TableHead>
            <TableHead className="text-right text-xs">Stars</TableHead>
            <TableHead className="text-right text-xs">PRs</TableHead>
            <TableHead className="text-right text-xs">Merged</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rankedWithStars.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={8}
                className="py-8 text-center text-sm text-muted-foreground"
              >
                No data for this period
              </TableCell>
            </TableRow>
          )}
          {rankedWithStars.map((r, i) => (
            <TableRow key={r.userId}>
              <TableCell className="text-sm font-medium">
                {i < 3 ? (
                  <Badge variant="secondary" className="text-xs">
                    {i + 1}
                  </Badge>
                ) : (
                  i + 1
                )}
              </TableCell>
              <TableCell>
                <Link
                  href={`/profile/${r.username}`}
                  className="flex items-center gap-2 hover:underline"
                >
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={r.avatarUrl ?? undefined} />
                    <AvatarFallback className="text-xs">
                      {r.username[0]}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{r.username}</span>
                </Link>
              </TableCell>
              <TableCell className="text-right text-sm text-green-400">
                +{r.totalAdditions.toLocaleString("en-US")}
              </TableCell>
              <TableCell className="text-right text-sm text-red-400">
                -{r.totalDeletions.toLocaleString("en-US")}
              </TableCell>
              <TableCell className="text-right text-sm">
                {r.totalCommits.toLocaleString("en-US")}
              </TableCell>
              <TableCell className="text-right text-sm text-yellow-400">
                {r.totalStars.toLocaleString("en-US")}
              </TableCell>
              <TableCell className="text-right text-sm text-muted-foreground">
                {r.prsRaised.toLocaleString("en-US")}
              </TableCell>
              <TableCell className="text-right text-sm text-muted-foreground">
                {r.prsMerged.toLocaleString("en-US")}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
