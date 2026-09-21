# 数据模型

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-20

**用途**：定义核心实体、关系与不变式，是数据相关改动的 Source of Truth。
**不写**：具体存储技术选型（属于 ADR）、表结构迁移脚本（属于对应 Spec 的 `migration.md`，见 [specs/README.md](../../specs/README.md)）。

---

## 实体清单

| 实体 | 说明 | 生命周期 | 详见 |
| ---- | ---- | -------- | ---- |
| AllowlistConfig | 主机列表与通配选项，决定哪些主机经 WebVPN 改写 | 随配置写入创建/更新，长期保留 | 本文件 |
| SessionState | WebVPN 会话所需的 Cookie 及最小附属状态 | 登录后创建，过期/登出即失效 | 本文件 |
| AppSettings | 应用设置（端口、调试、捕获方式与捕获应用、WebVPN 基址、WRD key/iv、代理标记） | 首次启动创建，用户修改时更新 | 本文件 |
| BridgeRuntimeStatus | 桥的运行时状态（不持久化） | 进程内产生与消亡 | 本文件、[api/electron-ipc.md](../api/electron-ipc.md) |
| DebugLogRecord | 调试日志记录（域名 + 是否改写成功） | 内存环缓，可选落盘 | 本文件 |

## 关系图

实体相互独立、无关系图：`AllowlistConfig`、`SessionState`、`AppSettings` 各自独立持久化，彼此没有标识或引用关系；`BridgeRuntimeStatus` 不持久化，`DebugLogRecord` 仅内存环缓。因此本文件不提供关系图，原 `erDiagram` 段已删除。实体间的组合发生在运行时（桥读取已登录会话与 allowlist 后进入 `running`），不属于数据模型的关系。

## 实体详情

### AllowlistConfig

- 说明：决定哪些主机经 WebVPN 改写；非名单主机直连不改写。
- 标识：单一配置对象（无多实例）。
- 关键属性：

  | 属性 | 类型 | 必填 | 约束 | 说明 |
  | ---- | ---- | ---- | ---- | ---- |
  | hosts | string[] | 是 | 每项为合法 hostname，小写存储，精确匹配 | 默认 `["jwxt.swufe.edu.cn"]` |
  | includeSwufeWildcard | boolean | 是 | 默认 `false` | 匹配 `swufe.edu.cn` apex 或 `.swufe.edu.cn` 后缀 |
  | updatedAt | string（ISO8601） | 是 | — | 最后更新时间 |

- 不变式：小写存储并精确匹配（INV-003）；`webvpn.swufe.edu.cn` / `authserver.swufe.edu.cn` 永不成为改写目标（INV-004）。
- 生命周期：创建于首次启动读取配置；更新于 allowlist 增删或通配切换；删除为显式清空（回到默认值）。
- 所有者：cherrchen。
- 关联需求：REQ-005、REQ-001。

### SessionState

- 说明：官方 WebVPN 会话所需 Cookie 与最小附属状态；敏感数据。
- 标识：单一会话对象（登录后一份）。
- 关键属性：

  | 属性 | 类型 | 必填 | 约束 | 说明 |
  | ---- | ---- | ---- | ---- | ---- |
  | cookies | Cookie[] | 是 | 敏感；不得进入日志 | WebVPN 会话相关 Cookie |
  | capturedAt | string | 是 | — | 采集时间 |
  | lastValidatedAt | string \| null | 否 | — | 最近一次失效检测时间 |

  Cookie 子结构：

  | 字段 | 类型 | 约束 | 说明 |
  | ---- | ---- | ---- | ---- |
  | name | string | — | Cookie 名 |
  | value | string | 敏感，禁止入日志 | Cookie 值 |
  | domain | string | — | 作用域 |
  | path | string | — | 路径 |
  | expires | number \| null | — | 过期时间 |
  | httpOnly | boolean | — | — |
  | secure | boolean | — | — |
  | sameSite | string \| null | — | — |

- 不变式：Cookie 与正文永不进入日志（INV-001）。
- 生命周期：创建于登录成功后的采集；更新于重新采集/校验；删除于登出、过期或桥会话重置。
- 所有者：cherrchen。
- 关联需求：REQ-002、REQ-009。

### AppSettings

- 说明：应用级设置与运行时标记。
- 标识：单一配置对象。
- 关键属性：

  | 属性 | 类型 | 必填 | 约束 | 说明 |
  | ---- | ---- | ---- | ---- | ---- |
  | bridgePort | number | 是 | 默认 8080 或自动 | 本机桥监听端口 |
  | debugLogging | boolean | 是 | 默认 `false` | 调试日志开关 |
  | captureMode | `'system-proxy'` \| `'selected-apps'` | 是 | 默认 `'system-proxy'` | 捕获方式（M3）：两种方式互斥（ADR-0006） |
  | captureProcesses | string[] | 是 | 默认 `[]`；元素为 mitmproxy intercept pattern（非空、不含逗号、去重，最多 32 个） | 捕获方式为 `selected-apps` 时下发给 sidecar 的应用集合（M3） |
  | webvpnBase | string | 是 | 默认 `https://webvpn.swufe.edu.cn` | WebVPN 入口 |
  | wrdKey | string | 是 | 默认 `wrdvpnisthebest!`，可覆盖 | WRD 默认密钥（ADR-0005） |
  | wrdIv | string | 是 | 默认 `wrdvpnisthebest!`，可覆盖 | WRD 默认 IV（ADR-0005） |
  | systemProxyManagedByApp | boolean | 是 | 默认 `false`；运行时 | 「系统代理由本 App 设置」标记 |

