# 桥控制协议（Electron Main → mitm sidecar）

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-20

## 范围

- 提供方：mitm sidecar（本机桥进程，含薄 WRD addon）。
- 消费方：Electron Main（Proxy Orchestrator）。
- 形态：本机进程间接口（两种候选实现方式见下）。
- 稳定性：Internal / Evolving —— 只在本 App 内部消费；`TBD`：第一期采用哪种实现方式未定，故在此之前不对稳定性作承诺。
- 关联 Spec：[specs/001-phase1-local-bridge/spec.md](../../specs/001-phase1-local-bridge/spec.md)

## 认证与授权

- 若采用方案 B，控制口仅监听 `127.0.0.1`（回环即信任边界），不引入令牌或账号体系；不对局域网或外部地址暴露。
- Cookie 是敏感数据：禁止写入调试日志与控制口响应（NFR-003）。

## 通用约定

- 编码：方案 B 的请求/响应体为 JSON（UTF-8）；方案 A 为配置文件（JSON）。
- 时间格式：ISO8601（如涉及时间字段）。
- 分页：无。
- 限流：无（本机回环/单进程调用）。
- 幂等：`GET /health` 只读；`POST /config` 为整体覆盖式写入（幂等）；`POST /shutdown` 幂等。

## 候选实现方式

第一期**未定**：以下两种方式都满足第一期需求，控制面具体形态在实现阶段决定。

### 方案 A：子进程生命周期 + 配置文件热加载

- Main 只负责拉起/结束 sidecar 进程，并把配置写入 sidecar 读取的配置文件。
- 配置生效通过 `SIGHUP` 或轮询文件变化（二者择一，实现阶段定）。
- 不新增监听端口；控制面能力相对方案 B 更弱（无 liveness 端点）。

### 方案 B：本地 HTTP 控制口

- sidecar 监听本机控制口 `127.0.0.1:control`（端口取值实现阶段定），Main 通过 HTTP 调用。

| Method | Path | 说明 |
|---|---|---|
| GET | `/health` | liveness |
| POST | `/config` | body: `{ allowlist, cookies, debug }` |
| POST | `/shutdown` | 优雅退出 |

### `TBD` 说明

- **未定项**：第一期采用方案 A 还是方案 B。
- **未定原因**：留给实现阶段决定（两种方式都能满足第一期需求，取舍取决于 sidecar 打包方式与配置热更新成本）。

## 硬约束

1. Cookie 禁止写入调试日志与控制口响应。
2. 控制口仅监听 `127.0.0.1`，不得监听 `0.0.0.0` 或任何外部可达地址。

## 版本与兼容性

- 版本策略：无独立版本号；稳定性为 Internal。
- 破坏性变更流程：更新本文件 + [architecture/interfaces.md](../architecture/interfaces.md) + [specs/001-phase1-local-bridge/spec.md](../../specs/001-phase1-local-bridge/spec.md)，并在 PR 的 Breaking Changes 中说明。
- 弃用流程：先在本文档标注 `Deprecated` 与替代端点，待 Main 全部迁移后删除。

## 变更记录

| 日期 | 变更 | 兼容性 | 关联 Spec / ADR |
| ---- | ---- | ------ | --------------- |
| 2026-09-20 | 首版：记录方案 A / 方案 B 两种候选实现与硬约束，实现方式标 `TBD` | — | [spec 001](../../specs/001-phase1-local-bridge/spec.md) |
