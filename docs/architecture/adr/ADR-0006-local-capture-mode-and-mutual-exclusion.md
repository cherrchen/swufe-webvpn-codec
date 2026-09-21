# ADR-0006: mitmproxy local 模式做进程捕获，且与系统代理互斥

## Status

`Accepted`

## Date

`2026-09-21`

## Decision Owners

`cherrchen`

## Context

REQ-003 要求第一期同时具备两种流量接管方式：系统 HTTP/HTTPS 代理指向本桥端口，以及**按进程捕获**（点选浏览器等应用）。M2 已经落地系统代理路径（[ADR-0004](ADR-0004-refuse-start-when-system-proxy-in-use.md)），M3 需要实现第二种方式。

可选实现有两条：自研网络扩展（System Extension / WFP 驱动）把指定进程的流量重定向到本桥，或复用 mitmproxy 自带的 `local` 模式（`--mode local:<spec>`）。后者由 `mitmproxy_rs` 提供跨平台实现：macOS 上把 `Mitmproxy Redirector.app` 解包到 `/Applications` 并激活系统扩展，Windows 上通过 WFP + UAC 提权；intercept spec 的匹配语义是「数字＝PID，否则 `process_name.contains(name)`」（macOS 侧用 `proc_pidpath` 得到的路径做 `contains` 匹配）。

同时存在一个必须处理的冲突：本桥的 regular 监听是 HTTP 代理，而 `local` 模式产生的连接进入的是**透明层**。若某个被捕获的应用仍然把系统代理指向本桥端口，它的 `CONNECT` 会到达透明层，被代理内核直接判为协议错误并硬失败（mitmproxy 明确拒绝透明层上的 CONNECT）。因此「系统代理」与「指定应用」两种方式不能在同一个应用上同时生效。

## Decision

1. **捕获方式用 mitmproxy `local` 模式实现**，不新增自研网络扩展或驱动：
   - 捕获 = 在同一个 mitmproxy 实例上追加 `local:<spec>` 模式；
   - spec 用**路径子串**：应用取 `.app` 包路径（如 `/Applications/Google Chrome.app/`），非应用取可执行文件全路径。用包路径可同时命中应用主进程与其 Helper 子进程，且不会像短名（`Safari`）那样误伤同名进程。
2. **两种捕获方式互斥**，由显式 `captureMode`（`system-proxy` / `selected-apps`）控制：
   - `selected-apps`：本 App 不设置系统代理；若此前由本 App 设置过则撤销（清 `systemProxyManagedByApp` 标记）；运行时配置下发 `capture.processes`。
   - `system-proxy`：不启用 local 捕获；运行时配置里 `capture.processes` 恒为空。
   - 两种模式下 `bridgePort` 都保持可用：regular 监听不清除，`local` 模式不额外占端口（`local` 的 `listen_addrs` 为空）。
3. **系统代理被其它软件占用时，启用「指定应用」同样拒绝**（`PROXY_CONFLICT`，与 ADR-0004 同一条原则）：否则被捕获应用的连接会被其它代理抢走并静默半坏。
4. **sidecar 以 `--mode regular@<port>` 启动，不传 `--listen-port`**：全局 `listen_port` 会作用于每个模式，运行时新增的 `local:` 会被 mitmproxy 判为与 `regular` 争用同一监听地址而抛 `OptionsError`。`swufe-ready` 的 `listen_port` 由 regular 模式推导。
5. **捕获是异步生效的可选能力**：addon 每秒轮询运行时配置，首次应用与配置变更时把 `local:<spec>` 加入/移出模式集，并通过 `swufe-capture {"enabled","processes","error"}` 回报结果；失败后**不自动重试**，直到配置被重写（界面的「重试」按钮即再次下发配置）。捕获失败不改变桥状态（桥继续 `running`），只体现在 `BridgeStatus.captureError`。
6. **执行责任人**：cherrchen。

## Alternatives

