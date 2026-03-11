// Public user profile page with stats
// Shows avatar, bio, activity chart, and totals

import { db } from "@/db";
import { users, dailyStats, repositories } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import StatsChart from "../../dashboard/chart";

export default async function Profile({
  params,
}: {
  params: Promise<{ user: string }>;
}) {
  const { user: username } = await params;

  const [profile] = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  if (!profile) notFound();

  const stats = await db
    .select()
    .from(dailyStats)
    .where(eq(dailyStats.userId, profile.id))
    .orderBy(desc(dailyStats.date))
    .limit(30);

  const repos = await db
    .select()
    .from(repositories)
    .where(eq(repositories.userId, profile.id));

  const totals = stats.reduce(
    (acc, s) => ({
      additions: acc.additions + s.additions,
      deletions: acc.deletions + s.deletions,
      commits: acc.commits + s.commits,
    }),
    { additions: 0, deletions: 0, commits: 0 },
  );

  return (
    <div>
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16">
          <AvatarImage src={profile.avatarUrl ?? undefined} />
          <AvatarFallback className="text-xl">
            {profile.username[0]}
          </AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-2xl font-bold">
            {profile.name ?? profile.username}
          </h1>
          <p className="text-sm text-muted-foreground">@{profile.username}</p>
          {profile.bio && (
            <p className="mt-1 text-sm text-muted-foreground">{profile.bio}</p>
          )}
        </div>
      </div>

      <Separator className="my-6" />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <Stat
          label="Additions (30d)"
          value={totals.additions.toLocaleString("en-US")}
        />
        <Stat
          label="Deletions (30d)"
          value={totals.deletions.toLocaleString("en-US")}
        />
        <Stat
          label="Commits (30d)"
          value={totals.commits.toLocaleString("en-US")}
        />
        <Stat
          label="Tracked Repos"
          value={String(repos.filter((r) => r.isTracked).length)}
        />
      </div>

      <Card className="mt-6">
        <CardContent className="pt-4">
          <p className="mb-2 text-xs text-muted-foreground">
            Activity (30 days)
          </p>
          <StatsChart
            data={stats.reverse().map((s) => ({
              date: s.date,
              additions: Number(s.additions),
              deletions: Number(s.deletions),
              newStars: 0,
              newPrsRaised: 0,
              newPrsMerged: 0,
            }))}
          />
        </CardContent>
      </Card>
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
