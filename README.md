# CodeViewer

CodeViewer 是一个用于追踪个人代码产出的桌面工具，面向日常写代码的开发者。它会扫描本地 Git 仓库，汇总提交次数、代码新增/删除行数、近 7 天趋势，并提供桌面端仪表盘查看；同时支持配置作者邮箱过滤，只统计你自己的提交。

项目当前采用 Rust + Tauri + React 技术栈，适合做跨平台桌面应用，也保留了一个可单独运行的 CLI 扫描入口。

## 核心能力

- 扫描多个本地 Git 仓库并汇总代码统计
- 支持按 `author_email` 过滤提交记录
- 展示总净变更行数、仓库维度统计、近 7 天趋势
- 支持后台定时扫描
- 关闭窗口后可最小化到系统托盘
- 支持保存 GitHub 账号信息，并在界面中展示公开仓库概览
- 工具页支持中英文切换

## 项目结构

```text
.
├─crates/
│  ├─codeviewer-core/      # 核心扫描、聚合、配置、CLI
│  └─codeviewer-desktop/   # Tauri 桌面端
├─frontend/                # React + Vite 前端界面
├─docs/                    # 设计与规划文档
└─config.toml.example      # 配置示例
```

## 运行环境

建议环境：

- Rust stable
- Node.js 20+
- npm 10+

桌面端额外依赖：

- Windows：需要 WebView2 Runtime
- macOS：需要 Xcode Command Line Tools
- Linux：需要 GTK3 / WebKit2GTK 等 Tauri 依赖

如需完整依赖清单，以 Tauri 2 官方文档为准。

## 快速开始

### 1. 安装前端依赖

```powershell
cd frontend
npm install
```

### 2. 启动桌面开发模式

在仓库根目录执行：

```powershell
cd frontend
npm run tauri:dev
```

这会同时启动：

- Vite 前端开发服务器
- Tauri 桌面应用

### 3. 单独启动前端

如果只想调界面：

```powershell
cd frontend
npm run dev
```

### 4. 使用 CLI 扫描

仓库根目录执行：

```powershell
cargo run -p codeviewer-core --bin codeviewer -- help
cargo run -p codeviewer-core --bin codeviewer -- today
cargo run -p codeviewer-core --bin codeviewer -- week
cargo run -p codeviewer-core --bin codeviewer -- scan
```

## 配置说明

桌面端默认会从系统配置目录读取 `config.toml`：

- Windows：`%AppData%\codeviewer\config.toml`
- macOS：`~/Library/Application Support/codeviewer/config.toml`
- Linux：`~/.config/codeviewer/config.toml`

CLI 支持通过环境变量 `CODEVIEWER_CONFIG` 指定配置文件路径。

可以参考仓库根目录的 [config.toml.example](./config.toml.example)。

示例：

```toml
author_email = "your-email@example.com"
close_behavior = "minimize"

[[repos]]
path = "D:/code/my-project"

[scan]
interval_secs = 30
since_days = 30
```

字段说明：

- `author_email`：只统计指定作者邮箱的提交；留空则统计所有人
- `close_behavior`：`minimize` 为关闭时最小化到托盘，`exit` 为直接退出
- `repos`：需要扫描的 Git 仓库列表
- `scan.interval_secs`：后台扫描间隔，最小有效值为 5 秒
- `scan.since_days`：统计最近多少天的数据

## 构建与部署

### 前端构建

```powershell
cd frontend
npm run build
```

### 桌面端打包

```powershell
cd frontend
npm run tauri:build
```

默认会产出 Tauri 桌面安装包，常见输出目录为：

```text
target/release/bundle/
```

不同平台下通常会生成各自格式的安装包，例如：

- Windows：`.msi` / `.exe`
- macOS：`.app` / `.dmg`
- Linux：`.deb` / `.AppImage` / `.rpm`

## 跨平台编译说明

项目架构本身支持 Windows、macOS、Linux，但当前仓库配置仍以 Windows 开发环境为主，主要体现在：

- `crates/codeviewer-desktop/tauri.conf.json` 中使用了 `npm.cmd`
- `beforeDevCommand` / `beforeBuildCommand` 写入了当前机器上的绝对路径

因此如果要在 macOS 或 Linux 上直接打包，建议先把这两项改成平台无关写法，例如：

```json
"beforeDevCommand": "npm --prefix ../../frontend run dev",
"beforeBuildCommand": "npm --prefix ../../frontend run build"
```

或者先手动在 `frontend/` 下执行构建，再调用 Tauri 打包。

跨平台部署建议：

1. 在目标平台本机完成构建，优先避免跨系统交叉打包
2. 先安装该平台对应的 Tauri 依赖和签名工具
3. 先执行 `npm run build`，再执行 `npm run tauri:build`
4. 在目标系统实测托盘、窗口关闭行为和 Git 仓库扫描权限

## 开发建议

- 前端模板自带的 [frontend/README.md](./frontend/README.md) 仍是 Vite 默认说明，实际以本文件为准
- 如果要继续做跨平台发布，建议先清理 `tauri.conf.json` 中的本地绝对路径
- 如果要接入正式的 GitHub 同步能力，建议将当前“账号信息存储”与“仓库数据拉取”拆成独立服务层

## 当前定位

这个项目更适合作为个人代码产出追踪器与桌面数据面板，而不是通用代码托管平台。核心价值是轻量、本地优先、快速查看自己的提交与代码行数变化。
