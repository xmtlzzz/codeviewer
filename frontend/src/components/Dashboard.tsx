import { useI18n } from "../i18n";
import type { DashboardRepo, Summary } from "../types";
import { TrendChart } from "./TrendChart";
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
  const repos: DashboardRepo[] = [...summary.repo_stats, ...githubRepos];
  const totalNet = summary.total_insertions - summary.total_deletions;

  return (
    <section className="page active">
      <div className="total-section">
        <div className="total-label">{t("dashboard.netChangedLines")}</div>
        <div className="total-number mono">{fmtSigned(totalNet)}</div>
        <div className="total-meta">
          <span>
            {fmt(summary.total_commits)} {t("dashboard.commits")}
          </span>
          <span className="dot" />
          <span>
            {t("dashboard.insertions")} +{fmt(summary.total_insertions)} /{" "}
            {t("dashboard.deletions")} -{fmt(summary.total_deletions)}
          </span>
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
        {repos.map((repo) => (
          <button
            className="lang-card"
            key={`${"source" in repo ? repo.full_name : repo.name}-${repo.last_date ?? "none"}`}
            role="listitem"
            type="button"
            onClick={() => onSelectRepo(repo)}
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
      </div>

      <div className="chart-card">
        <div className="chart-header">
          <span className="chart-title">{t("dashboard.last7Days")}</span>
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
        <TrendChart days={summary.days} />
      </div>
    </section>
  );
}
