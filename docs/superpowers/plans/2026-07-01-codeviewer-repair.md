# CodeViewer Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the CodeViewer workspace build and complete the dashboard/config repair scope defined in `docs/superpowers/specs/2026-07-01-codeviewer-repair-design.md`.

**Architecture:** `scanner::scan_repo()` stays single-repository. Callers bind scan output to `RepoStat`, and `aggregator::aggregate(Vec<RepoStat>)` produces global trend data plus per-repository summaries. Desktop commands, background scans, and tray scans share one scan helper that returns `ScanResult`.

**Tech Stack:** Rust 2021, git2, chrono, serde, Tauri 2, React, TypeScript, Vite.

---

## File Structure

- Modify: `crates/codeviewer-core/src/aggregator.rs`
  - Change aggregation input from `Vec<Vec<DailyStat>>` to `Vec<RepoStat>`.
  - Build `Summary.repo_stats`.
  - Update unit tests.
- Modify: `crates/codeviewer-core/src/bin/codeviewer.rs`
  - Build `RepoStat` values before calling `aggregator::aggregate`.
  - Print scan errors instead of silently dropping all failures.
- Modify: `crates/codeviewer-core/tests/integration_test.rs`
  - Update aggregation calls to pass `RepoStat`.
  - Add `close_behavior` to direct `Config` construction.
- Modify: `crates/codeviewer-desktop/src/commands.rs`
  - Introduce reusable scan helper returning `ScanResult`.
  - Update `get_summary` and `scan_now`.
- Modify: `crates/codeviewer-desktop/src/scanner_task.rs`
  - Reuse the command scan helper and emit full scan results.
- Modify: `crates/codeviewer-desktop/src/tray.rs`
  - Make tray scan trigger a real background scan.
- Modify: `crates/codeviewer-desktop/src/lib.rs`
  - Handle window close based on `Config.close_behavior`.
- Modify: `frontend/src/types.ts`
  - Add `RepoSummary`, `CloseBehavior`, and updated `Summary` / `Config`.
- Modify: `frontend/src/api.ts`
  - Add scan result event listener.
- Modify: `frontend/src/App.tsx`
  - Store scan errors and use `scanNow()` for initial dashboard data.
- Modify: `frontend/src/components/Dashboard.tsx`
  - Render repository rows from `summary.repo_stats`.
  - Render a small scan error alert.
- Modify: `config.toml.example`
  - Document `close_behavior`.

---

## Task 1: Core Aggregation Contract

**Files:**
- Modify: `crates/codeviewer-core/src/aggregator.rs`
- Modify: `crates/codeviewer-core/tests/integration_test.rs`

- [ ] **Step 1: Update aggregator tests to describe the new contract**

In `crates/codeviewer-core/src/aggregator.rs`, update the test module helpers and call sites so tests pass `RepoStat` values:

```rust
use crate::models::RepoStat;

fn make_stat(date_str: &str, repo_name: &str, ins: u64, del: u64, commits: u32) -> DailyStat {
    DailyStat {
        date: NaiveDate::parse_from_str(date_str, "%Y-%m-%d").unwrap(),
        insertions: ins,
        deletions: del,
        files_changed: 1,
        commits,
        repo_name: repo_name.to_string(),
    }
}

fn make_repo(name: &str, stats: Vec<DailyStat>) -> RepoStat {
    RepoStat {
        repo_path: format!("/tmp/{name}"),
        repo_name: name.to_string(),
        daily_stats: stats,
    }
}
```

Replace `aggregate(vec![repo_a, repo_b])` style calls with:

```rust
let summary = aggregate(vec![
    make_repo("repo-a", vec![make_stat(&today, "repo-a", 100, 10, 2)]),
    make_repo("repo-b", vec![make_stat(&today, "repo-b", 50, 5, 1)]),
]);
```

Add this test:

