import { useState } from "react";
import type { Config } from "../types";
import { addRepo, removeRepo, setAuthorEmail } from "../api";
import { GithubIcon, PlusIcon, SunIcon, MoonIcon, MonitorIcon, TrashIcon } from "./icons";

interface SettingsProps {
  config: Config;
  themeMode: ThemeMode;
  onSetTheme: (mode: ThemeMode) => void;
  onConfigChange: (config: Config) => void;
}

export type ThemeMode = "light" | "dark" | "auto";

const APP_VERSION = "0.1.0";

export function Settings({ config, themeMode, onSetTheme, onConfigChange }: SettingsProps) {
  const [newRepoPath, setNewRepoPath] = useState("");
  const [emailInput, setEmailInput] = useState(config.author_email);
  const [saving, setSaving] = useState(false);

  const repoCount = config.repos.length;
  const intervalLabel =
    config.scan.interval_secs >= 60
      ? `${Math.round(config.scan.interval_secs / 60)} 分钟`
      : `${config.scan.interval_secs} 秒`;

  const handleAddRepo = async () => {
    const path = newRepoPath.trim();
    if (!path) return;
    setSaving(true);
    try {
      const updated = await addRepo(path);
      onConfigChange(updated);
      setNewRepoPath("");
    } catch (e) {
      console.error("add_repo failed:", e);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveRepo = async (path: string) => {
    setSaving(true);
    try {
      const updated = await removeRepo(path);
      onConfigChange(updated);
    } catch (e) {
      console.error("remove_repo failed:", e);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEmail = async () => {
    setSaving(true);
    try {
      const updated = await setAuthorEmail(emailInput.trim());
      onConfigChange(updated);
    } catch (e) {
      console.error("set_author_email failed:", e);
    } finally {
      setSaving(false);
    }
  };

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
          {/* Author Email — editable */}
          <div className="info-row" style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
            <span className="info-label">作者邮箱</span>
            <div className="email-edit">
              <input
                className="settings-input"
                type="text"
                placeholder="your-email@example.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSaveEmail(); }}
              />
              <button
                className="btn"
                type="button"
                disabled={saving || emailInput.trim() === config.author_email}
                onClick={handleSaveEmail}
              >
                保存
              </button>
            </div>
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

      {/* Repo Management — interactive */}
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
              <button
                className="repo-delete"
                type="button"
                title="删除仓库"
                disabled={saving}
                onClick={() => handleRemoveRepo(repo.path)}
              >
                <TrashIcon />
              </button>
            </div>
          ))}
          {config.repos.length === 0 && (
            <div className="repo-row">
              <span className="repo-dot inactive" />
              <span className="repo-name">尚未添加仓库</span>
            </div>
          )}
          {/* Add repo input */}
          <div className="input-row">
            <input
              className="settings-input"
              type="text"
              placeholder="输入仓库路径，如 D:\code\my-project"
              value={newRepoPath}
              onChange={(e) => setNewRepoPath(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAddRepo(); }}
              disabled={saving}
            />
            <button
              className="btn"
              type="button"
              disabled={saving || !newRepoPath.trim()}
              onClick={handleAddRepo}
            >
              <PlusIcon />
              添加
            </button>
          </div>
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
