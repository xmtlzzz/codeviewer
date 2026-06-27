# CodeViewer — 每日代码行数实时追踪器 实现计划 (v2 — review 修正版)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个跨平台（Windows/macOS）桌面小工具，基于 git 提交记录 + 定时后台扫描，实时追踪每天写了多少行代码，通过系统托盘展示统计结果。

**Architecture:** Rust workspace 双 crate 结构——`codeviewer-core`（核心库 + CLI）和 `codeviewer-desktop`（Tauri 桌面壳）。前端 React+Vite+TypeScript+Chart.js。借鉴 vlook 项目的技术选型与已验证的 API 模式，全新独立代码库。

**Tech Stack:** Rust, git2, serde (JSON/TOML), Tauri 2.x, tauri::async_runtime, React, Vite, TypeScript, Chart.js

**v2 修正要点（基于 review 反馈）：**
- chrono: 用 `DateTime::from_timestamp(secs, 0).unwrap_or_default().with_timezone(&Local).date_naive()`（非 `timestamp_opt().unwrap()`）
- git2: 用 `Patch::from_diff` 逐文件统计行数（非 `DiffStats`）；加 `Sort::TIME`；`push_head().is_err()` 守卫空仓库；跳过 merge commits
- Tauri 2.x: 用 `Menu::with_items` / `MenuItem::with_id` / `TrayIconBuilder::with_id`（非 1.x 的 `SystemTray*`）；`show_menu_on_left_click(false)`；`MouseButtonState::Up`
- 异步: 用 `tauri::async_runtime::spawn` + `spawn_blocking`（非 `tokio::spawn` 直接调同步 git2）
- Mutex: clone config 后立即 drop lock，不在持锁时做长操作
- Workspace: 初始只含 `codeviewer-core`，Task 8 时加 `codeviewer-desktop`
- 错误: 自定义 `ScanError` enum，不混用 `Box<dyn Error>`
- 测试: 精确断言（`assert_eq!` 非 `assert!(>=)`）
- UI 放最后：Phase 8 才做前端，Tauri 阶段用 placeholder HTML

---

## 文件结构

```
codeviewer/
├── .gitignore
├── Cargo.toml                     # workspace 根（初始只含 core）
├── crates/
│   ├── codeviewer-core/
│   │   ├── Cargo.toml
│   │   ├── src/
│   │   │   ├── lib.rs             # pub re-export
│   │   │   ├── models.rs          # DailyStat, RepoStat, Summary
│   │   │   ├── error.rs           # ScanError enum
│   │   │   ├── scanner.rs         # git2 仓库扫描
│   │   │   ├── aggregator.rs      # 多仓库聚合
│   │   │   ├── storage.rs         # JSON 读写
│   │   │   ├── config.rs          # TOML 配置
│   │   │   └── bin/
│   │   │       └── codeviewer.rs  # CLI
│   │   └── tests/
│   │       └── integration_test.rs
│   └── codeviewer-desktop/        # Task 8 创建
│       ├── Cargo.toml
│       ├── src/
│       │   ├── main.rs
│       │   ├── tray.rs
│       │   ├── commands.rs
│       │   └── scanner_task.rs
│       ├── tauri.conf.json
│       └── icons/
├── frontend/                      # Phase 8 创建
├── config.toml.example
└── docs/superpowers/plans/
    └── 2026-06-27-codeviewer-tracker.md
```

---

## Phase 1: 脚手架 + 数据模型

### Task 1: Cargo Workspace + 数据模型 + 错误类型

**Files:**
- Create: `Cargo.toml`, `.gitignore`
- Create: `crates/codeviewer-core/Cargo.toml`
- Create: `crates/codeviewer-core/src/lib.rs`
- Create: `crates/codeviewer-core/src/models.rs`
- Create: `crates/codeviewer-core/src/error.rs`

- [ ] **Step 1: 创建 .gitignore**

```
/target
/frontend/node_modules
/frontend/dist
*.log
```

- [ ] **Step 2: 创建 workspace 根 Cargo.toml（只含 core）**

```toml
[workspace]
members = ["crates/codeviewer-core"]
resolver = "2"

[workspace.package]
version = "0.1.0"
edition = "2021"
```

- [ ] **Step 3: 创建 codeviewer-core/Cargo.toml**

```toml
[package]
name = "codeviewer-core"
version.workspace = true
edition.workspace = true

[lib]
name = "codeviewer_core"
path = "src/lib.rs"

[[bin]]
name = "codeviewer"
path = "src/bin/codeviewer.rs"

[dependencies]
git2 = "0.18"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
toml = "0.8"
chrono = { version = "0.4", features = ["serde"] }
dirs = "5"

[dev-dependencies]
tempfile = "3"
```

- [ ] **Step 4: 创建 error.rs**

