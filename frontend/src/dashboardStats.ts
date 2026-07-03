import type { DailyStat, RepoSummary, Summary } from "./types";

export type DashboardRange = "today" | "7d" | "30d";

const rangeDays: Record<DashboardRange, number> = {
  today: 1,
  "7d": 7,
  "30d": 30,
};

function parseDate(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayKey(now = new Date()): string {
  return formatDate(now);
}

export function filterDailyStatsByRange(
  days: DailyStat[],
  range: DashboardRange,
  today: string,
): DailyStat[] {
  const end = parseDate(today);
  const start = new Date(end);
  start.setDate(end.getDate() - rangeDays[range] + 1);
  const startKey = formatDate(start);

  return days.filter((day) => day.date >= startKey && day.date <= today);
}

export function summarizeDays(days: DailyStat[]) {
  return days.reduce(
    (totals, day) => ({
      insertions: totals.insertions + day.insertions,
      deletions: totals.deletions + day.deletions,
      commits: totals.commits + day.commits,
    }),
    { insertions: 0, deletions: 0, commits: 0 },
  );
}

export function filterRepoSummariesByRange(
  repos: RepoSummary[],
  range: DashboardRange,
  today: string,
): RepoSummary[] {
  return repos.map((repo) => {
    const dailyStats = filterDailyStatsByRange(repo.daily_stats, range, today);
    const totals = summarizeDays(dailyStats);

    return {
      ...repo,
      insertions: totals.insertions,
      deletions: totals.deletions,
      commits: totals.commits,
      files_changed: dailyStats.reduce((sum, day) => sum + day.files_changed, 0),
      last_date: dailyStats.at(-1)?.date ?? null,
      daily_stats: dailyStats,
    };
  });
}

export function filterSummaryByRange(
  summary: Summary,
  range: DashboardRange,
  today: string,
): Summary {
  const days = filterDailyStatsByRange(summary.days, range, today);
  const totals = summarizeDays(days);

  return {
    ...summary,
    today_insertions: range === "today" ? totals.insertions : summary.today_insertions,
    today_deletions: range === "today" ? totals.deletions : summary.today_deletions,
    today_commits: range === "today" ? totals.commits : summary.today_commits,
    week_insertions: range === "7d" ? totals.insertions : summary.week_insertions,
    total_insertions: totals.insertions,
    total_deletions: totals.deletions,
    total_commits: totals.commits,
    days,
    repo_stats: filterRepoSummariesByRange(summary.repo_stats, range, today),
  };
}
