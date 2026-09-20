# Session 交接（Session Handoff）

> Status: Draft ｜ Owner: <OWNER> ｜ Last Reviewed: <DATE>

**用途**：定义 Session 结束、中断或转交时如何记录状态，使下一个 Agent 或人能在不读聊天记录的前提下继续工作。
对应技能：[.agents/skills/session-handoff/SKILL.md](../../.agents/skills/session-handoff/SKILL.md)。

---

## 1. 核心规则

> **Session note 不是 Source of Truth。**

- 位置：[.agents/notes/](../../.agents/notes/README.md)；
- 命名：`YYYY-MM-DD-<topic>.md`；
- 只写**当前状态与下一步**，不复制聊天过程；
- 若产生长期结论（需求、架构、接口、决策），必须迁移到 `docs/`、`specs/` 或 ADR，并在 note 中写明迁移去向。

## 2. 模板

```markdown
# Session Handoff — <日期> — <主题>

## Current Goal
（本次会话要达成什么；关联 spec 路径）

## Completed
- [x] …（附证据：文件、命令、结果）

## In Progress
- [ ] …（做到哪一步，剩余什么）

## Remaining
- [ ] …

## Important Decisions
- …（临时决策可在此；长期决策必须已迁移到 docs/specs/ADR，并写出路径）

## Changed Files
| 文件 | 变更 | 关联任务 |
| ---- | ---- | -------- |

## Commands / Tests Run
| 命令 | 结果 | 备注 |
| ---- | ---- | ---- |

## Known Problems
- …（未解决的错误、失败测试、环境限制）

## Recommended Next Step
1. …
2. …
```

## 3. 填写要求

| 字段 | 要求 |
| ---- | ---- |
| Current Goal | 关联到具体 spec 或 issue；没有 spec 时说明为什么 |
| Completed | 附可核查证据（文件路径、命令、输出摘要），不写「基本完成」 |
| In Progress | 说明中断点，便于直接续接 |
| Remaining | 未开始的工作，含被排除的 Scope |
| Decisions | 区分「已迁移」与「未定」；未定的标 `Open` |
| Changed Files | 真实改动清单，便于复核 |
| Commands / Tests | 实际执行过的命令与结果；未执行的写明原因 |
| Known Problems | 不隐藏失败；不写「应该没问题」 |
| Next Step | 具体、可执行、可验证；不要写「继续完善」 |

## 4. 交接检查清单

- [ ] note 文件已写入 `.agents/notes/`，命名符合 `YYYY-MM-DD-<topic>.md`；
- [ ] 长期结论已迁移到 Level A/B 文档（或明确说明无需迁移）；
- [ ] 未提交的改动已在 Changed Files 中列出；
- [ ] 失败或未运行的验证已明确标注；
- [ ] Next Step 可在不读聊天记录的情况下执行。

## 5. 何时必须写

| 情况 | 是否必须 |
| ---- | -------- |
| Session 因上下文/时间限制中断 | 必须 |
| 任务转交他人或另一个 Agent | 必须 |
| 工作已完成且已同步文档 | 可选（Spec 的 `verification.md` 已是记录） |
| 纯问答、无仓库改动 | 不需要 |
