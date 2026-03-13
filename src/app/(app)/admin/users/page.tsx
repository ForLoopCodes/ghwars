// Admin user management page
// Lists all users with ban, promote, delete actions

import { db } from "@/db";
import { users, dailyStats, repositories } from "@/db/schema";
import { desc, sql, ilike } from "drizzle-orm";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  banUser,
  unbanUser,
  promoteUser,
  demoteUser,
  deleteUser,
  grantAdminByUsername,
  revokeAdminByUsername,
} from "../actions";

export default async function AdminUsers({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim();

  const allUsers = await db
    .select({
      id: users.id,
      username: users.username,
      name: users.name,
      avatarUrl: users.avatarUrl,
      email: users.email,
      isAdmin: users.isAdmin,
      isBanned: users.isBanned,
      banReason: users.banReason,
      prsRaised: users.prsRaised,
      prsMerged: users.prsMerged,
      createdAt: users.createdAt,
      lastSyncedAt: users.lastSyncedAt,
      totalCommits: sql<number>`coalesce((select sum(${dailyStats.commits}) from ${dailyStats} where ${dailyStats.userId} = ${users.id}), 0)`,
      totalAdditions: sql<number>`coalesce((select sum(${dailyStats.additions}) from ${dailyStats} where ${dailyStats.userId} = ${users.id}), 0)`,
      repoCount: sql<number>`(select count(*) from ${repositories} where ${repositories.userId} = ${users.id})`,
      totalStars: sql<number>`coalesce((select sum(${repositories.stars}) from ${repositories} where ${repositories.userId} = ${users.id}), 0)`,
    })
    .from(users)
    .where(query ? ilike(users.username, `%${query}%`) : undefined)
    .orderBy(desc(users.createdAt))
    .limit(100);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Grant / Revoke Admin
          </CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <form action={grantAdminByUsername} className="flex gap-2">
            <input
              name="username"
              placeholder="GitHub username"
              className="rounded border border-border bg-background px-3 py-1.5 text-sm"
              required
            />
            <Button type="submit" size="sm" variant="default">
              Grant Admin
            </Button>
          </form>
          <form action={revokeAdminByUsername} className="flex gap-2">
            <input
              name="username"
              placeholder="GitHub username"
              className="rounded border border-border bg-background px-3 py-1.5 text-sm"
              required
            />
            <Button type="submit" size="sm" variant="secondary">
              Revoke Admin
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">
              Users ({allUsers.length})
            </CardTitle>
            <form method="get" className="flex gap-2">
              <input
                name="q"
                defaultValue={query}
                placeholder="Search username..."
                className="rounded border border-border bg-background px-3 py-1.5 text-sm"
              />
              <Button type="submit" size="sm" variant="secondary">
                Search
              </Button>
            </form>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {allUsers.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={u.avatarUrl ?? undefined} />
                    <AvatarFallback className="text-xs">
                      {u.username[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{u.username}</span>
                      {u.isAdmin && (
                        <Badge variant="secondary" className="text-xs">
                          Admin
                        </Badge>
                      )}
                      {u.isBanned && (
                        <Badge variant="destructive" className="text-xs">
                          Banned
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      <span>{Number(u.repoCount)} repos</span>
                      <span>{Number(u.totalStars)} stars</span>
                      <span>
                        {Number(u.totalCommits).toLocaleString("en-US")} commits
                      </span>
                      <span className="text-green-400">
                        +{Number(u.totalAdditions).toLocaleString("en-US")}
                      </span>
                      <span>{u.prsRaised} PRs raised</span>
                      <span>{u.prsMerged} PRs merged</span>
                      <span>Joined {u.createdAt.toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  {u.isBanned ? (
                    <form action={unbanUser}>
                      <input type="hidden" name="userId" value={u.id} />
                      <Button
                        type="submit"
                        size="sm"
                        variant="secondary"
                        className="text-xs"
                      >
                        Unban
                      </Button>
                    </form>
                  ) : (
                    <form action={banUser} className="flex gap-1">
                      <input type="hidden" name="userId" value={u.id} />
                      <input
                        name="reason"
                        placeholder="Reason"
                        className="w-24 rounded border border-border bg-background px-2 py-1 text-xs"
                      />
                      <Button
                        type="submit"
                        size="sm"
                        variant="destructive"
                        className="text-xs"
                      >
                        Ban
                      </Button>
                    </form>
                  )}
                  {u.isAdmin ? (
                    <form action={demoteUser}>
                      <input type="hidden" name="userId" value={u.id} />
                      <Button
                        type="submit"
                        size="sm"
                        variant="secondary"
                        className="text-xs"
                      >
                        Demote
                      </Button>
                    </form>
                  ) : (
                    <form action={promoteUser}>
                      <input type="hidden" name="userId" value={u.id} />
                      <Button
                        type="submit"
                        size="sm"
                        variant="secondary"
                        className="text-xs"
                      >
                        Promote
                      </Button>
                    </form>
                  )}
                  <form action={deleteUser}>
                    <input type="hidden" name="userId" value={u.id} />
                    <Button
                      type="submit"
                      size="sm"
                      variant="destructive"
                      className="text-xs"
                    >
                      Delete
                    </Button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
