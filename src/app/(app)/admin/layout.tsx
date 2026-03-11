// Admin layout with permission guard
// Redirects non-admin users to dashboard

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  if (!user?.isAdmin) redirect("/dashboard");

  return (
    <div>
      <div className="mb-6 flex items-center gap-4 border-b border-border pb-4">
        <h1 className="text-xl font-bold">Admin Panel</h1>
        <nav className="flex gap-4 text-sm text-muted-foreground">
          <a href="/admin" className="hover:text-foreground">
            Overview
          </a>
          <a href="/admin/users" className="hover:text-foreground">
            Users
          </a>
          <a href="/admin/logs" className="hover:text-foreground">
            Logs
          </a>
        </nav>
      </div>
      {children}
    </div>
  );
}