```rust
#[test]
fn test_repo_stats_preserve_per_repo_totals() {
    let today = today_str();
    let yesterday = (Local::now().date_naive() - chrono::Duration::days(1))
        .format("%Y-%m-%d")
        .to_string();

    let summary = aggregate(vec![
        make_repo(
            "repo-a",
            vec![
                make_stat(&yesterday, "repo-a", 25, 5, 1),
                make_stat(&today, "repo-a", 75, 10, 2),
            ],
        ),
        make_repo("repo-b", vec![make_stat(&today, "repo-b", 50, 2, 1)]),
    ]);

    assert_eq!(summary.days.len(), 2);
    assert_eq!(summary.repo_stats.len(), 2);

    let repo_a = summary.repo_stats.iter().find(|r| r.name == "repo-a").unwrap();
    assert_eq!(repo_a.insertions, 100);
    assert_eq!(repo_a.deletions, 15);
    assert_eq!(repo_a.commits, 3);
    assert_eq!(repo_a.files_changed, 2);
    assert_eq!(repo_a.last_date.format("%Y-%m-%d").to_string(), today);
    assert_eq!(repo_a.daily_stats.len(), 2);

    let repo_b = summary.repo_stats.iter().find(|r| r.name == "repo-b").unwrap();
    assert_eq!(repo_b.insertions, 50);
    assert_eq!(repo_b.deletions, 2);
    assert_eq!(repo_b.commits, 1);
}
```

Update `test_empty_input` to assert:

```rust
assert!(summary.repo_stats.is_empty());
```

- [ ] **Step 2: Run the focused failing test**

Run:

```powershell
cargo test -p codeviewer-core aggregator::tests::test_repo_stats_preserve_per_repo_totals
```

Expected: FAIL because `aggregate` still accepts `Vec<Vec<DailyStat>>` or does not build `repo_stats`.

- [ ] **Step 3: Implement the new aggregator contract**

Replace the top imports and `aggregate` function in `crates/codeviewer-core/src/aggregator.rs` with:

```rust
use crate::models::{DailyStat, RepoStat, RepoSummary, Summary};
use chrono::{Local, NaiveDate};
use std::collections::BTreeMap;

/// Aggregate multiple repos' daily stats into a dashboard Summary.
/// - `days` is a global date series merged across repos.
/// - `repo_stats` preserves per-repository totals for the dashboard list.
pub fn aggregate(repos: Vec<RepoStat>) -> Summary {
    let today = Local::now().date_naive();
    let week_ago = today - chrono::Duration::days(7);

    let mut by_date: BTreeMap<NaiveDate, DailyStat> = BTreeMap::new();
    let mut repo_summaries = Vec::new();
    let mut total_insertions = 0u64;
    let mut total_deletions = 0u64;
    let mut total_commits = 0u32;
    let mut today_insertions = 0u64;
    let mut today_deletions = 0u64;
    let mut today_commits = 0u32;
    let mut week_insertions = 0u64;

    for repo in repos {
        let mut repo_insertions = 0u64;
        let mut repo_deletions = 0u64;
        let mut repo_commits = 0u32;
        let mut repo_files_changed = 0u32;
        let mut repo_last_date: Option<NaiveDate> = None;

        for stat in &repo.daily_stats {
            total_insertions += stat.insertions;
            total_deletions += stat.deletions;
            total_commits += stat.commits;

            repo_insertions += stat.insertions;
            repo_deletions += stat.deletions;
            repo_commits += stat.commits;
            repo_files_changed += stat.files_changed;
            repo_last_date = Some(repo_last_date.map_or(stat.date, |d| d.max(stat.date)));

            if stat.date == today {
                today_insertions += stat.insertions;
                today_deletions += stat.deletions;
                today_commits += stat.commits;
            }
            if stat.date >= week_ago {
                week_insertions += stat.insertions;
            }

            let entry = by_date.entry(stat.date).or_insert_with(|| DailyStat {
                date: stat.date,
                insertions: 0,
                deletions: 0,
                files_changed: 0,
                commits: 0,
                repo_name: "all".to_string(),
            });
            entry.insertions += stat.insertions;
            entry.deletions += stat.deletions;
            entry.files_changed += stat.files_changed;
            entry.commits += stat.commits;
        }

        if let Some(last_date) = repo_last_date {
            repo_summaries.push(RepoSummary {
                name: repo.repo_name,
                insertions: repo_insertions,
                deletions: repo_deletions,
                commits: repo_commits,
                files_changed: repo_files_changed,
                last_date,
                daily_stats: repo.daily_stats,
            });
        }
    }

    repo_summaries.sort_by(|a, b| {
        b.insertions
            .cmp(&a.insertions)
            .then_with(|| a.name.cmp(&b.name))
    });

    Summary {
        today_insertions,
        today_deletions,
        today_commits,
        week_insertions,
        total_insertions,
        total_deletions,
        total_commits,
        days: by_date.into_values().collect(),
        repo_stats: repo_summaries,
    }
}
```

