export interface DailyStat {
  date: string;
  insertions: number;
  deletions: number;
  files_changed: number;
  commits: number;
  repo_name: string;
}

export interface Summary {
  today_insertions: number;
  today_deletions: number;
  today_commits: number;
  week_insertions: number;
  total_insertions: number;
  total_deletions: number;
  total_commits: number;
  days: DailyStat[];
  repo_stats: RepoSummary[];
}

export interface RepoSummary {
  name: string;
  insertions: number;
  deletions: number;
  commits: number;
  files_changed: number;
  last_date: string;
  daily_stats: DailyStat[];
}

export interface RepoEntry {
  path: string;
  name?: string;
}

export interface ScanConfig {
  interval_secs: number;
  since_days: number;
}

export type CloseBehavior = "minimize" | "exit";

export interface Config {
  repos: RepoEntry[];
  scan: ScanConfig;
  author_email: string;
  close_behavior: CloseBehavior;
}

export interface ScanResult {
  summary: Summary;
  errors: string[];
}
