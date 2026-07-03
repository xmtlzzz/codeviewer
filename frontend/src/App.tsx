import { useCallback, useEffect, useRef, useState } from "react";
import {
  scanNow,
  onScanResultUpdated,
  getConfig,
  getGithubPublicRepos,
} from "./api";
import type {
  Summary,
  Config,
  DashboardRepo,
  GithubRepoSummary,
} from "./types";
import { Header } from "./components/Header";
import { Dashboard } from "./components/Dashboard";
import { RepositoryDetail } from "./components/RepositoryDetail";
import { Settings } from "./components/Settings";
import type { ThemeMode } from "./components/Settings";
import { I18nProvider, type Locale } from "./i18n";

export type Page = "dashboard" | "detail" | "settings";

const THEME_KEY = "codeviewer-theme";
const LOCALE_KEY = "codeviewer-locale";

function getSystemDark(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

function getEffectiveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "auto") return getSystemDark() ? "dark" : "light";
  return mode;
}

function readMode(): ThemeMode {
  if (typeof window === "undefined") return "light";
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "light" || saved === "dark" || saved === "auto") return saved;
  return "light";
}

function readLocale(): Locale {
  if (typeof window === "undefined") return "zh";
  const saved = localStorage.getItem(LOCALE_KEY);
  return saved === "zh" || saved === "en" ? saved : "zh";
}

export default function App() {
  const [page, setPage] = useState<Page>("dashboard");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [scanErrors, setScanErrors] = useState<string[]>([]);
  const [githubRepos, setGithubRepos] = useState<GithubRepoSummary[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<DashboardRepo | null>(null);
  const [themeMode, setThemeMode] = useState<ThemeMode>(readMode);
  const [locale, setLocale] = useState<Locale>(readLocale);
  const [refreshing, setRefreshing] = useState(false);
  const refreshingRef = useRef(false);

  const refreshStats = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);

    try {
      const result = await scanNow();
      setSummary(result.summary);
      setScanErrors(result.errors);
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const effective = getEffectiveTheme(themeMode);
    document.documentElement.dataset.theme = effective;

    if (themeMode !== "auto") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      document.documentElement.dataset.theme = getSystemDark()
        ? "dark"
        : "light";
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [themeMode]);

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale]);

  useEffect(() => {
    refreshStats().catch(() => undefined);

    getConfig()
      .then((loadedConfig) => {
        setConfig(loadedConfig);
        return refreshGithubRepos(loadedConfig);
      })
      .catch(() => undefined);

    const unlistenPromise = onScanResultUpdated((result) => {
      setSummary(result.summary);
      setScanErrors(result.errors);
    });
    return () => {
      unlistenPromise.then((fn) => fn());
    };
  }, [refreshStats]);

  const toggleTheme = () => {
    const current = document.documentElement.dataset.theme || "light";
    const next: ThemeMode = current === "dark" ? "light" : "dark";
    localStorage.setItem(THEME_KEY, next);
    setThemeMode(next);
  };

  const handleSetTheme = (mode: ThemeMode) => {
    localStorage.setItem(THEME_KEY, mode);
    setThemeMode(mode);
  };

  const handleSetLocale = (nextLocale: Locale) => {
    localStorage.setItem(LOCALE_KEY, nextLocale);
    setLocale(nextLocale);
  };

  const refreshGithubRepos = async (nextConfig: Config) => {
    if (!nextConfig.github.connected || !nextConfig.github.username.trim()) {
      setGithubRepos([]);
      return;
    }

    try {
      const repos = await getGithubPublicRepos(
        nextConfig.github.username,
        nextConfig.github.token,
      );
      setGithubRepos(repos);
    } catch (error) {
      console.error("getGithubPublicRepos failed:", error);
      setGithubRepos([]);
    }
  };

  const handleConfigChange = (updated: Config) => {
    setConfig(updated);
    refreshGithubRepos(updated).catch(() => undefined);
    refreshStats().catch(() => undefined);
  };

  const handleSelectRepo = (repo: DashboardRepo) => {
    setSelectedRepo(repo);
    setPage("detail");
  };

  const handleBack = () => {
    if (page === "detail") {
      setSelectedRepo(null);
    }
    setPage("dashboard");
  };

  const isDark = getEffectiveTheme(themeMode) === "dark";
  const title =
    page === "settings"
      ? locale === "zh"
        ? "设置"
        : "Settings"
      : page === "detail" && selectedRepo
        ? selectedRepo.name
        : "CodeViewer";

  return (
    <I18nProvider locale={locale} setLocale={handleSetLocale}>
      <div className="app">
        <Header
          page={page}
          title={title}
          isDark={isDark}
          locale={locale}
          onBack={handleBack}
          onSettings={() => setPage("settings")}
          onToggleTheme={toggleTheme}
          onToggleLanguage={() => handleSetLocale(locale === "zh" ? "en" : "zh")}
          onRefresh={() => refreshStats().catch(() => undefined)}
          isRefreshing={refreshing}
        />
        {page === "dashboard" &&
          (summary ? (
            <Dashboard
              summary={summary}
              scanErrors={scanErrors}
              githubRepos={githubRepos}
              onSelectRepo={handleSelectRepo}
            />
          ) : (
            <section className="page active">
              <div className="total-section">
                <div className="total-label">
                  {locale === "zh" ? "净变更行数" : "Net changed lines"}
                </div>
                <div className="total-number mono">...</div>
                <div className="total-meta">
                  {locale === "zh" ? "加载中..." : "Loading..."}
                </div>
              </div>
            </section>
          ))}
        {page === "detail" && selectedRepo && (
          <RepositoryDetail repo={selectedRepo} />
        )}
        {page === "settings" && config && (
          <Settings
            config={config}
            themeMode={themeMode}
            onSetTheme={handleSetTheme}
            onSetLocale={handleSetLocale}
            onConfigChange={handleConfigChange}
          />
        )}
      </div>
    </I18nProvider>
  );
}
