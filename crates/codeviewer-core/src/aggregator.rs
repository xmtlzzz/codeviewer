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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::RepoStat;
    use chrono::NaiveDate;

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

    fn today_str() -> String {
        Local::now().date_naive().format("%Y-%m-%d").to_string()
    }

    #[test]
    fn test_aggregate_merges_same_date_across_repos() {
        let today = today_str();
        let repo_a = make_repo("repo-a", vec![make_stat(&today, "repo-a", 100, 10, 2)]);
        let repo_b = make_repo("repo-b", vec![make_stat(&today, "repo-b", 50, 5, 1)]);
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
            .format("%Y-%m-%d")
            .to_string();
        let stats = vec![
            make_repo("repo-a", vec![make_stat(&today, "repo-a", 100, 10, 2)]),
            make_repo("repo-b", vec![make_stat(&yesterday, "repo-b", 50, 5, 1)]),
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
            .format("%Y-%m-%d")
            .to_string();
        let ten_days_ago = (Local::now().date_naive() - chrono::Duration::days(10))
            .format("%Y-%m-%d")
            .to_string();

        let stats = vec![vec![
            make_stat(&today, "repo-a", 30, 0, 1),
            make_stat(&three_days_ago, "repo-a", 20, 0, 1),
            make_stat(&ten_days_ago, "repo-a", 40, 0, 1), // outside week
        ]];
        let summary = aggregate(vec![make_repo(
            "repo-a",
            stats.into_iter().flatten().collect(),
        )]);

        assert_eq!(
            summary.week_insertions, 50,
            "today + 3 days ago = 50, 10 days ago excluded"
        );
        assert_eq!(summary.total_insertions, 90, "all three days");
    }

    #[test]
    fn test_empty_input() {
        let summary = aggregate(vec![]);
        assert_eq!(summary.today_insertions, 0);
        assert_eq!(summary.total_insertions, 0);
        assert_eq!(summary.total_commits, 0);
        assert!(summary.days.is_empty());
        assert!(summary.repo_stats.is_empty());
    }

    #[test]
    fn test_days_sorted_by_date() {
        let today = today_str();
        let yesterday = (Local::now().date_naive() - chrono::Duration::days(1))
            .format("%Y-%m-%d")
            .to_string();

        // Pass in reverse order, verify output is sorted
        let stats = vec![vec![
            make_stat(&today, "repo-a", 10, 0, 1),
            make_stat(&yesterday, "repo-a", 20, 0, 1),
        ]];
        let summary = aggregate(vec![make_repo(
            "repo-a",
            stats.into_iter().flatten().collect(),
        )]);

        assert_eq!(summary.days.len(), 2);
        assert!(
            summary.days[0].date < summary.days[1].date,
            "days should be sorted ascending"
        );
    }

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

        let repo_a = summary
            .repo_stats
            .iter()
            .find(|r| r.name == "repo-a")
            .unwrap();
        assert_eq!(repo_a.insertions, 100);
        assert_eq!(repo_a.deletions, 15);
        assert_eq!(repo_a.commits, 3);
        assert_eq!(repo_a.files_changed, 2);
        assert_eq!(repo_a.last_date.format("%Y-%m-%d").to_string(), today);
        assert_eq!(repo_a.daily_stats.len(), 2);

        let repo_b = summary
            .repo_stats
            .iter()
            .find(|r| r.name == "repo-b")
            .unwrap();
        assert_eq!(repo_b.insertions, 50);
        assert_eq!(repo_b.deletions, 2);
        assert_eq!(repo_b.commits, 1);
    }
}
