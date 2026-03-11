// GHWars landing page with GitHub sign-in
// Split-screen layout with hero text and dither

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
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="grid w-full max-w-5xl grid-cols-2 gap-0 overflow-hidden rounded-2xl border border-border">
        <div className="flex flex-col justify-center p-12">
          <h1 className={`${logoFont.className} text-5xl tracking-tight`}>
            GHWars
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">vibemaxxing</p>
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
        <div className="relative min-h-125 overflow-hidden rounded-xl border-l border-border">
          <DitherBackground />
        </div>
      </div>
    </div>
  );
}