```rust
use std::fmt;

#[derive(Debug)]
pub enum ScanError {
    PathNotFound(String),
    NotAGitRepo(String),
    Git(String),
    Io(String),
    Json(String),
    Toml(String),
}

impl fmt::Display for ScanError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ScanError::PathNotFound(p) => write!(f, "path does not exist: {p}"),
            ScanError::NotAGitRepo(p) => write!(f, "not a git repository: {p}"),
            ScanError::Git(msg) => write!(f, "git error: {msg}"),
            ScanError::Io(msg) => write!(f, "io error: {msg}"),
            ScanError::Json(msg) => write!(f, "json error: {msg}"),
            ScanError::Toml(msg) => write!(f, "toml error: {msg}"),
        }
    }
}

impl std::error::Error for ScanError {}

impl From<git2::Error> for ScanError {
    fn from(e: git2::Error) -> Self { ScanError::Git(e.to_string()) }
}
impl From<std::io::Error> for ScanError {
    fn from(e: std::io::Error) -> Self { ScanError::Io(e.to_string()) }
}
impl From<serde_json::Error> for ScanError {
    fn from(e: serde_json::Error) -> Self { ScanError::Json(e.to_string()) }
}
impl From<toml::de::Error> for ScanError {
    fn from(e: toml::de::Error) -> Self { ScanError::Toml(e.to_string()) }
}
```

- [ ] **Step 5: 创建 models.rs**

```rust
use chrono::NaiveDate;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DailyStat {
    pub date: NaiveDate,
    pub insertions: u64,
    pub deletions: u64,
    pub files_changed: u32,
    pub commits: u32,
    pub repo_name: String,
}

impl DailyStat {
    pub fn net_lines(&self) -> i64 {
        self.insertions as i64 - self.deletions as i64
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepoStat {
    pub repo_path: String,
    pub repo_name: String,
    pub daily_stats: Vec<DailyStat>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Summary {
    pub today_insertions: u64,
    pub today_deletions: u64,
    pub today_commits: u32,
    pub week_insertions: u64,
    pub total_insertions: u64,
    pub total_deletions: u64,
    pub total_commits: u32,
    pub days: Vec<DailyStat>,
}
```

- [ ] **Step 6: 创建 lib.rs**

```rust
pub mod models;
pub mod error;
pub mod scanner;
pub mod aggregator;
pub mod storage;
pub mod config;
```

同时创建空文件：`src/scanner.rs`, `src/aggregator.rs`, `src/storage.rs`, `src/config.rs`（各放一行注释占位）。不创建 `src/bin/codeviewer.rs`（Task 5 时创建，否则 workspace 找不到 bin 会报错）。

**临时措施：** 从 Cargo.toml 中移除 `[[bin]]` 节，Task 5 时再加回。

- [ ] **Step 7: 验证编译 + 测试**

Run: `cargo check -p codeviewer-core && cargo test -p codeviewer-core`
Expected: 编译通过

- [ ] **Step 8: Commit**

```bash
git init && git add -A && git commit -m "feat: scaffold workspace with models and error types"
```

---

## Phase 2: Git 扫描器

### Task 2: git2 仓库扫描器（借鉴 vlook repo.rs）

**Files:**
- Create: `crates/codeviewer-core/src/scanner.rs`

核心模块。用 git2 打开仓库，遍历 commit 历史，跳过 merge commits，用 `Patch::from_diff` 逐文件统计 insertions，按日期聚合。

- [ ] **Step 1: 实现 scanner.rs**

```rust
use crate::error::ScanError;
use crate::models::DailyStat;
use chrono::{DateTime, Local, NaiveDate};
use git2::{Repository, Sort};
use std::collections::BTreeMap;
use std::path::Path;

#[derive(Debug, Clone)]
pub struct ScanOptions {
    pub author_email: Option<String>,
    pub since_days: Option<u32>,
}

impl Default for ScanOptions {
    fn default() -> Self {
        ScanOptions { author_email: None, since_days: Some(30) }
    }
}

pub fn scan_repo(repo_path: &Path, opts: &ScanOptions) -> Result<Vec<DailyStat>, ScanError> {
    if !repo_path.exists() {
        return Err(ScanError::PathNotFound(repo_path.display().to_string()));
    }
    let repo = Repository::open(repo_path)
        .map_err(|_| ScanError::NotAGitRepo(repo_path.display().to_string()))?;

    let repo_name = repo_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    let mut revwalk = repo.revwalk()?;
    revwalk.set_sorting(Sort::TIME)?;

    if revwalk.push_head().is_err() {
        return Ok(Vec::new());
    }

    let cutoff = opts.since_days.map(|d| {
        Local::now().date_naive() - chrono::Duration::days(d as i64)
    });

    let mut by_date: BTreeMap<NaiveDate, DailyStat> = BTreeMap::new();

    for oid_result in revwalk {
        let oid = oid_result?;
        let commit = repo.find_commit(oid)?;

        // 作者过滤
        if let Some(ref email) = opts.author_email {
            let author_email = commit.author().email().unwrap_or("");
            if author_email != email {
                continue;
            }
        }

        let commit_date = DateTime::from_timestamp(commit.time().seconds(), 0)
            .unwrap_or_default()
            .with_timezone(&Local)
            .date_naive();

        if let Some(cutoff_date) = cutoff {
            if commit_date < cutoff_date {
                continue;
            }
        }

        // 跳过 merge commits
        if commit.parent_count() > 1 {
            continue;
        }

        let tree = commit.tree()?;
        let parent_tree = if commit.parent_count() == 0 {
            None
        } else {
            Some(commit.parent(0)?.tree()?)
        };

        let diff = repo.diff_tree_to_tree(parent_tree.as_ref(), Some(&tree), None)?;

        let mut insertions: u64 = 0;
        let mut deletions: u64 = 0;
        let mut files_changed: u32 = 0;

        let deltas: Vec<_> = diff.deltas().collect();
        for (delta_idx, delta) in deltas.iter().enumerate() {
            if delta.flags().is_binary() {
                continue;
            }
            files_changed += 1;
            if let Ok(patch) = git2::Patch::from_diff(&diff, delta_idx) {
                if let Ok((_, additions, deletions_count)) = patch.line_stats() {
                    insertions += additions as u64;
                    deletions += deletions_count as u64;
                }
            }
        }

        let entry = by_date.entry(commit_date).or_insert_with(|| DailyStat {
            date: commit_date,
            insertions: 0,
            deletions: 0,
            files_changed: 0,
            commits: 0,
            repo_name: repo_name.clone(),
        });
        entry.insertions += insertions;
        entry.deletions += deletions;
        entry.files_changed += files_changed;
        entry.commits += 1;
    }

    Ok(by_date.into_values().collect())
}
```

