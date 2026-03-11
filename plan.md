# GHWars - GitHub Coding Competition Platform

## Overview

A real-time competitive coding platform where developers log in via GitHub OAuth, and their daily coding activity (lines added/deleted) across all repositories is tracked and ranked on a public leaderboard. Think of it as "GitHub Wrapped" meets daily competitive coding.

---

## Core Features

### 1. Authentication

- GitHub OAuth 2.0 login (NextAuth.js with GitHub provider)
- On first login: fetch user profile, avatar, username, public repos list
- Store user in DB with GitHub ID as primary key
- Scopes needed: `read:user`, `repo` (for private repo stats if desired)

### 2. Repository Tracking

- On login, sync all user repositories (public + optionally private)
- Store repo metadata: name, owner, language, last synced timestamp
- User can toggle repos on/off for tracking via a settings page
- Periodic re-sync to pick up new repos (cron job every 6 hours)

### 3. Daily Code Stats Collection

- **Method**: Use GitHub REST API - `GET /repos/{owner}/{repo}/stats/code_frequency`
  - Returns weekly additions/deletions per repo
  - For daily granularity: use commit-level stats via `GET /repos/{owner}/{repo}/commits` with `since`/`until` params, then sum `stats.additions` and `stats.deletions` per commit
- **Cron Job**: Runs daily at midnight UTC
  - For each tracked user → for each tracked repo → fetch commits from last 24h → sum additions & deletions
  - Store in `daily_stats` table: `{ userId, date, additions, deletions, netLines }`
- **Rate Limiting**: GitHub API = 5000 req/hour with token. Queue and batch requests. Use conditional requests (ETags) to reduce waste.

### 4. Leaderboard

- **Daily Leaderboard**: Top 100 users ranked by total additions for that day
- Secondary sort by net lines (additions - deletions)
- Shows: rank, avatar, username, additions, deletions, net, streak
- **Filters**: Today, This Week, This Month, All Time
- **Streak Counter**: Consecutive days with at least 1 commit tracked

### 5. User Profile Page

- GitHub avatar, username, bio
- Personal stats: total additions, deletions, net lines, active days, streak
- Daily activity chart (heatmap or bar chart, last 30 days)
- List of tracked repositories with per-repo stats

---

## Tech Stack

| Layer      | Choice                         |
| ---------- | ------------------------------ |
| Framework  | Next.js 15 (App Router)        |
| Auth       | NextAuth.js (GitHub Provider)  |
| Database   | PostgreSQL (via Neon/Supabase) |
| ORM        | Drizzle ORM                    |
| Styling    | Tailwind CSS + shadcn/ui       |
| Charts     | Recharts                       |
| Deployment | Vercel                         |
| API Client | Octokit (GitHub SDK)           |
