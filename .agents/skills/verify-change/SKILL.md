# Skill: verify-change

## Purpose

对一个已完成（或进行中）的变更给出**有证据的**验证结论，而不是「看起来没问题」。

## When to use

- 代码改动完成，准备提交 PR；
- Bug 修复后确认原复现路径不再触发；
- 需要在交付前检查需求覆盖、兼容性与文档影响。

## Inputs

- 变更清单（diff / 文件列表）；
- 对应 Spec 或 Issue；
- [verification-strategy.md](../../../docs/verification/verification-strategy.md)、[testing-strategy.md](../../../docs/development/testing-strategy.md)。

## Steps

1. **Requirement coverage**：逐条对照 `specs/<id>/spec.md` 的 Acceptance Criteria 与 `verification.md` 映射，检查是否都有对应验证。
2. **Tests**：运行相关测试；无法运行时说明原因与替代验证方式。
3. **Lint / 类型 / 构建**：在项目已配置的前提下运行；未配置则说明。
4. **文档一致性**：运行 `pnpm run docs:check`；并逐项检查 [Documentation Update Matrix](../../../docs/development/documentation-rules.md)。
5. **Backward compatibility**：接口、数据、配置、行为四个维度是否受影响；破坏性变更是否已声明。
6. **Security implications**：信任边界、输入校验、认证授权、密钥、敏感数据、依赖风险（对照 [security/](../../../docs/security/README.md)）。
7. **回归确认**（Bug 修复）：原复现步骤是否不再触发；是否补了可复现的验证。
8. 汇总结论并更新 `verification.md` 状态（`Passed` / `Failed` / `N/A`）。

## Output

```text
Verification Report
- Scope:               <变更范围>
- Requirement coverage: <逐条结论>
- Commands run:        <命令 + 结果>
- Not run / why:       <未执行项 + 原因>
- Compatibility:       <结论 + 依据>
- Security:            <结论 + 依据>
- Documentation:       <更新项 或 无影响（依据）>
- Result:              Passed / Failed / Partial
- Follow-ups:          <未解决项>
```

## Do not

- 不要用「应该没问题」「看起来正确」作为结论；
- 不要在未运行命令时声称已通过；
- 不要因为测试通过就认定需求已满足（测试通过 ≠ 需求覆盖）；
- 不要顺手修复发现的新问题（记录并上报，除非属于本次范围）。
