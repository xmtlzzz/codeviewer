use crate::models::{DailyStat, Summary};
use chrono::{Local, NaiveDate};
use std::collections::BTreeMap;

/// Aggregate multiple repos' daily stats into a single Summary.
/// - Today's insertions/deletions/commits
/// - This week's insertions
/// - All-time totals
/// - A merged daily list (same date across repos merged into one entry)
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

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::NaiveDate;

    fn make_stat(date_str: &str, ins: u64, del: u64, commits: u32) -> DailyStat {
        DailyStat {
            date: NaiveDate::parse_from_str(date_str, "%Y-%m-%d").unwrap(),
            insertions: ins,
            deletions: del,
            files_changed: 1,
            commits,
            repo_name: "test".to_string(),
        }
    }

    fn today_str() -> String {
        Local::now().date_naive().format("%Y-%m-%d").to_string()
    }

    #[test]
    fn test_aggregate_merges_same_date_across_repos() {
        let today = today_str();
        let repo_a = vec![make_stat(&today, 100, 10, 2)];
        let repo_b = vec![make_stat(&today, 50, 5, 1)];
        let summary = aggregate(vec![repo_a, repo_b]);

        assert_eq!(summary.days.len(), 1, "same date should merge into 1 entry");
        assert_eq!(summary.days[0].insertions, 150);
        assert_eq!(summary.days[0].deletions, 15);
        assert_eq!(summary.days[0].commits, 3);
    }

    #[test]
    fn test_today_summary() {
        let today = today_str();
        let yesterday = (Local::now().date_naive() - chrono::Duration::days(1))
            .format("%Y-%m-%d").to_string();
        let stats = vec![
            vec![make_stat(&today, 100, 10, 2)],
            vec![make_stat(&yesterday, 50, 5, 1)],
        ];
        let summary = aggregate(stats);

        assert_eq!(summary.today_insertions, 100);
        assert_eq!(summary.today_deletions, 10);
        assert_eq!(summary.today_commits, 2);
    }

    #[test]
    fn test_week_insertions() {
        let today = today_str();
        let three_days_ago = (Local::now().date_naive() - chrono::Duration::days(3))
            .format("%Y-%m-%d").to_string();
        let ten_days_ago = (Local::now().date_naive() - chrono::Duration::days(10))
            .format("%Y-%m-%d").to_string();

        let stats = vec![vec![
            make_stat(&today, 30, 0, 1),
            make_stat(&three_days_ago, 20, 0, 1),
            make_stat(&ten_days_ago, 40, 0, 1),  // outside week
        ]];
        let summary = aggregate(stats);

        assert_eq!(summary.week_insertions, 50, "today + 3 days ago = 50, 10 days ago excluded");
        assert_eq!(summary.total_insertions, 90, "all three days");
    }

    #[test]
    fn test_empty_input() {
        let summary = aggregate(vec![]);
        assert_eq!(summary.today_insertions, 0);
        assert_eq!(summary.total_insertions, 0);
        assert_eq!(summary.total_commits, 0);
        assert!(summary.days.is_empty());
    }

    #[test]
    fn test_days_sorted_by_date() {
        let today = today_str();
        let yesterday = (Local::now().date_naive() - chrono::Duration::days(1))
            .format("%Y-%m-%d").to_string();

        // Pass in reverse order, verify output is sorted
        let stats = vec![vec![
            make_stat(&today, 10, 0, 1),
            make_stat(&yesterday, 20, 0, 1),
        ]];
        let summary = aggregate(stats);

        assert_eq!(summary.days.len(), 2);
        assert!(summary.days[0].date < summary.days[1].date, "days should be sorted ascending");
    }
}
