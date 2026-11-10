# news-daily

一条可复用的「新闻日报」工作流：给定一天，产出一份约 50 条、跨地区跨领域、每条带可点来源的新闻日报。

不是数据集，是**流程 + 判定标准**。里面的配额、去重口径、检索降级应对，来自多期实跑。

## 目录

```text
news-daily/
├─ SKILL.md              # 主文件：YAML frontmatter + 触发条件 + 配额 + 七步流程
├─ README.md             # 本文件
├─ MANIFEST.md           # 文件清单与 SHA256
└─ references/
   ├─ 运行手册.md         # 分桶清单、检索批次、选区经验、HTML 转正文片段
   ├─ 输出模板.md         # 日报正文 + 自检表
   ├─ 验收自检.md         # 交付前逐项清单 + 可跑的 3 行校验
   └─ 来源分级.md         # 域名可抓性（A/B/C）与实测结论
```

## 跨 agent 安装

skill 的通用形态是「目录 + `SKILL.md` + YAML frontmatter（`name` / `description`）」。

| 环境 | 放置位置 |
| --- | --- |
| Claude Code | `~/.claude/skills/news-daily/`（项目级用 `<项目>/.claude/skills/`） |
| Cursor | 项目 `.cursor/skills/news-daily/`（或按 Cursor 文档挂 `SKILL.md`） |
| DSH | `<项目根>/.dsh/skills/news-daily/` 或 `~/.dsh/skills/news-daily/` |
| 其他 | 把 `SKILL.md` 正文作为自定义指令，`references/` 随手可读 |

**不需要**任何 DSH 专有依赖：正文只用到「网络检索」和「网页抓取」两件事，工具名可按宿主替换。

## 换宿主时要改的三处

1. **工具名**：文中写的 `web_search` / `web_fetch` 是 DSH 的叫法；换宿主时替换成对方的名字（如 `search`、`fetch`、`browse`）。
2. **落盘路径**：已统一成中性的 `输出/`、`底账/`、`工作区/`，可直接照用，也可改成对方项目的习惯。
3. **来源分级表**：里面是 2026 年 10–11 月的实测结论，换环境要重测一遍 A/B/C。

## 已知限制

- 依赖检索接口能返回可用的标题/摘要；接口降级成「只给标题」时，正文里写了应对办法（改抓原文 + 保守措辞）。
- 抓取覆盖率随目标站点变化，`来源分级.md` 只是当时的快照。
- 内容判断仍要人复核：它保证的是**结构和口径**，不保证每条都核实到全文。

## 许可

许可证与 AI 参与声明由维护者补充；本目录只包含技能内容。
