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
