// Cron endpoint to sync user repositories
// Fetches repos from GitHub for all registered users

import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, accounts, repositories } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { createOctokit, fetchUserRepos } from "@/lib/github";

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const allUsers = await db.select().from(users);
  let synced = 0;

  for (const user of allUsers) {
    const [account] = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, user.id), eq(accounts.provider, "github")))
      .limit(1);

    if (!account?.accessToken) continue;

    const octokit = createOctokit(account.accessToken);
    const ghRepos = await fetchUserRepos(octokit);

    for (const repo of ghRepos) {
      const existing = await db
        .select()
        .from(repositories)
        .where(eq(repositories.githubRepoId, repo.id))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(repositories).values({
          userId: user.id,
          githubRepoId: repo.id,
          name: repo.name,
          fullName: repo.full_name,
          language: repo.language,
        });
      } else {
        await db.update(repositories).set({
          name: repo.name,
          fullName: repo.full_name,
          language: repo.language,
        }).where(eq(repositories.githubRepoId, repo.id));
      }
    }

    await db.update(users).set({ lastSyncedAt: new Date() }).where(eq(users.id, user.id));
    synced++;
  }

  return NextResponse.json({ synced });
}
