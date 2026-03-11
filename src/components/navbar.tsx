// Shared navigation bar for authenticated pages
// Shows logo, nav links, admin link, user dropdown

import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import UserMenu from "./user-menu";
import { logoFont } from "@/lib/fonts";

export default async function Navbar() {
  const session = await auth();
  if (!session?.user) return null;

  const user = session.user as {
    id: string;
    name?: string | null;
    image?: string | null;
    username?: string;
  };

  const [dbUser] = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  return (
    <nav className="flex items-center justify-between border-b border-border px-4 py-3 md:px-6">
      <div className="flex items-center gap-4 md:gap-6">
        <Link
          href="/dashboard"
          className={`${logoFont.className} text-xl tracking-tight`}
        >
          GHWars
        </Link>
        <div className="flex gap-2 text-sm text-muted-foreground md:gap-4">
          <Link href="/dashboard" className="hover:text-foreground">
            Dashboard
          </Link>
          <Link href="/leaderboard" className="hover:text-foreground">
            Leaderboard
          </Link>
          {dbUser?.isAdmin && (
            <Link href="/admin" className="hover:text-foreground">
              Admin
            </Link>
          )}
        </div>
      </div>
      <UserMenu
        name={user.name ?? user.username ?? "?"}
        image={user.image ?? undefined}
        username={user.username ?? ""}
      />
    </nav>
  );
}
