// Sortable repository activity list for dashboard
// Supports sorting by name, additions, deletions, commits

"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";

type Repo = {
  repoName: string;
  language: string | null;
  stars: number;
  totalAdditions: number;
  totalDeletions: number;
  totalCommits: number;
};

const sortOptions = [
  { key: "commits", label: "Commits" },
  { key: "additions", label: "Additions" },
  { key: "deletions", label: "Deletions" },
  { key: "stars", label: "Stars" },
  { key: "name", label: "Name" },
] as const;

type SortKey = typeof sortOptions[number]["key"];

export default function RepoList({ repos }: { repos: Repo[] }) {
  const [sortBy, setSortBy] = useState<SortKey>("commits");
  const [asc, setAsc] = useState(false);

  const sorted = useMemo(() => [...repos].sort((a, b) => {
    let cmp = 0;
    if (sortBy === "name") cmp = a.repoName.localeCompare(b.repoName);
    else if (sortBy === "additions") cmp = a.totalAdditions - b.totalAdditions;
    else if (sortBy === "deletions") cmp = a.totalDeletions - b.totalDeletions;
    else if (sortBy === "stars") cmp = a.stars - b.stars;
    else cmp = a.totalCommits - b.totalCommits;
    return asc ? cmp : -cmp;
  }), [repos, sortBy, asc]);

  function toggleSort(key: SortKey) {
    if (sortBy === key) setAsc(!asc);
    else { setSortBy(key); setAsc(false); }
  }

  if (repos.length === 0) {
    return <p className="py-4 text-center text-sm text-muted-foreground">No repo data yet - click Refresh Data</p>;
  }

  return (
    <div>
      <div className="mb-3 flex gap-1">
        {sortOptions.map((opt) => (
          <Button
            key={opt.key}
            variant={sortBy === opt.key ? "default" : "ghost"}
            size="sm"
            className="text-xs"
            onClick={() => toggleSort(opt.key)}
          >
            {opt.label} {sortBy === opt.key ? (asc ? "↑" : "↓") : ""}
          </Button>
        ))}
      </div>
      <div className="space-y-3">
        {sorted.map((repo) => (
          <div key={repo.repoName} className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0">
            <div>
              <p className="text-sm font-medium">{repo.repoName}</p>
              {repo.language && <p className="text-xs text-muted-foreground">{repo.language}</p>}
            </div>
            <div className="flex gap-6 text-right">
              <div>
                <p className="text-sm font-bold">{repo.stars.toLocaleString("en-US")}</p>
                <p className="text-xs text-muted-foreground">stars</p>
              </div>
              <div>
                <p className="text-sm font-bold text-green-400">+{repo.totalAdditions.toLocaleString("en-US")}</p>
                <p className="text-xs text-muted-foreground">added</p>
              </div>
              <div>
                <p className="text-sm font-bold text-red-400">-{repo.totalDeletions.toLocaleString("en-US")}</p>
                <p className="text-xs text-muted-foreground">deleted</p>
              </div>
              <div>
                <p className="text-sm font-bold">{repo.totalCommits.toLocaleString("en-US")}</p>
                <p className="text-xs text-muted-foreground">commits</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
