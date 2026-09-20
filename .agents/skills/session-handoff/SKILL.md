# Skill: session-handoff

## Purpose

在 Session 结束、中断或转交时生成一份**可续接**的交接记录，使下一个 Agent 或人无需阅读聊天记录即可继续工作。

## When to use

- 上下文即将耗尽或时间受限；
- 任务转交他人或另一个 Agent；
- 需要暂停并在稍后恢复。

## Inputs

- 本次 Session 的改动与命令（必须真实）；
- 相关 Spec 路径；
- 模板：[session-handoff.md](../../../docs/agent/session-handoff.md)。

## Steps

1. 统计真实改动：文件清单与用途（不要凭记忆，以实际状态为准）。
2. 统计真实执行过的命令与结果；未执行的写明原因。
3. 区分「已迁移到长期文档的结论」与「仍未定的结论」。
4. 按模板写入 `.agents/notes/YYYY-MM-DD-<topic>.md`（模板结构见
   [session-handoff.md](../../../docs/agent/session-handoff.md) 第 2 节）。
5. 若出现长期结论：先迁移到 [docs/](../../../docs/README.md)、[specs/](../../../specs/README.md) 或 ADR，再在 note 顶部标注迁移去向。
6. 让 Next Step 具体到「下一步执行什么、如何验证」，避免「继续完善」。
7. 自查清单（同模板第 4 节）逐项确认。

## Output

`.agents/notes/YYYY-MM-DD-<topic>.md`，包含：

```text
Current Goal / Completed / In Progress / Remaining
Important Decisions / Changed Files / Commands Run
Known Problems / Recommended Next Step
```

## Do not

- 不要把交接记录当作 Source of Truth；
- 不要复制聊天过程或思维过程；
- 不要虚报完成度（未运行就不要写「已验证」）；
- 不要写入密钥、令牌或真实个人数据；
- 不要用交接记录替代 Spec 更新与文档同步。
