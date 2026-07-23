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

export async function setLaunchOnStartup(enabled: boolean): Promise<Config> {
  return invoke<Config>("set_launch_on_startup", { enabled });
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

const GITHUB_PER_PAGE = 100;

export interface GithubApiRepo {
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

export function buildGithubReposUrl(username: string, page: number): string {
  const params = new URLSearchParams({
    type: "owner",
    sort: "updated",
    per_page: String(GITHUB_PER_PAGE),
    page: String(page),
  });
  return `https://api.github.com/users/${encodeURIComponent(username)}/repos?${params}`;
}

function githubHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
  };
  if (token?.trim()) {
    headers.Authorization = `Bearer ${token.trim()}`;
  }
  return headers;
}

export function mapGithubPublicRepos(repos: GithubApiRepo[]): GithubRepoSummary[] {
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
      working_tree_changes: [],
    }));
}

export async function getGithubPublicRepos(
  username: string,
  token?: string,
  fetchImpl: typeof fetch = fetch,
): Promise<GithubRepoSummary[]> {
  const allRepos: GithubApiRepo[] = [];
  const headers = githubHeaders(token);

  for (let page = 1; ; page += 1) {
    const response = await fetchImpl(buildGithubReposUrl(username, page), { headers });
    if (!response.ok) {
      throw new Error(`GitHub repos request failed: ${response.status}`);
    }

    const repos = (await response.json()) as GithubApiRepo[];
    allRepos.push(...repos);
    if (repos.length < GITHUB_PER_PAGE) break;
  }

  return mapGithubPublicRepos(allRepos);
}
