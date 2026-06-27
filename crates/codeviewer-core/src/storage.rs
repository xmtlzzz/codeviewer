use crate::error::ScanError;
use crate::models::RepoStat;
use std::path::Path;

/// Save repo stats to a JSON file
pub fn save(path: &Path, stats: &[RepoStat]) -> Result<(), ScanError> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let json = serde_json::to_string_pretty(stats)?;
    std::fs::write(path, json)?;
    Ok(())
}

/// Load repo stats from a JSON file
pub fn load(path: &Path) -> Result<Vec<RepoStat>, ScanError> {
    let content = std::fs::read_to_string(path)?;
    let stats: Vec<RepoStat> = serde_json::from_str(&content)?;
    Ok(stats)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{DailyStat, RepoStat};
    use chrono::NaiveDate;
    use tempfile::TempDir;

    fn make_repo_stat() -> RepoStat {
        RepoStat {
            repo_path: "/tmp/myproject".to_string(),
            repo_name: "myproject".to_string(),
            daily_stats: vec![DailyStat {
                date: NaiveDate::from_ymd_opt(2026, 6, 27).unwrap(),
                insertions: 100,
                deletions: 20,
                files_changed: 3,
                commits: 2,
                repo_name: "myproject".to_string(),
            }],
        }
    }

    #[test]
    fn test_save_and_load_roundtrip() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("stats.json");
        let stats = vec![make_repo_stat()];

        save(&path, &stats).unwrap();
        let loaded = load(&path).unwrap();

        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0].repo_name, "myproject");
        assert_eq!(loaded[0].daily_stats[0].insertions, 100);
        assert_eq!(loaded[0].daily_stats[0].deletions, 20);
    }

    #[test]
    fn test_load_nonexistent_returns_error() {
        let result = load(std::path::Path::new("/nonexistent/path.json"));
        assert!(result.is_err());
    }

    #[test]
    fn test_save_creates_parent_dirs() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("subdir").join("nested").join("stats.json");
        let stats = vec![make_repo_stat()];

        save(&path, &stats).unwrap();
        assert!(path.exists());

        let loaded = load(&path).unwrap();
        assert_eq!(loaded.len(), 1);
    }
}
