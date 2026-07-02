# Obsidian + Codex Starter Kit

这是一套可以直接拿去试的第一版，不追求一次做完，只追求能持续跑。

---

## 1. 目标形态

### 角色分工

- `Obsidian`：主知识库
- `Codex`：整理、总结、补链、生成任务
- `skills`：把重复动作变成固定流程
- `Markdown`：唯一主存储格式

### 你最终会得到什么

- 一个稳定的 inbox
- 一套统一模板
- 3 到 5 个固定 skills
- 每周一次的复盘流程

---

## 2. 第一版目录

```text
vault/
├── 00_inbox/
├── 10_sources/
├── 20_atomic/
├── 30_synthesis/
├── 40_projects/
└── 60_systems/
```

### 目录用途

- `00_inbox`：先收进来，不做判断
- `10_sources`：网页、书摘、会话、引用
- `20_atomic`：一个概念一页
- `30_synthesis`：主题总结
- `40_projects`：项目推进
- `60_systems`：方法、模板、流程

---

## 3. 推荐的 4 个 skills

### 3.1 `capture-to-note`

用途：把一段碎片输入变成规范笔记。

输入：

- 网页摘录
- 聊天内容
- 临时想法

输出：

- 标题
- 摘要
- 关键点
- 来源
- 下一步

适合场景：

- 看到一篇好文章
- 对话里冒出灵感
- 需要快速入库

### 3.2 `source-to-synthesis`

用途：把多篇来源合成一篇主题总结。

输入：

- 多个 source notes
- 相关 atomic notes

输出：

- 一篇 synthesis note
- 明确事实与观点
- 相关链接

适合场景：

- 读完一组资料后
- 想整理成自己的理解

### 3.3 `link-suggester`

用途：找出当前笔记该链接哪些旧笔记。

输入：

- 当前笔记
- 附近候选笔记

输出：

- 建议链接
- 每条链接理由

适合场景：

- 新笔记写完后
- 复盘时补连接

### 3.4 `weekly-review`

用途：每周清 inbox，推动知识库活起来。

输入：

- inbox 笔记
- active projects
- 最近新增内容

输出：

- 待整理项
- 待补充项
- 下周行动项

适合场景：

- 周末收尾
- 月初规划

---

## 4. skill 模板

你可以把每个 skill 理解成同一套结构：

```text
Name
Purpose
Input
Output
Rules
Steps
Failure cases
```

### 示例：`capture-to-note`

```text
Name: capture-to-note
Purpose: Convert raw input into an Obsidian note.
Input: text, url, excerpt, rough thoughts
Output: markdown note with summary, key points, source, next step
Rules:
- Keep source separate from interpretation
- Do not over-summarize
- Preserve user wording when it matters
Steps:
1. Identify the note type
2. Extract main points
3. Add source block
4. Add next step
Failure cases:
- Input too vague
- Source missing
- Mixed topics need splitting
```

---

## 5. 三个可直接照抄的笔记模板

### 5.1 Source Note

```markdown
# Title

## Summary

## Key Points

## My Notes

## Source
- URL:
- Date:

## Next Step
- 
```

### 5.2 Atomic Note

```markdown
# Concept Name

## Definition

## Why It Matters

## Examples

## Related Notes
- 
```

### 5.3 Project Note

```markdown
# Project Name

## Goal

## Current State

## References

## Next Actions
- 
```

---

## 6. 一条完整工作流

### 收集

1. 先丢进 `00_inbox`
2. 用 `capture-to-note` 变成结构化内容
3. 保留来源

### 整理

1. 每天或每周跑 `weekly-review`
2. 把内容分到 source / atomic / project
3. 该合并的合并

### 连接

1. 用 `link-suggester`
2. 人工确认链接
3. 只保留有意义的双链

### 输出

1. 从知识库里拉项目资料
2. 用 `project-brief` 生成执行上下文
3. 继续回写到 Obsidian

---

## 7. 推荐的第一周落地顺序

1. 建目录
2. 建模板
3. 先只做 `capture-to-note`
4. 第二个做 `weekly-review`
5. 第三个做 `link-suggester`

不要一开始就追求全自动。先把收集和复盘跑起来，系统才会长出来。

---

## 8. 你该避免的坑

- 让 Codex 直接成为知识真相源
- 标签无限增长
- 笔记只收集不复盘
- 让所有笔记风格都不一样
- 先做复杂数据库，再考虑实际使用

---

## 9. 最后一句建议

你的知识库应该像工作台，不像档案柜。  
Obsidian 负责装东西，Codex 负责把东西做成可用的成果。
