// Shared navigation bar for authenticated pages
// Shows logo, nav links, and user dropdown menu

import Link from "next/link";
import { auth } from "@/lib/auth";
import UserMenu from "./user-menu";

export default async function Navbar() {
  const session = await auth();
  if (!session?.user) return null;

  const user = session.user as {
    name?: string | null;
    image?: string | null;
    username?: string;
  };

  return (
    <nav className="flex items-center justify-between border-b border-border px-6 py-3">
      <div className="flex items-center gap-6">
        <Link href="/dashboard" className="text-lg font-bold tracking-tight">
          GHWars
        </Link>
        <div className="flex gap-4 text-sm text-muted-foreground">
          <Link href="/dashboard" className="hover:text-foreground">
            Dashboard
          </Link>
          <Link href="/leaderboard" className="hover:text-foreground">
            Leaderboard
          </Link>
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
