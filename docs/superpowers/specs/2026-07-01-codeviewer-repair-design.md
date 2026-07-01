# CodeViewer Repair Design

Date: 2026-07-01

## Goal

Repair the current CodeViewer project so the Rust workspace builds again and the partially added dashboard/config features are completed at the backend contract level.

The target scope is option B from the review follow-up:

- Restore `cargo check` and `cargo test`.
- Make `Summary.repo_stats` a real backend/frontend contract.
- Fix dashboard per-repository statistics so repositories are not inferred from merged global days.
- Make tray "scan now" trigger a real scan.
- Surface scan errors without blocking valid data.
- Make `close_behavior` work in the desktop backend, but do not add a settings UI for it yet.

## Current Problems

The Rust workspace currently fails to compile because `Summary` now contains `repo_stats`, but `aggregator::aggregate()` still constructs `Summary` without that field.

The existing dashboard derives repository rows from `summary.days[*].repo_name`. That is structurally wrong because `summary.days` is a global date series merged across repositories. The merged entries currently use an empty `repo_name`, so multi-repository dashboards can collapse into `unknown`.

The desktop tray emits a `trigger-scan` event for "scan now", but no code consumes that event. Users can click the menu item without a scan happening.

Scan errors are collected in some command paths but dropped in others, so the UI can show partial data without explaining that some repositories failed.

`close_behavior` exists in the core config model but is not applied by the Tauri window close path.

## Scope

In scope:

- Core model and aggregator contract cleanup.
- Desktop command and background scan data flow cleanup.
- Frontend type and dashboard data source updates.
- Minimal frontend error display for scan failures.
- Config example update for `close_behavior`.
- Tests and build verification.

Out of scope:

- New settings UI for `close_behavior`.
- New frontend test framework.
- Major UI redesign.
- Persistent scan cache redesign.
- GitHub sync functionality.

## Architecture

Use `RepoStat` as the aggregation input boundary.

`scanner::scan_repo()` remains focused on scanning one Git repository and returning `Vec<DailyStat>`. The caller that has access to configuration binds those stats to repository metadata:

```rust
RepoStat {
    repo_path,
    repo_name,
    daily_stats,
}
```

`aggregator::aggregate()` should accept `Vec<RepoStat>` and return `Summary`.

`Summary.days` is the global trend series. It is merged by date across all repositories and should not be used as a source of repository identity.

`Summary.repo_stats` is the dashboard repository list source. Each `RepoSummary` contains per-repository totals, last activity date, and that repository's daily stats.

## Data Flow

Desktop scan flow:

1. Read and clone `Config` while holding the mutex briefly.
2. Build scanner options from `author_email` and `scan.since_days`.
3. For each configured repo:
   - scan the repo;
   - on success, create a `RepoStat`;
   - on failure, append a user-visible error string.
4. Aggregate successful `RepoStat` values into `Summary`.
5. Return or emit `ScanResult { summary, errors }`.

The same scan helper should be reused by:

- `scan_now`
- initial dashboard loading command
- background scanner
- tray "scan now"

This prevents command paths from drifting.

## Frontend Contract

Update `frontend/src/types.ts` to include:

- `RepoSummary`
- `Summary.repo_stats`
- `CloseBehavior`
- `Config.close_behavior`

`Dashboard` should render repository rows from `summary.repo_stats`.

The trend chart should continue to use `summary.days`.

`App` should keep scan errors in state and pass them to the dashboard or render a small alert near the dashboard content. Errors should not prevent valid repository data from rendering.

## Desktop Behavior

Tray "scan now" should run the same scan helper used by `scan_now`, then emit an event with the fresh `ScanResult` or at least the fresh `Summary` plus scan errors.

Window close handling should read `Config.close_behavior`:

- `minimize`: prevent the close request and hide the main window.
- `exit`: allow the app to exit.

The default remains `minimize`.

## Error Handling

Scanning one bad repository must not fail the whole dashboard. Successful repositories should still contribute to the summary.

Each failed repository should produce a concise error containing the configured path and the scanner error.

Frontend copy should communicate partial results, for example: "Some repositories failed to scan" followed by the error list.

## Testing

Rust tests:

- `aggregator` merges same-day global stats while preserving per-repository `repo_stats`.
- `RepoSummary` totals are correct.
- `RepoSummary.last_date` is the latest daily stat date.
- Empty input returns zero totals, empty `days`, and empty `repo_stats`.
- Integration tests construct `Config` with `close_behavior` or use `..Default::default()`.

Frontend verification:

- `npm run build`
- `npm run lint`

Workspace verification:

- `cargo check`
- `cargo test`

## Acceptance Criteria

- `cargo check` passes.
- `cargo test` passes.
- `npm run build` passes.
- `npm run lint` passes.
- Dashboard repository rows come from `summary.repo_stats`.
- Multi-repository data no longer collapses into a single `unknown` row.
- Broken repository paths are visible as scan errors while valid data still renders.
- Tray "scan now" refreshes statistics.
- `close_behavior = "minimize"` hides the window on close.
- `close_behavior = "exit"` exits the app on close.

