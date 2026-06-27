import { useMemo } from "react";
import type { Summary } from "../types";
import { TrendChart } from "./TrendChart";
import { FileCodeIcon, ChevronRightIcon } from "./icons";

interface DashboardProps {
  summary: Summary;
}

interface RepoAgg {
  name: string;
  insertions: number;
  deletions: number;
  commits: number;
  filesChanged: number;
  lastUpdated: string;
}

function fmt(n: number): string {
  return n.toLocaleString();
}

export function Dashboard({ summary }: DashboardProps) {
  const repos = useMemo<RepoAgg[]>(() => {
    const map = new Map<string, RepoAgg>();
    for (const d of summary.days) {
      const name = d.repo_name || "unknown";
      const cur =
        map.get(name) ??
        {
          name,
          insertions: 0,
          deletions: 0,
          commits: 0,
          filesChanged: 0,
          lastUpdated: d.date,
        };
      cur.insertions += d.insertions;
      cur.deletions += d.deletions;
      cur.commits += d.commits;
      cur.filesChanged += d.files_changed;
      if (d.date > cur.lastUpdated) cur.lastUpdated = d.date;
      map.set(name, cur);
    }
    return [...map.values()].sort((a, b) => b.insertions - a.insertions);
  }, [summary.days]);

  return (
    <section className="page active">
      {/* Total */}
      <div className="total-section">
        <div className="total-label">总提交代码行数</div>
        <div className="total-number mono">{fmt(summary.total_insertions)}</div>
        <div className="total-meta">
          <span>{fmt(summary.total_commits)} 次提交</span>
          <span className="dot" />
          <span>新增 {fmt(summary.total_insertions)} · 删除 {fmt(summary.total_deletions)}</span>
        </div>
      </div>

      {/* Repo List */}
      <div className="section-title">
        <span>仓库统计</span>
        <span className="count">{repos.length} 个仓库</span>
      </div>
      <div className="lang-list">
        {repos.length === 0 && (
          <div
            className="lang-card"
            style={{ cursor: "default", justifyContent: "center" }}
          >
            <div className="lang-body" style={{ textAlign: "center" }}>
              <div className="lang-updated">暂无统计数据</div>
            </div>
          </div>
        )}
        {repos.map((repo) => (
          <div className="lang-card" key={repo.name} role="listitem">
            <div className="lang-icon">
              <FileCodeIcon />
            </div>
            <div className="lang-body">
              <div className="lang-name">{repo.name}</div>
              <div className="lang-updated">最后更新 {repo.lastUpdated || "-"}</div>
            </div>
            <div className="lang-stats">
              <div className="lang-stat">
                <div className="lang-stat-label">提交次数</div>
                <div className="lang-stat-value mono">{fmt(repo.commits)}</div>
              </div>
              <div className="lang-stat">
                <div className="lang-stat-label">变更行数</div>
                <div className="lang-stat-value mono positive">
                  +{fmt(repo.insertions)}
                </div>
              </div>
            </div>
            <div className="lang-chevron">
              <ChevronRightIcon />
            </div>
          </div>
        ))}
      </div>

      {/* Trend Chart */}
      <div className="chart-card">
        <div className="chart-header">
          <span className="chart-title">最近 7 天趋势</span>
          <div className="chart-legend">
            <div className="legend-item">
              <span className="legend-dot green" />
              <span>新增</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot red" />
              <span>删除</span>
            </div>
          </div>
        </div>
        <TrendChart days={summary.days} />
      </div>
    </section>
  );
}