- [ ] **Step 4: Update integration aggregation calls**

In `crates/codeviewer-core/tests/integration_test.rs`, replace calls like:

```rust
let summary = aggregator::aggregate(vec![stats1.clone(), stats2.clone()]);
```

with:

```rust
let summary = aggregator::aggregate(vec![
    models::RepoStat {
        repo_path: dir1.path().to_string_lossy().into_owned(),
        repo_name: "repo1".to_string(),
        daily_stats: stats1.clone(),
    },
    models::RepoStat {
        repo_path: dir2.path().to_string_lossy().into_owned(),
        repo_name: "repo2".to_string(),
        daily_stats: stats2.clone(),
    },
]);
```

Replace:

```rust
let summary = aggregator::aggregate(vec![stats]);
```

with:

```rust
let summary = aggregator::aggregate(vec![models::RepoStat {
    repo_path: dir.path().to_string_lossy().into_owned(),
    repo_name: "repo".to_string(),
    daily_stats: stats,
}]);
```

Replace the final nonexistent-repo aggregate call with:

```rust
let summary = aggregator::aggregate(vec![models::RepoStat {
    repo_path: dir1.path().to_string_lossy().into_owned(),
    repo_name: "repo1".to_string(),
    daily_stats: stats1,
}]);
```

In `test_config_save_and_load_roundtrip`, add the missing field to the `config::Config` literal:

```rust
close_behavior: config::CloseBehavior::Minimize,
```

- [ ] **Step 5: Run core tests**

Run:

```powershell
cargo test -p codeviewer-core
```

Expected: PASS for core library tests after call sites are updated. If the CLI still fails to compile because of the changed `aggregate` signature, continue to Task 2.

- [ ] **Step 6: Commit core aggregation repair**

Run:

```powershell
git add crates/codeviewer-core/src/aggregator.rs crates/codeviewer-core/tests/integration_test.rs
git commit -m "fix: aggregate repository summaries"
```

---

## Task 2: Core CLI Call Sites

**Files:**
- Modify: `crates/codeviewer-core/src/bin/codeviewer.rs`

- [ ] **Step 1: Change CLI scan helper to return `RepoStat` plus errors**

In `crates/codeviewer-core/src/bin/codeviewer.rs`, replace `scan_all` with:

```rust
fn repo_name_for(entry: &config::RepoEntry) -> String {
    entry.name.clone().unwrap_or_else(|| {
        std::path::Path::new(&entry.path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string()
    })
}

fn scan_all(config: &config::Config) -> (Vec<models::RepoStat>, Vec<String>) {
    let opts = scanner::ScanOptions {
        author_email: if config.author_email.is_empty() {
            None
        } else {
            Some(config.author_email.clone())
        },
        since_days: Some(config.scan.since_days),
    };

    let mut repos = Vec::new();
    let mut errors = Vec::new();

    for entry in &config.repos {
        match scanner::scan_repo(std::path::Path::new(&entry.path), &opts) {
            Ok(stats) => repos.push(models::RepoStat {
                repo_path: entry.path.clone(),
                repo_name: repo_name_for(entry),
                daily_stats: stats,
            }),
            Err(e) => errors.push(format!("{}: {}", entry.path, e)),
        }
    }

    (repos, errors)
}
```

- [ ] **Step 2: Update CLI command branches**

In the `"today"` branch, replace:

```rust
let summary = aggregator::aggregate(scan_all(&config));
```

with:

