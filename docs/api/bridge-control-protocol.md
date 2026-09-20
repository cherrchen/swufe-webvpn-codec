# 桥控制协议（Electron Main → mitm sidecar）

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-21

## 范围

- 提供方：mitm sidecar（本机桥进程，含薄 WRD addon）。
- 消费方：Electron Main（Proxy Orchestrator）。
- 形态：本机进程间接口。第一期已采用**方案 A**（子进程生命周期 + 配置文件热加载），见下文「采用的实现方式」。
- 稳定性：Internal / Evolving —— 只在本 App 内部消费；方案 A 已定稿，不再承诺额外的控制面形态。
- 关联 Spec：[specs/001-phase1-local-bridge/spec.md](../../specs/001-phase1-local-bridge/spec.md)

## 认证与授权

- 方案 A 不新增控制监听端口：唯一监听面是桥代理端口，恒为 `127.0.0.1`（由 sidecar 硬编码强制，不提供开关），不引入令牌或账号体系。
- Cookie 是敏感数据：禁止写入调试日志与控制口输出（NFR-003）。

## 通用约定

- 编码：控制面为配置文件（JSON，UTF-8）；诊断输出为 stderr 上的单行 JSON。
- 时间格式：ISO8601（`swufe-debug.ts`、`allowlist.updatedAt`）。
- 分页：无。
- 限流：无（本机回环/单进程调用）。
- 幂等：配置文件整体覆盖式写入（幂等，以「最后一次写入生效」为准）；结束进程等价于优雅停止，重复调用收敛。

## 采用的实现方式：方案 A（子进程生命周期 + 配置文件热加载）

第一期采用方案 A（2026-09-21 定稿）：Main 只负责拉起/结束 sidecar 进程，并把配置写入 sidecar 读取的配置文件；不新增监听端口。

| 能力 | 实现 |
| ---- | ---- |
| 启动 | `uv run python -m swufe_bridge.sidecar --config <file> --port <port> --confdir <dir>`（M2 以 Electron 子进程方式 spawn 同一入口） |
| 就绪探测 | stderr 出现 `swufe-ready` 行 **且** TCP 可连 `127.0.0.1:<port>` |
| 配置下发 | 写入配置文件（整体覆盖）；sidecar 以 mtime + size 轮询热加载，无需信号、无需重启 |
| 配置失败回退 | 解析失败时保留上一次可用配置继续服务，并输出 `swufe-error CONFIG_INVALID <message>`（同一消息不重复打印） |
| 停止 | 结束进程（`SIGTERM`）；正常停止退出码 `0` |
| 启动失败 | 输出 `swufe-error <CODE> <message>` 并以退出码 `2` 结束（`CONFIG_INVALID`、`ALLOWLIST_EMPTY`） |

### 配置文件

- 路径：默认 `~/.swufe-webvpn-bridge/bridge-config.json`，`--config` 覆盖（M2 传入 Electron `userData` 下的路径）。
- 权限：`0600`（含 WebVPN 会话 Cookie，见 NFR-003）。
- 内容（字段名与 [data-model.md](../architecture/data-model.md) 的 `AllowlistConfig` / `SessionState` / `AppSettings` 一致）：

  ```json
  {
    "allowlist": { "hosts": ["jwxt.swufe.edu.cn"], "includeSwufeWildcard": false, "updatedAt": "2026-09-21T00:00:00+00:00" },
    "cookies": [ { "name": "wrdvpn_session", "value": "<secret>", "domain": ".swufe.edu.cn", "path": "/" } ],
    "debug": false,
    "webvpnBase": "https://webvpn.swufe.edu.cn",
    "wrdKey": "wrdvpnisthebest!",
    "wrdIv": "wrdvpnisthebest!"
  }
  ```

