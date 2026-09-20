<!--
PR 模板：人类与 Coding Agent 共用。
请删除不适用的说明行，保留小节标题；未覆盖的小节请写明「不适用 + 理由」。
Coding Agent 请先读 AGENTS.md，并遵守其中的强制规则。
-->

## Summary

<!-- 一段话说明这个 PR 做了什么、为什么。 -->

## Related Spec

<!-- specs/<id>-<feature-name>/ 路径；无 Spec 时说明原因（Trivial / Bug 修复）。 -->
<!-- 同时列出关联的 REQ / NFR / Issue： -->

## Changes

<!-- 逐条列出改动；同时给出关键文件路径。 -->

-

## Verification

<!-- 必须写实际执行过的命令与结果；无法执行时说明原因与替代验证方式。 -->
<!-- 附上 specs/<id>/verification.md 的更新情况。 -->

```text
command:
result:
```

## Documentation Impact

<!-- 对照 docs/development/documentation-rules.md 的 Documentation Update Matrix 逐项判断： -->

| 文档 | 是否更新 | 说明 |
| ---- | -------- | ---- |
| docs/requirements/ | 是 / 否 | |
| docs/architecture/ | 是 / 否 | |
| docs/api/ | 是 / 否 | |
| ADR | 是 / 否 | |
| `.en.md` 配对 | 是 / 否 | |

## Architecture Impact

<!-- 是否改变组件、数据流、接口、数据模型、安全模型？是否需要 ADR？ -->

## Breaking Changes

<!-- 破坏性变更、兼容性影响、迁移方式；没有则写「无」。 -->

## Checklist

- [ ] Relevant tests passed（并已记录命令与结果）
- [ ] Relevant spec updated（`spec.md` / `tasks.md` / `verification.md` 状态已同步）
- [ ] Documentation updated（或已说明无需更新的理由）
- [ ] ADR considered（难逆决策是否已建立 ADR）
- [ ] No unrelated scope added（无顺手重构、无额外抽象、无未要求的校验）
