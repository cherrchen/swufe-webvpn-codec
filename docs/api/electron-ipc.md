# Electron IPC（`window.swufeBridge`）

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-23

## 范围

- 提供方：Electron Main 进程（Login WebView / Session Broker / Proxy Orchestrator / Cert Manager / Allowlist Store 的对外收口）。
- 消费方：Renderer（四个窗口——主窗口与捕获 / 日志 / Allowlist 三个二级窗口，见 [../ui-ux/main-window.md](../ui-ux/main-window.md) 与 [../ui-ux/secondary-windows.md](../ui-ux/secondary-windows.md)）。
- 形态：进程内 IPC；preload 脚本暴露命名空间 `window.swufeBridge`（示例名）。
- 窗口控制：二级窗口的打开/聚焦也经本表面提供（`openCaptureWindow` / `openLogWindow` / `openAllowlistWindow`），窗口生命周期由 Main 的窗口注册表持有，每类单实例。
- 稳定性：Internal —— 仅供本 App 内部消费，不对外承诺；破坏性变更需同步本文件 + [architecture/interfaces.md](../architecture/interfaces.md) + 相关 Spec。
- 关联 Spec：[specs/001-phase1-local-bridge/spec.md](../../specs/001-phase1-local-bridge/spec.md)、[specs/002-desktop-ui-multiwindow/spec.md](../../specs/002-desktop-ui-multiwindow/spec.md)

## 认证与授权

不适用。调用双方是同一台机器上同一个应用的两个进程（Renderer 的命名空间由本 App 的 preload 注入），不存在网络边界、无外部调用方，也没有独立的用户身份或令牌概念；隔离由 Electron 的上下文隔离与 preload 白名单保证，故不引入认证与授权层。

## 通用约定