| 键 | 缺省 | 非法时 |
| ---- | ---- | ------ |
| `allowlist` | `{"hosts":["jwxt.swufe.edu.cn"],"includeSwufeWildcard":false}` | 抛 `CONFIG_INVALID` |
| `cookies` | `[]`；每项 `name` / `value` 必填，`domain` / `path` 可选，未知字段忽略 | 抛 `CONFIG_INVALID` |
| `debug` | `false` | 抛 `CONFIG_INVALID` |
| `webvpnBase` | `https://webvpn.swufe.edu.cn` | 抛 `CONFIG_INVALID` |
| `wrdKey` / `wrdIv` | `wrdvpnisthebest!` | 长度 ≠ 16 字节 ⇒ 抛 `CONFIG_INVALID` |

- 缺键取默认值；未知顶层键忽略；文件缺失或 JSON 解析失败 ⇒ `CONFIG_INVALID`。
- **sidecar 不写入、不修改该文件**：唯一写入方是 App（M2）；M1 开发期由人工写入。

### 诊断输出（stderr 单行，机器可读）

```text
swufe-debug {"ts":"2026-09-21T10:00:00+00:00","host":"jwxt.swufe.edu.cn","rewritten":true,"direction":"request","detail":null}
swufe-ready {"listen_host":"127.0.0.1","listen_port":8080,"config":"/abs/path.json","allowlist":["jwxt.swufe.edu.cn"],"includeSwufeWildcard":false,"cookies":1,"debug":false}
swufe-error CONFIG_INVALID <message>
swufe-error ALLOWLIST_EMPTY allowlist 为空：请添加主机或启用 *.swufe.edu.cn
swufe-error LISTEN_NOT_LOOPBACK <message>
```

- `swufe-debug` 键固定为 `ts` / `host` / `rewritten` / `direction` / `detail`；`detail` 仅取短标记（`not-allowlisted`、`encode-failed`、`location`、`set-cookie`、`body`、`body-skipped`、`no-wrd-match`），**禁止**出现 Cookie 值与请求/响应正文（INV-001）。
- `swufe-ready` 在 addon `running()` 打印一次，报告生效的 `listen_host` / `listen_port`；`cookies` 只输出条数。
- 退出码：正常停止 `0`；启动校验失败（`CONFIG_INVALID`、`ALLOWLIST_EMPTY`）`2`。

### 开发运行

```bash
uv run python -m swufe_bridge.sidecar --config <bridge-config.json> --port 18080 --confdir <confdir>
# 就绪后（stderr 出现 swufe-ready）：
curl -sS -i -x http://127.0.0.1:18080 --cacert <confdir>/mitmproxy-ca-cert.pem https://jwxt.swufe.edu.cn/sso/jziotlogin
```

## 硬约束

1. Cookie 禁止写入调试日志与控制面输出。
2. 监听仅限 `127.0.0.1`，不得监听 `0.0.0.0` 或任何外部可达地址。强制方式：sidecar 硬编码 `--listen-host 127.0.0.1` 且不提供改监听地址的开关；addon 在 `running()` 复查生效值，非回环地址则输出 `swufe-error LISTEN_NOT_LOOPBACK` 并停止。

## 版本与兼容性

- 版本策略：无独立版本号；稳定性为 Internal。
- 破坏性变更流程：更新本文件 + [architecture/interfaces.md](../architecture/interfaces.md) + [specs/001-phase1-local-bridge/spec.md](../../specs/001-phase1-local-bridge/spec.md)，并在 PR 的 Breaking Changes 中说明。
- 弃用流程：先在本文档标注 `Deprecated` 与替代方式，待 Main 全部迁移后删除。

## 变更记录

| 日期 | 变更 | 兼容性 | 关联 Spec / ADR |
| ---- | ---- | ------ | --------------- |
| 2026-09-20 | 首版：记录方案 A / 方案 B 两种候选实现与硬约束，实现方式标 `TBD` | — | [spec 001](../../specs/001-phase1-local-bridge/spec.md) |
| 2026-09-21 | 定稿方案 A：配置文件路径与字段表、mtime + size 轮询热加载与失败回退、`swufe-ready` / `swufe-error` 行与退出码、开发运行命令、回环由 sidecar 硬编码强制 | 兼容（首版未定稿，无既有消费方） | [spec 001](../../specs/001-phase1-local-bridge/spec.md) / [ADR-0002](../architecture/adr/ADR-0002-reuse-mitmproxy-for-tls.md) |
