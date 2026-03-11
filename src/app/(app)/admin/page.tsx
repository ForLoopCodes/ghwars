// Admin overview with platform-wide statistics
// Shows user count, repo count, activity metrics

import { db } from "@/db";
import {
  users,
  repositories,
  dailyStats,
  repoStats,
  adminLogs,
} from "@/db/schema";
import { sql, eq, desc, gte } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminOverview() {
  const today = new Date().toISOString().split("T")[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000)
    .toISOString()
    .split("T")[0];

  const [counts] = await db
    .select({
      totalUsers: sql<number>`count(distinct ${users.id})`,
      adminCount: sql<number>`count(distinct ${users.id}) filter (where ${users.isAdmin})`,
      bannedCount: sql<number>`count(distinct ${users.id}) filter (where ${users.isBanned})`,
    })
    .from(users);

  const [repoCounts] = await db
    .select({
      totalRepos: sql<number>`count(*)`,
      totalStars: sql<number>`coalesce(sum(${repositories.stars}), 0)`,
    })
    .from(repositories);

  const [todayActivity] = await db
    .select({
      additions: sql<number>`coalesce(sum(${dailyStats.additions}), 0)`,
      deletions: sql<number>`coalesce(sum(${dailyStats.deletions}), 0)`,
      commits: sql<number>`coalesce(sum(${dailyStats.commits}), 0)`,
    })
    .from(dailyStats)
    .where(eq(dailyStats.date, today));

  const [weekActivity] = await db
    .select({
      additions: sql<number>`coalesce(sum(${dailyStats.additions}), 0)`,
      deletions: sql<number>`coalesce(sum(${dailyStats.deletions}), 0)`,
      commits: sql<number>`coalesce(sum(${dailyStats.commits}), 0)`,
      activeUsers: sql<number>`count(distinct ${dailyStats.userId})`,
    })
    .from(dailyStats)
    .where(gte(dailyStats.date, weekAgo));

  const [allTimeActivity] = await db
    .select({
      additions: sql<number>`coalesce(sum(${dailyStats.additions}), 0)`,
      deletions: sql<number>`coalesce(sum(${dailyStats.deletions}), 0)`,
      commits: sql<number>`coalesce(sum(${dailyStats.commits}), 0)`,
    })
    .from(dailyStats);

  const recentLogs = await db
    .select({
      action: adminLogs.action,
      details: adminLogs.details,
      createdAt: adminLogs.createdAt,
      adminUsername: users.username,
    })
    .from(adminLogs)
    .innerJoin(users, eq(adminLogs.adminId, users.id))
    .orderBy(desc(adminLogs.createdAt))
    .limit(10);

  const topUsers = await db
    .select({
      username: users.username,
      totalCommits: sql<number>`coalesce(sum(${dailyStats.commits}), 0)`,
      totalAdditions: sql<number>`coalesce(sum(${dailyStats.additions}), 0)`,
    })
    .from(dailyStats)
    .innerJoin(users, eq(dailyStats.userId, users.id))
    .where(gte(dailyStats.date, weekAgo))
    .groupBy(users.id, users.username)
    .orderBy(desc(sql`sum(${dailyStats.commits})`))
    .limit(5);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <Stat
          label="Total Users"
          value={Number(counts.totalUsers).toLocaleString("en-US")}
        />
        <Stat label="Admins" value={String(counts.adminCount)} />
        <Stat label="Banned Users" value={String(counts.bannedCount)} />
        <Stat
          label="Total Repos"
          value={Number(repoCounts.totalRepos).toLocaleString("en-US")}
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Today</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              <span className="text-green-400">
                +{Number(todayActivity.additions).toLocaleString("en-US")}
              </span>{" "}
              /{" "}
              <span className="text-red-400">
                -{Number(todayActivity.deletions).toLocaleString("en-US")}
              </span>
            </p>
            <p className="text-muted-foreground">
              {Number(todayActivity.commits).toLocaleString("en-US")} commits
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">This Week</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              <span className="text-green-400">
                +{Number(weekActivity.additions).toLocaleString("en-US")}
              </span>{" "}
              /{" "}
              <span className="text-red-400">
                -{Number(weekActivity.deletions).toLocaleString("en-US")}
              </span>
            </p>
            <p className="text-muted-foreground">
              {Number(weekActivity.commits).toLocaleString("en-US")} commits,{" "}
              {Number(weekActivity.activeUsers)} active users
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">All Time</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              <span className="text-green-400">
                +{Number(allTimeActivity.additions).toLocaleString("en-US")}
              </span>{" "}
              /{" "}
              <span className="text-red-400">
                -{Number(allTimeActivity.deletions).toLocaleString("en-US")}
              </span>
            </p>
            <p className="text-muted-foreground">
              {Number(allTimeActivity.commits).toLocaleString("en-US")} commits,{" "}
              {Number(repoCounts.totalStars).toLocaleString("en-US")} total
              stars
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Top Users (7d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity</p>
            ) : (
              <div className="space-y-2">
                {topUsers.map((u, i) => (
                  <div
                    key={u.username}
                    className="flex items-center justify-between text-sm"
                  >
                    <span>
                      {i + 1}. {u.username}
                    </span>
                    <span className="text-muted-foreground">
                      {Number(u.totalCommits).toLocaleString("en-US")} commits,
                      +{Number(u.totalAdditions).toLocaleString("en-US")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Recent Admin Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent actions</p>
            ) : (
              <div className="space-y-2">
                {recentLogs.map((log, i) => (
                  <div key={i} className="text-sm">
                    <span className="text-muted-foreground">
                      {log.adminUsername}
                    </span>{" "}
                    <span>{log.action}</span>
                    {log.details && (
                      <span className="text-muted-foreground">
                        {" "}
                        - {log.details}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}
