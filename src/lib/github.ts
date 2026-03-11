// GitHub API helper for fetching commit stats
// Uses Octokit with user access tokens

import { Octokit } from "octokit";

export function createOctokit(accessToken: string) {
  return new Octokit({ auth: accessToken });
}

export async function fetchUserRepos(octokit: Octokit) {
  const repos: Array<{ id: number; name: string; full_name: string; language: string | null }> = [];
  let page = 1;

  while (true) {
    const { data } = await octokit.rest.repos.listForAuthenticatedUser({
      per_page: 100,
      page,
      sort: "pushed",
    });
    if (data.length === 0) break;
    repos.push(...data.map((r) => ({ id: r.id, name: r.name, full_name: r.full_name, language: r.language })));
    if (data.length < 100) break;
    page++;
  }

  return repos;
}

export async function fetchCommitStatsGrouped(
  octokit: Octokit,
  owner: string,
  repo: string,
  author: string,
  since: string,
): Promise<Map<string, { additions: number; deletions: number; commits: number }>> {
  const grouped = new Map<string, { additions: number; deletions: number; commits: number }>();

  try {
    let page = 1;
    const allCommits: Array<{ sha: string; date: string }> = [];

    while (true) {
      const { data } = await octokit.rest.repos.listCommits({
        owner, repo, author, since, per_page: 100, page,
      });
      if (data.length === 0) break;
      for (const c of data) {
        const date = c.commit.author?.date?.split("T")[0];
        if (date) allCommits.push({ sha: c.sha, date });
      }
      if (data.length < 100) break;
      page++;
    }

    for (const { sha, date } of allCommits) {
      try {
        const { data: detail } = await octokit.rest.repos.getCommit({ owner, repo, ref: sha });
        const entry = grouped.get(date) ?? { additions: 0, deletions: 0, commits: 0 };
        entry.additions += detail.stats?.additions ?? 0;
        entry.deletions += detail.stats?.deletions ?? 0;
        entry.commits += 1;
        grouped.set(date, entry);
      } catch {
        continue;
      }
    }
  } catch {
    // repo access error — skip
  }

  return grouped;
}
