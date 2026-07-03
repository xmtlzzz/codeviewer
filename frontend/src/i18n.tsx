import { createContext, useContext, type PropsWithChildren } from "react";

export type Locale = "zh" | "en";

type Params = Record<string, string | number>;
type MessageValue = string | ((params: Params) => string);

const messages = {
  zh: {
    "app.settings": "设置",
    "app.loadingTitle": "净变更行数",
    "app.loadingMeta": "加载中...",
    "header.back": "返回",
    "header.toggleTheme": "切换明暗模式",
    "header.settings": "打开设置",
    "header.toggleLanguage": "切换语言",
    "dashboard.netChangedLines": "净变更行数",
    "dashboard.commits": "提交",
    "dashboard.insertions": "新增",
    "dashboard.deletions": "删除",
    "dashboard.scanFailed": "部分仓库扫描失败",
    "dashboard.repositoryStats": "仓库统计",
    "dashboard.repoCount": ({ count }: Params) => `${count} 个仓库`,
    "dashboard.noRepoData": "暂无仓库数据",
    "dashboard.repository": "仓库",
    "dashboard.stars": "星标",
    "dashboard.forks": "Fork",
    "dashboard.lastUpdated": ({ date }: Params) => `最近更新 ${date}`,
    "dashboard.noActivity": "当前扫描窗口内无活动",
    "dashboard.net": "净值",
    "dashboard.last7Days": "最近 7 天",
    "dashboard.expandRepos": ({ count }: Params) => `展开 ${count} 个更多仓库`,
    "dashboard.collapseRepos": "收起仓库",
    "dashboard.chartType": "图表类型",
    "dashboard.chart.line": "折线",
    "dashboard.chart.bar": "柱状",
    "dashboard.chart.pie": "饼图",
    "dashboard.lines": "行",
    "detail.githubRepo": "GitHub 公开仓库",
    "detail.netChangedLines": "净变更行数",
    "detail.githubStars": "GitHub 星标",
    "detail.filesChanged": "变更文件数",
    "detail.lastActivity": "最近活动",
    "detail.language": "语言",
    "detail.url": "地址",
    "detail.source": "来源",
    "detail.repositoryTrend": "仓库趋势",
    "detail.date": "日期",
    "detail.changedLines": "变更行数",
    "detail.workingTreeChanges": "当前文件变化",
    "detail.noWorkingTreeChanges": "当前没有未提交文件变化",
    "detail.file": "文件",
    "detail.status": "状态",
    "settings.general": "通用",
    "settings.application": "应用",
    "settings.version": "版本",
    "settings.status": "状态",
    "settings.running": "运行中",
    "settings.scanInterval": "扫描间隔",
    "settings.scanWindow": "扫描窗口",
    "settings.days": ({ count }: Params) => `${count} 天`,
    "settings.authorEmail": "作者邮箱",
    "settings.emailPlaceholder": "your-email@example.com",
    "settings.save": "保存",
    "settings.github": "GitHub",
    "settings.githubAccount": "GitHub 账户",
    "settings.githubConnected": ({ username }: Params) =>
      `已连接 @${username}。当前会在本地保存凭据，供后续 GitHub 同步功能使用。`,
    "settings.githubDisconnected":
      "保存 GitHub 用户名和令牌后，即可在设置中启用账户连接。",
    "settings.githubUsername": "GitHub 用户名",
    "settings.githubToken": "GitHub 个人访问令牌",
    "settings.updateConnection": "更新连接",
    "settings.connectGithub": "连接 GitHub",
    "settings.disconnect": "断开连接",
    "settings.repositories": "仓库",
    "settings.removeRepository": "移除仓库",
    "settings.noRepositories": "还没有添加仓库",
    "settings.repoPathPlaceholder": "仓库路径，例如 D:\\code\\my-project",
    "settings.add": "添加",
    "settings.appearance": "外观",
    "settings.theme": "主题",
    "settings.light": "浅色",
    "settings.dark": "深色",
    "settings.auto": "自动",
    "settings.language": "语言",
    "settings.simplifiedChinese": "中文",
    "settings.english": "English",
    "settings.intervalMinutes": ({ count }: Params) => `${count} 分钟`,
    "settings.intervalSeconds": ({ count }: Params) => `${count} 秒`,
    "common.unknown": "未知",
  },
  en: {
    "app.settings": "Settings",
    "app.loadingTitle": "Net changed lines",
    "app.loadingMeta": "Loading...",
    "header.back": "Back",
    "header.toggleTheme": "Toggle theme",
    "header.settings": "Open settings",
    "header.toggleLanguage": "Toggle language",
    "dashboard.netChangedLines": "Net changed lines",
    "dashboard.commits": "Commits",
    "dashboard.insertions": "Insertions",
    "dashboard.deletions": "Deletions",
    "dashboard.scanFailed": "Some repositories failed to scan",
    "dashboard.repositoryStats": "Repository stats",
    "dashboard.repoCount": ({ count }: Params) => `${count} repos`,
    "dashboard.noRepoData": "No repository data",
    "dashboard.repository": "Repository",
    "dashboard.stars": "stars",
    "dashboard.forks": "forks",
    "dashboard.lastUpdated": ({ date }: Params) => `Last updated ${date}`,
    "dashboard.noActivity": "No activity in current scan window",
    "dashboard.net": "Net",
    "dashboard.last7Days": "Last 7 days",
    "dashboard.expandRepos": ({ count }: Params) => `Show ${count} more`,
    "dashboard.collapseRepos": "Collapse repositories",
    "dashboard.chartType": "Chart type",
    "dashboard.chart.line": "Line",
    "dashboard.chart.bar": "Bar",
    "dashboard.chart.pie": "Pie",
    "dashboard.lines": "lines",
    "detail.githubRepo": "GitHub public repository",
    "detail.netChangedLines": "Net changed lines",
    "detail.githubStars": "GitHub stars",
    "detail.filesChanged": "Files changed",
    "detail.lastActivity": "Last activity",
    "detail.language": "Language",
    "detail.url": "URL",
    "detail.source": "Source",
    "detail.repositoryTrend": "Repository trend",
    "detail.date": "Date",
    "detail.changedLines": "Changed lines",
    "detail.workingTreeChanges": "Working tree changes",
    "detail.noWorkingTreeChanges": "No current file changes",
    "detail.file": "File",
    "detail.status": "Status",
    "settings.general": "General",
    "settings.application": "Application",
    "settings.version": "Version",
    "settings.status": "Status",
    "settings.running": "Running",
    "settings.scanInterval": "Scan interval",
    "settings.scanWindow": "Scan window",
    "settings.days": ({ count }: Params) => `${count} days`,
    "settings.authorEmail": "Author email",
    "settings.emailPlaceholder": "your-email@example.com",
    "settings.save": "Save",
    "settings.github": "GitHub",
    "settings.githubAccount": "GitHub account",
    "settings.githubConnected": ({ username }: Params) =>
      `Connected as @${username}. This stores local credentials for future GitHub sync support.`,
    "settings.githubDisconnected":
      "Save a GitHub username and token to enable account connection in settings.",
    "settings.githubUsername": "GitHub username",
    "settings.githubToken": "GitHub personal access token",
    "settings.updateConnection": "Update connection",
    "settings.connectGithub": "Connect GitHub",
    "settings.disconnect": "Disconnect",
    "settings.repositories": "Repositories",
    "settings.removeRepository": "Remove repository",
    "settings.noRepositories": "No repositories added",
    "settings.repoPathPlaceholder": "Repository path, e.g. D:\\code\\my-project",
    "settings.add": "Add",
    "settings.appearance": "Appearance",
    "settings.theme": "Theme",
    "settings.light": "Light",
    "settings.dark": "Dark",
    "settings.auto": "Auto",
    "settings.language": "Language",
    "settings.simplifiedChinese": "中文",
    "settings.english": "English",
    "settings.intervalMinutes": ({ count }: Params) => `${count} min`,
    "settings.intervalSeconds": ({ count }: Params) => `${count} sec`,
    "common.unknown": "unknown",
  },
} satisfies Record<Locale, Record<string, MessageValue>>;

type MessageKey = keyof (typeof messages)["zh"];

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, params?: Params) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  locale,
  setLocale,
  children,
}: PropsWithChildren<Pick<I18nContextValue, "locale" | "setLocale">>) {
  const t = (key: MessageKey, params: Params = {}) => {
    const entry = messages[locale][key];
    return typeof entry === "function" ? entry(params) : entry;
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return ctx;
}
