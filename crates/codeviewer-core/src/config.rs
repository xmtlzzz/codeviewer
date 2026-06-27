use crate::error::ScanError;
use serde::{Deserialize, Serialize};
use std::path::Path;

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

    /// Add a repo entry. Duplicate paths are silently ignored.
    pub fn add_repo(&mut self, path: String, name: Option<String>) {
        if self.repos.iter().any(|r| r.path == path) {
            return;
        }
        self.repos.push(RepoEntry { path, name });
    }

    /// Remove a repo by path. Returns true if a repo was removed.
    pub fn remove_repo(&mut self, path: &str) -> bool {
        let before = self.repos.len();
        self.repos.retain(|r| r.path != path);
        self.repos.len() < before
    }

    /// Set the author email filter.
    pub fn set_author_email(&mut self, email: String) {
        self.author_email = email;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_full_config() {
        let toml_str = r#"
author_email = "user@example.com"

[[repos]]
path = "/home/user/project1"

[[repos]]
path = "/home/user/project2"

[scan]
interval_secs = 60
since_days = 30
"#;
        let config = Config::parse(toml_str).unwrap();
        assert_eq!(config.author_email, "user@example.com");
        assert_eq!(config.repos.len(), 2);
        assert_eq!(config.repos[0].path, "/home/user/project1");
        assert_eq!(config.scan.interval_secs, 60);
        assert_eq!(config.scan.since_days, 30);
    }

    #[test]
    fn test_defaults_when_empty() {
        let config = Config::parse("").unwrap();
        assert!(config.repos.is_empty());
        assert_eq!(config.scan.interval_secs, 30);
        assert_eq!(config.scan.since_days, 30);
        assert_eq!(config.author_email, "");
    }

    #[test]
    fn test_interval_clamped_to_minimum() {
        let toml_str = r#"
[scan]
interval_secs = 1
"#;
        let config = Config::parse(toml_str).unwrap();
        assert_eq!(config.scan.interval_secs, 5, "interval below 5 should be clamped to 5");
    }

    #[test]
    fn test_save_and_load_roundtrip() {
        use tempfile::TempDir;
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("config.toml");

        let config = Config {
            repos: vec![RepoEntry { path: "/tmp/test".into(), name: Some("test".into()) }],
            scan: ScanConfig { interval_secs: 45, since_days: 14 },
            author_email: "test@test.com".into(),
        };

        config.save(&path).unwrap();
        let loaded = Config::load(&path).unwrap();

        assert_eq!(loaded.repos.len(), 1);
        assert_eq!(loaded.repos[0].path, "/tmp/test");
        assert_eq!(loaded.scan.interval_secs, 45);
        assert_eq!(loaded.scan.since_days, 14);
        assert_eq!(loaded.author_email, "test@test.com");
    }

    // --- TDD: add_repo / remove_repo / set_author_email ---

    #[test]
    fn test_add_repo_new() {
        let mut config = Config::default();
        config.add_repo("/home/user/project1".into(), None);
        assert_eq!(config.repos.len(), 1);
        assert_eq!(config.repos[0].path, "/home/user/project1");
        assert_eq!(config.repos[0].name, None);
    }

    #[test]
    fn test_add_repo_with_name() {
        let mut config = Config::default();
        config.add_repo("/home/user/project1".into(), Some("my-project".into()));
        assert_eq!(config.repos.len(), 1);
        assert_eq!(config.repos[0].name.as_deref(), Some("my-project"));
    }

    #[test]
    fn test_add_repo_duplicate_path_ignored() {
        let mut config = Config::default();
        config.add_repo("/home/user/project1".into(), None);
        config.add_repo("/home/user/project1".into(), Some("dup".into()));
        assert_eq!(config.repos.len(), 1, "duplicate path should not be added");
        assert_eq!(config.repos[0].name, None, "original entry should be unchanged");
    }

    #[test]
    fn test_add_repo_multiple_different_paths() {
        let mut config = Config::default();
        config.add_repo("/a".into(), None);
        config.add_repo("/b".into(), None);
        config.add_repo("/c".into(), None);
        assert_eq!(config.repos.len(), 3);
    }

    #[test]
    fn test_remove_repo_existing() {
        let mut config = Config::default();
        config.add_repo("/a".into(), None);
        config.add_repo("/b".into(), None);
        let removed = config.remove_repo("/a");
        assert!(removed, "should return true for existing path");
        assert_eq!(config.repos.len(), 1);
        assert_eq!(config.repos[0].path, "/b");
    }

    #[test]
    fn test_remove_repo_nonexistent() {
        let mut config = Config::default();
        config.add_repo("/a".into(), None);
        let removed = config.remove_repo("/nonexistent");
        assert!(!removed, "should return false for nonexistent path");
        assert_eq!(config.repos.len(), 1);
    }

    #[test]
    fn test_set_author_email() {
        let mut config = Config::default();
        assert_eq!(config.author_email, "");
        config.set_author_email("dev@example.com".into());
        assert_eq!(config.author_email, "dev@example.com");
    }
}
