// Shared navigation bar for authenticated pages
// Shows logo, nav links, and user avatar

import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

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
      <div className="flex items-center gap-3">
        <Link href={`/profile/${user.username}`}>
          <Avatar className="h-7 w-7">
            <AvatarImage src={user.image ?? undefined} />
            <AvatarFallback className="text-xs">
              {user.name?.[0] ?? "?"}
            </AvatarFallback>
          </Avatar>
        </Link>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <Button
            variant="ghost"
            size="sm"
            type="submit"
            className="text-xs text-muted-foreground"
          >
            Sign out
          </Button>
        </form>
      </div>
    </nav>
  );
}