- [ ] **Step 2: 编写测试（用 git2 API 创建 test repo，精确断言）**

在 scanner.rs 底部添加 `#[cfg(test)] mod tests`，参考 vlook 的 `make_test_repo` + `create_commit` helper：

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use git2::Signature;
    use std::fs;
    use tempfile::TempDir;

    fn make_test_repo() -> (TempDir, Repository) {
        let dir = TempDir::new().unwrap();
        let repo = Repository::init(dir.path()).unwrap();
        {
            let mut config = repo.config().unwrap();
            config.set_str("user.name", "Test").unwrap();
            config.set_str("user.email", "test@example.com").unwrap();
        }
        (dir, repo)
    }

    fn create_commit(repo: &Repository, files: &[(&str, &str)]) {
        let sig = Signature::now("Test", "test@example.com").unwrap();
        let mut index = repo.index().unwrap();
        for (path, content) in files {
            let full = repo.workdir().unwrap().join(path);
            if let Some(p) = full.parent() { fs::create_dir_all(p).unwrap(); }
            fs::write(&full, content).unwrap();
            index.add_path(Path::new(path)).unwrap();
        }
        index.write().unwrap();
        let tree_id = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_id).unwrap();
        let parent = repo.head().ok().and_then(|r| r.target()).map(|oid| repo.find_commit(oid).unwrap());
        let parents: Vec<&git2::Commit> = parent.iter().collect();
        repo.commit(Some("HEAD"), &sig, &sig, "test", &tree, &parents).unwrap();
    }

    #[test]
    fn test_empty_repo() {
        let dir = TempDir::new().unwrap();
        Repository::init(dir.path()).unwrap();
        let stats = scan_repo(dir.path(), &ScanOptions::default()).unwrap();
        assert!(stats.is_empty());
    }

    #[test]
    fn test_count_insertions() {
        let (dir, repo) = make_test_repo();
        create_commit(&repo, &[("main.rs", "line1\nline2\nline3\n")]);
        let stats = scan_repo(dir.path(), &ScanOptions::default()).unwrap();
        assert_eq!(stats.len(), 1);
        assert_eq!(stats[0].insertions, 3);
        assert_eq!(stats[0].commits, 1);
    }

    #[test]
    fn test_multiple_commits_same_day() {
        let (dir, repo) = make_test_repo();
        create_commit(&repo, &[("a.rs", "x\n")]);
        create_commit(&repo, &[("b.rs", "y\nz\n")]);
        let stats = scan_repo(dir.path(), &ScanOptions::default()).unwrap();
        assert_eq!(stats.len(), 1);
        assert_eq!(stats[0].insertions, 3);
        assert_eq!(stats[0].commits, 2);
    }

    #[test]
    fn test_author_filter() {
        let (dir, repo) = make_test_repo();
        // 用不同 email 提交
        let sig = Signature::now("Other", "other@example.com").unwrap();
        let mut index = repo.index().unwrap();
        fs::write(repo.workdir().unwrap().join("x.rs"), "x\n").unwrap();
        index.add_path(Path::new("x.rs")).unwrap();
        index.write().unwrap();
        let tree = repo.find_tree(index.write_tree().unwrap()).unwrap();
        repo.commit(Some("HEAD"), &sig, &sig, "other", &tree, &[]).unwrap();

        let opts = ScanOptions { author_email: Some("nobody@example.com".into()), since_days: None };
        let stats = scan_repo(dir.path(), &opts).unwrap();
        assert!(stats.is_empty());
    }

    #[test]
    fn test_non_git_dir() {
        let dir = TempDir::new().unwrap();
        let result = scan_repo(dir.path(), &ScanOptions::default());
        assert!(matches!(result, Err(ScanError::NotAGitRepo(_))));
    }

    #[test]
    fn test_nonexistent_path() {
        let result = scan_repo(Path::new("/nonexistent/abc123"), &ScanOptions::default());
        assert!(matches!(result, Err(ScanError::PathNotFound(_))));
    }
}
```

- [ ] **Step 3: 运行测试**

Run: `cargo test -p codeviewer-core scanner`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: implement git2 scanner with Patch line counting and author filter"
```

---

## Phase 3: 存储与配置

### Task 3: JSON 存储 + TOML 配置

