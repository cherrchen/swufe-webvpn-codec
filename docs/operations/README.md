# 运维文档

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-21

**用途**：记录运行环境、配置、部署、可观测性、备份与事故响应的长期事实。
**范围**：SWUFE WebVPN Bridge Phase 1 —— **本应用为单机桌面工具**（Electron 应用 + 本机 mitmproxy sidecar），面向 macOS 与 Windows，无服务器端。

---

## 1. 环境

| 环境 | 用途 | 说明 | 访问方式 |
| ---- | ---- | ---- | -------- |
| 开发（本机） | 开发与本地调试 | 本机 Node（Electron 应用）+ Python venv（WRD codec 与 addon）+ `mitmdump` | 开发者本机 |
| 验收（本机真机） | L3 手工验收 | macOS 与 Windows 各一测试机，运行真实 WebVPN 会话，用 Chrome/Edge 做教务浏览器验收（需测试者自有账号） | 测试者本机 |
| 生产 / 服务器 | 不适用 | 本应用为单机桌面工具，不部署服务器端组件，也不存在集中运行环境 | — |

> 第一期不设测试 / 预发集群：上游为学校真实 WebVPN，本机测试即为最终运行形态。

## 2. 配置

| 配置项 | 作用 | 取值范围 | 默认值 | 敏感性 | 变更影响 |
| ------ | ---- | -------- | ------ | ------ | -------- |
| `bridgePort` | 本机桥监听的 HTTP/HTTPS 代理端口 | 可用端口（8080 或自动分配） | 8080 或自动 | 低 | 系统代理指向该端口；桥运行期间变更需重启桥 |
| `debugLogging` | 调试日志开关 | `true` / `false` | `false` | 低 | 开启后记录「域名 + 是否改写成功 + 方向 + 时间」，仍不含正文与 Cookie |
| `captureMode` | 捕获方式：系统代理接管全部流量，或只捕获所选应用（M3，二者互斥） | `system-proxy` / `selected-apps` | `system-proxy` | 低 | 切到 `selected-apps` 会撤销本 App 设置的系统代理；切回会重新设置并移除进程捕获；系统代理被其它软件占用时切到 `selected-apps` 会被拒绝 |
| `captureProcesses` | 进程捕获（mitmproxy local）的应用 pattern 列表（M3） | 非空、不含逗号、去重的字符串数组（最多 32 个；`.app` 包路径或可执行文件全路径） | `[]` | 低 | 仅在 `captureMode = selected-apps` 时下发到 `<userData>/bridge-config.json` 的 `capture.processes`；运行中修改无需重启桥，失败不自动重试（界面「重试」重新下发）；macOS 首次启用会请求系统扩展授权 |
| `webvpnBase` | 上游 WebVPN 基址（改写目标） | URL | `https://webvpn.swufe.edu.cn` | 低 | 变更后教务验收结论失效，需重新验收 |
| `wrdKey` / `wrdIv` | WRD hostname 加密的 key / iv | 字符串（首期使用默认值） | `wrdvpnisthebest!` | 高 | 值错误会导致编码不可用；需与上游规则一致（ADR-0005） |
| `systemProxyManagedByApp` | 「系统代理由本 App 设置」标记（运行时） | `true` / `false` | `false` | 低 | 决定关桥 / 退出时是否清除系统代理；标记错误会导致代理残留或误清 |
| `allowlist.hosts` | 经 WebVPN 改写的主机列表 | 小写合法 hostname 数组（精确匹配） | `["jwxt.swufe.edu.cn"]` | 低 | 新增主机即扩大解密与改写范围 |
| `allowlist.includeSwufeWildcard` | `*.swufe.edu.cn` 通配（含 apex `swufe.edu.cn`） | `true` / `false` | `false` | 低 | 开启后 `swufe.edu.cn` 及其全部子域纳入改写 |
| `allowlist.updatedAt` | allowlist 最近更新时间 | ISO8601 字符串 | 创建时间 | 低 | 仅作记录 |

- **存储位置**：
  - `<userData>/config.json`：顶层为 allowlist（`hosts` / `includeSwufeWildcard` / `updatedAt`），同级 `settings` 键保存 `AppSettings`（缺键取默认值）；Python 侧读同一文件的 allowlist 部分。
  - `<userData>/bridge-config.json`：下发给 sidecar 的运行时配置（`allowlist` + `cookies` + `debug` + `webvpnBase` + `wrdKey`/`wrdIv` + `capture.processes`），权限 `0600`（含会话 Cookie）；唯一写入方是 App。sidecar 以 `--mode regular@<bridgePort>` 起桥（不传 `--listen-port`，见 ADR-0006），捕获配置变化靠该文件的 mtime+size 热加载。
  - `<userData>/mitmproxy/`：MITM CA 的 confdir（私钥 `0600`），同时也是 sidecar 的 `--confdir`。
  - `<userData>/Partitions/swufe-login/`：登录会话（Electron 持久分区，不写 `session.bin`）；会话 Cookie 位置与加密见 [security/README.md](../security/README.md) 第 4 节。