- 编码：字符串 UTF-8；签名与类型用 TypeScript 声明（见「类型定义」）。
- 时间格式：ISO8601 字符串（如 `getSession().expiresAt`、`DebugLogEvent.ts`）。
- 分页：无（返回集合均为本机小列表）。
- 限流：无（本机进程内调用）。
- 幂等：逐方法标注（见下表）；「是」表示以相同参数重复调用与调用一次结果等价。
- 错误：方法可以 reject 一个携带错误码的错误，或通过 `BridgeStatus.error` 返回 `{ code, message }`；错误码全集与用户动作见 [错误模型](#错误模型)。

| 方法 | 幂等 |
| ---- | ---- |
| `login` | 否（打开登录 WebView，属交互式流程） |
| `logout` | 是 |
| `getSession` | 是（只读） |
| `startBridge` | 是（已在运行时保持 `running`） |
| `stopBridge` | 是 |
| `getStatus` | 是（只读） |
| `getAllowlist` | 是（只读） |
| `setAllowlist` | 是（整体覆盖写入） |
| `getSettings` | 是（只读） |
| `installCa` / `uninstallCa` | 是 |
| `getCaStatus` | 是（只读） |
| `listCaptureCandidates` | 是（只读） |
| `setCaptureMode` | 是（整体覆盖写入） |
| `setCaptureProcesses` | 是（整体覆盖写入） |
| `setDebugLogging` | 是 |
| `openCaptureWindow` | 是（单实例：已打开则聚焦，不重复创建） |
| `openLogWindow` | 是（单实例：已打开则聚焦，不重复创建） |
| `openAllowlistWindow` | 是（单实例：已打开则聚焦，不重复创建） |
| `getDebugLogs` | 是（只读） |
| `clearDebugLogs` | 是 |
| `onDebugLog` | 是（订阅；重复订阅各自独立，返回各自的取消订阅函数） |
| `onStatus` | 是（订阅；重复订阅各自独立，返回各自的取消订阅函数） |
| `onSessionExpired` | 是（订阅；重复订阅各自独立，返回各自的取消订阅函数） |

> 原包未逐条规定幂等性；上表是本文档对实现的约定。

## 类型定义

以下类型逐字取自归档原包的接口定义。

```ts
interface BridgeStatus {
  state: 'idle' | 'starting' | 'running' | 'stopping' | 'error'
  loggedIn: boolean
  systemProxyEnabled: boolean
  localCaptureEnabled: boolean
  bridgePort?: number
  error?: { code: string; message: string }
  captureError?: string   // M3 补充：进程捕获失败原因（不影响桥状态）
}
```

```ts
interface AllowlistConfig {
  hosts: string[]           // 精确主机名
  includeSwufeWildcard: boolean  // *.swufe.edu.cn
}
```

```ts
interface CaStatus {
  installed: boolean
  trusted: boolean
}
```

```ts
interface DebugLogEvent {
  ts: string
  host: string
  rewritten: boolean
  direction: 'request' | 'response'
  detail?: string   // 短信息，无 body
}
```

```ts
type CaptureMode = 'system-proxy' | 'selected-apps'   // M3 补充：捕获方式，二者互斥
```

```ts
interface CaptureCandidate {          // M3 补充：候选应用（一行一个应用）
  pid: number
  name: string
  pattern: string                     // mitmproxy intercept pattern：.app 包路径或可执行文件全路径
}
```

```ts
interface CaptureReport {             // M3 补充：对应 sidecar 的 swufe-capture 诊断行
  enabled: boolean
  processes: string[]
  error: string | null
}
```

```ts
interface AppSettingsView {
  bridgePort: number
  debugLogging: boolean
  captureMode: CaptureMode            // M3：取代 capturePids
  captureProcesses: string[]          // M3：intercept pattern 列表（最多 32 个）
  webvpnBase: string
}
```

持久化实体（`AllowlistConfig` 的 `updatedAt`、`SessionState`、`AppSettings`）以 [architecture/data-model.md](../architecture/data-model.md) 为准；本文件只定义 IPC 表面类型。

## 方法

### `login(): Promise<void>`

```ts
login(): Promise<void>           // 打开登录 WebView
```

- 用途：打开登录 WebView，由用户在官方门户完成 CAS/MFA 认证，取得可用 WebVPN 会话（Session Broker）。
- 输入：无。
- 输出：`Promise<void>`；登录成功即「稳定取得可用 WebVPN 会话」（Cookie 名以实机为准），随后 `getStatus()` 的 `loggedIn` 为 `true`。
- 错误：见 [错误模型](#错误模型)（未登录时启动桥会返回 `NOT_LOGGED_IN`）。

### `logout(): Promise<void>`

```ts
logout(): Promise<void>          // 清 Cookie，若桥开启则停桥
```

- 用途：清除会话 Cookie；若桥正在运行则先停桥。
- 输入：无。
- 输出：`Promise<void>`。
- 错误：见 [错误模型](#错误模型)（停桥失败时为 `BRIDGE_CRASH`）。

### `getSession(): Promise<{ loggedIn: boolean; expiresAt?: string | null }>`

```ts
getSession(): Promise<{
  loggedIn: boolean
  expiresAt?: string | null      // 若可得
}>
```

- 用途：查询当前会话状态。
- 输入：无。
- 输出：

  | 字段 | 类型 | 必填 | 约束 | 说明 |
  | ---- | ---- | ---- | ---- | ---- |
  | `loggedIn` | `boolean` | 是 | — | 是否存在可用 WebVPN 会话 |
  | `expiresAt` | `string \| null` | 否 | ISO8601 | 会话过期时间；若可得 |

- 错误：见 [错误模型](#错误模型)。

### `startBridge(): Promise<BridgeStatus>`

```ts
startBridge(): Promise<BridgeStatus>
```

- 用途：开启本机桥：启动 mitm sidecar、按需设置系统代理与进程捕获。
- 输入：无（桥端口、allowlist、webvpnBase 等来自 `AppSettings` 与 Allowlist Store）。
- 输出：`BridgeStatus`（见「类型定义」）；成功路径 `state` 由 `idle → starting → running`。
- 错误：见 [错误模型](#错误模型)；开桥前若系统代理已被占用，或网关主机解析到 fake-ip 段（`198.18.0.0/15`，Clash / mihomo / sing-box 的 TUN 模式），则以 `PROXY_CONFLICT` 拒绝启动（ADR-0004、[ADR-0011](../architecture/adr/ADR-0011-refuse-start-on-fake-ip-dns.md)）。

### `stopBridge(): Promise<BridgeStatus>`

```ts
stopBridge(): Promise<BridgeStatus>
```

- 用途：关闭本机桥：停 sidecar、停进程捕获，并清除由本 App 设置的系统代理。
- 输入：无。
- 输出：`BridgeStatus`；成功路径 `state` 经 `stopping` 回到 `idle`。
- 错误：见 [错误模型](#错误模型)。

### `getStatus(): Promise<BridgeStatus>`

```ts
getStatus(): Promise<BridgeStatus>
```

- 用途：读取桥的运行时状态（不持久化）。
- 输入：无。
- 输出：`BridgeStatus`；`error` 非空时表示处于错误态（如 `SESSION_EXPIRED`、`BRIDGE_CRASH`）。
- 错误：见 [错误模型](#错误模型)。

### `getAllowlist(): Promise<AllowlistConfig>`

```ts
getAllowlist(): Promise<AllowlistConfig>
```

- 用途：读取 allowlist（仅这些主机经 WebVPN 改写，其余直连）。
- 输入：无。
- 输出：`AllowlistConfig`；默认 `{"hosts":["jwxt.swufe.edu.cn"],"includeSwufeWildcard":false}`。
- 错误：见 [错误模型](#错误模型)。

### `setAllowlist(cfg: AllowlistConfig): Promise<void>`

```ts
setAllowlist(cfg: AllowlistConfig): Promise<void>
```

- 用途：整体覆盖写入 allowlist。
- 输入：

  | 字段 | 类型 | 必填 | 约束 | 说明 |
  | ---- | ---- | ---- | ---- | ---- |
  | `hosts` | `string[]` | 是 | 每项为合法 hostname，小写存储 | 精确匹配 |
  | `includeSwufeWildcard` | `boolean` | 是 | 默认 `false` | 勾选后匹配 `swufe.edu.cn` 及 `.swufe.edu.cn` 后缀 |

- 输出：`Promise<void>`。
- 副作用（M6 补充）：写入成功后 Main 额外广播一次当前 `BridgeStatus`，各窗口据此重读 allowlist 摘要（主窗口的摘要是唯一消费方；推送通道仍是 `onStatus`，不新增事件）。
- 错误：见 [错误模型](#错误模型)（`hosts` 为空且未开通配时启动桥返回 `ALLOWLIST_EMPTY`）。

### `getSettings(): Promise<AppSettingsView>`

```ts
getSettings(): Promise<AppSettingsView>   // M2 补充：只读，供界面显示设置初值
```

- 用途：读取当前设置的界面可见子集（`bridgePort` / `debugLogging` / `captureMode` / `captureProcesses` / `webvpnBase`），供界面显示开关、捕获方式与端口的初值。
- 输入：无。
- 输出：`AppSettingsView`；**不含** `wrdKey` / `wrdIv`（敏感值不跨 IPC）。
- 错误：见 [错误模型](#错误模型)。

### `installCa(): Promise<{ ok: boolean; message?: string }>`

```ts
installCa(): Promise<{ ok: boolean; message?: string }>
```

- 用途：把本机生成的 MITM CA 安装到系统信任库（复用 mitmproxy CA 机制）。
- 输入：无。
- 输出：`ok` 表示安装是否成功；`message` 为可选补充信息。
- 错误：见 [错误模型](#错误模型)（未安装/未信任时为 `CA_MISSING`）。

### `uninstallCa(): Promise<{ ok: boolean; message?: string }>`

```ts
uninstallCa(): Promise<{ ok: boolean; message?: string }>
```

- 用途：从系统信任库卸载本机 CA（一键可逆）。
- 输入：无。
- 输出：`ok` + 可选 `message`。
- 错误：见 [错误模型](#错误模型)。

### `getCaStatus(): Promise<CaStatus>`

```ts
getCaStatus(): Promise<{ installed: boolean; trusted: boolean }>
```

- 用途：查询 CA 是否已安装、是否被系统信任。
- 输入：无。
- 输出：`CaStatus`（见「类型定义」）。
- 错误：见 [错误模型](#错误模型)。

### `listCaptureCandidates(): Promise<CaptureCandidate[]>`

```ts
listCaptureCandidates(): Promise<CaptureCandidate[]>   // M3：每项含 pattern
```

- 用途：列出可供「进程捕获」（mitmproxy local mode）选择的应用（如 Chrome）。
- 输入：无。
- 输出：`CaptureCandidate[]`；**一行一个应用**——应用主进程与其 Helper 归并为同一条 `pattern`（`.app` 包路径），非应用用可执行文件全路径。
- 错误：见 [错误模型](#错误模型)。

### `setCaptureMode(mode: CaptureMode): Promise<void>`

```ts
setCaptureMode(mode: CaptureMode): Promise<void>   // M3 新增
```

- 用途：切换捕获方式（`system-proxy` = 系统代理接管全部流量；`selected-apps` = 仅捕获所选应用）。
- 输入：

  | 字段 | 类型 | 必填 | 约束 | 说明 |
  | ---- | ---- | ---- | ---- | ---- |
  | `mode` | `'system-proxy' \| 'selected-apps'` | 是 | 必须是两个字面量之一 | 整体覆盖写入 |

- 输出：`Promise<void>`。
- 行为：两种方式**互斥**——切到 `selected-apps` 会撤销本 App 设置过的系统代理（而非设置新代理）；切回 `system-proxy` 会移除进程捕获并重新设置系统代理。桥未运行时只落盘与下发配置，不动 OS 代理。
- 错误：见 [错误模型](#错误模型)；系统代理被其它软件占用时切到 `selected-apps` 以 `PROXY_CONFLICT` 拒绝，且配置不落盘。

### `setCaptureProcesses(patterns: string[]): Promise<void>`

```ts
setCaptureProcesses(patterns: string[]): Promise<void>   // M3 新增，取代 setCapturePids
```

- 用途：设置要捕获的应用集合（仅在捕获方式为 `selected-apps` 时生效）。
- 输入：

  | 字段 | 类型 | 必填 | 约束 | 说明 |
  | ---- | ---- | ---- | ---- | ---- |
  | `patterns` | `string[]` | 是 | 取值须来自 `listCaptureCandidates()` 的 `pattern`；非空、不含逗号、去重；最多 32 个；空数组表示不捕获任何应用 | 整体覆盖写入 |

- 输出：`Promise<void>`。
- 错误：见 [错误模型](#错误模型)；参数非法时 reject（不写入配置）。

### `setDebugLogging(enabled: boolean): Promise<void>`

```ts
setDebugLogging(enabled: boolean): Promise<void>
```

- 用途：开关调试日志（默认关；开启也只记录「域名 + 是否改写成功」，不记正文/请求体/Cookie）。
- 输入：

  | 字段 | 类型 | 必填 | 约束 | 说明 |
  | ---- | ---- | ---- | ---- | ---- |
  | `enabled` | `boolean` | 是 | 默认 `false` | 对应 `AppSettings.debugLogging` |

- 输出：`Promise<void>`。
- 副作用：`enabled === false` 时除落盘与下发配置外，还会**清空 Main 的调试日志环形缓冲并关闭日志窗口**（既有「关闭即清空」语义的延伸）；`true` 只落盘与下发，日志窗口由渲染层随后调用 `openLogWindow()` 打开。
- 错误：见 [错误模型](#错误模型)。

### `openCaptureWindow(): Promise<void>`

```ts
openCaptureWindow(): Promise<void>   // M6 新增：打开或聚焦捕获窗口
```

- 用途：打开「进程捕获 — 应用选择」二级窗口（主窗口 `[选择应用…]` 的落点）。
- 输入：无。
- 输出：`Promise<void>`（只表示窗口创建/聚焦动作完成，不等待页面渲染完成）。
- 行为：每类窗口单实例——窗口已存在时 `restore()` / `show()` / `focus()`，否则按 `WINDOW_SPECS` 创建；二级窗口非模态（不设 `parent`，主窗口仍可操作）；新窗口挂载后自行经本表面拉取初始状态（`getStatus` / `getSettings` / `listCaptureCandidates`）。
- 错误：见 [错误模型](#错误模型)。

### `openLogWindow(): Promise<void>`

```ts
openLogWindow(): Promise<void>   // M6 新增：打开或聚焦日志窗口
```

- 用途：打开「调试日志」二级窗口（开启调试日志开关后的落点）。
- 输入：无。
- 输出：`Promise<void>`。
- 行为：同 `openCaptureWindow` 的单实例/非模态语义；窗口挂载后经 `getDebugLogs()` 恢复历史（缓冲在 Main，重开不丢）。
- 错误：见 [错误模型](#错误模型)。

### `openAllowlistWindow(): Promise<void>`

```ts
openAllowlistWindow(): Promise<void>   // M6 新增：打开或聚焦 Allowlist 窗口
```

- 用途：打开 Allowlist 编辑窗口（主窗口 `[管理…]` 的落点：增删主机、切换 `*.swufe.edu.cn`）。
- 输入：无。
- 输出：`Promise<void>`。
- 行为：同 `openCaptureWindow` 的单实例/非模态语义；窗口挂载后经 `getAllowlist()` 取初值。
- 错误：见 [错误模型](#错误模型)。

### `getDebugLogs(): Promise<DebugLogEvent[]>`

```ts
getDebugLogs(): Promise<DebugLogEvent[]>   // M6 新增：只读
```

- 用途：读取 Main 环形缓冲中的调试日志副本（日志窗口挂载时恢复历史）。
- 输入：无。
- 输出：`DebugLogEvent[]`，**最新在前**、最多 `MAX_DEBUG_LOG_ENTRIES`（200）条；返回值是副本，调用方修改不影响缓冲。缓冲只驻留内存、不落盘（NFR-003）。
- 错误：见 [错误模型](#错误模型)。

### `clearDebugLogs(): Promise<void>`

```ts
clearDebugLogs(): Promise<void>   // M6 新增：清空 Main 环形缓冲
```

- 用途：清空 Main 的调试日志环形缓冲（日志窗口 `[清空]` 的落点）；清空后窗口关闭再打开也不再出现已清空的记录。
- 输入：无。
- 输出：`Promise<void>`。
- 错误：见 [错误模型](#错误模型)。

### `onDebugLog(cb: (e: DebugLogEvent) => void): () => void`

```ts
// Main → Renderer 事件
onDebugLog(cb: (e: DebugLogEvent) => void): () => void
```

- 用途：订阅 Main → Renderer 的调试日志事件（日志面板：域名 | 改写结果 | 时间）。
- 输入：

  | 字段 | 类型 | 必填 | 约束 | 说明 |
  | ---- | ---- | ---- | ---- | ---- |
  | `cb` | `(e: DebugLogEvent) => void` | 是 | — | 事件回调 |

- 输出：取消订阅函数 `() => void`。
- 投递范围（M6 变更）：Main **广播到全部存活窗口**（此前只投递主窗口）；每个窗口各自订阅并各自渲染。
- 事件负载：`DebugLogEvent`（见「类型定义」）；`detail` 允许短信息、禁止 body 与 Cookie。
- 错误：见 [错误模型](#错误模型)。

### `onStatus(cb: (status: BridgeStatus) => void): () => void`

```ts
// Main → Renderer 事件（M2 补充）
onStatus(cb: (status: BridgeStatus) => void): () => void
```

- 用途：订阅 Main → Renderer 的桥状态推送；每次状态变化（开桥/关桥/失败/过期/会话变化）后 Main 主动推送一次，界面无需轮询。
- 输入：`cb`（状态回调）。
- 输出：取消订阅函数 `() => void`（重复订阅各自独立）。
- 投递范围（M6 变更）：Main **广播到全部存活窗口**（此前只投递主窗口）；`setAllowlist` 成功后的额外广播同样经此通道。
- 事件负载：`BridgeStatus`（见「类型定义」）。
- 错误：见 [错误模型](#错误模型)。

### `onSessionExpired(cb: () => void): () => void`

```ts
// Main → Renderer 事件（M2 补充）
onSessionExpired(cb: () => void): () => void
```

- 用途：订阅「会话已失效且桥已停止、系统代理已清除」的通知，界面据此弹出重登模态（文案见 [../ui-ux/main-window.md](../ui-ux/main-window.md)）；`getStatus()` 的 `error.code` 同时为 `SESSION_EXPIRED`。
- 输入：`cb`（无参数回调）。
- 输出：取消订阅函数 `() => void`。
- 投递范围（M6 变更）：Main **广播到全部存活窗口**（此前只投递主窗口），二级窗口在前台时事件同样送达。
- 错误：见 [错误模型](#错误模型)。

## 错误模型

错误码全集（含义与用户动作）；`message` 为面向用户的原因描述。

| 错误码 | 含义 | 用户动作 |
| ------ | ---- | -------- |
| `PROXY_CONFLICT` | 代理环境冲突：系统代理已占用（开桥前，或启用「指定应用」前检测到），或网关主机解析到 fake-ip 段（`198.18.0.0/15`，TUN 模式，[ADR-0011](../architecture/adr/ADR-0011-refuse-start-on-fake-ip-dns.md)） | 关闭其它代理的系统代理与 TUN 模式 |
| `CA_MISSING` | 未安装/未信任 CA | 去安装 |
| `NOT_LOGGED_IN` | 无会话 | 去登录 |
| `SESSION_EXPIRED` | 会话失效 | 重登 |
| `BRIDGE_CRASH` | mitm 进程退出 | 查看日志/重启桥 |
| `ALLOWLIST_EMPTY` | 无主机 | 添加主机 |

错误码的传递方式：`BridgeStatus.error` / `BridgeStatus.captureError` 走状态对象；方法 reject 时错误码随 `Error` 一起抛给 Renderer。
但 Electron 的 `invoke` rejection 只保留 `message` 与 `stack`（自定义属性会被丢弃），因此 `setCaptureMode` / `setCaptureProcesses` 的拒绝消息形如
`<CODE>：<message>`（例如 `PROXY_CONFLICT：检测到代理环境冲突：…`），Renderer 侧解析该前缀决定是否弹出代理冲突模态。

进程捕获失败**不使用**错误码：它不改变桥状态，只写入 `BridgeStatus.captureError`（REQ-003 边界 / [ADR-0006](../architecture/adr/ADR-0006-local-capture-mode-and-mutual-exclusion.md)）。

会话失效处理后（停桥 → 清系统代理 → 停进程捕获 → 提示重登）的完整流程见 [../ui-ux/main-window.md](../ui-ux/main-window.md)。

## 版本与兼容性

- 版本策略：无独立版本号；稳定性为 Internal。
- 破坏性变更流程：同一次变更内更新本文件 + [architecture/interfaces.md](../architecture/interfaces.md) + [specs/001-phase1-local-bridge/spec.md](../../specs/001-phase1-local-bridge/spec.md)，并在 PR 的 Breaking Changes 中说明。
- 弃用流程：先在本文件标注 `Deprecated` 与替代方法，待 Renderer 全部迁移后删除。

## 变更记录

| 日期 | 变更 | 兼容性 | 关联 Spec / ADR |
| ---- | ---- | ------ | --------------- |
| 2026-09-20 | 首版：会话、桥控制、allowlist、证书、进程捕获、调试日志共 15 个方法/事件 | — | [spec 001](../../specs/001-phase1-local-bridge/spec.md) |
| 2026-09-21 | M2 落地补充三项（不改变上述 15 个方法的语义）：`getSettings`（只读，供界面显示设置初值；WRD key/IV 不跨 IPC）、`onStatus`（Main → Renderer 状态推送）、`onSessionExpired`（会话过期事件，驱动重登模态） | 兼容（新增方法/事件） | [spec 001](../../specs/001-phase1-local-bridge/spec.md) / [M2 完成记录](../planning/milestones/M2-desktop-orchestration.md) |
| 2026-09-21 | M3 捕获方式：`setCapturePids` → **`setCaptureProcesses`**（按 intercept pattern 而非 PID，整体覆盖写入）；新增 `setCaptureMode`（`system-proxy` / `selected-apps` 互斥）；`BridgeStatus.captureError`；`CaptureCandidate.pattern`；`AppSettingsView.captureMode` / `.captureProcesses`；`getStatus` 的 `localCaptureEnabled` 语义收紧为「桥 running + 指定应用 + sidecar 已报告 enabled」 | **破坏性**：`setCapturePids` 已删除 | [spec 001](../../specs/001-phase1-local-bridge/spec.md) / [ADR-0006](../architecture/adr/ADR-0006-local-capture-mode-and-mutual-exclusion.md) |
| 2026-09-23 | M6 四窗口界面：新增 5 个方法——`openCaptureWindow` / `openLogWindow` / `openAllowlistWindow`（二级窗口入口，每类单实例、重复调用即聚焦）、`getDebugLogs`（只读返回 Main 环形缓冲副本，最新在前、≤200）、`clearDebugLogs`（清空该缓冲）；`setDebugLogging(false)` 追加副作用（清空缓冲 + 关闭日志窗口）；`setAllowlist` 成功后额外广播一次 `status`；`onDebugLog` / `onStatus` / `onSessionExpired` 的投递范围由「只投递主窗口」改为**全部存活窗口**；既有 16 个方法与事件签名不变（共 21 个方法 / 3 个事件） | 兼容（只增） | [spec 002](../../specs/002-desktop-ui-multiwindow/spec.md) / [ADR-0012](../architecture/adr/ADR-0012-react-antd-multiwindow-renderer.md) |
