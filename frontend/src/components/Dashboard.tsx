import type { Summary } from "../types";
import { TrendChart } from "./TrendChart";
import { FileCodeIcon, ChevronRightIcon } from "./icons";

interface DashboardProps {
  summary: Summary;
  scanErrors: string[];
}

function fmt(n: number): string {
  return n.toLocaleString();
}

function fmtSigned(n: number): string {
  if (n > 0) return `+${fmt(n)}`;
  if (n < 0) return `-${fmt(Math.abs(n))}`;
  return "0";
}

export function Dashboard({ summary, scanErrors }: DashboardProps) {
  const repos = summary.repo_stats;
  const totalNet = summary.total_insertions - summary.total_deletions;

  return (
    <section className="page active">
      <div className="total-section">
        <div className="total-label">Net changed lines</div>
        <div className="total-number mono">{fmtSigned(totalNet)}</div>
        <div className="total-meta">
          <span>{fmt(summary.total_commits)} commits</span>
          <span className="dot" />
          <span>
            +{fmt(summary.total_insertions)} / -{fmt(summary.total_deletions)}
          </span>
        </div>
      </div>

      {scanErrors.length > 0 && (
        <div className="scan-error-box" role="alert">
          <div className="scan-error-title">Some repositories failed to scan</div>
          {scanErrors.map((error) => (
            <div className="scan-error-line" key={error}>
              {error}
            </div>
          ))}
        </div>
      )}

      <div className="section-title">
        <span>Repository stats</span>
        <span className="count">{repos.length} repos</span>
      </div>
      <div className="lang-list">
        {repos.length === 0 && (
          <div className="lang-card" style={{ cursor: "default", justifyContent: "center" }}>
            <div className="lang-body" style={{ textAlign: "center" }}>
              <div className="lang-updated">No repository data</div>
            </div>
          </div>
        )}
        {repos.map((repo) => (
          <div
            className="lang-card"
            key={`${repo.name}-${repo.last_date ?? "none"}`}
            role="listitem"
          >
            <div className="lang-icon">
              <FileCodeIcon />
            </div>
            <div className="lang-body">
              <div className="lang-name">{repo.name}</div>
              <div className="lang-updated">
                {repo.last_date
                  ? `Last updated ${repo.last_date}`
                  : "No activity in current scan window"}
              </div>
            </div>
            <div className="lang-stats">
              <div className="lang-stat">
                <div className="lang-stat-label">Commits</div>
                <div className="lang-stat-value mono">{fmt(repo.commits)}</div>
              </div>
              <div className="lang-stat">
                <div className="lang-stat-label">Net</div>
                <div
                  className={`lang-stat-value mono ${
                    repo.insertions - repo.deletions > 0
                      ? "positive"
                      : repo.insertions - repo.deletions < 0
                        ? "negative"
                        : ""
                  }`}
                >
                  {fmtSigned(repo.insertions - repo.deletions)}
                </div>
              </div>
            </div>
            <div className="lang-chevron">
              <ChevronRightIcon />
            </div>
          </div>
        ))}
      </div>

      <div className="chart-card">
        <div className="chart-header">
          <span className="chart-title">Last 7 days</span>
          <div className="chart-legend">
            <div className="legend-item">
              <span className="legend-dot green" />
              <span>Insertions</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot red" />
              <span>Deletions</span>
            </div>
          </div>
        </div>
        <TrendChart days={summary.days} />
      </div>
    </section>
  );
}
