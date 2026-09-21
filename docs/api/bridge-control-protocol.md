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
| 启动 | `uv run --directory bridges/python python -m swufe_bridge.sidecar --config <file> --port <port> --confdir <dir>`（M2 以 Electron 子进程方式 spawn 同一入口）；mitmdump 侧以 `--mode regular@<port>` 启动，**不传 `--listen-port`**（M3，见下） |
| 就绪探测 | stderr 出现 `swufe-ready` 行 **且** TCP 可连 `127.0.0.1:<port>` |
| 配置下发 | 写入配置文件（整体覆盖）；sidecar 以 mtime + size 轮询热加载，无需信号、无需重启 |
| 配置失败回退 | 解析失败时保留上一次可用配置继续服务，并输出 `swufe-error CONFIG_INVALID <message>`（同一消息不重复打印） |
| 停止 | 结束进程（`SIGTERM`）；正常停止退出码 `0` |
| 启动失败 | 输出 `swufe-error <CODE> <message>` 并以退出码 `2` 结束（`CONFIG_INVALID`、`ALLOWLIST_EMPTY`） |

### 配置文件

- 路径：默认 `~/.swufe-webvpn-bridge/bridge-config.json`，`--config` 覆盖（M2 传入 Electron `userData` 下的 `<userData>/bridge-config.json`）。
- 权限：`0600`（含 WebVPN 会话 Cookie，见 NFR-003）。
- 内容（字段名与 [data-model.md](../architecture/data-model.md) 的 `AllowlistConfig` / `SessionState` / `AppSettings` 一致）：

  ```json
  {
    "allowlist": { "hosts": ["jwxt.swufe.edu.cn"], "includeSwufeWildcard": false, "updatedAt": "2026-09-21T00:00:00+00:00" },
    "cookies": [ { "name": "wrdvpn_session", "value": "<secret>", "domain": ".swufe.edu.cn", "path": "/" } ],
    "debug": false,
    "webvpnBase": "https://webvpn.swufe.edu.cn",
    "wrdKey": "wrdvpnisthebest!",
    "wrdIv": "wrdvpnisthebest!",
    "capture": { "processes": [] }
  }
  ```

| 键 | 缺省 | 非法时 |
| ---- | ---- | ------ |
| `allowlist` | `{"hosts":["jwxt.swufe.edu.cn"],"includeSwufeWildcard":false}` | 抛 `CONFIG_INVALID` |
| `cookies` | `[]`；每项 `name` / `value` 必填，`domain` / `path` 可选，未知字段忽略 | 抛 `CONFIG_INVALID` |
| `debug` | `false` | 抛 `CONFIG_INVALID` |
| `webvpnBase` | `https://webvpn.swufe.edu.cn` | 抛 `CONFIG_INVALID` |
| `wrdKey` / `wrdIv` | `wrdvpnisthebest!` | 长度 ≠ 16 字节 ⇒ 抛 `CONFIG_INVALID` |
| `capture` | `{"processes": []}` | 非对象、`processes` 非列表、元素非字符串 / 空串 / 含逗号 ⇒ 抛 `CONFIG_INVALID` |

- `capture.processes` 项为 mitmproxy intercept pattern：应用取 `.app` 包路径，非应用取可执行文件全路径；逗号是 intercept spec 的分隔符，故不允许出现在单个 pattern 内。空列表表示不启用进程捕获；`system-proxy` 捕获方式下 App 恒写入空列表（两种方式互斥，见 [ADR-0006](../architecture/adr/ADR-0006-local-capture-mode-and-mutual-exclusion.md)）。
- 缺键取默认值；未知顶层键忽略；文件缺失或 JSON 解析失败 ⇒ `CONFIG_INVALID`。
- **sidecar 不写入、不修改该文件**：唯一写入方是 App（M2）；M1 开发期由人工写入。

### CA 生成入口（M2 新增）

App 必须先能「安装 CA」再开桥，而 mitmproxy 只在 mitmdump 启动时生成 CA，因此新增一个只做生成的独立入口（复用 mitmproxy 的 `CertStore`，不自研 PKI，见 [ADR-0002](../architecture/adr/ADR-0002-reuse-mitmproxy-for-tls.md)）：

```bash
python -m swufe_bridge.ca --confdir <confdir>
```

