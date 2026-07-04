use codeviewer_core::{aggregator, config, models, scanner, storage};
use git2::{Repository, Signature};
use std::fs;
use std::path::Path;
use tempfile::TempDir;

/// Create a git repo in the given directory and make one commit with the specified files
fn make_repo_with_commit(dir: &Path, files: &[(&str, &str)]) {
    let repo = Repository::init(dir).unwrap();
    {
        let mut cfg = repo.config().unwrap();
        cfg.set_str("user.name", "Test").unwrap();
        cfg.set_str("user.email", "test@example.com").unwrap();
    }
    let sig = Signature::now("Test", "test@example.com").unwrap();
    let mut index = repo.index().unwrap();
    for (path, content) in files {
        let full = dir.join(path);
        if let Some(p) = full.parent() {
            fs::create_dir_all(p).unwrap();
        }
        fs::write(&full, content).unwrap();
        index.add_path(Path::new(path)).unwrap();
    }
    index.write().unwrap();
    let tree = repo.find_tree(index.write_tree().unwrap()).unwrap();
    repo.commit(Some("HEAD"), &sig, &sig, "test commit", &tree, &[])
        .unwrap();
}

/// Create a git repo and make two commits (to test multi-commit aggregation)
fn make_repo_with_two_commits(dir: &Path) {
    let repo = Repository::init(dir).unwrap();
    {
        let mut cfg = repo.config().unwrap();
        cfg.set_str("user.name", "Test").unwrap();
        cfg.set_str("user.email", "test@example.com").unwrap();
    }
    // Commit 1: 2 lines
    let sig = Signature::now("Test", "test@example.com").unwrap();
    let mut index = repo.index().unwrap();
    fs::write(dir.join("main.rs"), "fn main() {}\n").unwrap();
    index.add_path(Path::new("main.rs")).unwrap();
    index.write().unwrap();
    let tree = repo.find_tree(index.write_tree().unwrap()).unwrap();
    repo.commit(Some("HEAD"), &sig, &sig, "first", &tree, &[])
        .unwrap();

    // Commit 2: add 3 more lines in a new file
    let mut index = repo.index().unwrap();
    fs::write(
        dir.join("lib.rs"),
        "pub fn hello() {\n    println!(\"hi\");\n}\n",
    )
    .unwrap();
    index.add_path(Path::new("lib.rs")).unwrap();
    index.write().unwrap();
    let tree = repo.find_tree(index.write_tree().unwrap()).unwrap();
    let parent = repo
        .head()
        .ok()
        .and_then(|r| r.target())
        .map(|oid| repo.find_commit(oid).unwrap());
    let parents: Vec<&git2::Commit> = parent.iter().collect();
    repo.commit(Some("HEAD"), &sig, &sig, "second", &tree, &parents)
        .unwrap();
}

#[test]
fn test_full_pipeline_scan_aggregate_save_load() {
    // Create two test repos
    let dir1 = TempDir::new().unwrap();
    let dir2 = TempDir::new().unwrap();
    make_repo_with_commit(dir1.path(), &[("a.rs", "line1\nline2\n")]);
    make_repo_with_commit(dir2.path(), &[("b.rs", "hello\n")]);

    // Scan both repos
    let opts = scanner::ScanOptions::default();
    let stats1 = scanner::scan_repo(dir1.path(), &opts).unwrap();
    let stats2 = scanner::scan_repo(dir2.path(), &opts).unwrap();

    // Verify scan results
    assert_eq!(stats1.len(), 1, "repo1 should have 1 day of stats");
    assert_eq!(stats1[0].insertions, 2, "repo1: 2 lines inserted");
    assert_eq!(stats2[0].insertions, 1, "repo2: 1 line inserted");

    // Aggregate
    let summary = aggregator::aggregate(vec![
        models::RepoStat {
            repo_path: dir1.path().to_string_lossy().into_owned(),
            repo_name: "repo1".to_string(),
            daily_stats: stats1.clone(),
            working_tree_changes: Vec::new(),
        },
        models::RepoStat {
            repo_path: dir2.path().to_string_lossy().into_owned(),
            repo_name: "repo2".to_string(),
            daily_stats: stats2.clone(),
            working_tree_changes: Vec::new(),
        },
    ]);
    assert_eq!(summary.total_insertions, 3, "2 + 1 = 3 total insertions");
    assert_eq!(summary.total_commits, 2, "1 + 1 = 2 total commits");
    assert_eq!(summary.today_insertions, 3, "all commits are today");
    assert_eq!(
        summary.days.len(),
        1,
        "both repos committed today, should merge to 1 day"
    );

    // Save to JSON
    let repo_stats = vec![
        models::RepoStat {
            repo_path: dir1.path().to_string_lossy().into_owned(),
            repo_name: "repo1".to_string(),
            daily_stats: stats1,
            working_tree_changes: Vec::new(),
        },
        models::RepoStat {
            repo_path: dir2.path().to_string_lossy().into_owned(),
            repo_name: "repo2".to_string(),
            daily_stats: stats2,
            working_tree_changes: Vec::new(),
        },
    ];
    let store_dir = TempDir::new().unwrap();
    let store_path = store_dir.path().join("stats.json");
    storage::save(&store_path, &repo_stats).unwrap();

    // Load and verify
    let loaded = storage::load(&store_path).unwrap();
    assert_eq!(loaded.len(), 2, "should load 2 repo stats");
    assert_eq!(loaded[0].repo_name, "repo1");
    assert_eq!(loaded[0].daily_stats[0].insertions, 2);
    assert_eq!(loaded[1].repo_name, "repo2");
    assert_eq!(loaded[1].daily_stats[0].insertions, 1);
}