```rust
let (repos, errors) = scan_all(&config);
for error in &errors {
    eprintln!("scan skipped: {error}");
}
let summary = aggregator::aggregate(repos);
```

Make the same replacement in the `"week"` branch.

In the `"scan"` branch, replace:

```rust
let all = scan_all(&config);
let repo_stats: Vec<models::RepoStat> = config
    .repos
    .iter()
    .zip(all.iter())
    .map(|(r, stats)| models::RepoStat {
        repo_path: r.path.clone(),
        repo_name: std::path::Path::new(&r.path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string(),
        daily_stats: stats.clone(),
    })
    .collect();
```

with:

```rust
let (repo_stats, errors) = scan_all(&config);
for error in &errors {
    eprintln!("scan skipped: {error}");
}
```

- [ ] **Step 3: Run core check**

Run:

```powershell
cargo check -p codeviewer-core
```

Expected: PASS.

- [ ] **Step 4: Commit CLI call-site repair**

Run:

```powershell
git add crates/codeviewer-core/src/bin/codeviewer.rs
git commit -m "fix: update cli aggregation inputs"
```

---

## Task 3: Desktop Shared Scan Helper and Events

**Files:**
- Modify: `crates/codeviewer-desktop/src/commands.rs`
- Modify: `crates/codeviewer-desktop/src/scanner_task.rs`
- Modify: `crates/codeviewer-desktop/src/tray.rs`
- Modify: `crates/codeviewer-desktop/src/lib.rs`

- [ ] **Step 1: Make `ScanResult` cloneable and reusable**

In `crates/codeviewer-desktop/src/commands.rs`, replace the imports and helper section with:

```rust
use codeviewer_core::{aggregator, config, models, scanner};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;

pub struct AppState {
    pub config: Mutex<config::Config>,
    pub config_path: PathBuf,
}

#[derive(Clone, serde::Serialize)]
pub struct ScanResult {
    pub summary: models::Summary,
    pub errors: Vec<String>,
}

fn repo_name_for(entry: &config::RepoEntry) -> String {
    entry.name.clone().unwrap_or_else(|| {
        std::path::Path::new(&entry.path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string()
    })
}

pub fn scan_config(config: &config::Config) -> ScanResult {
    let opts = scanner::ScanOptions {
        author_email: if config.author_email.is_empty() {
            None
        } else {
            Some(config.author_email.clone())
        },
        since_days: Some(config.scan.since_days),
    };

    let mut repos = Vec::new();
    let mut errors = Vec::new();

    for entry in &config.repos {
        match scanner::scan_repo(std::path::Path::new(&entry.path), &opts) {
            Ok(stats) => repos.push(models::RepoStat {
                repo_path: entry.path.clone(),
                repo_name: repo_name_for(entry),
                daily_stats: stats,
            }),
            Err(e) => errors.push(format!("{}: {}", entry.path, e)),
        }
    }

    ScanResult {
        summary: aggregator::aggregate(repos),
        errors,
    }
}

pub fn scan_state(state: &AppState) -> ScanResult {
    let config = state.config.lock().unwrap().clone();
    scan_config(&config)
}
```

Remove the old private `scan_all` helper and the duplicate `ScanResult` definition.

- [ ] **Step 2: Update Tauri commands**

In `commands.rs`, replace `get_summary` with:

```rust
#[tauri::command]
pub fn get_summary(state: State<'_, AppState>) -> models::Summary {
    scan_state(&state).summary
}
```

Replace `scan_now` with:

```rust
#[tauri::command]
pub fn scan_now(state: State<'_, AppState>) -> ScanResult {
    scan_state(&state)
}
```

- [ ] **Step 3: Update background scanner**

Replace `crates/codeviewer-desktop/src/scanner_task.rs` with:

