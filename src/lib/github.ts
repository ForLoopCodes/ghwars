// GitHub API helper for fetching commit stats
// Uses Octokit with search, statistics, and PR APIs

import { Octokit } from "octokit";

export function createOctokit(accessToken: string) {
  return new Octokit({ auth: accessToken });
}

export async function fetchUserRepos(octokit: Octokit) {
  const repos: Array<{ id: number; name: string; full_name: string; language: string | null; stargazers_count: number }> = [];
  let page = 1;

  while (true) {
    const { data } = await octokit.rest.repos.listForAuthenticatedUser({
      per_page: 100,
      page,
      sort: "pushed",
    });
    if (data.length === 0) break;
    repos.push(...data.map((r) => ({ id: r.id, name: r.name, full_name: r.full_name, language: r.language, stargazers_count: r.stargazers_count })));
    if (data.length < 100) break;
    page++;
  }

  return repos;
}

export async function fetchPRCounts(octokit: Octokit, username: string): Promise<{ raised: number; merged: number }> {
  try {
    const [raised, merged] = await Promise.all([
      octokit.rest.search.issuesAndPullRequests({ q: `type:pr author:${username}`, per_page: 1 }),
      octokit.rest.search.issuesAndPullRequests({ q: `type:pr author:${username} is:merged`, per_page: 1 }),
    ]);
    return { raised: raised.data.total_count, merged: merged.data.total_count };
  } catch {
    return { raised: 0, merged: 0 };
  }
}

export async function fetchTodaysCommits(
  octokit: Octokit,
  username: string,
): Promise<Map<string, Array<{ sha: string; additions: number; deletions: number }>>> {
  const today = new Date().toISOString().split("T")[0];
  const repoCommits = new Map<string, Array<{ sha: string; additions: number; deletions: number }>>();

  try {
    let page = 1;
    while (true) {
      const { data } = await octokit.rest.search.commits({
        q: `author:${username}+author-date:${today}`,
        per_page: 100,
        page,
      });

      for (const item of data.items) {
        const repoName = item.repository.full_name;
        const commits = repoCommits.get(repoName) ?? [];
        commits.push({ sha: item.sha, additions: 0, deletions: 0 });
        repoCommits.set(repoName, commits);
      }

      if (data.items.length < 100) break;
      page++;
    }

    for (const [repoName, commits] of repoCommits) {
      const [owner, repo] = repoName.split("/");
      for (const commit of commits) {
        try {
          const { data: detail } = await octokit.rest.repos.getCommit({ owner, repo, ref: commit.sha });
          commit.additions = detail.stats?.additions ?? 0;
          commit.deletions = detail.stats?.deletions ?? 0;
        } catch {
          continue;
        }
      }
    }
  } catch { }

  return repoCommits;
}

export async function fetchDailyCommits(
  octokit: Octokit,
  username: string,
  onProgress?: (fetched: number, total: number) => void,
): Promise<Map<string, Map<string, { additions: number; deletions: number; commits: number }>>> {
  const allCommits: Array<{ sha: string; date: string; repo: string }> = [];
  const seen = new Set<string>();
  const now = new Date();

  for (let i = 0; i < 12; i++) {
    const rangeEnd = new Date(now);
    rangeEnd.setMonth(rangeEnd.getMonth() - i);
    const rangeStart = new Date(now);
    rangeStart.setMonth(rangeStart.getMonth() - i - 1);
    rangeStart.setDate(rangeStart.getDate() + 1);

    let page = 1;
    while (true) {
      try {
        const { data } = await octokit.rest.search.commits({
          q: `author:${username} author-date:${rangeStart.toISOString().split("T")[0]}..${rangeEnd.toISOString().split("T")[0]}`,
          per_page: 100,
          page,
          sort: "author-date",
          order: "desc",
        });
        for (const item of data.items) {
          if (seen.has(item.sha)) continue;
          seen.add(item.sha);
          allCommits.push({
            sha: item.sha,
            date: (item.commit.author?.date ?? "").split("T")[0],
            repo: item.repository.full_name,
          });
        }
        if (data.items.length < 100) break;
        if (page >= 10) break;
        page++;
      } catch {
        break;
      }
    }
  }

  const result = new Map<string, Map<string, { additions: number; deletions: number; commits: number }>>();
  const batchSize = 20;
  let processed = 0;

  for (let i = 0; i < allCommits.length; i += batchSize) {
    const batch = allCommits.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(async (c) => {
        const [owner, repo] = c.repo.split("/");
        const { data: detail } = await octokit.rest.repos.getCommit({ owner, repo, ref: c.sha });
        return { ...c, additions: detail.stats?.additions ?? 0, deletions: detail.stats?.deletions ?? 0 };
      }),
    );

    for (const r of results) {
      if (r.status !== "fulfilled") continue;
      const { date, repo, additions, deletions } = r.value;
      if (!result.has(date)) result.set(date, new Map());
      const dateMap = result.get(date)!;
      const existing = dateMap.get(repo) ?? { additions: 0, deletions: 0, commits: 0 };
      existing.additions += additions;
      existing.deletions += deletions;
      existing.commits += 1;
      dateMap.set(repo, existing);
    }

    processed += batch.length;
    onProgress?.(processed, allCommits.length);
  }

  return result;
}

export async function fetchStarHistory(
  octokit: Octokit,
  repos: Array<{ fullName: string }>,
  onProgress?: (done: number, total: number) => void,
): Promise<Map<string, number>> {
  const starsByDate = new Map<string, number>();

  for (let i = 0; i < repos.length; i++) {
    const [owner, repo] = repos[i].fullName.split("/");
    let page = 1;

    while (true) {
      try {
        const { data } = await octokit.request("GET /repos/{owner}/{repo}/stargazers", {
          owner, repo, per_page: 100, page,
          headers: { accept: "application/vnd.github.star+json" },
        });
        const items = data as Array<{ starred_at: string }>;
        for (const s of items) {
          const date = s.starred_at.split("T")[0];
          starsByDate.set(date, (starsByDate.get(date) ?? 0) + 1);
        }
        if (items.length < 100) break;
        page++;
      } catch {
        break;
      }
    }

    onProgress?.(i + 1, repos.length);
  }

  return starsByDate;
}

export async function fetchPRHistory(
  octokit: Octokit,
  username: string,
): Promise<{ raised: Map<string, number>; merged: Map<string, number> }> {
  const raised = new Map<string, number>();
  const merged = new Map<string, number>();

  async function searchPRs(query: string, target: Map<string, number>, dateField: "created_at" | "closed_at") {
    let page = 1;
    while (true) {
      try {
        const { data } = await octokit.rest.search.issuesAndPullRequests({ q: query, per_page: 100, page, sort: "created", order: "desc" });
        for (const pr of data.items) {
          const raw = dateField === "created_at" ? pr.created_at : pr.closed_at;
          if (!raw) continue;
          const date = raw.split("T")[0];
          target.set(date, (target.get(date) ?? 0) + 1);
        }
        if (data.items.length < 100) break;
        if (page >= 10) break;
        page++;
      } catch {
        break;
      }
    }
  }

  await Promise.all([
    searchPRs(`type:pr author:${username}`, raised, "created_at"),
    searchPRs(`type:pr author:${username} is:merged`, merged, "closed_at"),
  ]);

  return { raised, merged };
}