#[test]
fn test_multi_commit_aggregation() {
    let dir = TempDir::new().unwrap();
    make_repo_with_two_commits(dir.path());

    let opts = scanner::ScanOptions::default();
    let stats = scanner::scan_repo(dir.path(), &opts).unwrap();

    assert_eq!(stats.len(), 1, "both commits today, 1 day entry");
    assert_eq!(
        stats[0].insertions, 4,
        "1 + 3 = 4 insertions (fn main line + 3 lib.rs lines)"
    );
    assert_eq!(stats[0].commits, 2, "2 commits");

    let summary = aggregator::aggregate(vec![models::RepoStat {
        repo_path: dir.path().to_string_lossy().into_owned(),
        repo_name: "repo".to_string(),
        daily_stats: stats,
        working_tree_changes: Vec::new(),
    }]);
    assert_eq!(summary.total_insertions, 4);
    assert_eq!(summary.total_commits, 2);
}

#[test]
fn test_config_parse_and_scan() {
    // Create a test repo
    let dir = TempDir::new().unwrap();
    make_repo_with_commit(dir.path(), &[("test.rs", "x\ny\n")]);

    // Parse config pointing to the test repo
    let toml_str = format!(
        r#"
author_email = "test@example.com"

[[repos]]
path = "{}"

[scan]
interval_secs = 15
since_days = 30
"#,
        dir.path().to_string_lossy().replace('\\', "/")
    );
    let config = config::Config::parse(&toml_str).unwrap();
    assert_eq!(config.author_email, "test@example.com");
    assert_eq!(config.repos.len(), 1);
    assert_eq!(config.scan.interval_secs, 15);

    // Use config to drive a scan
    let opts = scanner::ScanOptions {
        author_email: Some(config.author_email.clone()),
        since_days: Some(config.scan.since_days),
    };
    let stats = scanner::scan_repo(std::path::Path::new(&config.repos[0].path), &opts).unwrap();
    assert_eq!(stats.len(), 1);
    assert_eq!(stats[0].insertions, 2);
}

#[test]
fn test_config_save_and_load_roundtrip() {
    let dir = TempDir::new().unwrap();
    let config_path = dir.path().join("config.toml");

    let original = config::Config {
        repos: vec![config::RepoEntry {
            path: "/some/path".to_string(),
            name: Some("myproject".to_string()),
        }],
        scan: config::ScanConfig {
            interval_secs: 45,
            since_days: 14,
        },
        author_email: "user@example.com".to_string(),
        github: config::GithubConfig::default(),
        close_behavior: config::CloseBehavior::Minimize,
        launch_on_startup: false,
    };

    original.save(&config_path).unwrap();
    let loaded = config::Config::load(&config_path).unwrap();

    assert_eq!(loaded.repos.len(), 1);
    assert_eq!(loaded.repos[0].path, "/some/path");
    assert_eq!(loaded.repos[0].name, Some("myproject".to_string()));
    assert_eq!(loaded.scan.interval_secs, 45);
    assert_eq!(loaded.scan.since_days, 14);
    assert_eq!(loaded.author_email, "user@example.com");
}

#[test]
fn test_scan_nonexistent_repo_skipped_in_aggregate() {
    // One valid repo, one nonexistent path
    let dir1 = TempDir::new().unwrap();
    make_repo_with_commit(dir1.path(), &[("a.rs", "x\n")]);

    let opts = scanner::ScanOptions::default();
    let stats1 = scanner::scan_repo(dir1.path(), &opts).unwrap();
    let stats2 = scanner::scan_repo(Path::new("/nonexistent/path"), &opts);

    // The nonexistent repo should error, not panic
    assert!(stats2.is_err());

    // Aggregate only the successful scan
    let summary = aggregator::aggregate(vec![models::RepoStat {
        repo_path: dir1.path().to_string_lossy().into_owned(),
        repo_name: "repo1".to_string(),
        daily_stats: stats1,
        working_tree_changes: Vec::new(),
    }]);
    assert_eq!(summary.total_insertions, 1);
    assert_eq!(summary.total_commits, 1);
}