```rust
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

pub fn spawn_scanner_task(app: AppHandle) {
    let interval_secs = {
        let state = app.state::<crate::commands::AppState>();
        let config = state.config.lock().unwrap();
        config.scan.interval_secs
    };

    tauri::async_runtime::spawn(async move {
        let mut ticker = tokio::time::interval(Duration::from_secs(interval_secs));

        loop {
            ticker.tick().await;
            emit_scan_result(app.clone()).await;
        }
    });
}

pub async fn emit_scan_result(app: AppHandle) {
    let app_clone = app.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        let state = app_clone.state::<crate::commands::AppState>();
        crate::commands::scan_state(&state)
    })
    .await;

    if let Ok(scan_result) = result {
        let _ = app.emit("stats-updated", &scan_result);
    }
}
```

- [ ] **Step 4: Update tray scan action**

In `crates/codeviewer-desktop/src/tray.rs`, remove `Emitter` from the imports:

```rust
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};
```

Replace the `"scan"` menu branch with:

```rust
"scan" => {
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        crate::scanner_task::emit_scan_result(app).await;
    });
}
```

- [ ] **Step 5: Run desktop check**

Run:

```powershell
cargo check -p codeviewer-desktop
```

Expected: PASS after `aggregate` call sites compile.

- [ ] **Step 6: Commit shared scan helper**

Run:

```powershell
git add crates/codeviewer-desktop/src/commands.rs crates/codeviewer-desktop/src/scanner_task.rs crates/codeviewer-desktop/src/tray.rs
git commit -m "fix: share desktop scan flow"
```

---

## Task 4: Desktop Close Behavior

**Files:**
- Modify: `crates/codeviewer-desktop/src/lib.rs`
- Modify: `config.toml.example`

- [ ] **Step 1: Add close behavior handling**

In `crates/codeviewer-desktop/src/lib.rs`, add this import near the top:

```rust
use codeviewer_core::config::CloseBehavior;
```

Add `.on_window_event(...)` before `.setup(...)` in the Tauri builder chain:

```rust
.on_window_event(|window, event| {
    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
        let state = window.state::<AppState>();
        let behavior = state.config.lock().unwrap().close_behavior.clone();
        if behavior == CloseBehavior::Minimize {
            api.prevent_close();
            let _ = window.hide();
        }
    }
})
```

The surrounding builder should look like:

```rust
tauri::Builder::default()
    .manage(AppState {
        config: Mutex::new(config),
        config_path,
    })
    .on_window_event(|window, event| {
        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
            let state = window.state::<AppState>();
            let behavior = state.config.lock().unwrap().close_behavior.clone();
            if behavior == CloseBehavior::Minimize {
                api.prevent_close();
                let _ = window.hide();
            }
        }
    })
    .setup(|app| {
        #[cfg(desktop)]
        {
            tray::create_tray(app.handle())?;
        }
        scanner_task::spawn_scanner_task(app.handle().clone());
        Ok(())
    })
```

- [ ] **Step 2: Document config example**

In `config.toml.example`, add this line after `author_email`:

```toml
close_behavior = "minimize" # minimize hides to tray on close, exit quits the app
```

- [ ] **Step 3: Run desktop check**

Run:

```powershell
cargo check -p codeviewer-desktop
```

Expected: PASS.

- [ ] **Step 4: Commit close behavior**

Run:

```powershell
git add crates/codeviewer-desktop/src/lib.rs config.toml.example
git commit -m "fix: apply desktop close behavior"
```

---

## Task 5: Frontend Contract and Dashboard Data Source

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/api.ts`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Dashboard.tsx`

- [ ] **Step 1: Update frontend types**

In `frontend/src/types.ts`, add `RepoSummary`, `CloseBehavior`, and updated fields:

```ts
export interface DailyStat {
  date: string;
  insertions: number;
  deletions: number;
  files_changed: number;
  commits: number;
  repo_name: string;
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
```

- [ ] **Step 2: Update API event listener**

In `frontend/src/api.ts`, add:

```ts
export function onScanResultUpdated(callback: (result: ScanResult) => void) {
  return listen<ScanResult>("stats-updated", (event) => callback(event.payload));
}
```

Keep `onStatsUpdated` only if existing code still uses it during the task; remove it after `App.tsx` switches to `onScanResultUpdated`.

- [ ] **Step 3: Update App initial loading and event state**

In `frontend/src/App.tsx`, change the imports:

```ts
import { scanNow, onScanResultUpdated, getConfig } from "./api";
```

