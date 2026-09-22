# UI / UX 文档

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-23

**用途**：记录界面结构、交互约定、状态与可访问性要求。
**不写**：实现细节（框架、组件库、样式方案 → 属于 Spec 或 ADR）、接口字段（→ [docs/api/](../api/README.md)）。

## 界面清单

| 文件 | 内容 |
| ---- | ---- |
| [main-window.md](main-window.md) | 主窗口（720×560 固定、零滚动）：结构、状态、交互、尺寸与内容缩放、文案 |
| [secondary-windows.md](secondary-windows.md) | 二级窗口（捕获 / 日志 / Allowlist）：共同约定、结构、状态、交互、文案 |

界面固定为四个窗口：主窗口承载全部高频内容且严格零滚动，三类长内容（捕获应用选择、调试日志、Allowlist 编辑）各自进入非模态二级窗口（每类单实例）；结构事实由 [Spec 002](../../specs/002-desktop-ui-multiwindow/spec.md) 与 [ADR-0012](../architecture/adr/ADR-0012-react-antd-multiwindow-renderer.md) 决定。托盘图标非必须，是否实现未定（见 [main-window.md](main-window.md) 的开放问题）。设计系统/视觉规范文档 `TBD`（尚未定义）。

> 新增界面时在上表补一行，并按下方「界面文档模板」新建 `docs/ui-ux/<surface>.md`。

## 界面文档模板

```markdown
# <界面名称>

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-23

## 目标

- 用户目标：……
- 关联需求：REQ-xxx
- 关联 Spec：`specs/<id>-<name>/`

## 结构与信息层级

```mermaid
flowchart TD
    A["界面"] --> B["区块"]
```

## 状态

| 状态 | 表现 | 触发条件 |
| ---- | ---- | -------- |
| 空态 | …… | …… |
| 加载 | …… | …… |
| 错误 | …… | …… |
| 成功 | …… | …… |
| 无权限 | …… | …… |

## 交互

| 操作 | 结果 | 边界条件 |
| ---- | ---- | -------- |

## 可访问性

- 键盘操作：……
- 对比度：……
- 文案与本地化：……

## 文案

| 位置 | 文案 | 备注 |
| ---- | ---- | ---- |

## 开放问题

| ID | 问题 | 状态 |
| -- | ---- | ---- |
```

## 维护规则

1. 影响用户可见行为的改动，必须检查 [requirements/](../requirements/README.md) 与对应 Spec 的 `ui-ux.md`。
2. 设计稿或原型以完整 URL（或仓库内相对路径）引用，不要复制到仓库，除非有明确理由。
3. 未定的视觉细节标 `TBD`；不要编造设计系统。