**Files:**
- Create: `crates/codeviewer-core/src/storage.rs`
- Create: `crates/codeviewer-core/src/config.rs`
- Create: `config.toml.example`

- [ ] **Step 1: 实现 storage.rs**

```rust
use crate::error::ScanError;
use crate::models::RepoStat;
use std::path::Path;

pub fn save(path: &Path, stats: &[RepoStat]) -> Result<(), ScanError> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let json = serde_json::to_string_pretty(stats)?;
    std::fs::write(path, json)?;
    Ok(())
}

pub fn load(path: &Path) -> Result<Vec<RepoStat>, ScanError> {
    let content = std::fs::read_to_string(path)?;
    let stats: Vec<RepoStat> = serde_json::from_str(&content)?;
    Ok(stats)
}
```

- [ ] **Step 2: 实现 config.rs**

```rust
use crate::error::ScanError;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    #[serde(default)]
    pub repos: Vec<RepoEntry>,
    #[serde(default)]
    pub scan: ScanConfig,
    #[serde(default)]
    pub author_email: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepoEntry {
    pub path: String,
    #[serde(default)]
    pub name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanConfig {
    #[serde(default = "default_interval")]
    pub interval_secs: u64,
    #[serde(default = "default_since_days")]
    pub since_days: u32,
}

fn default_interval() -> u64 { 30 }
fn default_since_days() -> u32 { 30 }

impl Default for ScanConfig {
    fn default() -> Self {
        ScanConfig { interval_secs: 30, since_days: 30 }
    }
}

impl Default for Config {
    fn default() -> Self {
        Config { repos: Vec::new(), scan: ScanConfig::default(), author_email: String::new() }
    }
}

impl Config {
    pub fn load(path: &Path) -> Result<Self, ScanError> {
        let content = std::fs::read_to_string(path)?;
        Self::parse(&content)
    }

    pub fn parse(toml_str: &str) -> Result<Self, ScanError> {
        let mut config: Config = toml::from_str(toml_str)?;
        if config.scan.interval_secs < 5 {
            config.scan.interval_secs = 5;
        }
        Ok(config)
    }

    pub fn save(&self, path: &Path) -> Result<(), ScanError> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let toml_str = toml::to_string_pretty(self)
            .map_err(|e| ScanError::Toml(e.to_string()))?;
        std::fs::write(path, toml_str)?;
        Ok(())
    }
}

use std::path::Path;
```

- [ ] **Step 3: 创建 config.toml.example**

```toml
# CodeViewer 配置

author_email = "your-email@example.com"  # 只统计此作者的提交

[[repos]]
path = "/path/to/your/project"

[scan]
interval_secs = 30   # 后台扫描间隔（秒），最低 5
since_days = 30      # 统计最近多少天
```

- [ ] **Step 4: 编写测试 + 运行**

在 storage.rs 和 config.rs 各加 `#[cfg(test)] mod tests`，测试 save/load roundtrip、config parse、default values。精确断言。

Run: `cargo test -p codeviewer-core`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add JSON storage and TOML config with author_email"
```

---

## Phase 4: 聚合器

### Task 4: 多仓库聚合 + Summary 生成

**Files:**
- Create: `crates/codeviewer-core/src/aggregator.rs`

- [ ] **Step 1: 实现 aggregator.rs**

```rust
use crate::models::{DailyStat, Summary};
use chrono::{Local, NaiveDate};
use std::collections::BTreeMap;

pub fn aggregate(repos: Vec<Vec<DailyStat>>) -> Summary {
    let today = Local::now().date_naive();
    let week_ago = today - chrono::Duration::days(7);

    let mut by_date: BTreeMap<NaiveDate, DailyStat> = BTreeMap::new();
    let mut total_insertions = 0u64;
    let mut total_deletions = 0u64;
    let mut total_commits = 0u32;
    let mut today_insertions = 0u64;
    let mut today_deletions = 0u64;
    let mut today_commits = 0u32;
    let mut week_insertions = 0u64;

    for repo_stats in repos {
        for stat in repo_stats {
            total_insertions += stat.insertions;
            total_deletions += stat.deletions;
            total_commits += stat.commits;

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
                repo_name: String::new(),
            });
            entry.insertions += stat.insertions;
            entry.deletions += stat.deletions;
            entry.files_changed += stat.files_changed;
            entry.commits += stat.commits;
        }
    }

    Summary {
        today_insertions,
        today_deletions,
        today_commits,
        week_insertions,
        total_insertions,
        total_deletions,
        total_commits,
        days: by_date.into_values().collect(),
    }
}
```

- [ ] **Step 2: 编写测试（精确断言：两 repo 同日聚合、week 隔离）**

Run: `cargo test -p codeviewer-core aggregator`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add multi-repo aggregator with today/week/total summary"
```

---

## Phase 5: CLI

### Task 5: CLI binary

**Files:**
- Create: `crates/codeviewer-core/src/bin/codeviewer.rs`
- Modify: `crates/codeviewer-core/Cargo.toml`（加回 `[[bin]]` 节）

- [ ] **Step 1: 在 Cargo.toml 加回 `[[bin]]` 节**

```toml
[[bin]]
name = "codeviewer"
path = "src/bin/codeviewer.rs"
```

- [ ] **Step 2: 实现 CLI**

