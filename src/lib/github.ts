// GitHub API helper for fetching commit stats
// Uses Octokit with search, GraphQL, and PR APIs

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

    const nodeIds = Array.from(repoCommits.values()).flat().map((_, i, arr) => arr[i]);
    const allShas: string[] = [];
    const shaToCommit = new Map<string, { additions: number; deletions: number }>();

    for (const commits of repoCommits.values()) {
      for (const c of commits) allShas.push(c.sha);
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

export async function fetchYearlyCommits(
  octokit: Octokit,
  username: string,
): Promise<Array<{ nodeId: string; date: string; repo: string }>> {
  const now = new Date();
  const yearAgo = new Date(now);
  yearAgo.setFullYear(yearAgo.getFullYear() - 1);

  const commits: Array<{ nodeId: string; date: string; repo: string }> = [];
  const seen = new Set<string>();
  let page = 1;

  while (true) {
    try {
      const { data } = await octokit.rest.search.commits({
        q: `author:${username} author-date:${yearAgo.toISOString().split("T")[0]}..${now.toISOString().split("T")[0]}`,
        per_page: 100,
        page,
      });
      for (const item of data.items) {
        if (seen.has(item.node_id)) continue;
        seen.add(item.node_id);
        commits.push({
          nodeId: item.node_id,
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

  return commits;
}

export async function fetchCommitStatsGQL(
  octokit: Octokit,
  nodeIds: string[],
): Promise<Map<string, { additions: number; deletions: number }>> {
  const result = new Map<string, { additions: number; deletions: number }>();
  const batchSize = 50;

  for (let i = 0; i < nodeIds.length; i += batchSize) {
    const batch = nodeIds.slice(i, i + batchSize);
    const fields = batch.map((id, idx) =>
      `c${idx}: node(id: "${id}") { ... on Commit { additions deletions } }`
    ).join("\n");

    try {
      const data: Record<string, { additions?: number; deletions?: number } | null> = await octokit.graphql(`{ ${fields} }`);
      for (let j = 0; j < batch.length; j++) {
        const node = data[`c${j}`];
        if (node) result.set(batch[j], { additions: node.additions ?? 0, deletions: node.deletions ?? 0 });
      }
    } catch {
      continue;
    }
  }

  return result;
}

export async function fetchStarHistory(
  octokit: Octokit,
  repos: Array<{ fullName: string }>,
): Promise<Map<string, number>> {
  const starsByDate = new Map<string, number>();

  for (const repo of repos) {
    const [owner, name] = repo.fullName.split("/");
    try {
      let page = 1;
      while (true) {
        const { data } = await octokit.request("GET /repos/{owner}/{repo}/stargazers", {
          owner, repo: name, per_page: 100, page,
          headers: { accept: "application/vnd.github.star+json" },
        });
        for (const s of data as unknown as Array<{ starred_at: string }>) {
          const date = s.starred_at.split("T")[0];
          starsByDate.set(date, (starsByDate.get(date) ?? 0) + 1);
        }
        if ((data as unknown[]).length < 100) break;
        page++;
      }
    } catch { continue; }
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
