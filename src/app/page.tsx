// GHWars landing page with GitHub sign-in
// Shows hero section with dithered wave background

import { signIn, auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { logoFont } from "@/lib/fonts";
import DitherBackground from "@/components/dither-bg";

export default async function Landing() {
  try {
    const session = await auth();
    if (session?.user) redirect("/dashboard");
  } catch {}

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-6">
      <DitherBackground />
      <div className="max-w-2xl text-center">
        <h1 className={`${logoFont.className} text-5xl tracking-tight`}>GHWars</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Compete with developers worldwide. Every line of code counts.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in with GitHub to track your daily additions, deletions, and
          climb the top 100 leaderboard.
        </p>
        <form
          action={async () => {
            "use server";
            await signIn("github", { redirectTo: "/dashboard" });
          }}
        >
          <Button
            type="submit"
            size="lg"
            className="mt-8 text-base font-semibold"
          >
            Sign in with GitHub
          </Button>
        </form>
      </div>

      <div className="mt-16 grid max-w-3xl grid-cols-3 gap-8 text-center">
        <div>
          <p className="text-3xl font-bold">24h</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Daily tracking cycle
          </p>
        </div>
        <div>
          <p className="text-3xl font-bold">Top 100</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Leaderboard spots
          </p>
        </div>
        <div>
          <p className="text-3xl font-bold">All Repos</p>
          <p className="mt-1 text-xs text-muted-foreground">Public & private</p>
        </div>
      </div>
    </div>
  );
}