```rust
use codeviewer_core::{aggregator, config, scanner, storage, models};
use std::path::PathBuf;

fn config_path() -> PathBuf {
    std::env::var("CODEVIEWER_CONFIG").map(PathBuf::from).unwrap_or_else(|_| {
        dirs::config_dir().unwrap_or_else(|| PathBuf::from("."))
            .join("codeviewer").join("config.toml")
    })
}

fn scan_all(config: &config::Config) -> Vec<Vec<models::DailyStat>> {
    let opts = scanner::ScanOptions {
        author_email: if config.author_email.is_empty() { None } else { Some(config.author_email.clone()) },
        since_days: Some(config.scan.since_days),
    };
    config.repos.iter()
        .filter_map(|r| scanner::scan_repo(std::path::Path::new(&r.path), &opts).ok())
        .collect()
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let cmd = args.get(1).as_deref().unwrap_or("today");

    let config = config::Config::load(&config_path()).unwrap_or_default();

    match cmd {
        "today" => {
            let summary = aggregator::aggregate(scan_all(&config));
            println!("今日: +{}/-{} (净 {} 行, {} commits)",
                summary.today_insertions, summary.today_deletions,
                summary.today_insertions as i64 - summary.today_deletions as i64,
                summary.today_commits);
        }
        "week" => {
            let summary = aggregator::aggregate(scan_all(&config));
            println!("最近 7 天:");
            for d in &summary.days {
                if d.date >= chrono::Local::now().date_naive() - chrono::Duration::days(7) {
                    println!("  {} +{}/-{} ({} commits)", d.date, d.insertions, d.deletions, d.commits);
                }
            }
            println!("合计: +{} ({} commits)", summary.week_insertions, summary.total_commits);
        }
        "scan" => {
            let all = scan_all(&config);
            let repo_stats: Vec<models::RepoStat> = config.repos.iter().zip(all.iter())
                .map(|(r, stats)| models::RepoStat {
                    repo_path: r.path.clone(),
                    repo_name: std::path::Path::new(&r.path).file_name().and_then(|n| n.to_str()).unwrap_or("unknown").to_string(),
                    daily_stats: stats.clone(),
                }).collect();
            let store_path = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."))
                .join("codeviewer").join("stats.json");
            match storage::save(&store_path, &repo_stats) {
                Ok(()) => println!("已保存到 {}", store_path.display()),
                Err(e) => eprintln!("保存失败: {}", e),
            }
        }
        _ => {
            println!("CodeViewer — 每日代码行数追踪器\n\n用法: codeviewer <command>\n\n命令:\n  today   今日统计\n  week    最近 7 天\n  scan    扫描并保存\n  help    帮助");
        }
    }
}
```

- [ ] **Step 3: 验证编译 + 手动测试**

Run: `cargo build -p codeviewer-core && cargo run -p codeviewer-core -- help`

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: add CLI with today/week/scan commands"
```

---

## Phase 6: Tauri 桌面壳（后端，无前端 UI）

### Task 6: Tauri 项目 + 系统托盘 + 后台扫描

**Files:**
- Create: `crates/codeviewer-desktop/Cargo.toml`
- Create: `crates/codeviewer-desktop/tauri.conf.json`
- Create: `crates/codeviewer-desktop/build.rs`
- Create: `crates/codeviewer-desktop/src/main.rs`
- Create: `crates/codeviewer-desktop/src/tray.rs`
- Create: `crates/codeviewer-desktop/src/commands.rs`
- Create: `crates/codeviewer-desktop/src/scanner_task.rs`
- Create: `crates/codeviewer-desktop/icons/` (placeholder)
- Modify: `Cargo.toml`（workspace members 加 desktop）
- Create: `frontend/dist/index.html` (placeholder，让 generate_context! 编译通过)

- [ ] **Step 1: workspace 根 Cargo.toml 加 desktop 成员**

```toml
[workspace]
members = ["crates/codeviewer-core", "crates/codeviewer-desktop"]
resolver = "2"
```

- [ ] **Step 2: 创建 placeholder frontend/dist/index.html**

```html
<!DOCTYPE html><html><body><h1>CodeViewer</h1><p>UI loading...</p></body></html>
```

- [ ] **Step 3: 创建 codeviewer-desktop/Cargo.toml**

```toml
[package]
name = "codeviewer-desktop"
version.workspace = true
edition.workspace = true

[dependencies]
codeviewer-core = { path = "../codeviewer-core" }
tauri = { version = "2", features = ["tray-icon"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
dirs = "5"
chrono = "0.4"

[build-dependencies]
tauri-build = { version = "2" }
```

- [ ] **Step 4: 创建 tauri.conf.json（借鉴 vlook，beforeDevCommand 置空）**

```json
{
  "productName": "CodeViewer",
  "version": "0.1.0",
  "identifier": "com.codeviewer.app",
  "build": {
    "beforeDevCommand": "",
    "devUrl": "http://localhost:5173",
    "beforeBuildCommand": "",
    "frontendDist": "../../frontend/dist"
  },
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "CodeViewer",
        "width": 800,
        "height": 600,
        "resizable": true,
        "visible": false
      }
    ],
    "security": { "csp": null }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": ["icons/icon.png", "icons/icon.ico", "icons/icon.icns"]
  }
}
```

- [ ] **Step 5: 创建 build.rs**

```rust
fn main() { tauri_build::build() }
```

- [ ] **Step 6: 实现 tray.rs（Tauri 2.x API，借鉴 vlook）**

```rust
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};

