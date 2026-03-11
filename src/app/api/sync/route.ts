// API route for user-triggered data refresh
// Syncs repos and daily stats for current user

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { syncUserData } from "@/lib/sync";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const result = await syncUserData(session.user.id);
  return NextResponse.json(result);
}
