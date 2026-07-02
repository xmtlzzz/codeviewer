import type { Page } from "../App";
import { useI18n, type Locale } from "../i18n";
import { ArrowLeftIcon, MoonIcon, SunIcon, SettingsIcon } from "./icons";

interface HeaderProps {
  page: Page;
  title: string;
  isDark: boolean;
  locale: Locale;
  onBack: () => void;
  onSettings: () => void;
  onToggleTheme: () => void;
  onToggleLanguage: () => void;
}

export function Header({
  page,
  title,
  isDark,
  locale,
  onBack,
  onSettings,
  onToggleTheme,
  onToggleLanguage,
}: HeaderProps) {
  const { t } = useI18n();

  return (
    <header className="header">
      <div className="header-left">
        {page !== "dashboard" && (
          <button
            className="back-btn"
            onClick={onBack}
            aria-label={t("header.back")}
            type="button"
          >
            <ArrowLeftIcon />
            <span>{t("header.back")}</span>
          </button>
        )}
      </div>
      <div className="header-center">{title}</div>
      <div className="header-right">
        <button
          className="lang-toggle"
          onClick={onToggleLanguage}
          aria-label={t("header.toggleLanguage")}
          type="button"
        >
          {locale === "zh" ? "EN" : "中"}
        </button>
        <button
          className="icon-btn"
          onClick={onToggleTheme}
          aria-label={t("header.toggleTheme")}
          type="button"
        >
          {isDark ? <SunIcon /> : <MoonIcon />}
        </button>
        {page === "dashboard" && (
          <button
            className="icon-btn"
            onClick={onSettings}
            aria-label={t("header.settings")}
            type="button"
          >
            <SettingsIcon />
          </button>
        )}
      </div>
    </header>
  );
}
