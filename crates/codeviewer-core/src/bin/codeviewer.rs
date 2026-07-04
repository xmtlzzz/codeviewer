use codeviewer_core::{aggregator, config, models, scanner, storage};
use std::path::PathBuf;

fn config_path() -> PathBuf {
    std::env::var("CODEVIEWER_CONFIG")
        .map(PathBuf::from)
        .unwrap_or_else(|_| {
            dirs::config_dir()
                .unwrap_or_else(|| PathBuf::from("."))
                .join("codeviewer")
                .join("config.toml")
        })
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
            Ok(stats) => {
                let working_tree_changes =
                    match scanner::scan_working_tree_changes(std::path::Path::new(&entry.path)) {
                        Ok(changes) => changes,
                        Err(e) => {
                            errors.push(format!("{}: {}", entry.path, e));
                            Vec::new()
                        }
                    };
                repos.push(models::RepoStat {
                    repo_path: entry.path.clone(),
                    repo_name: repo_name_for(entry),
                    daily_stats: stats,
                    working_tree_changes,
                });
            }
            Err(e) => errors.push(format!("{}: {}", entry.path, e)),
        }
    }

    (repos, errors)
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let cmd = args.get(1).map(|s| s.as_str()).unwrap_or("today");

    let config = config::Config::load(&config_path()).unwrap_or_default();

    match cmd {
        "today" => {
            let (repos, errors) = scan_all(&config);
            for error in &errors {
                eprintln!("scan skipped: {error}");
            }
            let summary = aggregator::aggregate(repos);
            let net = summary.today_insertions as i64 - summary.today_deletions as i64;
            if summary.today_commits == 0 {
                println!("今日: 暂无提交记录");
            } else {
                println!(
                    "今日: +{}/-{} (净 {} 行, {} commits)",
                    summary.today_insertions, summary.today_deletions, net, summary.today_commits
                );
            }
        }
        "week" => {
            let (repos, errors) = scan_all(&config);
            for error in &errors {
                eprintln!("scan skipped: {error}");
            }
            let summary = aggregator::aggregate(repos);
            let week_ago = chrono::Local::now().date_naive() - chrono::Duration::days(7);
            println!("最近 7 天:");
            for d in &summary.days {
                if d.date >= week_ago {
                    println!(
                        "  {} +{}/-{} ({} commits)",
                        d.date, d.insertions, d.deletions, d.commits
                    );
                }
            }
            println!(
                "合计: +{} ({} commits)",
                summary.week_insertions, summary.total_commits
            );
        }
        "scan" => {
            let (repo_stats, errors) = scan_all(&config);
            for error in &errors {
                eprintln!("scan skipped: {error}");
            }

            let store_path = dirs::data_dir()
                .unwrap_or_else(|| PathBuf::from("."))
                .join("codeviewer")
                .join("stats.json");

            match storage::save(&store_path, &repo_stats) {
                Ok(()) => println!(
                    "已保存 {} 个仓库的统计到 {}",
                    repo_stats.len(),
                    store_path.display()
                ),
                Err(e) => eprintln!("保存失败: {}", e),
            }
        }
        "help" | "--help" | "-h" => {
            print_help();
        }
        _ => {
            eprintln!("未知命令: {}", cmd);
            print_help();
            std::process::exit(1);
        }
    }
}

fn print_help() {
    println!("CodeViewer — 每日代码行数追踪器");
    println!();
    println!("用法: codeviewer <command>");
    println!();
    println!("命令:");
    println!("  today   显示今日代码统计");
    println!("  week    显示最近 7 天统计");
    println!("  scan    扫描所有配置仓库并保存到 JSON");
    println!("  help    显示此帮助信息");
}
