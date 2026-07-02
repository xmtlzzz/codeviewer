import { useEffect, useState } from "react";
import type { Config } from "../types";
import {
  addRepo,
  removeRepo,
  setAuthorEmail,
  setGithubConnection,
  clearGithubConnection,
} from "../api";
import {
  GithubIcon,
  PlusIcon,
  SunIcon,
  MoonIcon,
  MonitorIcon,
  TrashIcon,
} from "./icons";

interface SettingsProps {
  config: Config;
  themeMode: ThemeMode;
  onSetTheme: (mode: ThemeMode) => void;
  onConfigChange: (config: Config) => void;
}

export type ThemeMode = "light" | "dark" | "auto";

const APP_VERSION = "0.1.0";

export function Settings({
  config,
  themeMode,
  onSetTheme,
  onConfigChange,
}: SettingsProps) {
  const [newRepoPath, setNewRepoPath] = useState("");
  const [emailInput, setEmailInput] = useState(config.author_email);
  const [githubUsername, setGithubUsername] = useState(config.github.username);
  const [githubToken, setGithubToken] = useState(config.github.token);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEmailInput(config.author_email);
    setGithubUsername(config.github.username);
    setGithubToken(config.github.token);
  }, [config]);

  const repoCount = config.repos.length;
  const intervalLabel =
    config.scan.interval_secs >= 60
      ? `${Math.round(config.scan.interval_secs / 60)} min`
      : `${config.scan.interval_secs} sec`;

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

  const handleConnectGithub = async () => {
    setSaving(true);
    try {
      const updated = await setGithubConnection(githubUsername, githubToken);
      onConfigChange(updated);
    } catch (e) {
      console.error("set_github_connection failed:", e);
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnectGithub = async () => {
    setSaving(true);
    try {
      const updated = await clearGithubConnection();
      onConfigChange(updated);
    } catch (e) {
      console.error("clear_github_connection failed:", e);
    } finally {
      setSaving(false);
    }
  };

  const githubReady =
    githubUsername.trim().length > 0 && githubToken.trim().length > 0;
  const githubDirty =
    githubUsername !== config.github.username || githubToken !== config.github.token;

  return (
    <section className="page active">
      <div className="settings-section">
        <div className="section-title">
          <span>General</span>
        </div>
        <div className="settings-card">
          <div className="info-row">
            <span className="info-label">Application</span>
            <span className="info-value">CodeViewer</span>
          </div>
          <div className="info-row">
            <span className="info-label">Version</span>
            <span className="info-value mono">{APP_VERSION}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Status</span>
            <span className="info-value">
              <span className="status-dot on" />
              Running
            </span>
          </div>
          <div className="info-row">
            <span className="info-label">Scan interval</span>
            <span className="info-value mono">{intervalLabel}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Scan window</span>
            <span className="info-value mono">{config.scan.since_days} days</span>
          </div>
          <div
            className="info-row"
            style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}
          >
            <span className="info-label">Author email</span>
            <div className="email-edit">
              <input
                className="settings-input"
                type="text"
                placeholder="your-email@example.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveEmail();
                }}
              />
              <button
                className="btn"
                type="button"
                disabled={saving || emailInput.trim() === config.author_email}
                onClick={handleSaveEmail}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <div className="section-title">
          <span>GitHub</span>
        </div>
        <div className="settings-card">
          <div className="github-box">
            <div className="github-box-title">
              <GithubIcon />
              GitHub account
            </div>
            <div className="github-box-desc">
              {config.github.connected
                ? `Connected as @${config.github.username}. This stores local credentials for future GitHub sync support.`
                : "Save a GitHub username and token to enable account connection in settings."}
            </div>
            <div className="github-fields">
              <input
                className="settings-input"
                type="text"
                placeholder="GitHub username"
                value={githubUsername}
                onChange={(e) => setGithubUsername(e.target.value)}
                disabled={saving}
              />
              <input
                className="settings-input"
                type="password"
                placeholder="GitHub personal access token"
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                disabled={saving}
              />
            </div>
            <div className="github-actions">
              <button
                className={`btn${config.github.connected ? " connected" : ""}`}
                type="button"
                disabled={saving || !githubReady || !githubDirty}
                onClick={handleConnectGithub}
              >
                <GithubIcon />
                {config.github.connected ? "Update connection" : "Connect GitHub"}
              </button>
              <button
                className="btn connected"
                type="button"
                disabled={saving || !config.github.connected}
                onClick={handleDisconnectGithub}
              >
                Disconnect
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <div className="section-title">
          <span>Repositories</span>
          <span className="count">{repoCount} repos</span>
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
                title="Remove repository"
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
              <span className="repo-name">No repositories added</span>
            </div>
          )}
          <div className="input-row">
            <input
              className="settings-input"
              type="text"
              placeholder="Repository path, e.g. D:\\code\\my-project"
              value={newRepoPath}
              onChange={(e) => setNewRepoPath(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddRepo();
              }}
              disabled={saving}
            />
            <button
              className="btn"
              type="button"
              disabled={saving || !newRepoPath.trim()}
              onClick={handleAddRepo}
            >
              <PlusIcon />
              Add
            </button>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <div className="section-title">
          <span>Appearance</span>
        </div>
        <div className="settings-card">
          <div
            className="info-row"
            style={{ flexDirection: "column", alignItems: "stretch", gap: 10 }}
          >
            <span className="info-label">Theme</span>
            <div className="theme-selector">
              <button
                className={`theme-option${themeMode === "light" ? " active" : ""}`}
                onClick={() => onSetTheme("light")}
                type="button"
              >
                <SunIcon />
                Light
              </button>
              <button
                className={`theme-option${themeMode === "dark" ? " active" : ""}`}
                onClick={() => onSetTheme("dark")}
                type="button"
              >
                <MoonIcon />
                Dark
              </button>
              <button
                className={`theme-option${themeMode === "auto" ? " active" : ""}`}
                onClick={() => onSetTheme("auto")}
                type="button"
              >
                <MonitorIcon />
                Auto
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
