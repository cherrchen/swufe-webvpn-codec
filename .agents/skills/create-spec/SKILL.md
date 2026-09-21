# Skill: create-spec

## Purpose

把用户需求转成一套可执行的 Feature Spec：`spec.md → design.md → plan.md → tasks.md → verification.md`。
**信息不足时不允许虚构**：缺失内容写入 `Open Questions` 并标 `TBD`。

## When to use

- 用户提出新 Feature 或行为变更；
- 已有 Bug 暴露出需求/设计缺口，需要升级为 Spec；
- 需要把口头讨论固化为可评审的产物。

## Inputs

- 用户需求描述；
- 相关长期事实：[requirements/](../../../docs/requirements/README.md)、[architecture/](../../../docs/architecture/README.md)、[ADR](../../../docs/architecture/adr/README.md)；
- 模板：[specs/_template/](../../../specs/_template/README.md)。

## Steps

1. 读 [AGENTS.md](../../../AGENTS.md) 与 [docs/agent/context-routing.md](../../../docs/agent/context-routing.md)，确认本任务属于 Feature 级变更。
2. 检查是否已有对应 Spec（`specs/` 下同名或同需求项）；已有则改为更新，不要新建重复 Spec。
3. 分配 ID：查看 `specs/` 现有最大编号 +1，三位递增。
4. 复制模板：`cp -r specs/_template specs/<id>-<feature-name>`。
5. 填写 `spec.md`：
   - Background / Problem / Goals / Non-goals / User Stories；
   - Functional Requirements（`REQ-xxx`，与 [functional-requirements.md](../../../docs/requirements/functional-requirements.md) 保持一致）；
   - Non-functional Requirements、Constraints、Edge Cases、Out of Scope；
   - Acceptance Criteria：每条可验证；
   - 不确定项 → `Open Questions`，标 `TBD`。
6. 填写 `design.md`：方案、影响面（组件/数据流/接口/数据模型）、安全与性能、兼容性、迁移、备选方案、风险。
   - 出现难以逆转的决策 ⇒ 停止，先建 ADR 并在此引用。
7. 填写 `plan.md`：阶段、依赖、迁移、回滚、文档更新计划、验证计划。
8. 填写 `tasks.md`：把 Phase 拆成 `T00x` 原子任务（动作 / 输入 / 输出 / 依赖 / 验证 / 关联 ID）。
9. 填写 `verification.md`：Requirement → Verification 映射，状态初始 `Pending`。
10. 在 [roadmap.md](../../../docs/planning/roadmap.md) 注册一行。
11. 运行 `pnpm run spec:check`。
12. 在交付说明中列出：新 Spec 路径、未解决项、需要谁决策。

## Output

- `specs/<id>-<feature-name>/` 下五个文件；
- roadmap 索引行；
- 未解决问题清单。

## Do not

- 不要虚构需求细节或技术事实；不确定即 `TBD`；
- 不要在 Spec 中重新定义长期事实（应引用 [docs/](../../../docs/README.md)）；
- 不要在 `tasks.md` 中写「实现整个 Feature」这类任务；
- 不要在没有 design 的情况下拆 tasks；
- 不要把 Spec 当作 ADR 使用（难逆决策 → ADR）。
