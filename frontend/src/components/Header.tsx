import type { Page } from "../App";
import { ArrowLeftIcon, MoonIcon, SunIcon, SettingsIcon } from "./icons";

interface HeaderProps {
  page: Page;
  title: string;
  isDark: boolean;
  onBack: () => void;
  onSettings: () => void;
  onToggleTheme: () => void;
}

export function Header({
  page,
  title,
  isDark,
  onBack,
  onSettings,
  onToggleTheme,
}: HeaderProps) {
  return (
    <header className="header">
      <div className="header-left">
        {page !== "dashboard" && (
          <button
            className="back-btn"
            onClick={onBack}
            aria-label="返回"
            type="button"
          >
            <ArrowLeftIcon />
            <span>返回</span>
          </button>
        )}
      </div>
      <div className="header-center">{title}</div>
      <div className="header-right">
        <button
          className="icon-btn"
          onClick={onToggleTheme}
          aria-label="切换明暗模式"
          type="button"
        >
          {isDark ? <SunIcon /> : <MoonIcon />}
        </button>
        {page === "dashboard" && (
          <button
            className="icon-btn"
            onClick={onSettings}
            aria-label="设置"
            type="button"
          >
            <SettingsIcon />
          </button>
        )}
      </div>
    </header>
  );
}
