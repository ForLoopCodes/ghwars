// Top 100 leaderboard with period filters
// Ranks users by additions, commits, stars, PRs

import { db } from "@/db";
import { users, dailyStats } from "@/db/schema";
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

  const rankings = await db
    .select({
      userId: dailyStats.userId,
      username: users.username,
      avatarUrl: users.avatarUrl,
      totalAdditions: sql<number>`coalesce(sum(${dailyStats.additions}), 0)`.as(
        "total_additions",
      ),
      totalDeletions: sql<number>`coalesce(sum(${dailyStats.deletions}), 0)`.as(
        "total_deletions",
      ),
      totalCommits: sql<number>`coalesce(sum(${dailyStats.commits}), 0)`.as(
        "total_commits",
      ),
      totalStars: sql<number>`coalesce(sum(${dailyStats.newStars}), 0)`.as(
        "total_stars",
      ),
      prsRaised: sql<number>`coalesce(sum(${dailyStats.newPrsRaised}), 0)`.as(
        "prs_raised",
      ),
      prsMerged: sql<number>`coalesce(sum(${dailyStats.newPrsMerged}), 0)`.as(
        "prs_merged",
      ),
    })
    .from(dailyStats)
    .innerJoin(users, eq(dailyStats.userId, users.id))
    .where(gte(dailyStats.date, dateStr))
    .groupBy(dailyStats.userId, users.username, users.avatarUrl)
    .orderBy(desc(sql`sum(${dailyStats.additions})`))
    .limit(100);

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
          {rankings.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={8}
                className="py-8 text-center text-sm text-muted-foreground"
              >
                No data for this period
              </TableCell>
            </TableRow>
          )}
          {rankings.map((r, i) => (
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
                +{Number(r.totalAdditions).toLocaleString("en-US")}
              </TableCell>
              <TableCell className="text-right text-sm text-red-400">
                -{Number(r.totalDeletions).toLocaleString("en-US")}
              </TableCell>
              <TableCell className="text-right text-sm">
                {Number(r.totalCommits).toLocaleString("en-US")}
              </TableCell>
              <TableCell className="text-right text-sm text-yellow-400">
                {Number(r.totalStars).toLocaleString("en-US")}
              </TableCell>
              <TableCell className="text-right text-sm text-muted-foreground">
                {Number(r.prsRaised).toLocaleString("en-US")}
              </TableCell>
              <TableCell className="text-right text-sm text-muted-foreground">
                {Number(r.prsMerged).toLocaleString("en-US")}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
