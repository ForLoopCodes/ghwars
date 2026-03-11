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

export async function fetchDailyCommitStats(
  octokit: Octokit,
  owner: string,
  repo: string,
  since: string,
  until: string
): Promise<{ additions: number; deletions: number; commits: number }> {
  try {
    const { data: commits } = await octokit.rest.repos.listCommits({
      owner,
      repo,
      since,
      until,
      per_page: 100,
    });

    let additions = 0, deletions = 0;

    for (const commit of commits) {
      try {
        const { data: detail } = await octokit.rest.repos.getCommit({
          owner,
          repo,
          ref: commit.sha,
        });
        additions += detail.stats?.additions ?? 0;
        deletions += detail.stats?.deletions ?? 0;
      } catch {
        continue;
      }
    }

    return { additions, deletions, commits: commits.length };
  } catch {
    return { additions: 0, deletions: 0, commits: 0 };
  }
}
