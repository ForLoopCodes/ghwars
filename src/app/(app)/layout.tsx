// Dashboard layout wrapping authenticated pages
// Includes navbar, auth guard, and ban check

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import Navbar from "@/components/navbar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let session;
  try {
    session = await auth();
  } catch {
    redirect("/");
  }
  if (!session?.user) redirect("/");

  const [user] = await db
    .select({ isBanned: users.isBanned, banReason: users.banReason })
    .from(users)
    .where(eq(users.id, session.user.id!))
    .limit(1);

  if (user?.isBanned) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Account Suspended</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {user.banReason || "Your account has been suspended"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
