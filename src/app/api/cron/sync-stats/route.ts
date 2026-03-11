// Cron endpoint to sync daily commit stats
// Calls syncUserData for all registered users

import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { syncUserData } from "@/lib/sync";

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const allUsers = await db.select().from(users);
  let synced = 0;

  for (const user of allUsers) {
    await syncUserData(user.id);
    synced++;
  }

  return NextResponse.json({ synced });
}
