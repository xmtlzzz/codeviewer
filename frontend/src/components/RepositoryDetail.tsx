import { useI18n } from "../i18n";
import type { DashboardRepo } from "../types";
import { TrendChart } from "./TrendChart";

interface RepositoryDetailProps {
  repo: DashboardRepo;
}

function fmt(n: number): string {
  return n.toLocaleString();
}

function fmtSigned(n: number): string {
  if (n > 0) return `+${fmt(n)}`;
  if (n < 0) return `-${fmt(Math.abs(n))}`;
  return "0";
}

function statusClass(status: string): string {
  return status.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
}

export function RepositoryDetail({ repo }: RepositoryDetailProps) {
  const { t } = useI18n();
  const net = repo.insertions - repo.deletions;
  const isGithubRepo = "source" in repo;
  const workingTreeChanges = isGithubRepo ? [] : repo.working_tree_changes;

  return (
    <section className="page active">
      <div className="detail-header">
        <div className="detail-title">
          {isGithubRepo ? repo.full_name : repo.name}
        </div>
        <div className="detail-subtitle">
          {isGithubRepo
            ? repo.description || t("detail.githubRepo")
            : repo.last_date
              ? t("dashboard.lastUpdated", { date: repo.last_date })
              : t("dashboard.noActivity")}
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-card-label">{t("detail.netChangedLines")}</div>
          <div
            className={`stat-card-value ${net > 0 ? "pos" : net < 0 ? "neg" : ""}`}
          >
            {fmtSigned(net)}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">
            {isGithubRepo ? t("detail.githubStars") : t("dashboard.commits")}
          </div>
          <div className="stat-card-value mono">
            {isGithubRepo ? fmt(repo.stars) : fmt(repo.commits)}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">
            {isGithubRepo ? t("dashboard.forks") : t("detail.filesChanged")}
          </div>
          <div className="stat-card-value mono">
            {isGithubRepo ? fmt(repo.forks) : fmt(repo.files_changed)}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">{t("detail.lastActivity")}</div>
          <div className="stat-card-value">
            <span className="sub">{repo.last_date ?? "-"}</span>
          </div>
        </div>
      </div>

      {isGithubRepo ? (
        <div className="settings-card">
          <div className="info-row">
            <span className="info-label">{t("detail.language")}</span>
            <span className="info-value">{repo.language ?? "-"}</span>
          </div>
          <div className="info-row">
            <span className="info-label">{t("detail.url")}</span>
            <span className="info-value repo-url">{repo.html_url}</span>
          </div>
          <div className="info-row">
            <span className="info-label">{t("detail.source")}</span>
            <span className="info-value">{t("detail.githubRepo")}</span>
          </div>
        </div>
      ) : (
        <>
          <div className="chart-card">
            <div className="chart-header">
              <span className="chart-title">{t("detail.repositoryTrend")}</span>
            </div>
            <TrendChart days={repo.daily_stats} />
          </div>

          <div className="data-table">
            <div className="table-row header">
              <div className="table-cell">{t("detail.date")}</div>
              <div className="table-cell">{t("detail.changedLines")}</div>
              <div className="table-cell">{t("dashboard.commits")}</div>
            </div>
            {repo.daily_stats.map((day) => (
              <div className="table-row" key={`${repo.name}-${day.date}`}>
                <div className="table-cell date">{day.date}</div>
                <div className="table-cell num">
                  <span className="pos">+{fmt(day.insertions)}</span>
                  {" / "}
                  <span className="neg">-{fmt(day.deletions)}</span>
                </div>
                <div className="table-cell mono">{fmt(day.commits)}</div>
              </div>
            ))}
          </div>

          <div className="chart-header file-change-header">
            <span className="chart-title">{t("detail.workingTreeChanges")}</span>
          </div>
          <div className="data-table file-change-table">
            <div className="table-row header">
              <div className="table-cell">{t("detail.file")}</div>
              <div className="table-cell">{t("detail.status")}</div>
              <div className="table-cell">{t("detail.changedLines")}</div>
            </div>
            {workingTreeChanges.length === 0 ? (
              <div className="table-row empty">
                <div className="table-cell">{t("detail.noWorkingTreeChanges")}</div>
              </div>
            ) : (
              workingTreeChanges.map((change) => (
                <div className="table-row" key={`${repo.name}-${change.path}`}>
                  <div className="table-cell file-path" title={change.path}>
                    {change.path}
                  </div>
                  <div className="table-cell">
                    <span className={`status-pill ${statusClass(change.status)}`}>
                      {change.status}
                    </span>
                  </div>
                  <div className="table-cell num">
                    <span className="pos">+{fmt(change.insertions)}</span>
                    {" / "}
                    <span className="neg">-{fmt(change.deletions)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </section>
  );
}
