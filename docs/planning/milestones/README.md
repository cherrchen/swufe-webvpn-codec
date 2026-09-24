# 里程碑（Milestones）

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-21

**用途**：定义「到达某个节点」的判定标准，使进度可被外部复核。
**不写**：需求、设计、任务拆解（分别见 [requirements/](../../requirements/README.md)、[architecture/](../../architecture/README.md)、`specs/<id>/tasks.md`）。

## 何时建立里程碑

- 存在多个 Feature Spec 需要一次性交付；
- 需要对外承诺一个可验证的时间点或版本；
- 需要一组共同的退出条件（例如：验证通过 + 文档同步 + 无已知阻塞缺陷）。

## 文件命名

```text
docs/planning/milestones/<MILESTONE_ID>-<short-name>.md
```

例如：`M1-mitm-bridge.md`（编号式）或 `2026-09-20-packaging.md`（日期式）；按项目习惯二选一，并保持统一。

## 里程碑清单

| 里程碑 | 文件 | Status | 关联 Spec | 目标一句话 |
| ------ | ---- | ------ | --------- | ---------- |
| M0 预研 | [M0-pre-research.md](M0-pre-research.md) | Done | —（M0 交付文档包与需求规格，未归属 Spec） | WRD codec 验证、Phase 1 需求规格与文档包完成并归档 |
| M1 桥核心 | [M1-mitm-bridge.md](M1-mitm-bridge.md) | Done | [001-phase1-local-bridge](../../../specs/001-phase1-local-bridge/spec.md) | mitm WRD addon 请求改写 + Cookie 注入 + 单测/集成测 |
| M2 桌面编排 | [M2-desktop-orchestration.md](M2-desktop-orchestration.md) | Done | [001-phase1-local-bridge](../../../specs/001-phase1-local-bridge/spec.md) | Electron 可登录、开桥、设置系统代理、安装 CA |
| M3 体验打磨 | [M3-experience-polish.md](M3-experience-polish.md) | Done | [001-phase1-local-bridge](../../../specs/001-phase1-local-bridge/spec.md) | Allowlist UI、调试日志、进程捕获、文案可用 |
| M4 验收 | [M4-acceptance.md](M4-acceptance.md) | In Progress | [001-phase1-local-bridge](../../../specs/001-phase1-local-bridge/spec.md) | 两侧 P0 与教务浏览器验收已通过；`KI-014` 已接受，`KI-019` 保持 `Open`，现场证据定位到桥上游阶段，根因未定 |
| M5 开源准备（可选） | [M5-open-source-preparation.md](M5-open-source-preparation.md) | Done（2026-09-23） | —（文档准备里程碑） | 用户/开发者 README、开源边界说明与后续 TUN 设计备忘完成；不含安装包或公开发行 |
| M6 界面重构 | [M6-ui-rework.md](M6-ui-rework.md) | Done（2026-09-23） | [002-desktop-ui-multiwindow](../../../specs/002-desktop-ui-multiwindow/spec.md)（`Implemented`） | 渲染层迁移到 React + Ant Design 6 并固定为四窗口结构（主窗口 720×560 零滚动，捕获/日志/Allowlist 进非模态二级窗口）；可机器执行的验收全部通过，未验证项 = Windows 真机、真实会话下的教务页面操作、进程捕获真实范围 |
| M7 iOS 代理插件 | [M7-ios-proxy-plugins.md](M7-ios-proxy-plugins.md) | Draft | [003-ios-proxy-client-plugins](../../../specs/003-ios-proxy-client-plugins/spec.md) | Loon/Stash 插件 + 共享 JS Core；Spec 003 文档已入库，P0 宿主能力与 Session Capture 待真机 |

> 阶段划分、依赖与 Spec 索引见 [roadmap.md](../roadmap.md)。M5 的完成范围仅为开源前文档准备，不代表发行物已完成。

## 里程碑模板

> 以下代码块是**模板示例**（占位符保持原样），新建里程碑文件时复制并按实际内容替换。

```markdown
# <里程碑 ID>: <名称>

> Status: Candidate | Planned | In Progress | Done | Dropped
> Owner: <OWNER>
> Target: <DATE>

## 目标

（该里程碑要达成的可验证结果）

## 包含的 Specs

| Spec | 状态 | 依赖 |
| ---- | ---- | ---- |

## 退出条件

- [ ] 所有包含的 Spec 状态为 `Verified`
- [ ] 相关文档已同步（含双语配对）
- [ ] 无阻塞类缺陷
- [ ] 相关验证命令通过
- [ ] 兼容性与安全影响已确认

## 风险

| 风险 | 影响 | 应对 |
| ---- | ---- | ---- |

## 完成记录

（完成时间、证据、遗留问题）
```

## 规则

1. 里程碑的退出条件必须可验证，避免「基本完成」；
2. 里程碑不定义新需求；缺需求时先补 Spec；
3. 未达成即延期时要记录原因，不要静默修改历史里程碑定义。