- **配置来源与优先级**：持久文件是唯一来源，构建期默认值只用于缺键/首次启动；`settings.bridgePort` 与 `settings.webvpnBase` 在开桥时读取并下发，运行期标记 `systemProxyManagedByApp` 由 Proxy Orchestrator 写入。配置如何下发到 sidecar 见 [bridge-control-protocol.md](../api/bridge-control-protocol.md)。
- **开发期覆盖**：`--user-data-dir <dir>`（或 `SWUFE_USER_DATA_DIR`）覆盖 `userData`；`SWUFE_REPO_ROOT` 覆盖仓库根路径；`SWUFE_PYTHON` 指定运行 sidecar/CA 入口的解释器；`SWUFE_PROBE_INTERVAL_MS` 覆盖会话过期探测间隔。
- **密钥处理**：见 [security/README.md](../security/README.md)。

## 3. 部署

```text
交付物:      Electron 安装包（macOS / Windows）+ mitmproxy sidecar
             （WRD codec 与 bridge addon 随 sidecar 分发）
部署方式:    用户本机安装并运行；应用启动时以子进程拉起 mitmproxy sidecar
             开发等效方式：本机 Node + Python venv + mitmdump
             （M2 起：根目录 `uv sync --directory bridges/python` 后 `pnpm install && pnpm start`，
              App 会用 `<repo>/bridges/python/.venv/bin/python -m swufe_bridge.sidecar` 拉起 sidecar，见 [apps/desktop/README.md](../../apps/desktop/README.md)；
              完整步骤（前置条件 / 启动 / 管理员权限操作 / 自检 / 排障 / 重置）见 [development-run.md](development-run.md)）
分发形态:    TBD —— 嵌入式 Python 运行时与外置 mitmproxy 可执行文件两种方案
             尚未选定（体积与签名取舍见 ADR-0002，实现阶段决定）
发布流程:    TBD —— 尚无发布流水线；当前 CI 做文档检查（pnpm run docs:check）与
             Python L0 测试（.github/workflows/python-tests.yml）；打包与分发尚未实现（tasks.md 的 T041/T042，属 Phase 7 后置，未绑定里程碑）
回滚方式:    关闭桥 → 确认系统代理已清除 → 卸载本机 MITM CA；
             必要时回退到上一版应用安装包
```

> 部署与回滚的每一步都依赖 [security/README.md](../security/README.md) 第 8 节「安全敏感操作」的约束：系统代理只在标记存在时清除，CA 只在用户显式操作时安装或卸载。

## 4. 可观测性

| 维度 | 工具 | 关键信号 | 保留期 |
| ---- | ---- | -------- | ------ |
| 日志 | 应用内调试日志（默认关闭） | 域名 + 是否改写成功 + 方向（request/response）+ 时间；不含正文与 Cookie（`DebugLogRecord`） | 内存环缓；落盘与保留期 `TBD`（第一期未定义） |
| 指标 | 不适用 | 无服务端指标采集（单机桌面工具） | 不适用 |
| 追踪 | 不适用 | 无分布式追踪 | 不适用 |
| 告警 | 不适用 | 无服务端告警；界面状态区与错误码（`PROXY_CONFLICT`、`CA_MISSING`、`NOT_LOGGED_IN`、`SESSION_EXPIRED`、`BRIDGE_CRASH`、`ALLOWLIST_EMPTY`）即用户可见信号（`PROXY_CONFLICT` 同时覆盖「系统代理被占用」与「网关主机解析到 fake-ip 段」，[ADR-0011](../architecture/adr/ADR-0011-refuse-start-on-fake-ip-dns.md)） | 不适用 |

## 5. 备份与恢复

```text
备份对象:    userData/config.json（settings + allowlist）
             userData/Partitions/swufe-login/（登录会话分区；Cookie 明文由 OS 用户目录权限保护）
             MITM CA confdir（mitmproxy 专用目录）
频率:        TBD —— 第一期未定义自动备份（配置可由用户重填，CA 可重新生成）
保留:        TBD —— 同上
恢复演练:    TBD —— 同上
RPO / RTO:   TBD —— 同上
```

丢失任一对象的后果：`config.json` 丢失 → 需重建 allowlist 与设置；登录分区丢失 → 需重新登录；CA confdir 丢失 → 需重新生成 CA 并在系统信任库重新安装。

## 6. 事故响应

| 事故 | 处置动作 | 负责人 |
| ---- | -------- | ------ |
| 桥崩溃（`BRIDGE_CRASH`） | 查看调试日志确认 sidecar 退出原因并重启桥；必要时重开应用 | cherrchen |
| 会话过期（`SESSION_EXPIRED`） | 按产品流程自动停桥、清系统代理、停捕获，随后在登录窗重新登录 | cherrchen |
| 代理残留 | 关闭 App 后确认系统代理已恢复；若仍指向 `127.0.0.1:<bridgePort>` 则手动清除（App 只在「由本 App 设置」标记存在时清除） | cherrchen |
| CA 误装 / 不再需要 | 先停桥，再卸载本机 MITM CA，并确认系统信任库中已移除 | cherrchen |

## 7. 相关

- 配置项字段定义 ⇒ [architecture/data-model.md](../architecture/data-model.md)（`AppSettings` / `AllowlistConfig`）
- 配置与 Cookie 的安全约束 ⇒ [security/README.md](../security/README.md)
- 配置下发到 sidecar 的接口 ⇒ [api/bridge-control-protocol.md](../api/bridge-control-protocol.md)
- 配置变更的文档影响 ⇒ [documentation-rules.md](../development/documentation-rules.md) 中的 Documentation Update Matrix
- 验证与发版门槛 ⇒ [verification-strategy.md](../verification/verification-strategy.md) 第 6 节、[specs/001-phase1-local-bridge/verification.md](../../specs/001-phase1-local-bridge/verification.md)
