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

export async function fetchRepoWeeklyStats(
  octokit: Octokit,
  owner: string,
  repo: string,
  githubUserId: number,
): Promise<Array<{ weekStart: string; additions: number; deletions: number; commits: number }>> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { data, status } = await octokit.rest.repos.getContributorsStats({ owner, repo });
      if (status === 202) {
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      if (!Array.isArray(data)) return [];

      const contributor = data.find((c) => c.author?.id === githubUserId);
      if (!contributor) return [];

      return contributor.weeks
        .filter((w) => (w.a ?? 0) > 0 || (w.d ?? 0) > 0 || (w.c ?? 0) > 0)
        .map((w) => ({
          weekStart: new Date((w.w ?? 0) * 1000).toISOString().split("T")[0],
          additions: w.a ?? 0,
          deletions: w.d ?? 0,
          commits: w.c ?? 0,
        }));
    } catch {
      return [];
    }
  }
  return [];
}
