# Agent 工作流

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-20

**用途**：定义 Coding Agent 的完整工作循环。人类流程见 [development-workflow.md](../development/development-workflow.md)；两者使用同一套产物，Agent 额外受本文件约束。

---

## 1. 循环

```text
1. Orient     读 AGENTS.md → 读最小充分上下文
2. Classify   判定任务类型（Feature / Bug / Architecture / API / UI / Database / Testing / Docs）
3. Check      检查 Spec / ADR / 验证要求是否存在；缺失则先补齐
4. Plan       产出或更新 tasks.md（或对 Trivial 变更说明无需计划）
5. Implement  最小改动，遵循仓库既有模式
6. Verify     运行相关测试 / 命令；无法运行时说明原因
7. Sync Docs  按 Documentation Update Matrix 更新文档
8. Handoff    必要时写 .agents/notes/YYYY-MM-DD-<topic>.md
```

## 2. 各步骤要求

| 步骤 | 必须做到 | 禁止 |
| ---- | -------- | ---- |
| Orient | 明确声明读了哪些文件 | 假装读过、凭印象回答 |
| Classify | 说明分类结论与理由 | 跳过分类直接改代码 |
| Check | 引用对应 Spec / ADR 路径；不存在时先创建或明确记录缺口 | 无 Spec 直接实现 Feature |
| Plan | 任务拆到可独立验证的粒度 | 把「实现整个 Feature」当作一个任务 |
| Implement | 只改与任务相关的文件 | 顺手重构、顺手加校验、扩大 Scope |
| Verify | 给出实际运行的命令与结果 | 声称「应该没问题」 |
| Sync Docs | 说明改了哪些文档或为什么不需要 | 把临时结论写进长期文档 |
| Handoff | 记录真实状态与下一步 | 把交接记录当作 Source of Truth |

## 3. 任务粒度与并行

- 一个任务必须可独立验证，并描述输入/输出与依赖；
- 多个任务可并行时，明确契约（接口、数据结构、文件归属）后再并行，避免同文件并发修改；
- 涉及同一文件的任务应串行，或先确定集成责任人。

## 4. 阻塞处理

遇到阻塞时（信息缺失、需求冲突、环境不可用）：

1. 先穷尽仓库内可获得的信息（docs、specs、notes、代码、测试）；
2. 仍无法解决 ⇒ 记录到对应 Spec 的 `Open Questions` 或 note 中，标明影响；
3. 在交付说明中明确指出「缺少什么、已尝试什么、需要谁决策」；
4. 不要用猜测填补缺口，也不要静默缩小范围。

## 5. 完成判定

Agent 声称完成前必须确认：

- 验收标准逐条对应（见 `specs/<id>/verification.md` 矩阵）；
- 相关测试/命令已实际运行并有输出证据；
- 受影响的文档已同步；
- 未引入与任务无关的改动。

## 6. 相关

- 上下文路由：[context-routing.md](context-routing.md)
- 技能指令：[.agents/skills/](../../.agents/README.md)
- 完成标准：[docs/verification/verification-strategy.md](../verification/verification-strategy.md)
