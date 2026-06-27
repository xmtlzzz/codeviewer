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

    // Empty repo (no HEAD) returns empty — don't error
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

        // Author filter
        if let Some(ref email) = opts.author_email {
            let author = commit.author();
            let author_email = author.email().unwrap_or("");
            if author_email != email {
                continue;
            }
        }

        // Date conversion (verified pattern: DateTime::from_timestamp, NOT timestamp_opt)
        let commit_date = DateTime::from_timestamp(commit.time().seconds(), 0)
            .unwrap_or_default()
            .with_timezone(&Local)
            .date_naive();

        // Skip commits older than cutoff
        if let Some(cutoff_date) = cutoff {
            if commit_date < cutoff_date {
                continue;
            }
        }

        // Skip merge commits
        if commit.parent_count() > 1 {
            continue;
        }

        let tree = commit.tree()?;
        let parent_tree = if commit.parent_count() == 0 {
            None
        } else {
            Some(commit.parent(0)?.tree()?)
        };

        // diff_tree_to_tree with None options (no stat_format needed)
        let diff = repo.diff_tree_to_tree(parent_tree.as_ref(), Some(&tree), None)?;

        let mut insertions: u64 = 0;
        let mut deletions: u64 = 0;
        let mut files_changed: u32 = 0;

        // Use Patch::from_diff for per-file line stats (more accurate than DiffStats)
        let deltas: Vec<_> = diff.deltas().collect();
        for (delta_idx, delta) in deltas.iter().enumerate() {
            if delta.flags().is_binary() {
                continue;
            }
            files_changed += 1;
            // git2 0.18: from_diff returns Result<Option<Patch>, Error>;
            // Ok(None) for binary/unchanged files (binary also skipped above).
            if let Ok(Some(patch)) = git2::Patch::from_diff(&diff, delta_idx) {
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

#[cfg(test)]
mod tests {
    use super::*;
    use git2::Signature;
    use std::fs;
    use tempfile::TempDir;

    /// Create a temp git repo with user config set
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

    /// Create a commit in the repo with the given files
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
    fn test_count_insertions_single_commit() {
        let (dir, repo) = make_test_repo();
        create_commit(&repo, &[("main.rs", "line1\nline2\nline3\n")]);
        let stats = scan_repo(dir.path(), &ScanOptions::default()).unwrap();
        assert_eq!(stats.len(), 1);
        assert_eq!(stats[0].insertions, 3);
        assert_eq!(stats[0].deletions, 0);
        assert_eq!(stats[0].commits, 1);
    }

    #[test]
    fn test_multiple_commits_same_day() {
        let (dir, repo) = make_test_repo();
        create_commit(&repo, &[("a.rs", "x\n")]);
        create_commit(&repo, &[("b.rs", "y\nz\n")]);
        let stats = scan_repo(dir.path(), &ScanOptions::default()).unwrap();
        assert_eq!(stats.len(), 1, "both commits are today, should aggregate to 1 day");
        assert_eq!(stats[0].insertions, 3, "1 + 2 = 3 insertions");
        assert_eq!(stats[0].commits, 2);
    }

    #[test]
    fn test_deletions_counted() {
        let (dir, repo) = make_test_repo();
        // First commit: 5 lines
        create_commit(&repo, &[("data.txt", "1\n2\n3\n4\n5\n")]);
        // Second commit: modify to 3 lines (delete 2)
        create_commit(&repo, &[("data.txt", "1\n2\n3\n")]);
        let stats = scan_repo(dir.path(), &ScanOptions::default()).unwrap();
        assert_eq!(stats.len(), 1);
        // First commit adds 5 lines (5 insertions); second commit keeps
        // "1\n2\n3" as context and deletes "4\n5" (0 insertions, 2 deletions).
        assert_eq!(stats[0].insertions, 5, "first commit adds 5 lines, second adds 0");
        assert_eq!(stats[0].deletions, 2, "second commit deletes 2 lines");
        assert_eq!(stats[0].commits, 2);
    }

    #[test]
    fn test_author_filter() {
        let (dir, repo) = make_test_repo();
        create_commit(&repo, &[("a.rs", "x\n")]);
        // Create commit with different author
        let sig = Signature::now("Other", "other@example.com").unwrap();
        let mut index = repo.index().unwrap();
        fs::write(repo.workdir().unwrap().join("b.rs"), "y\n").unwrap();
        index.add_path(Path::new("b.rs")).unwrap();
        index.write().unwrap();
        let tree = repo.find_tree(index.write_tree().unwrap()).unwrap();
        let parent = repo.head().ok().and_then(|r| r.target()).map(|oid| repo.find_commit(oid).unwrap());
        let parents: Vec<&git2::Commit> = parent.iter().collect();
        repo.commit(Some("HEAD"), &sig, &sig, "other author", &tree, &parents).unwrap();

        let opts = ScanOptions { author_email: Some("test@example.com".into()), since_days: None };
        let stats = scan_repo(dir.path(), &opts).unwrap();
        assert_eq!(stats.len(), 1);
        assert_eq!(stats[0].commits, 1, "only 1 commit from test@example.com");
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

    #[test]
    fn test_since_days_filter() {
        let (dir, repo) = make_test_repo();
        create_commit(&repo, &[("a.rs", "x\n")]);

        // since_days: 0 means only today, which should still include the commit
        let opts = ScanOptions { author_email: None, since_days: Some(0) };
        let stats = scan_repo(dir.path(), &opts).unwrap();
        assert_eq!(stats.len(), 1, "commit is today, should be included with since_days=0");

        // since_days: Some(30) should also include it
        let opts = ScanOptions { author_email: None, since_days: Some(30) };
        let stats = scan_repo(dir.path(), &opts).unwrap();
        assert_eq!(stats.len(), 1);
    }
}