pub fn create_tray(app: &tauri::AppHandle) -> tauri::Result<()> {
    let show_item = MenuItem::with_id(app, "show", "显示面板", true, None::<&str>)?;
    let scan_item = MenuItem::with_id(app, "scan", "立即扫描", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show_item, &scan_item, &quit_item])?;

    TrayIconBuilder::with_id("codeviewer-tray")
        .icon(app.default_window_icon().unwrap().clone())
        .tooltip("CodeViewer — 代码行数追踪")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(move |app, event| match event.id.as_ref() {
            "show" => {
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.show();
                    let _ = win.set_focus();
                }
            }
            "scan" => { let _ = app.emit("trigger-scan", ()); }
            "quit" => { app.exit(0); }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.show();
                    let _ = win.unminimize();
                    let _ = win.set_focus();
                }
            }
        })
        .build(app)?;
    Ok(())
}
```

- [ ] **Step 7: 实现 commands.rs（clone config 后 drop lock，收集 errors）**

```rust
use codeviewer_core::{aggregator, config, models, scanner};
use std::sync::Mutex;
use tauri::State;

pub struct AppState {
    pub config: Mutex<config::Config>,
}

fn scan_all(config: &config::Config) -> (Vec<Vec<models::DailyStat>>, Vec<String>) {
    let opts = scanner::ScanOptions {
        author_email: if config.author_email.is_empty() { None } else { Some(config.author_email.clone()) },
        since_days: Some(config.scan.since_days),
    };
    let mut all = Vec::new();
    let mut errors = Vec::new();
    for r in &config.repos {
        match scanner::scan_repo(std::path::Path::new(&r.path), &opts) {
            Ok(stats) => all.push(stats),
            Err(e) => errors.push(format!("{}: {}", r.path, e)),
        }
    }
    (all, errors)
}

#[tauri::command]
pub fn get_summary(state: State<'_, AppState>) -> models::Summary {
    let config = state.config.lock().unwrap().clone();
    let (all, _errors) = scan_all(&config);
    aggregator::aggregate(all)
}

#[tauri::command]
pub fn get_config(state: State<'_, AppState>) -> config::Config {
    state.config.lock().unwrap().clone()
}

#[derive(serde::Serialize)]
pub struct ScanResult {
    pub summary: models::Summary,
    pub errors: Vec<String>,
}

#[tauri::command]
pub fn scan_now(state: State<'_, AppState>) -> ScanResult {
    let config = state.config.lock().unwrap().clone();
    let (all, errors) = scan_all(&config);
    let summary = aggregator::aggregate(all);
    ScanResult { summary, errors }
}
```

- [ ] **Step 8: 实现 scanner_task.rs（tauri::async_runtime + spawn_blocking）**

```rust
use codeviewer_core::{aggregator, config, scanner};
use std::time::Duration;
use tauri::{AppHandle, Emitter};

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
            let app_clone = app.clone();
            let result = tauri::async_runtime::spawn_blocking(move || {
                let state = app_clone.state::<crate::commands::AppState>();
                let config = state.config.lock().unwrap().clone();
                let opts = scanner::ScanOptions {
                    author_email: if config.author_email.is_empty() { None } else { Some(config.author_email.clone()) },
                    since_days: Some(config.scan.since_days),
                };
                let mut all = Vec::new();
                for r in &config.repos {
                    if let Ok(stats) = scanner::scan_repo(std::path::Path::new(&r.path), &opts) {
                        all.push(stats);
                    }
                }
                aggregator::aggregate(all)
            }).await;
            if let Ok(summary) = result {
                let _ = app.emit("stats-updated", &summary);
            }
        }
    });
}
```

注意：desktop Cargo.toml 需要加 `tokio = { version = "1", features = ["time"] }` 依赖（interval 需要）。或者用 `tauri::async_runtime` 提供的 timer 替代。编译时根据错误调整。

- [ ] **Step 9: 实现 main.rs**

```rust
mod commands;
mod tray;
mod scanner_task;

use codeviewer_core::config;
use commands::AppState;
use std::sync::Mutex;

