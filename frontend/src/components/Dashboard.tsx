import { useMemo, useState } from "react";
import {
  filterSummaryByRange,
  todayKey,
  type DashboardRange,
} from "../dashboardStats";
import { useI18n } from "../i18n";
import type { DashboardRepo, Summary } from "../types";
import { TrendChart, type TrendChartVariant } from "./TrendChart";
import { FileCodeIcon, ChevronRightIcon } from "./icons";

interface DashboardProps {
  summary: Summary;
  scanErrors: string[];
  githubRepos: DashboardRepo[];
  onSelectRepo: (repo: DashboardRepo) => void;
}

function fmt(n: number): string {
  return n.toLocaleString();
}

function fmtSigned(n: number): string {
  if (n > 0) return `+${fmt(n)}`;
  if (n < 0) return `-${fmt(Math.abs(n))}`;
  return "0";
}

function repoSubtext(repo: DashboardRepo, t: ReturnType<typeof useI18n>["t"]): string {
  if ("source" in repo) {
    return `${repo.language ?? t("dashboard.repository")} | ${repo.stars} ${t(
      "dashboard.stars",
    )} | ${repo.forks} ${t("dashboard.forks")}`;
  }
  if (repo.last_date) {
    return t("dashboard.lastUpdated", { date: repo.last_date });
  }
  return t("dashboard.noActivity");
}

export function Dashboard({
  summary,
  scanErrors,
  githubRepos,
  onSelectRepo,
}: DashboardProps) {
  const { t } = useI18n();
  const [reposExpanded, setReposExpanded] = useState(false);
  const [chartVariant, setChartVariant] = useState<TrendChartVariant>("line");
  const [dashboardRange, setDashboardRange] = useState<DashboardRange>("7d");
  const rangeLabels: Record<DashboardRange, string> = {
    today: t("dashboard.range.today"),
    "7d": t("dashboard.range.7d"),
    "30d": t("dashboard.range.30d"),
  };
  const chartLabels: Record<TrendChartVariant, string> = {
    line: t("dashboard.chart.line"),
    bar: t("dashboard.chart.bar"),
    pie: t("dashboard.chart.pie"),
  };
  const today = useMemo(() => todayKey(), []);
  const filteredSummary = useMemo(
    () => filterSummaryByRange(summary, dashboardRange, today),
    [summary, dashboardRange, today],
  );
  const repos: DashboardRepo[] = useMemo(
    () => [...filteredSummary.repo_stats, ...githubRepos],
    [filteredSummary.repo_stats, githubRepos],
  );
  const visibleRepos = reposExpanded ? repos : repos.slice(0, 4);
  const hiddenRepoCount = Math.max(0, repos.length - 4);
  const totalNet = filteredSummary.total_insertions - filteredSummary.total_deletions;

  return (
    <section className="page active">
      <div className="total-section">
        <div className="total-label">{t("dashboard.netChangedLines")}</div>
        <div className="total-number mono">{fmtSigned(totalNet)}</div>
        <div className="total-meta">
          <span>
            {fmt(filteredSummary.total_commits)} {t("dashboard.commits")}
          </span>
          <span className="dot" />
          <span>
            {t("dashboard.insertions")} +{fmt(filteredSummary.total_insertions)} /{" "}
            {t("dashboard.deletions")} -{fmt(filteredSummary.total_deletions)}
          </span>
        </div>
      </div>

      <div className="dashboard-range-row">
        <div className="range-selector" role="tablist" aria-label={t("dashboard.rangeLabel")}>
          {(["today", "7d", "30d"] as DashboardRange[]).map((range) => (
            <button
              key={range}
              className={`range-option${dashboardRange === range ? " active" : ""}`}
              type="button"
              role="tab"
              aria-selected={dashboardRange === range}
              onClick={() => setDashboardRange(range)}
            >
              {rangeLabels[range]}
            </button>
          ))}
        </div>
      </div>

      {scanErrors.length > 0 && (
        <div className="scan-error-box" role="alert">
          <div className="scan-error-title">{t("dashboard.scanFailed")}</div>
          {scanErrors.map((error) => (
            <div className="scan-error-line" key={error}>
              {error}
            </div>
          ))}
        </div>
      )}

      <div className="section-title">
        <span>{t("dashboard.repositoryStats")}</span>
        <span className="count">{t("dashboard.repoCount", { count: repos.length })}</span>
      </div>
      <div className="lang-list">
        {repos.length === 0 && (
          <div
            className="lang-card"
            style={{ cursor: "default", justifyContent: "center" }}
          >
            <div className="lang-body" style={{ textAlign: "center" }}>
              <div className="lang-updated">{t("dashboard.noRepoData")}</div>
            </div>
          </div>
        )}
        {visibleRepos.map((repo, i) => (
          <button
            className="lang-card"
            key={`${"source" in repo ? repo.full_name : repo.name}-${repo.last_date ?? "none"}`}
            role="listitem"
            type="button"
            onClick={() => onSelectRepo(repo)}
            style={{ animationDelay: `${Math.min(i, 8) * 28}ms` }}
          >
            <div className="lang-icon">
              <FileCodeIcon />
            </div>
            <div className="lang-body">
              <div className="lang-name">
                {"source" in repo ? repo.full_name : repo.name}
              </div>
              <div className="lang-updated">{repoSubtext(repo, t)}</div>
            </div>
            <div className="lang-stats">
              <div className="lang-stat">
                <div className="lang-stat-label">{t("dashboard.commits")}</div>
                <div className="lang-stat-value mono">{fmt(repo.commits)}</div>
              </div>
              <div className="lang-stat">
                <div className="lang-stat-label">{t("dashboard.net")}</div>
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
          </button>
        ))}
        {hiddenRepoCount > 0 && (
          <button
            className="repo-list-toggle"
            type="button"
            aria-expanded={reposExpanded}
            onClick={() => setReposExpanded((value) => !value)}
          >
            <span>
              {reposExpanded
                ? t("dashboard.collapseRepos")
                : t("dashboard.expandRepos", { count: hiddenRepoCount })}
            </span>
            <span className={`toggle-chevron${reposExpanded ? " expanded" : ""}`}>
              <ChevronRightIcon />
            </span>
          </button>
        )}
      </div>

      <div className="chart-card">
        <div className="chart-header">
          <span className="chart-title">
            {t("dashboard.rangeChartTitle", { range: rangeLabels[dashboardRange] })}
          </span>
          <div className="chart-controls">
            <div className="chart-type-selector" role="tablist" aria-label={t("dashboard.chartType")}>
              {(["line", "bar", "pie"] as TrendChartVariant[]).map((variant) => (
                <button
                  key={variant}
                  className={`chart-type-option${chartVariant === variant ? " active" : ""}`}
                  type="button"
                  role="tab"
                  aria-selected={chartVariant === variant}
                  onClick={() => setChartVariant(variant)}
                >
                  {chartLabels[variant]}
                </button>
              ))}
            </div>
            <div className="chart-legend">
              <div className="legend-item">
                <span className="legend-dot green" />
                <span>{t("dashboard.insertions")}</span>
              </div>
              <div className="legend-item">
                <span className="legend-dot red" />
                <span>{t("dashboard.deletions")}</span>
              </div>
            </div>
          </div>
        </div>
        <TrendChart
          days={filteredSummary.days}
          variant={chartVariant}
          labels={{
            insertions: t("dashboard.insertions"),
            deletions: t("dashboard.deletions"),
            lines: t("dashboard.lines"),
          }}
        />
      </div>
    </section>
  );
}