- 不变式：`systemProxyManagedByApp` 与实际代理状态强一致；仅在标记为真时清除系统代理（INV-002）。
- 不变式（M3）：`captureMode` 与「本 App 是否设置系统代理」互斥——`selected-apps` 时 `systemProxyManagedByApp` 必须为 `false`；`captureProcesses` 仅在 `selected-apps` 时写入 `bridge-config.json` 的 `capture.processes`（`system-proxy` 下恒为空数组）。
- 生命周期：创建于首次启动；更新于用户修改设置或桥启停；删除为重置设置。
- 所有者：cherrchen。
- 关联需求：REQ-001、REQ-003、REQ-004。

### BridgeRuntimeStatus

- 说明：桥的运行时状态，供 UI 展示；**不持久化**。
- 标识：单一运行时对象；定义为接口 `BridgeStatus`。
- 关键属性：

  | 属性 | 类型 | 必填 | 约束 | 说明 |
  | ---- | ---- | ---- | ---- | ---- |
  | state | `idle` \| `starting` \| `running` \| `stopping` \| `error` | 是 | 状态机取值固定 | 桥状态 |
  | loggedIn | boolean | 是 | — | 是否已取得可用会话 |
  | systemProxyEnabled | boolean | 是 | — | 系统代理是否指向本桥 |
  | localCaptureEnabled | boolean | 是 | — | 是否启用进程捕获 |
  | bridgePort | number | 否 | — | 本机桥端口 |
  | error | `{ code, message }` | 否 | code 取固定错误码集合 | 错误信息 |

- 不变式：状态迁移必须遵循 `idle → starting → running`、`running → stopping → idle`、`starting → error → idle`。
- 生命周期：进程内创建与消亡；不写入磁盘。
- 所有者：cherrchen。
- 关联需求：REQ-001、REQ-009。

### DebugLogRecord

- 说明：调试日志记录，仅含域名与是否改写成功。
- 标识：内存环缓中的单条记录，可选落盘。
- 关键属性：

  | 属性 | 类型 | 必填 | 约束 | 说明 |
  | ---- | ---- | ---- | ---- | ---- |
  | ts | string | 是 | — | 时间 |
  | host | string | 是 | — | 域名 |
  | rewritten | boolean | 是 | — | 是否改写成功 |
  | direction | `request` \| `response` | 是 | — | 方向 |
  | detail | string \| null | 否 | **禁止含 Cookie 与正文** | 短信息 |

- 不变式：记录中不得出现 Cookie 与正文（INV-001）。
- 生命周期：创建于一次请求/响应处理；默认内存环缓，可选落盘；随进程退出或清理而消失。
- 所有者：cherrchen。
- 关联需求：REQ-009。

## 不变式（Invariants）

| ID | 不变式 | 违反后果 | 校验位置 |
| -- | ------ | -------- | -------- |
| INV-001 | Cookie 与正文永不进入日志 | 会话泄露、隐私泄露 | DebugLogRecord 写入路径与日志面板 |
| INV-002 | 关闭 / 过期 / 退出后仅清除本 App 设置的系统代理 | 误清用户自有代理设置，破坏其它工具 | Proxy Orchestrator 的代理清除逻辑 |
| INV-003 | allowlist 主机以小写存储并精确匹配 | 漏匹配导致本应改写的主机直连，或误匹配扩大改写范围 | Allowlist Store 写入路径与匹配函数 |
| INV-004 | `webvpn.swufe.edu.cn` 与 `authserver.swufe.edu.cn` 永不被二次包装 | 防环失败，登录与桥流量成环 | Bridge Addon 硬编码排除与登录 WebView bypass |

## 存储与迁移

| 内容 | 位置 |
| ---- | ---- |
| 存储选型决策 | ADR（见 [adr/README.md](adr/README.md)）；配置存储为 JSON（settings + allowlist → `userData/config.json`，会话 → `userData/session.bin`（加密）或 Electron Session 持久分区，CA → mitmproxy 专用 confdir） |
| 迁移方案 | 尚无迁移方案（第一期仅本地持久化，无云端账号体系） |
| 备份 / 恢复 | [docs/operations/](../operations/README.md) |

## 变更流程

修改数据模型前必须：

1. 更新本文件（实体、不变式）；
2. 评估是否需要 ADR（数据模型重大改变 ⇒ 必须）；
3. 在 Spec 中定义迁移与回滚；
4. 更新 [verification](../../specs/_template/verification.md) 中的验证项。
