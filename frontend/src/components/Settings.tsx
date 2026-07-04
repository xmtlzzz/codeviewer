import { useEffect, useState } from "react";
import { useI18n, type Locale } from "../i18n";
import type { Config } from "../types";
import {
  addRepo,
  removeRepo,
  setAuthorEmail,
  setLaunchOnStartup,
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
  onSetLocale: (locale: Locale) => void;
  onConfigChange: (config: Config) => void;
}

export type ThemeMode = "light" | "dark" | "auto";

const APP_VERSION = "0.1.0";

export function Settings({
  config,
  themeMode,
  onSetTheme,
  onSetLocale,
  onConfigChange,
}: SettingsProps) {
  const { locale, t } = useI18n();
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
      ? t("settings.intervalMinutes", {
          count: Math.round(config.scan.interval_secs / 60),
        })
      : t("settings.intervalSeconds", { count: config.scan.interval_secs });

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

  const handleToggleLaunchOnStartup = async () => {
    setSaving(true);
    try {
      const updated = await setLaunchOnStartup(!config.launch_on_startup);
      onConfigChange(updated);
    } catch (e) {
      console.error("set_launch_on_startup failed:", e);
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
          <span>{t("settings.general")}</span>
        </div>
        <div className="settings-card">
          <div className="info-row">
            <span className="info-label">{t("settings.application")}</span>
            <span className="info-value">CodeViewer</span>
          </div>
          <div className="info-row">
            <span className="info-label">{t("settings.version")}</span>
            <span className="info-value mono">{APP_VERSION}</span>
          </div>
          <div className="info-row">
            <span className="info-label">{t("settings.status")}</span>
            <span className="info-value">
              <span className="status-dot on" />
              {t("settings.running")}
            </span>
          </div>
          <div className="info-row">
            <span className="info-label">{t("settings.launchOnStartup")}</span>
            <button
              className={`toggle${config.launch_on_startup ? " on" : ""}`}
              type="button"
              role="switch"
              aria-checked={config.launch_on_startup}
              aria-label={t("settings.launchOnStartup")}
              disabled={saving}
              onClick={handleToggleLaunchOnStartup}
            />
          </div>
          <div className="info-row">
            <span className="info-label">{t("settings.scanInterval")}</span>
            <span className="info-value mono">{intervalLabel}</span>
          </div>
          <div className="info-row">
            <span className="info-label">{t("settings.scanWindow")}</span>
            <span className="info-value mono">
              {t("settings.days", { count: config.scan.since_days })}
            </span>
          </div>
          <div
            className="info-row"
            style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}
          >
            <span className="info-label">{t("settings.authorEmail")}</span>
            <div className="email-edit">
              <input
                className="settings-input"
                type="text"
                placeholder={t("settings.emailPlaceholder")}
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
                {t("settings.save")}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <div className="section-title">
          <span>{t("settings.github")}</span>
        </div>
        <div className="settings-card">
          <div className="github-box">
            <div className="github-box-title">
              <GithubIcon />
              {t("settings.githubAccount")}
            </div>
            <div className="github-box-desc">
              {config.github.connected
                ? t("settings.githubConnected", {
                    username: config.github.username,
                  })
                : t("settings.githubDisconnected")}
            </div>
            <div className="github-fields">
              <input
                className="settings-input"
                type="text"
                placeholder={t("settings.githubUsername")}
                value={githubUsername}
                onChange={(e) => setGithubUsername(e.target.value)}
                disabled={saving}
              />
              <input
                className="settings-input"
                type="password"
                placeholder={t("settings.githubToken")}
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
                {config.github.connected
                  ? t("settings.updateConnection")
                  : t("settings.connectGithub")}
              </button>
              <button
                className="btn connected"
                type="button"
                disabled={saving || !config.github.connected}
                onClick={handleDisconnectGithub}
              >
                {t("settings.disconnect")}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <div className="section-title">
          <span>{t("settings.repositories")}</span>
          <span className="count">{t("dashboard.repoCount", { count: repoCount })}</span>
        </div>
        <div className="settings-card">
          {config.repos.map((repo, i) => (
            <div className="repo-row" key={`${repo.path}-${i}`}>
              <span className="repo-dot active" />
              <span className="repo-name">{repo.name || deriveName(repo.path, t)}</span>
              <span className="repo-path" title={repo.path}>
                {repo.path}
              </span>
              <button
                className="repo-delete"
                type="button"
                title={t("settings.removeRepository")}
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
              <span className="repo-name">{t("settings.noRepositories")}</span>
            </div>
          )}
          <div className="input-row">
            <input
              className="settings-input"
              type="text"
              placeholder={t("settings.repoPathPlaceholder")}
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
              {t("settings.add")}
            </button>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <div className="section-title">
          <span>{t("settings.appearance")}</span>
        </div>
        <div className="settings-card">
          <div
            className="info-row"
            style={{ flexDirection: "column", alignItems: "stretch", gap: 10 }}
          >
            <span className="info-label">{t("settings.theme")}</span>
            <div className="theme-selector">
              <button
                className={`theme-option${themeMode === "light" ? " active" : ""}`}
                onClick={() => onSetTheme("light")}
                type="button"
              >
                <SunIcon />
                {t("settings.light")}
              </button>
              <button
                className={`theme-option${themeMode === "dark" ? " active" : ""}`}
                onClick={() => onSetTheme("dark")}
                type="button"
              >
                <MoonIcon />
                {t("settings.dark")}
              </button>
              <button
                className={`theme-option${themeMode === "auto" ? " active" : ""}`}
                onClick={() => onSetTheme("auto")}
                type="button"
              >
                <MonitorIcon />
                {t("settings.auto")}
              </button>
            </div>
          </div>
          <div
            className="info-row"
            style={{ flexDirection: "column", alignItems: "stretch", gap: 10 }}
          >
            <span className="info-label">{t("settings.language")}</span>
            <div className="theme-selector">
              <button
                className={`theme-option${locale === "zh" ? " active" : ""}`}
                onClick={() => onSetLocale("zh")}
                type="button"
              >
                {t("settings.simplifiedChinese")}
              </button>
              <button
                className={`theme-option${locale === "en" ? " active" : ""}`}
                onClick={() => onSetLocale("en")}
                type="button"
              >
                {t("settings.english")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function deriveName(path: string, t: ReturnType<typeof useI18n>["t"]): string {
  if (!path) return t("common.unknown");
  const cleaned = path.replace(/[\\/]+$/, "");
  const segs = cleaned.split(/[\\/]/);
  return segs[segs.length - 1] || t("common.unknown");
}
