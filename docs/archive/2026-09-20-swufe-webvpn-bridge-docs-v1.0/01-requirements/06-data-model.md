# 数据模型文档 — Phase 1

## 1. 概览

第一期仅本地持久化，无云端账号体系。

## 2. 实体

### 2.1 AllowlistConfig

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| hosts | string[] | 每项为合法 hostname，小写存储 | 精确匹配 |
| includeSwufeWildcard | boolean | 默认 false | 匹配 `*.swufe.edu.cn`（含 apex 与否需在实现注明；建议：`host == swufe.edu.cn` 或后缀 `.swufe.edu.cn`） |
| updatedAt | string (ISO8601) | | |

**默认值**

```json
{
  "hosts": ["jwxt.swufe.edu.cn"],
  "includeSwufeWildcard": false
}
```

### 2.2 SessionState

| 字段 | 类型 | 说明 |
|---|---|---|
| cookies | Cookie[] | WebVPN 会话相关；敏感 |
| capturedAt | string | |
| lastValidatedAt | string \| null | |

**Cookie**

| 字段 | 类型 |
|---|---|
| name | string |
| value | string |
| domain | string |
| path | string |
| expires | number \| null |
| httpOnly | boolean |
| secure | boolean |
| sameSite | string \| null |

持久化：可选 Electron `safeStorage` 加密；不得进入日志。

### 2.3 AppSettings

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| bridgePort | number | 8080 或自动 | |
| debugLogging | boolean | false | |
| capturePids | number[] | [] | |
| webvpnBase | string | https://webvpn.swufe.edu.cn | |
| wrdKey | string | wrdvpnisthebest! | 可覆盖 |
| wrdIv | string | wrdvpnisthebest! | 可覆盖 |
| systemProxyManagedByApp | boolean | false | 运行时 |

### 2.4 BridgeRuntimeStatus（不持久化）

见接口文档 `BridgeStatus`。

### 2.5 DebugLogRecord（内存环缓，可选落盘）

| 字段 | 类型 | 说明 |
|---|---|---|
| ts | string | |
| host | string | |
| rewritten | boolean | |
| direction | request/response | |
| detail | string \| null | 禁止含 Cookie/正文 |

## 3. 匹配算法（Allowlist）

```text
function match(host):
  host = host.lower()
  if host in hosts: return true
  if includeSwufeWildcard and (host == "swufe.edu.cn" or host.endswith(".swufe.edu.cn")):
    return true
  return false
```

`webvpn.swufe.edu.cn` 与 `authserver.swufe.edu.cn`：即使通配开启，**桥对登录 WebView 仍 bypass**；对普通流量若误入 allowlist，请求改写需避免环——实现上建议 **硬编码排除** 这两类主机不作为「再包一层 WebVPN」的目标，或对已是 WebVPN URL 的请求直通。

## 4. 存储位置（建议）

| 数据 | 位置 |
|---|---|
| settings + allowlist | `userData/config.json` |
| session cookies | `userData/session.bin`（加密）或 Electron Session 持久分区 |
| CA | mitmproxy 默认 confdir（App 专用目录） |

## 5. 状态机（桥）

```text
idle → (start) → starting → running
running → (stop|expire|error) → stopping → idle
starting → (fail) → error → idle
```
