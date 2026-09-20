# 接口定义文档 — Phase 1

本文定义 **进程内/本机** 接口，非公网 HTTP API。含：Renderer↔Main IPC、Main↔Bridge 控制、WRD 库 API。

## 1. IPC（Electron preload 暴露）

命名空间：`window.swufeBridge`（示例名）。

### 1.1 会话

```ts
login(): Promise<void>           // 打开登录 WebView
logout(): Promise<void>          // 清 Cookie，若桥开启则停桥
getSession(): Promise<{
  loggedIn: boolean
  expiresAt?: string | null      // 若可得
}>
```

### 1.2 桥控制

```ts
startBridge(): Promise<BridgeStatus>
stopBridge(): Promise<BridgeStatus>
getStatus(): Promise<BridgeStatus>

interface BridgeStatus {
  state: 'idle' | 'starting' | 'running' | 'stopping' | 'error'
  loggedIn: boolean
  systemProxyEnabled: boolean
  localCaptureEnabled: boolean
  bridgePort?: number
  error?: { code: string; message: string }
}
```

错误码见技术设计：`PROXY_CONFLICT` | `CA_MISSING` | `NOT_LOGGED_IN` | …

### 1.3 Allowlist

```ts
getAllowlist(): Promise<AllowlistConfig>
setAllowlist(cfg: AllowlistConfig): Promise<void>

interface AllowlistConfig {
  hosts: string[]           // 精确主机名
  includeSwufeWildcard: boolean  // *.swufe.edu.cn
}
```

### 1.4 证书

```ts
installCa(): Promise<{ ok: boolean; message?: string }>
uninstallCa(): Promise<{ ok: boolean; message?: string }>
getCaStatus(): Promise<{ installed: boolean; trusted: boolean }>
```

### 1.5 进程捕获

```ts
listCaptureCandidates(): Promise<Array<{ pid: number; name: string }>>
setCapturePids(pids: number[]): Promise<void>
```

### 1.6 日志

```ts
setDebugLogging(enabled: boolean): Promise<void>
// Main → Renderer 事件
onDebugLog(cb: (e: DebugLogEvent) => void): () => void

interface DebugLogEvent {
  ts: string
  host: string
  rewritten: boolean
  direction: 'request' | 'response'
  detail?: string   // 短信息，无 body
}
```

## 2. Bridge 控制协议（Main → mitm sidecar）

可选实现方式：

- A. 仅用子进程生命周期 + 配置文件热加载（SIGHUP/轮询）
- B. 本地 HTTP 控制口 `127.0.0.1:control`（仅本机）

若采用 B：

| Method | Path | 说明 |
|---|---|---|
| GET | `/health` | liveness |
| POST | `/config` | body: `{ allowlist, cookies, debug }` |
| POST | `/shutdown` | 优雅退出 |

Cookie 禁止写入调试日志与控制口响应。

## 3. WRD Codec 库 API

```ts
// 逻辑等价于 wrd_codec.py
encryptHost(host: string, key?: string, iv?: string): string
decryptHost(token: string, key?: string, iv?: string): string
encodeUrl(ordinaryUrl: string, webvpnHost?: string): string
decodeUrl(webvpnUrl: string): string
```

默认 `webvpnHost = webvpn.swufe.edu.cn`，`key=iv=wrdvpnisthebest!`。

## 4. 外部依赖（非本系统实现）

| 系统 | 用途 |
|---|---|
| `https://webvpn.swufe.edu.cn` | WebVPN 入口与反向代理 |
| `https://authserver.swufe.edu.cn` | CAS |
| OS 代理 API | 设置/清除系统代理 |
| OS 信任库 | 安装/卸载 CA |
