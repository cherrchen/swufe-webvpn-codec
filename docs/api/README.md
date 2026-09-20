# API 文档

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-20

**用途**：本目录是**接口契约**的 Source of Truth：字段、错误、版本、兼容性承诺。
边界与稳定性策略见 [architecture/interfaces.md](../architecture/interfaces.md)；数据实体见 [architecture/data-model.md](../architecture/data-model.md)。

本仓库**没有公网 HTTP API**：第一期全部接口都是本机进程内接口（Electron IPC）、本机进程间接口（Electron Main ↔ mitm sidecar）与库级 API。

## 接口面清单

| 文件 | 接口面 | 提供方 → 消费方 | 形态 | 稳定性 |
| ---- | ------ | --------------- | ---- | ------ |
| [electron-ipc.md](electron-ipc.md) | Electron IPC，preload 暴露命名空间 `window.swufeBridge` | Electron Main → Renderer | 进程内 | Internal |
| [bridge-control-protocol.md](bridge-control-protocol.md) | 桥控制协议 | Electron Main → mitm sidecar | 进程间（仅本机） | Internal / Evolving（两种实现方式未定，见该文档） |
| [wrd-codec-library.md](wrd-codec-library.md) | WrdCodec 库 API（主机名加解密与 URL 互转） | WrdCodec 库 → 调用方（桥 addon、App） | 库级 | Evolving |

> 新增接口面时在上表补一行，并按下方「接口文档模板」新建 `docs/api/<surface>.md`。

## 接口文档模板

```markdown
# <接口面名称>

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-20

## 范围

- 提供方：……
- 消费方：……
- 稳定性：Stable / Evolving / Internal
- 关联 Spec：`specs/<id>-<name>/`

## 认证与授权

TBD

## 通用约定

- 编码：……
- 时间格式：……
- 分页：……
- 幂等：……
- 限流：……

## 端点 / 方法

### <METHOD> <path 或签名>

- 用途：……
- 输入：……

  | 字段 | 类型 | 必填 | 约束 | 说明 |
  | ---- | ---- | ---- | ---- | ---- |

- 输出：……
- 错误：……

  | 错误码 | 含义 | 触发条件 | 处理建议 |
  | ------ | ---- | -------- | -------- |

- 示例：……

## 版本与兼容性

- 版本策略：……
- 破坏性变更流程：……
- 弃用流程：……

## 变更记录

| 日期 | 变更 | 兼容性 | 关联 Spec / ADR |
| ---- | ---- | ------ | --------------- |
```

## 维护规则

1. 接口变更必须同步：本目录 + [interfaces.md](../architecture/interfaces.md) + 相关 Spec + 测试。
2. 破坏性变更必须评估 ADR，并在 PR 的 Breaking Changes 中说明。
3. 只写已确认的契约；未定字段标 `TBD`。
