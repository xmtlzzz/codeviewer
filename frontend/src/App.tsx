import { useEffect, useState } from "react";
import { scanNow, onScanResultUpdated, getConfig } from "./api";
import type { Summary, Config } from "./types";
import { Header } from "./components/Header";
import { Dashboard } from "./components/Dashboard";
import { Settings } from "./components/Settings";
import type { ThemeMode } from "./components/Settings";

export type Page = "dashboard" | "settings";

const THEME_KEY = "codeviewer-theme";

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

export default function App() {
  const [page, setPage] = useState<Page>("dashboard");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [scanErrors, setScanErrors] = useState<string[]>([]);
  const [themeMode, setThemeMode] = useState<ThemeMode>(readMode);

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
    scanNow()
      .then((result) => {
        setSummary(result.summary);
        setScanErrors(result.errors);
      })
      .catch(() => undefined);
    getConfig().then(setConfig).catch(() => undefined);
    const unlistenPromise = onScanResultUpdated((result) => {
      setSummary(result.summary);
      setScanErrors(result.errors);
    });
    return () => {
      unlistenPromise.then((fn) => fn());
    };
  }, []);

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

  const handleConfigChange = (updated: Config) => {
    setConfig(updated);
    scanNow()
      .then((result) => {
        setSummary(result.summary);
        setScanErrors(result.errors);
      })
      .catch(() => undefined);
  };

  const isDark = getEffectiveTheme(themeMode) === "dark";

  return (
    <div className="app">
      <Header
        page={page}
        title={page === "settings" ? "Settings" : "CodeViewer"}
        isDark={isDark}
        onBack={() => setPage("dashboard")}
        onSettings={() => setPage("settings")}
        onToggleTheme={toggleTheme}
      />
      {page === "dashboard" &&
        (summary ? (
          <Dashboard summary={summary} scanErrors={scanErrors} />
        ) : (
          <section className="page active">
            <div className="total-section">
              <div className="total-label">Net changed lines</div>
              <div className="total-number mono">...</div>
              <div className="total-meta">Loading...</div>
            </div>
          </section>
        ))}
      {page === "settings" && config && (
        <Settings
          config={config}
          themeMode={themeMode}
          onSetTheme={handleSetTheme}
          onConfigChange={handleConfigChange}
        />
      )}
    </div>
  );
}
