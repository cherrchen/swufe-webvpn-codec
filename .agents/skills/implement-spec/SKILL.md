# Skill: implement-spec

## Purpose

按既定 Spec 实现功能，逐条推进 `tasks.md`，并在实现过程中保持范围不被扩大。

## When to use

- 目标 Spec 状态为 `Approved` 或 `In Progress`；
- 用户明确要求实现某个 `specs/<id>-<feature-name>/`。

## Inputs

- `specs/<id>-<feature-name>/spec.md`、`design.md`、`plan.md`、`tasks.md`；
- 相关长期文档（按 [context-routing.md](../../../docs/agent/context-routing.md)）；
- 项目代码与既有模式。

## Steps

1. 读 Spec 全套文件；确认 `Status` 与验收标准。
2. **检查 Scope**：任何不在 `spec.md`（Goals + Functional Requirements）内的改动都属于扩大范围 ⇒ 不做，记录建议另开任务。
3. 确认依赖与阻塞：`Open Questions` 中标记阻塞实现的问题未解决时，先上报，不要猜测。
4. 按 `tasks.md` 顺序执行：
   - 一次一个任务；完成即把 `- [ ]` 改为 `- [x]`；
   - 任务描述与实际不符时，先修正 `tasks.md` 再继续；
   - 新发现的必要工作追加为**新任务**，不塞进既有任务。
5. 遵循仓库既有模式（[coding-conventions.md](../../../docs/development/coding-conventions.md)），不引入第二套等价写法。
6. 每个任务完成后运行该任务声明的验证方式；失败则保持未勾选并记录。
7. 实现完成后：
   - 运行相关测试与检查；
   - 更新 `verification.md` 映射状态与「执行的命令与结果」；
   - 按 [Documentation Update Matrix](../../../docs/development/documentation-rules.md) 更新文档或在 `verification.md` 中写明「无影响」；
   - 推进 Spec 状态（`Implemented`，验证通过后 `Verified`）。
8. 交付说明中给出：改了哪些文件、任务勾选情况、实际运行的命令与结果、未完成项与原因。

## Output

- 代码改动；
- `tasks.md` 状态更新；
- `verification.md` 更新；
- 受影响的长期文档更新。

## Do not

- 不做与 Spec 无关的重构或「顺手」优化；
- 不绕过 Spec 直接实现未批准的行为；
- 不删除用途未知的代码；
- 不声称「测试应该会通过」而实际未运行；
- 不在验证失败时把 Spec 标记为完成。
