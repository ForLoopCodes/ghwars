// NextAuth configuration with GitHub OAuth
// Stores user data in PostgreSQL via Drizzle

import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { db } from "@/db";
import { users, accounts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { syncUserData } from "./sync";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID!,
      clientSecret: process.env.AUTH_GITHUB_SECRET!,
      authorization: { params: { scope: "read:user repo" } },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!account || !profile) return false;
      const ghProfile = profile as unknown as { id: number; login: string; avatar_url: string; bio: string };

      const existing = await db.select().from(users).where(eq(users.githubId, ghProfile.id)).limit(1);

      if (existing.length === 0) {
        const [newUser] = await db.insert(users).values({
          githubId: ghProfile.id,
          username: ghProfile.login,
          name: user.name ?? ghProfile.login,
          avatarUrl: ghProfile.avatar_url,
          bio: ghProfile.bio ?? null,
          email: user.email ?? null,
        }).returning();

        await db.insert(accounts).values({
          userId: newUser.id,
          provider: account.provider,
          providerAccountId: account.providerAccountId,
          accessToken: account.access_token ?? null,
          refreshToken: account.refresh_token ?? null,
          expiresAt: account.expires_at ?? null,
          tokenType: account.token_type ?? null,
          scope: account.scope ?? null,
        });

        syncUserData(newUser.id, "full").catch(() => { });
      } else {
        await db.update(users).set({
          avatarUrl: ghProfile.avatar_url,
          name: user.name ?? ghProfile.login,
          bio: ghProfile.bio ?? null,
        }).where(eq(users.githubId, ghProfile.id));

        await db.update(accounts).set({
          accessToken: account.access_token ?? null,
          refreshToken: account.refresh_token ?? null,
          expiresAt: account.expires_at ?? null,
        }).where(eq(accounts.providerAccountId, account.providerAccountId));
      }

      return true;
    },
    async session({ session, token }) {
      if (token.sub) {
        const [dbUser] = await db.select().from(users).where(eq(users.githubId, parseInt(token.sub))).limit(1);
        if (dbUser) {
          session.user.id = dbUser.id;
          session.user.image = dbUser.avatarUrl;
          (session.user as unknown as Record<string, unknown>).username = dbUser.username;
        }
      }
      return session;
    },
    async jwt({ token, profile }) {
      if (profile) token.sub = String((profile as unknown as { id: number }).id);
      return token;
    },
  },
  pages: { signIn: "/" },
  session: { strategy: "jwt" },
});
