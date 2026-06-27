use codeviewer_core::{aggregator, config, scanner, storage, models};
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

fn scan_all(config: &config::Config) -> Vec<Vec<models::DailyStat>> {
    let opts = scanner::ScanOptions {
        author_email: if config.author_email.is_empty() {
            None
        } else {
            Some(config.author_email.clone())
        },
        since_days: Some(config.scan.since_days),
    };
    config.repos
        .iter()
        .filter_map(|r| scanner::scan_repo(std::path::Path::new(&r.path), &opts).ok())
        .collect()
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let cmd = args.get(1).map(|s| s.as_str()).unwrap_or("today");

    let config = config::Config::load(&config_path()).unwrap_or_default();

    match cmd {
        "today" => {
            let summary = aggregator::aggregate(scan_all(&config));
            let net = summary.today_insertions as i64 - summary.today_deletions as i64;
            if summary.today_commits == 0 {
                println!("今日: 暂无提交记录");
            } else {
                println!(
                    "今日: +{}/-{} (净 {} 行, {} commits)",
                    summary.today_insertions,
                    summary.today_deletions,
                    net,
                    summary.today_commits
                );
            }
        }
        "week" => {
            let summary = aggregator::aggregate(scan_all(&config));
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
            let all = scan_all(&config);
            let repo_stats: Vec<models::RepoStat> = config
                .repos
                .iter()
                .zip(all.iter())
                .map(|(r, stats)| models::RepoStat {
                    repo_path: r.path.clone(),
                    repo_name: std::path::Path::new(&r.path)
                        .file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("unknown")
                        .to_string(),
                    daily_stats: stats.clone(),
                })
                .collect();

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