| 备选方案 | 优点 | 缺点 | 未采纳原因 |
| -------- | ---- | ---- | ---------- |
| 自研网络扩展 / 驱动做进程重定向 | 完全可控；不依赖 mitmproxy 的 Rust 侧实现；无 `/Applications` 解包 | 需要在两个平台各写一份内核态/系统扩展代码并长期维护签名与分发；与第一期「复用成熟栈」的取向（ADR-0002）相反 | 成本与风险远超收益，且 M1/M2 已把改写逻辑固定在 mitmproxy addon 上 |
| 只做系统代理，不做按进程捕获 | 实现最小，无额外授权弹窗 | 不满足 REQ-003（用户无法把范围收窄到点选的应用）；用户原有代理工具也无法保留 | 与本里程碑退出条件直接冲突 |
| 两种方式同时启用（进程捕获 + 系统代理） | 表面上覆盖更全 | 被捕获应用的 `CONNECT` 会进入透明层并硬失败；表现为「部分请求 502」的静默半坏 | 行为不可预期，与 ADR-0004「拒绝而不是半工作」的原则冲突 |
| 捕获失败即把桥判为 error 状态 | 状态更「显眼」 | 进程捕获是可选能力，失败不应让系统代理主路径也不可用（REQ-003 边界 / R4） | 用 `captureError` 就地提示 + 重试，桥保持运行 |
| 用进程短名（如 `Safari`）作 intercept pattern | spec 更短、更易读 | 会命中同名进程；无法覆盖 Helper 子进程（Chrome 的 Helper 与主进程路径不同） | 用包路径/可执行文件全路径 |

## Consequences

### Positive

- 复用 mitmproxy 既有能力，没有新增自研网络组件与分发负担（与 ADR-0002 一致）；
- 流量路径唯一、可归因：一次只有一种接管方式生效，排障时不需要判断「是哪一层」；
- 捕获失败不影响主路径：系统代理模式在任何情况下都可独立工作（REQ-003 边界 / R4）；
- 切换捕获方式不需要重启 sidecar，`bridgePort` 始终可用。

### Negative

- 依赖 `mitmproxy_rs` 的平台行为：macOS 首次启用会把 `Mitmproxy Redirector.app` 解包到 `/Applications` 并请求系统扩展授权；Windows 需要 UAC 提权。这是外部依赖，版本升级需回归；
- 用户若手动把某个被捕获应用的代理指向本桥端口，该应用的 `CONNECT` 会硬失败（互斥的另一面）；
- 候选应用列表来自操作系统的进程枚举（macOS `ps -Ao pid=,comm=`、Windows `tasklist`），只有运行中的应用可被列出；已保存但当前未运行的应用仍需在界面中可见；
- 进程捕获无法覆盖以 root 运行的进程（系统扩展/驱动的匹配与权限边界）。

### Risks

| 风险 | 可能性 | 影响 | 缓解措施 |
| ---- | ------ | ---- | -------- |
| macOS 系统扩展授权弹窗劝退用户（R4） | 中 | 中 | 失败时不自动重试，界面给出「系统设置 → 通用 → 登录项与扩展」引导与「重试」按钮；该路径失败不影响系统代理主路径 |
| 首次启用未在 5 秒内确认导致失败 | 中 | 低 | 属预期失败路径：显示失败原因 + 引导 + 重试；不在后台反复触发授权 |
| `local` 模式与 `regular` 模式共用同一 mitmproxy 实例时的选项重算（`OptionsError`） | 低 | 中 | 启动时不传 `--listen-port`；模式推导 `listen_port`；失败时回滚模式集合并回报错误 |
| 平台差异（Windows UAC / 权限模型） | 中 | 中 | Windows 真机验证归 M4（T038）；实现沿用同一套 spec 与状态机 |

## References

- 相关需求：REQ-003、REQ-004、REQ-009、NFR-004、NFR-005
- 相关 Spec：[specs/001-phase1-local-bridge/](../../../specs/001-phase1-local-bridge/spec.md)、[tasks.md T026/T031](../../../specs/001-phase1-local-bridge/tasks.md)
- 相关 ADR：[ADR-0002](ADR-0002-reuse-mitmproxy-for-tls.md)（复用 mitmproxy 栈）、[ADR-0004](ADR-0004-refuse-start-when-system-proxy-in-use.md)（冲突时拒绝而不是半工作）
- 相关文档：[桥控制协议](../../api/bridge-control-protocol.md)（`capture` 配置键与 `swufe-capture` 诊断行）、[Electron IPC](../../api/electron-ipc.md)（`setCaptureMode` / `setCaptureProcesses`）、[主窗口](../../ui-ux/main-window.md)（捕获方式区与授权引导文案）
- 实现依据：`mitmproxy/proxy/mode_specs.py`（`LocalMode.default_port = None`）、`mitmproxy/proxy/mode_servers.py`（`LocalRedirectorInstance`）、`mitmproxy/addons/proxyserver.py`（重复监听地址检查）、`mitmproxy_rs` 的 intercept spec 匹配语义
