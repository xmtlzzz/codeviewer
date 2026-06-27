import type { Config } from "../types";
import { GithubIcon, PlusIcon, SunIcon, MoonIcon, MonitorIcon } from "./icons";

interface SettingsProps {
  config: Config;
  themeMode: ThemeMode;
  onSetTheme: (mode: ThemeMode) => void;
}

export type ThemeMode = "light" | "dark" | "auto";

const APP_VERSION = "0.1.0";

export function Settings({ config, themeMode, onSetTheme }: SettingsProps) {
  const repoCount = config.repos.length;
  const intervalLabel =
    config.scan.interval_secs >= 60
      ? `${Math.round(config.scan.interval_secs / 60)} 分钟`
      : `${config.scan.interval_secs} 秒`;

  return (
    <section className="page active">
      {/* Basic Info */}
      <div className="settings-section">
        <div className="section-title">
          <span>基本信息</span>
        </div>
        <div className="settings-card">
          <div className="info-row">
            <span className="info-label">应用名称</span>
            <span className="info-value">CodeViewer</span>
          </div>
          <div className="info-row">
            <span className="info-label">版本</span>
            <span className="info-value mono">{APP_VERSION}</span>
          </div>
          <div className="info-row">
            <span className="info-label">运行状态</span>
            <span className="info-value">
              <span className="status-dot on" />
              运行中
            </span>
          </div>
          <div className="info-row">
            <span className="info-label">扫描间隔</span>
            <span className="info-value mono">{intervalLabel}</span>
          </div>
          <div className="info-row">
            <span className="info-label">统计天数</span>
            <span className="info-value mono">{config.scan.since_days} 天</span>
          </div>
          <div className="info-row">
            <span className="info-label">作者邮箱</span>
            <span className="info-value mono">
              {config.author_email || "未设置"}
            </span>
          </div>
        </div>
      </div>

      {/* GitHub Sync */}
      <div className="settings-section">
        <div className="section-title">
          <span>GitHub 同步</span>
        </div>
        <div className="settings-card">
          <div className="github-box">
            <div className="github-box-title">
              <GithubIcon />
              GitHub 账号
            </div>
            <div className="github-box-desc">
              绑定 GitHub 账号后，可同步远程仓库的 PR、Issue 等统计数据。
            </div>
            <button className="btn" type="button" disabled style={{ opacity: 0.7, cursor: "not-allowed" }}>
              <GithubIcon />
              连接 GitHub 账号
            </button>
          </div>
          <div className="info-row">
            <span className="info-label">自动同步</span>
            <button
              className="toggle on"
              type="button"
              aria-label="自动同步"
              disabled
              style={{ cursor: "not-allowed", opacity: 0.7 }}
            />
          </div>
          <div className="info-row">
            <span className="info-label">同步间隔</span>
            <span className="info-value mono">{intervalLabel}</span>
          </div>
        </div>
      </div>

      {/* Repo Management */}
      <div className="settings-section">
        <div className="section-title">
          <span>仓库管理</span>
          <span className="count">{repoCount} 个仓库</span>
        </div>
        <div className="settings-card">
          {config.repos.map((repo, i) => (
            <div className="repo-row" key={`${repo.path}-${i}`}>
              <span className="repo-dot active" />
              <span className="repo-name">{repo.name || deriveName(repo.path)}</span>
              <span className="repo-path" title={repo.path}>
                {repo.path}
              </span>
            </div>
          ))}
          {config.repos.length === 0 && (
            <div className="repo-row">
              <span className="repo-dot inactive" />
              <span className="repo-name">尚未添加仓库</span>
            </div>
          )}
          <button className="repo-add" type="button" disabled style={{ opacity: 0.6, cursor: "not-allowed" }}>
            <PlusIcon />
            添加仓库
          </button>
        </div>
      </div>

      {/* Appearance */}
      <div className="settings-section">
        <div className="section-title">
          <span>外观</span>
        </div>
        <div className="settings-card">
          <div
            className="info-row"
            style={{ flexDirection: "column", alignItems: "stretch", gap: 10 }}
          >
            <span className="info-label">主题模式</span>
            <div className="theme-selector">
              <button
                className={`theme-option${themeMode === "light" ? " active" : ""}`}
                onClick={() => onSetTheme("light")}
                type="button"
              >
                <SunIcon />
                浅色
              </button>
              <button
                className={`theme-option${themeMode === "dark" ? " active" : ""}`}
                onClick={() => onSetTheme("dark")}
                type="button"
              >
                <MoonIcon />
                深色
              </button>
              <button
                className={`theme-option${themeMode === "auto" ? " active" : ""}`}
                onClick={() => onSetTheme("auto")}
                type="button"
              >
                <MonitorIcon />
                跟随系统
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function deriveName(path: string): string {
  if (!path) return "unknown";
  const cleaned = path.replace(/[\\/]+$/, "");
  const segs = cleaned.split(/[\\/]/);
  return segs[segs.length - 1] || "unknown";
}
