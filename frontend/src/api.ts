import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Summary, Config, ScanResult, GithubRepoSummary } from "./types";

export async function getSummary(): Promise<Summary> {
  return invoke<Summary>("get_summary");
}

export async function getConfig(): Promise<Config> {
  return invoke<Config>("get_config");
}

export async function scanNow(): Promise<ScanResult> {
  return invoke<ScanResult>("scan_now");
}

export function onStatsUpdated(callback: (summary: Summary) => void) {
  return listen<Summary>("stats-updated", (event) => callback(event.payload));
}

export function onScanResultUpdated(callback: (result: ScanResult) => void) {
  return listen<ScanResult>("stats-updated", (event) => callback(event.payload));
}

export async function addRepo(path: string, name?: string): Promise<Config> {
  return invoke<Config>("add_repo", { path, name: name ?? null });
}

export async function removeRepo(path: string): Promise<Config> {
  return invoke<Config>("remove_repo", { path });
}

export async function setAuthorEmail(email: string): Promise<Config> {
  return invoke<Config>("set_author_email", { email });
}

export async function setGithubConnection(
  username: string,
  token: string,
): Promise<Config> {
  return invoke<Config>("set_github_connection", { username, token });
}

export async function clearGithubConnection(): Promise<Config> {
  return invoke<Config>("clear_github_connection");
}

interface GithubApiRepo {
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  private: boolean;
  updated_at: string | null;
}

export async function getGithubPublicRepos(
  username: string,
  token?: string,
): Promise<GithubRepoSummary[]> {
  const url = `https://api.github.com/users/${encodeURIComponent(
    username,
  )}/repos?type=owner&sort=updated&per_page=100`;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
  };
  if (token?.trim()) {
    headers.Authorization = `Bearer ${token.trim()}`;
  }

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`GitHub repos request failed: ${response.status}`);
  }

  const repos = (await response.json()) as GithubApiRepo[];
  return repos
    .filter((repo) => !repo.private)
    .map((repo) => ({
      source: "github" as const,
      name: repo.name,
      full_name: repo.full_name,
      html_url: repo.html_url,
      description: repo.description,
      language: repo.language,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      private: repo.private,
      insertions: 0,
      deletions: 0,
      commits: 0,
      files_changed: 0,
      last_date: repo.updated_at ? repo.updated_at.slice(0, 10) : null,
      daily_stats: [],
    }));
}
