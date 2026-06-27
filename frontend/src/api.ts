import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Summary, Config, ScanResult } from "./types";

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

export async function addRepo(path: string, name?: string): Promise<Config> {
  return invoke<Config>("add_repo", { path, name: name ?? null });
}

export async function removeRepo(path: string): Promise<Config> {
  return invoke<Config>("remove_repo", { path });
}

export async function setAuthorEmail(email: string): Promise<Config> {
  return invoke<Config>("set_author_email", { email });
}