| 项 | 约定 |
| ---- | ---- |
| 幂等 | `<confdir>/mitmproxy-ca.pem` 已存在时不改写任何文件（重复调用返回同样的路径） |
| 成功输出 | stdout 单行 JSON：`{"caCert": "…/mitmproxy-ca-cert.pem", "caPem": "…/mitmproxy-ca.pem", "caCer": "…/mitmproxy-ca-cert.cer", "created": true\|false}`，退出码 `0` |
| 失败 | stderr `swufe-error CA_FAILED <message>`，退出码 `2` |
| 权限 | 私钥文件 `0600`（仅本机用户可读，NFR-003） |
| 落点 | M2 使用 `<userData>/mitmproxy/`；与 sidecar 的 `--confdir` 必须是同一目录 |

### 诊断输出（stderr 单行，机器可读）

```text
swufe-debug {"ts":"2026-09-21T10:00:00+00:00","host":"jwxt.swufe.edu.cn","rewritten":true,"direction":"request","detail":null}
swufe-ready {"listen_host":"127.0.0.1","listen_port":8080,"config":"/abs/path.json","allowlist":["jwxt.swufe.edu.cn"],"includeSwufeWildcard":false,"cookies":1,"debug":false}
swufe-capture {"enabled":true,"processes":["/Applications/Google Chrome.app/"],"error":null}
swufe-error CONFIG_INVALID <message>
swufe-error ALLOWLIST_EMPTY allowlist 为空：请添加主机或启用 *.swufe.edu.cn
swufe-error LISTEN_NOT_LOOPBACK <message>
```

- `swufe-debug` 键固定为 `ts` / `host` / `rewritten` / `direction` / `detail`；`detail` 仅取短标记（`not-allowlisted`、`encode-failed`、`location`、`set-cookie`、`body`、`body-skipped`、`no-wrd-match`），**禁止**出现 Cookie 值与请求/响应正文（INV-001）。
- `swufe-ready` 在 addon `running()` 打印一次，报告生效的 `listen_host` / `listen_port`；`cookies` 只输出条数。`listen_port` 由 `--mode regular@<port>` 推导（sidecar 不传 `--listen-port`）。
- `swufe-capture`（M3）键固定为 `enabled` / `processes` / `error` 三个：首次应用捕获配置与配置变更后各上报一次。它**不参与就绪判定**（进程捕获是可选能力），失败后不自动重试，直到运行时配置被重写（界面「重试」即再次下发配置）。失败只影响 `BridgeStatus.captureError`，桥保持 `running`。
- 退出码：正常停止 `0`；启动校验失败（`CONFIG_INVALID`、`ALLOWLIST_EMPTY`）`2`。

### 开发运行

```bash
uv run --directory bridges/python python -m swufe_bridge.sidecar --config <bridge-config.json> --port 18080 --confdir <confdir>
# 就绪后（stderr 出现 swufe-ready）：
curl -sS -i -x http://127.0.0.1:18080 --cacert <confdir>/mitmproxy-ca-cert.pem https://jwxt.swufe.edu.cn/sso/jziotlogin
```

### 为什么用 `--mode regular@<port>`（M3 变更）

sidecar 不再向 mitmdump 传 `--listen-port`：全局 `listen_port` 会作用于**每个**模式，而进程捕获要求运行时把 `local:<spec>` 追加到同一个 mitmproxy 实例上，mitmproxy 的重复监听地址检查会把 `local` 判为与 `regular` 争用同一地址并抛 `OptionsError`。改用 `--mode regular@<port>` 后端口只属于 regular 模式，`local` 模式不占端口（`listen_addrs` 为空），两种模式共存且切换时桥端口始终可用。`swufe-ready` 的 `listen_port` 因此由 regular 模式推导，而不是读取 `ctx.options.listen_port`。

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
| 2026-09-21 | M2 落地：新增 CA 生成入口 `python -m swufe_bridge.ca --confdir <dir>`（stdout JSON / `swufe-error CA_FAILED` / 退出码 2 / 幂等）；明确 M2 的 `--config` 与 `--confdir` 落点分别为 `<userData>/bridge-config.json` 与 `<userData>/mitmproxy/` | 兼容（新增入口，控制面未变） | [spec 001](../../specs/001-phase1-local-bridge/spec.md) |
| 2026-09-21 | M3 捕获：配置新增 `capture.processes`；新增 `swufe-capture {"enabled","processes","error"}` 诊断行；启动改为 `--mode regular@<port>`（不再传 `--listen-port`），`swufe-ready.listen_port` 由 regular 模式推导 | 兼容（新增键与行；启动参数变化对 Main 透明） | [spec 001](../../specs/001-phase1-local-bridge/spec.md) / [ADR-0006](../architecture/adr/ADR-0006-local-capture-mode-and-mutual-exclusion.md) |
