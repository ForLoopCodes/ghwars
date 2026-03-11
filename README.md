# GHWars

Competitive GitHub coding platform. Developers sign in via GitHub, sync their daily coding stats, and climb a live leaderboard ranked by code output.

## Stack

- **Next.js 16** — App Router, TypeScript, Turbopack
- **PostgreSQL** — Drizzle ORM
- **NextAuth v5** — GitHub OAuth
- **Octokit** — GitHub REST + GraphQL API
- **Recharts** — Activity charts
- **Tailwind CSS 4 + shadcn/ui** — Dark theme, Geist Mono font

## Features

- **Dashboard** — Personal stats (additions, deletions, commits, stars, PRs) with period filters (today, 7d, 30d, 1y, lifetime), activity chart, daily/weekly breakdown table, per-repo list
- **Leaderboard** — Top 100 developers ranked by net lines, with period-scoped deltas
- **Profiles** — Public user pages with coding history
- **Sync** — Incremental (today) and full (yearly) modes using GitHub Search + GraphQL batching (~25 API calls per full sync)
- **Admin** — User management, ban system, audit logs
- **Cron** — Automated repo and stats sync

## Setup

```bash
git clone https://github.com/ForLoopCodes/ghwars.git
cd ghwars
bun install
```

Create `.env`:

```
DATABASE_URL=postgresql://user:pass@host:5432/dbname
AUTH_SECRET=<openssl rand -base64 32>
AUTH_GITHUB_ID=<github oauth client id>
AUTH_GITHUB_SECRET=<github oauth client secret>
NEXTAUTH_URL=http://localhost:6767
CRON_SECRET=<random secret>
```

Push schema and run:

```bash
bun run db:push
bun run dev
```

Open [localhost:6767](http://localhost:6767).

## Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Dev server (port 6767) |
| `bun run build` | Production build |
| `bun run start` | Production server |
| `bun run db:push` | Push schema to DB |
| `bun run db:studio` | Drizzle Studio GUI |

## Structure

```
src/
├── app/
│   ├── (app)/           # Authenticated pages
│   │   ├── admin/       # Admin panel
│   │   ├── dashboard/   # Stats, chart, sync
│   │   ├── leaderboard/ # Top 100
│   │   └── profile/     # User profiles
│   ├── api/             # Auth, sync, cron, leaderboard
│   └── page.tsx         # Landing page
├── components/          # Navbar, user menu, shadcn/ui
├── db/                  # Schema, Drizzle instance
└── lib/                 # Auth, GitHub API, sync logic
```