fn main() {
    let config_path = dirs::config_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("codeviewer").join("config.toml");
    let config = config::Config::load(&config_path).unwrap_or_default();

    tauri::Builder::default()
        .manage(AppState { config: Mutex::new(config) })
        .invoke_handler(tauri::generate_handler![
            commands::get_summary,
            commands::get_config,
            commands::scan_now,
        ])
        .setup(|app| {
            tray::create_tray(app.handle())?;
            scanner_task::spawn_scanner_task(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running codeviewer");
}
```

- [ ] **Step 10: 创建 placeholder 图标**

用一张简单的 PNG 放到 `crates/codeviewer-desktop/icons/icon.png`（可以用任何 32x32+ 的 PNG）。

- [ ] **Step 11: 验证编译**

Run: `cargo check -p codeviewer-desktop`
Expected: 编译通过

- [ ] **Step 12: Commit**

```bash
git add -A && git commit -m "feat: add tauri desktop shell with tray, commands, and background scanner"
```

---

## Phase 7: 集成测试

### Task 7: 端到端集成测试

**Files:**
- Create: `crates/codeviewer-core/tests/integration_test.rs`

- [ ] **Step 1: 编写集成测试（完整 pipeline: config → scan → aggregate → save → load）**

测试场景：
1. 创建两个临时 git repo，各做 1-2 次提交
2. 扫描两个 repo
3. 聚合
4. 保存到 JSON
5. 加载并验证

```rust
use codeviewer_core::{aggregator, config, scanner, storage, models};
use git2::{Repository, Signature};
use std::fs;
use std::path::Path;
use tempfile::TempDir;

fn make_repo_with_commit(dir: &Path, filename: &str, content: &str) {
    let repo = Repository::init(dir).unwrap();
    let mut cfg = repo.config().unwrap();
    cfg.set_str("user.name", "Test").unwrap();
    cfg.set_str("user.email", "test@example.com").unwrap();
    let sig = Signature::now("Test", "test@example.com").unwrap();
    let mut index = repo.index().unwrap();
    fs::write(dir.join(filename), content).unwrap();
    index.add_path(Path::new(filename)).unwrap();
    index.write().unwrap();
    let tree = repo.find_tree(index.write_tree().unwrap()).unwrap();
    repo.commit(Some("HEAD"), &sig, &sig, "test", &tree, &[]).unwrap();
}

#[test]
fn test_full_pipeline() {
    let dir1 = TempDir::new().unwrap();
    let dir2 = TempDir::new().unwrap();
    make_repo_with_commit(dir1.path(), "a.rs", "line1\nline2\n");
    make_repo_with_commit(dir2.path(), "b.rs", "hello\n");

    let opts = scanner::ScanOptions::default();
    let stats1 = scanner::scan_repo(dir1.path(), &opts).unwrap();
    let stats2 = scanner::scan_repo(dir2.path(), &opts).unwrap();

    let summary = aggregator::aggregate(vec![stats1.clone(), stats2.clone()]);
    assert_eq!(summary.total_insertions, 3); // 2 + 1
    assert_eq!(summary.total_commits, 2);

    let repo_stats = vec![
        models::RepoStat { repo_path: dir1.path().to_string_lossy().into_owned(), repo_name: "repo1".into(), daily_stats: stats1 },
        models::RepoStat { repo_path: dir2.path().to_string_lossy().into_owned(), repo_name: "repo2".into(), daily_stats: stats2 },
    ];
    let store = TempDir::new().unwrap();
    let store_path = store.path().join("stats.json");
    storage::save(&store_path, &repo_stats).unwrap();
    let loaded = storage::load(&store_path).unwrap();
    assert_eq!(loaded.len(), 2);
}

#[test]
fn test_config_parse() {
    let toml_str = r#"
author_email = "test@example.com"

[[repos]]
path = "/tmp/a"

[scan]
interval_secs = 15
since_days = 7
"#;
    let config = config::Config::parse(toml_str).unwrap();
    assert_eq!(config.author_email, "test@example.com");
    assert_eq!(config.repos.len(), 1);
    assert_eq!(config.scan.interval_secs, 15);
    assert_eq!(config.scan.since_days, 7);
}
```

- [ ] **Step 2: 运行全部测试**

Run: `cargo test`
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "test: add end-to-end integration tests"
```

---

## Phase 8: 前端 UI（最后）

### Task 8: React + Vite + 仪表盘

**Files:**
- Create: `frontend/package.json`, `frontend/vite.config.ts`, `frontend/tsconfig.json`
- Create: `frontend/index.html`, `frontend/src/main.tsx`, `frontend/src/styles.css`
- Create: `frontend/src/types.ts`, `frontend/src/api.ts`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/components/Dashboard.tsx`, `TrendChart.tsx`, `RepoList.tsx`

- [ ] **Step 1: 初始化 Vite 项目**

```bash
cd frontend && npm create vite@latest . -- --template react-ts && npm install && npm install chart.js react-chartjs-2 @tauri-apps/api
```

- [ ] **Step 2: 创建 types.ts（镜像 Rust models，snake_case）**

```typescript
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
}
```

- [ ] **Step 3: 创建 api.ts**

```typescript
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Summary, Config } from "./types";

export async function getSummary(): Promise<Summary> {
  return invoke<Summary>("get_summary");
}
export async function getConfig(): Promise<Config> {
  return invoke<Config>("get_config");
}
export function onStatsUpdated(cb: (s: Summary) => void) {
  return listen<Summary>("stats-updated", (e) => cb(e.payload));
}
```

- [ ] **Step 4: 创建 styles.css（暗色主题）**

```css
:root { --bg: #1a1a2e; --card: #16213e; --text: #e0e0e0; }
body { margin: 0; background: var(--bg); color: var(--text); font-family: system-ui; }
.app { max-width: 800px; margin: 0 auto; padding: 20px; }
.card { background: var(--card); border-radius: 12px; padding: 20px; margin-bottom: 16px; }
.stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.stat { text-align: center; }
.stat-label { display: block; font-size: 0.85rem; opacity: 0.7; }
.stat-value { font-size: 1.5rem; font-weight: bold; }
.positive { color: #4ade80; } .negative { color: #f87171; }
.repo-list { list-style: none; padding: 0; }
.repo-list li { padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.1); }
```

- [ ] **Step 5: 实现 App.tsx（单一数据源，props 传递给 Dashboard）**

```tsx
import { useEffect, useState } from "react";
import { getSummary, onStatsUpdated } from "./api";
import type { Summary } from "./types";
import { Dashboard } from "./components/Dashboard";
import { TrendChart } from "./components/TrendChart";
import "./styles.css";

export default function App() {
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    getSummary().then(setSummary);
    const unlisten = onStatsUpdated(setSummary);
    return () => { unlisten.then(fn => fn()); };
  }, []);

  if (!summary) return <div>加载中...</div>;

  return (
    <div className="app">
      <h1>CodeViewer</h1>
      <Dashboard summary={summary} />
      <div className="card">
        <h2>趋势</h2>
        <TrendChart days={summary.days} />
      </div>
    </div>
  );
}
```

- [ ] **Step 6: 实现 Dashboard.tsx（接收 summary 作为 prop，不自己 fetch）**

```tsx
import type { Summary } from "../types";

