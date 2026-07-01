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

/// Per-repo summary for the dashboard repo list and detail page.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepoSummary {
    pub name: String,
    pub insertions: u64,
    pub deletions: u64,
    pub commits: u32,
    pub files_changed: u32,
    pub last_date: NaiveDate,
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
    pub repo_stats: Vec<RepoSummary>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_daily_stat_serde_roundtrip() {
        let stat = DailyStat {
            date: NaiveDate::from_ymd_opt(2024, 6, 27).unwrap(),
            insertions: 150,
            deletions: 42,
            files_changed: 8,
            commits: 3,
            repo_name: "codeviewer".to_string(),
        };

        let serialized = serde_json::to_string(&stat).unwrap();
        let deserialized: DailyStat = serde_json::from_str(&serialized).unwrap();

        assert_eq!(stat, deserialized);
        assert_eq!(deserialized.date, stat.date);
        assert_eq!(deserialized.insertions, stat.insertions);
        assert_eq!(deserialized.deletions, stat.deletions);
        assert_eq!(deserialized.files_changed, stat.files_changed);
        assert_eq!(deserialized.commits, stat.commits);
        assert_eq!(deserialized.repo_name, stat.repo_name);
    }

    #[test]
    fn test_net_lines_correct() {
        let stat = DailyStat {
            date: NaiveDate::from_ymd_opt(2024, 6, 27).unwrap(),
            insertions: 200,
            deletions: 75,
            files_changed: 5,
            commits: 2,
            repo_name: "test-repo".to_string(),
        };

        assert_eq!(stat.net_lines(), 125);

        // Test with deletions > insertions (negative net)
        let stat_neg = DailyStat {
            date: NaiveDate::from_ymd_opt(2024, 6, 27).unwrap(),
            insertions: 30,
            deletions: 100,
            files_changed: 3,
            commits: 1,
            repo_name: "test-repo".to_string(),
        };

        assert_eq!(stat_neg.net_lines(), -70);

        // Test with equal insertions and deletions (zero net)
        let stat_zero = DailyStat {
            date: NaiveDate::from_ymd_opt(2024, 6, 27).unwrap(),
            insertions: 50,
            deletions: 50,
            files_changed: 2,
            commits: 1,
            repo_name: "test-repo".to_string(),
        };

        assert_eq!(stat_zero.net_lines(), 0);
    }

    #[test]
    fn test_repo_summary_serde_roundtrip() {
        let daily = vec![DailyStat {
            date: NaiveDate::from_ymd_opt(2026, 6, 27).unwrap(),
            insertions: 100,
            deletions: 20,
            files_changed: 3,
            commits: 2,
            repo_name: "my-repo".to_string(),
        }];
        let summary = RepoSummary {
            name: "my-repo".to_string(),
            insertions: 100,
            deletions: 20,
            commits: 2,
            files_changed: 3,
            last_date: NaiveDate::from_ymd_opt(2026, 6, 27).unwrap(),
            daily_stats: daily,
        };

        let json = serde_json::to_string(&summary).unwrap();
        let decoded: RepoSummary = serde_json::from_str(&json).unwrap();
        assert_eq!(decoded.name, "my-repo");
        assert_eq!(decoded.insertions, 100);
        assert_eq!(decoded.commits, 2);
        assert_eq!(decoded.daily_stats.len(), 1);
        assert_eq!(decoded.daily_stats[0].repo_name, "my-repo");
    }
}