Add scan error state:

```ts
const [scanErrors, setScanErrors] = useState<string[]>([]);
```

Replace the data subscription effect with:

```ts
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
```

Update `handleConfigChange`:

```ts
const handleConfigChange = (updated: Config) => {
  setConfig(updated);
  scanNow()
    .then((result) => {
      setSummary(result.summary);
      setScanErrors(result.errors);
    })
    .catch(() => undefined);
};
```

Update the dashboard render:

```tsx
<Dashboard summary={summary} scanErrors={scanErrors} />
```

- [ ] **Step 4: Update Dashboard props and repository rows**

In `frontend/src/components/Dashboard.tsx`, remove `useMemo` and the local `RepoAgg` interface.

Change imports:

```ts
import type { Summary } from "../types";
```

Change props:

```ts
interface DashboardProps {
  summary: Summary;
  scanErrors: string[];
}
```

Change function signature:

```ts
export function Dashboard({ summary, scanErrors }: DashboardProps) {
  const repos = summary.repo_stats;
```

In the repo row mapping, replace camelCase fields:

```tsx
<div className="lang-updated">最后更新 {repo.last_date || "-"}</div>
...
<div className="lang-stat-value mono">{fmt(repo.commits)}</div>
...
<div className="lang-stat-value mono positive">
  +{fmt(repo.insertions)}
</div>
```

Add this alert below the total section and before the repo list:

```tsx
{scanErrors.length > 0 && (
  <div className="scan-error-box" role="alert">
    <div className="scan-error-title">部分仓库扫描失败</div>
    {scanErrors.map((error) => (
      <div className="scan-error-line" key={error}>
        {error}
      </div>
    ))}
  </div>
)}
```

- [ ] **Step 5: Add minimal scan error styles**

In `frontend/src/styles.css`, add:

```css
.scan-error-box {
  margin: 0 20px 18px;
  padding: 12px 14px;
  border: 1px solid color-mix(in srgb, var(--negative) 35%, var(--divider));
  border-radius: 8px;
  background: color-mix(in srgb, var(--negative) 9%, var(--surface));
  color: var(--text-primary);
}

.scan-error-title {
  font-size: 13px;
  font-weight: 700;
  margin-bottom: 6px;
}

.scan-error-line {
  font-size: 12px;
  color: var(--text-secondary);
  word-break: break-word;
}
```

- [ ] **Step 6: Run frontend verification**

Run:

```powershell
npm run build
npm run lint
```

from `frontend`.

Expected: both PASS.

- [ ] **Step 7: Commit frontend contract update**

Run:

```powershell
git add frontend/src/types.ts frontend/src/api.ts frontend/src/App.tsx frontend/src/components/Dashboard.tsx frontend/src/styles.css
git commit -m "fix: use repository summaries in dashboard"
```

---

## Task 6: Full Workspace Verification

**Files:**
- No planned source edits unless verification exposes a concrete failure.

- [ ] **Step 1: Run Rust check**

Run:

```powershell
cargo check
```

Expected: PASS.

- [ ] **Step 2: Run Rust tests**

Run:

```powershell
cargo test
```

Expected: PASS.

- [ ] **Step 3: Run frontend build**

Run:

```powershell
npm run build
```

from `frontend`.

Expected: PASS.

- [ ] **Step 4: Run frontend lint**

Run:

```powershell
npm run lint
```

from `frontend`.

Expected: PASS.

- [ ] **Step 5: Inspect final diff**

Run:

```powershell
git status --short
git diff --stat HEAD
```

Expected: only intentional files are modified or all task commits are complete.

- [ ] **Step 6: Final commit for verification fixes if needed**

If verification required small fixes, first inspect the exact modified files:

```powershell
git status --short
```

Then stage only the files changed by the verification fix. For example, if the fix touched `frontend/src/App.tsx` and `crates/codeviewer-desktop/src/commands.rs`, run:

```powershell
git add frontend/src/App.tsx crates/codeviewer-desktop/src/commands.rs
git commit -m "fix: complete codeviewer repair verification"
```

If no fixes were needed, do not create an empty commit.