export function Dashboard({ summary }: { summary: Summary }) {
  const net = summary.today_insertions - summary.today_deletions;
  return (
    <div className="card">
      <h2>今日统计</h2>
      <div className="stats-grid">
        <div className="stat"><span className="stat-label">新增</span><span className="stat-value positive">+{summary.today_insertions}</span></div>
        <div className="stat"><span className="stat-label">删除</span><span className="stat-value negative">-{summary.today_deletions}</span></div>
        <div className="stat"><span className="stat-label">净增</span><span className="stat-value">{net > 0 ? `+${net}` : net}</span></div>
        <div className="stat"><span className="stat-label">提交</span><span className="stat-value">{summary.today_commits}</span></div>
      </div>
      <div style={{ marginTop: 12, display: "flex", gap: 24 }}>
        <span>本周: +{summary.week_insertions}</span>
        <span>总计: +{summary.total_insertions}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: 实现 TrendChart.tsx（注册 Filler 插件）**

```tsx
import { Line } from "react-chartjs-2";
import { Chart, LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler } from "chart.js";
import type { DailyStat } from "../types";

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler);

export function TrendChart({ days }: { days: DailyStat[] }) {
  const data = {
    labels: days.map(d => d.date),
    datasets: [
      { label: "新增", data: days.map(d => d.insertions), borderColor: "#4ade80", backgroundColor: "rgba(74,222,128,0.1)", fill: true },
      { label: "删除", data: days.map(d => d.deletions), borderColor: "#f87171", backgroundColor: "rgba(248,113,113,0.1)", fill: true },
    ],
  };
  return <Line data={data} options={{ responsive: true }} />;
}
```

- [ ] **Step 8: 构建 + 验证 Tauri 编译**

Run: `cd frontend && npm run build`
Run: `cargo check -p codeviewer-desktop`

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat: add React dashboard with trend chart and real-time updates"
```

---

## Phase 9: 跨平台打磨

### Task 9: 打包 + 端到端验证

- [ ] **Step 1: 生成图标** (`npx @tauri-apps/cli icon source.png`)
- [ ] **Step 2: Windows 构建测试** (`cargo tauri build`)
- [ ] **Step 3: macOS 构建测试**（如有 Mac）
- [ ] **Step 4: 手动验证：托盘显示、点击展开、数据正确、实时更新**
- [ ] **Step 5: Commit + tag v0.1.0**

---

## Self-Review (v2)

**编译级修正（8 项全修）：**
1. ✅ Task 1 Step 6 明确创建空模块文件
2. ✅ workspace 初始只含 core，Task 6 Step 1 才加 desktop
3. ✅ chrono 用 `DateTime::from_timestamp` (Task 2)
4. ✅ 移除 `stat_format`，用 `Patch::from_diff` (Task 2)
5. ✅ `push_head().is_err()` 守卫 (Task 2)
6. ✅ Tauri 2.x tray API (Task 6 Step 6)
7. ✅ scanner_task 不传 State，用 app.state() (Task 6 Step 8)
8. ✅ dirs 在 Task 1 Step 3 的 Cargo.toml 中

**运行时修正（7 项全修）：**
9. ✅ `tauri::async_runtime::spawn` + `spawn_blocking` (Task 6 Step 8)
10. ✅ clone config 后 drop lock (Task 6 Step 7)
11. ✅ author_email 过滤 (Task 2)
12. ✅ 跳过 merge commits (Task 2)
13. ✅ `Sort::TIME` (Task 2)
14. ✅ 收集 errors 不静默丢弃 (Task 6 Step 7)
15. ✅ `MouseButtonState::Up` + `show_menu_on_left_click(false)` (Task 6 Step 6)

**UI 修正：**
16. ✅ Dashboard 接收 props，不独立 fetch (Task 8 Step 6)
17. ✅ Filler 插件注册 (Task 8 Step 7)
18. ✅ CSS 独立文件 (Task 8 Step 4)

**完整性：**
19. ✅ .gitignore (Task 1 Step 1)
20. ✅ tauri.conf.json 有 label/beforeDevCommand (Task 6 Step 4)
21. ✅ config.toml.example 用占位路径 (Task 3 Step 3)
22. ✅ placeholder frontend/dist 让 generate_context! 编译 (Task 6 Step 2)
