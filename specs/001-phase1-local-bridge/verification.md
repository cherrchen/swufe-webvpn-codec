# Verification: Phase 1 本机桥（001-phase1-local-bridge）

> Spec ID: 001
> Status: In Progress
> Owner: cherrchen
> Last Updated: 2026-09-23
> 界面结构提示（2026-09-23）：本文件中的界面结构相关记录（REQ-009 日志面板、REQ-005 allowlist 编辑界面、REQ-003 候选应用列表、AC-009 等）描述的是迁移前的单窗口实现；对应的界面结构事实已由 [spec 002](../002-desktop-ui-multiwindow/spec.md)（[REQ-012](../../docs/requirements/functional-requirements.md)）取代，002 将重新执行这些用例。本文件的历史证据与结论保留不变。

> 本文件建立 **Requirement → Verification** 映射，是「Feature 是否完成」的判定依据。
> 规则见 [verification-strategy.md](../../docs/verification/verification-strategy.md)。
> Feature **不因为「代码写完了」被视为完成**；状态必须推进到 `Verified`。
> 当前进度：M1/M2/M3 已交付；M5 后 macOS 教务浏览器验收通过，2026-09-23 Windows 真机项全部通过（`KI-001` 已 `Fixed`）。本轮复核确认 `KI-014` 在应用和桥之外的传输路径复现，按本轮决策置 `Accepted`；`KI-019` 的历史挂起当前未复现，原「上游侧」归因缺少同路径和上游连接阶段证据，故重新置 `Open`。Spec 001 保持 `Implemented`，待 `KI-019` 区分本地与外部原因后再评估 `Verified`。

## 映射表

> 测试用例编号与分层沿用归档测试用例集（`docs/archive/2026-09-20-swufe-webvpn-bridge-docs-v1.0/02-testing/02-test-cases.md`）；层级定义见 [docs/development/testing-strategy.md](../../docs/development/testing-strategy.md)。M1 覆盖的自动化用例已 `Passed`，其余保持 `Pending` 并标注 M1 已通过的部分。
>
> **Windows 侧（2026-09-23）**：本映射表下方的 `Passed` 结论以 macOS 为基准；Windows 真机的同期执行结果与逐条 REQ / NFR / AC 覆盖见「M4 Windows 验收执行记录（2026-09-23）」（结论：Windows 侧全部 P0/P1 项通过，`KI-001` 置 `Fixed`）。

| Requirement | Verification | Status |
| ----------- | ------------ | ------ |
| REQ-001 | TC-H01（L3 手工：状态条与状态机一致，含捕获态）；应用启动 smoke（TC-G01/TC-G03 前置，L3 手工） | Passed（M5：macOS 侧全部通过——TC-G01 复验通过（教务首页可打开并可操作，见「M5（KI-011 修复）执行记录」）；TC-G03 仍延 Windows，见 `KI-001`）；M4 曾 `Failed`（TC-G01/TC-G02 失败，根因见 `KI-011`；TC-G03 延 Windows，见 `KI-001`）——应用启动与界面部分通过：M4 实机状态条覆盖含「桥接中（进程捕获）」在内的六种呈现且与状态机一致（TC-H01）、日志面板与真实桥端到端联动（TC-F04）；M3 已通过：主窗口一级「捕获方式」区、可增删的 allowlist 与日志面板实机可用；状态条在捕获生效时显示「桥接中（进程捕获）」（渲染层以真实推流验证，桥未运行时保持「桥接中」）；M2 已通过：应用启动 smoke，且五个状态（未登录/已登录/桥接中/错误/过期处理中）实机可见并与状态机一致 |
| REQ-002 | TC-D01、TC-D02、TC-D03（L1 组件 + L3 手工：登录成功、未登录拒绝开桥、过期停桥清代理弹窗） | Passed（M4：TC-D01 在真实 CAS/MFA 会话下通过、TC-D02 通过、TC-D03 以服务端使 ticket 失效触发并在 ≤8s 内完成级联且重登后回到「已登录」；过程中修复 `KI-008`（探测丢 Cookie）与 `KI-009`（登录窗 ERR_ABORTED））；M2 已通过：TC-D02（未登录时开关禁用且 `startBridge` 返回 `NOT_LOGGED_IN`）、TC-D03（过期级联实机 8 秒内完成）、TC-D01（桩上游「打开门户 → 采集 Cookie → 已登录」）；M1 已通过：Cookie 注入与去重、配置热更新 |
| REQ-003 | TC-C02、TC-C03、TC-C04（L1 组件 / L2 集成：设代理、关桥清代理、退出清代理）；TC-G04（L3 手工：进程捕获的范围与停止） | Passed（M4：TC-C02/C03/C04 与 TC-G04 的真实范围全部实机通过——捕获与系统代理互斥（`Enabled: No`）、正向「被选中的 Chrome 经桥」、反向「未选中的 curl 不经桥」、切回系统代理即恢复）；M2 已通过：TC-C02/C03/C04 实机——开桥把 6 个启用服务指向 `127.0.0.1:8080`，关桥/退出清空，异常退出残留由 `recoverOnLaunch()` 自愈；M1 已通过：sidecar 起桥、回环监听、结束进程即停止；M3 已通过：`--mode regular@<port>` 起桥且 `swufe-ready.listen_port` 等于 `--port`（L2）、捕获模式集推导/回滚/不重试（L0 `bridges/python/tests/l0/test_capture.py`）、addon 叠加与移除 `local:` 并回报 `swufe-capture`（L1 `bridges/python/tests/l1/test_addon_capture.py`）、互斥编排（`apps/desktop/test/orchestrator.test.ts` 6 例）、实机切到「指定应用」不设置系统代理（`networksetup` 证据见「M3 手工验证记录」）、系统代理被占用时拒绝启用「指定应用」并弹出冲突模态（实机 CDP 驱动） |
| REQ-004 | TC-C01（L1 组件 / L2 集成：已有系统代理时拒绝启动，错误码 `PROXY_CONFLICT`） | Passed（M2：实机 `Enabled: Yes / 127.0.0.1:7890` 时拒绝启动、模态提示、OS 设置未被改动、未启动 sidecar；`apps/desktop/test/orchestrator.test.ts` 断言冲突时不调用 `enable`。2026-09-21（`KI-013` 修复）新增 fake-ip 预检：网关主机解析到 `198.18.0.0/15` 时以同一错误码拒绝启动——单测 + 真机 smoke，见「`KI-013` 修复执行记录」） |
| REQ-005 | TC-B01..B05（L0 单元 + L1 组件：默认值、精确命中、非名单直连语义、通配、持久化）；TC-H02（L3 手工：通配勾选） | Passed：M3 实机通过 TC-B05 / TC-H02——界面添加 `portal.swufe.edu.cn` 后出现在列表、删除后回落，非法主机名显示「主机名不合法：…」且不写入，勾选 `*.swufe.edu.cn` 与增删结果在重启 App 后仍保留（`/tmp/m3-e2e/config.json` 证据）；M1/M2 已通过：TC-B01..B05 以及 App 侧 `<userData>/config.json` 的读写与校验（`apps/desktop/test/store.test.ts`）与跨语言同文件用例（`bridges/python/tests/l0/test_config.py`） |
| REQ-006 | TC-A01..A05（L0 单元：codec 向量）；TC-F01（L2 集成：curl 经代理访问 allowlist 主机） | Passed（M1） |
| REQ-007 | TC-F03（L1 组件：`Location` 反向改写）；TC-G02（L3 手工：教务页面内导航不跳飞） | Passed（M5：macOS 的 TC-G02 复验通过——教务首页与站内导航均在网关原生空间可用且不跳飞；`Location` 反向改写本身在 M1/L1 与真实链路均通过；两条例外（网关自有命名空间直通、bootstrap 文档升级）见 [ADR-0007](../../docs/architecture/adr/ADR-0007-gateway-owned-namespaces-and-native-mode-promotion.md)）；M4 曾 `Failed`（TC-G02 因网关客户端 shim 与透明桥不兼容而失败，见 `KI-011`；`Location` 反向改写本身在真实链路上通过——经桥 `http://jwxt.swufe.edu.cn/` 的 `302` 被改写为普通主机）；M1 已通过：`Location`、`Set-Cookie` Domain/Path、HTML/JS/JSON 反向改写与内容类型边界（`bridges/python/tests/l1/test_rewrite.py`、`bridges/python/tests/l1/test_addon_response.py`） |
| REQ-008 | TC-D04（L2 集成 / L3 手工：登录 WebView 无代理环）；TC-F02（L2 集成：非 allowlist 直连不改写） | Passed（M4：真实 CAS 会话下登录窗口 `resolveProxy(https://webvpn.swufe.edu.cn) = DIRECT`，登录期间无 webvpn/authserver 的 `swufe-debug` 行；桥运行期这两个主机均为 `not-allowlisted`，防环对照段记录到未包装的 `302 → https://webvpn.swufe.edu.cn/login`）；M2 已通过：登录分区 `setProxy({mode:'direct'})`，实机日志 `resolveProxy(...) = DIRECT` 且登录期间无 `swufe-debug` 行；M1 已通过：TC-F02 与「已是 WebVPN 形态的请求直通」 |
| REQ-009 | TC-F04（L2 集成 + L3 手工：调试日志仅域名与改写结果）；TC-H01（L3 手工：状态可见） | Passed（M4：真实桥流量下逐条出现——累计 200 条上限、最新在前、行内只有「时间/域名/结果」，关闭开关后面板隐藏且行数归 0（TC-F04 + TC-H01））；M3 已通过：日志面板三列（时间/域名/结果）、200 条上限、最新在前、清空、随开关显示/隐藏与关闭时清空——在真实渲染层上以真实 `onDebugLog` 推流验证，且事件携带的额外字段（cookie/body）不进入界面；M2 已通过：debug 事件经 IPC 到达渲染层且只保留契约的五个键（`apps/desktop/test/sidecar-lines.test.ts`、`apps/desktop/test/debug-relay.test.ts`）；M1 已通过：TC-F04 的 L2 部分（键集固定、无 Cookie/正文） |
| REQ-010 | TC-E01、TC-E02、TC-E03（L3 手工，需管理员权限：安装 CA、卸载 CA、未装 CA 提示 `CA_MISSING`） | Passed（**2026-09-21 `KI-007` 修复后复验：TC-E01 已由应用内自动路径通过（`#message` = 「本机 CA 已安装并被系统信任。」、`getCaStatus() = {installed:true,trusted:true}`、管理域信任项含该 CA、`verify-cert` 退出码 0），安装改为「提权写系统钥匙串 + 应用进程写信任设置」，见 [ADR-0008](../../docs/architecture/adr/ADR-0008-ca-trust-authorization-in-app-session.md)**；M4：TC-E01 经应用自带的手动命令把 CA 写入系统信任库并被系统信任（自动路径失败，见 `KI-007`）、TC-E02 修复 `KI-010` 后卸载成功（钥匙串 0 字节、UI「未安装」）、TC-E03 未装 CA 时开桥返回 `CA_MISSING` 且未做任何 OS 变更）；M2 已通过：TC-E03、安装前风险提示模态、CA 生成入口（`bridges/python/tests/l1/test_ca.py`） |
| REQ-011 | TC-G01（L3 手工：macOS 教务验收）；TC-G03（L3 手工：Windows 教务验收） | Passed（M5：macOS 侧（TC-G01）通过；TC-G03 延 Windows，见 `KI-001`）；M4 曾 `Failed`（macOS 的 TC-G01/TC-G02 失败，根因见 `KI-011`；TC-G03 延 Windows，见 `KI-001`） |
| NFR-001 | 代码审查（TLS/HTTP2/证书签发实现来自 mitmproxy，无自研 PKI）；TC-E01（L3 手工：CA 生成于 mitmproxy 专用 confdir） | Passed（M2：CA 生成入口 `bridges/python/swufe_bridge/ca.py` 复用 mitmproxy `CertStore`，App 与 sidecar 使用同一 `<userData>/mitmproxy/` confdir，实机开桥即在该目录生成 CA）；M1 已通过：TLS/HTTP2/证书签发全部来自 mitmproxy（无自研 PKI） |
| NFR-002 | TC-A01..A05（L0 单元：与 `wrd_codec.py` 向量一致，含 authserver / jwxt 样本） | Passed（M1） |
| NFR-003 | TC-D01（L1/L3：登录后无密码文件）＋ TC-F04（L2/L3：日志不含正文/Cookie）＋ 人工检查（L3：CA 私钥与会话文件权限仅本机用户可读、不上传） | Passed（M2：实机 `bridge-config.json` 与 CA 私钥均为 0600；会话只以 `name/value/domain/path` 下发 sidecar，WRD key/IV 不跨 IPC（`getSettings` 只返回界面可见子集）；会话存于 Electron 持久分区，不写密码文件）；M1 已通过：TC-F04 的自动化部分与 0600 写入。M4 已通过：真实会话下 `bridge-config.json` 与 CA 私钥均为 0600、profile 内无任何密码文件，脱敏采集报告经 `redaction-self-check` 确认无 Cookie/密钥值（`pnpm run acceptance:check`） |
| NFR-004 | TC-C03、TC-C04（L1/L2：关桥与退出清代理）；TC-D03（L3 手工：过期清代理） | Passed（M2：实机三种路径均清空系统代理——关桥、退出（`before-quit` 清理完成后才退出）、会话过期；异常退出残留由下次启动的 `recoverOnLaunch()` 清除；`apps/desktop/test/orchestrator.test.ts` 断言只清本桥项。M4 实机复验：关桥、应用内退出、会话失效三条路径均把 6 个服务恢复为 `Enabled: No` 且无 sidecar 残留） |
| NFR-005 | TC-E01（L3 手工：安装 CA 前展示风险提示文案）；进程捕获授权引导文案 | Passed（M2：点击「安装本机 CA」先弹出风险模态，文案与 ui-ux 一致；取消后未发生任何安装动作。真实安装动作未执行，见 TC-E01。M3：捕获失败时实机显示「启用失败 — <原因>」+ macOS 扩展授权引导文案 + 「重试」按钮，文案与 [ui-ux/main-window.md](../../docs/ui-ux/main-window.md) 一致） |
| NFR-006 | TC-G01（macOS）、TC-G03（Windows）（L3 手工） | Passed（M5：macOS 侧通过——教务可打开并可操作；Windows 侧的编排与启动实现已完成、真机验证延 M4/T038 与 `KI-001`）；M4 曾 `Failed`（macOS 的编排链路与启动均通过，但教务浏览器验收失败，见 `KI-011`；Windows 实现 + 单测完成、真机验证延 M4/T038 与 `KI-001`） |
| NFR-007 | TC-H01、TC-H02（L3 手工：界面文案为中文优先） | Passed：M3 实机确认新增的捕获方式区、应用列表、日志面板与两条新文案全部为中文；M2 已通过：主窗口状态条、按钮、模态与错误文案全部为中文，实机可见 |

Status 取值：`Pending` / `Passed` / `Failed` / `N/A`（`N/A` 必须写明理由）。

## 验收标准覆盖

| Acceptance Criteria | 对应验证项 | Status |
| ------------------- | ---------- | ------ |
| AC-001 | TC-G01 / TC-G03（L3 手工：双平台启动 Electron 应用） | Passed（M5：macOS 的启动、界面与 TC-G01 全部通过；TC-G03 延 Windows，见 `KI-001`）；M4 曾 `Failed`（应用启动与界面部分通过——真实应用可启动、可交互、单实例锁生效；但两条 TC 的教务首页部分失败，见 AC-007 与 `KI-011`；TC-G03 延 Windows，见 `KI-001`）；M2 已通过 macOS 启动 smoke：`pnpm start` 显示主窗口并可交互，单实例锁生效 |
| AC-002 | TC-D01（L1/L3：登录后 `loggedIn=true`）+ TC-F04（日志检查无 Cookie/密码） | Passed（M4：真实 CAS/MFA 会话下 `loggedIn = true`（`expiresAt` 有值）、状态条「已登录」、profile 内无密码文件；日志面板与 `swufe-debug` 行只含域名/结果（TC-F04））；M2 已通过：桩上游下「登录 → `loggedIn=true` → 状态条已登录」，过程无密码文件；M1 已通过：日志检查部分 |
| AC-003 | TC-C01（L1/L2：系统代理已占用时拒绝启动并提示） | Passed（M2：实机模态提示 + OS 设置未变 + 未启动 sidecar） |
| AC-004 | TC-C02 / TC-C03 / TC-C04（L1/L2：开桥设代理、关桥清代理、退出清代理）+ TC-G04（M3：指定应用时不设置系统代理） | Passed（M2：实机 `networksetup` 三态证据；M3：捕获方式为「指定应用」时编排层不调用 `enable` 并在切换时撤销本 App 设置过的代理（`apps/desktop/test/orchestrator.test.ts`），实机切换捕获方式后 `networksetup` 仍为 `Enabled: No`。M4：TC-G04 的真实范围已通过——捕获态下系统代理为 `Enabled: No`、被选中的 Chrome 经桥、未选中的 curl 不经桥、切回「系统代理」即恢复（`KI-002` 置 `Fixed`）；M2/M4 的 TC-C02/C03/C04 实机三态证据见结果表） |
| AC-005 | TC-E01 / TC-E02（L3 手工：CA 安装与卸载在系统信任库生效） | Passed（**2026-09-21 `KI-007` 修复后复验：TC-E01 由应用内自动路径完成（系统钥匙串含该证书、管理域信任项含该 CA、`security verify-cert` 退出码 0、`getCaStatus() = {installed:true,trusted:true}`、UI「已安装并被系统信任」），见 [ADR-0008](../../docs/architecture/adr/ADR-0008-ca-trust-authorization-in-app-session.md)**；M4：TC-E01 的信任库写入以应用自带的手动命令完成（自动路径失败见 `KI-007`）、TC-E02 修复 `KI-010` 后卸载成功（系统钥匙串中 `mitmproxy` 证书 0 字节、UI「未安装」）；M2 已通过：实现、风险提示与 `CA_MISSING`） |
| AC-006 | TC-B01 / TC-B02 / TC-B05（L0/L1）+ TC-H02（L3 手工：默认含 jwxt、可增删、可勾选通配） | Passed：M3 实机通过界面增删主机与通配勾选，且重启 App 后仍保留（TC-B05 / TC-H02）；M1/M2 已通过：默认值、小写化/校验、持久化与跨语言同文件读取 |
| AC-007 | TC-G01 / TC-G02 / TC-G03（L3 手工：教务可打开并操作） | Passed（M5：macOS 通过——入口 `http://jwxt.swufe.edu.cn/` 首次进入时被升级到 WebVPN 原生 URL 形态（`https://webvpn.swufe.edu.cn/http/<token>/…`，见 [ADR-0007](../../docs/architecture/adr/ADR-0007-gateway-owned-namespaces-and-native-mode-promotion.md)），随后首页、菜单与站内「学生成绩查询」均可交互且链接不跳飞到不可达地址；其它 allowlist 主机（实测 `www.swufe.edu.cn`）仍是普通主机名；TC-G03 延 Windows，见 `KI-001`）；M4 曾 `Failed`（macOS 的 TC-G01/TC-G02 失败——根 URL 白屏、真实页渲染但不可交互，根因与候选解除路径见 `KI-011`；网关的改写与反向改写链路本身经 curl 与 Chrome 内 `fetch` 双向复核可用；TC-G03 延 Windows，见 `KI-001`） |
| AC-008 | TC-D03（L3 手工：过期停桥、清代理、弹窗重登） | Passed（M2：实机 8 秒内完成停桥 + 清代理 + 模态「WebVPN 会话已失效…」+ [去登录]，重登后状态回到「已登录」） |
| AC-009 | TC-F04（L2 + L3：调试日志仅域名与改写结果） | Passed（M4：真实桥流量下逐条出现、累计 200 条上限、行内只有域名与结果、关闭开关后隐藏并清零）；M3 已通过：面板三列 / 200 条上限 / 清空 / 随开关显示隐藏（真实渲染层 + 真实 `onDebugLog` 推流），且额外字段（cookie/body）不进入界面；M2 已通过：debug 事件经 IPC 到渲染层且只保留五个键；M1 已通过：L2 部分 |
| AC-010 | TC-D04（L2/L3：登录 WebView 不经本桥） | Passed（M4：真实 CAS 会话下登录窗口 `resolveProxy(https://webvpn.swufe.edu.cn) = DIRECT`、登录期间无 webvpn/authserver 的 `swufe-debug` 行；桥运行期这两主机均为 `not-allowlisted`（防环对照段记录到未包装的 `302 → /login`））；M2 已通过：登录窗 `resolveProxy = DIRECT`、登录期间无 webvpn/authserver 的 `swufe-debug` 行 |

## 执行的命令与结果

| 命令 | 结果 | 时间 | 备注 |
| ---- | ---- | ---- | ---- |
| `uv sync --frozen --directory bridges/python` | 通过（48 packages checked） | 2026-09-21 | lock 与 `bridges/python/pyproject.toml` 一致 |
| `uv run --directory bridges/python pytest tests/l0 -q` | `74 passed` | 2026-09-21 | TC-A01..A05、TC-B01..B05、运行时配置解析与热更新缓存 |
| `uv run --directory bridges/python pytest tests/l1 -q` | `74 passed` | 2026-09-21 | 请求改写、响应反向改写、日志最小化（INV-001）、配置热更新（T012） |
| `uv run --directory bridges/python pytest tests/l2 -q` | `6 passed` | 2026-09-21 | TC-F01/F02/F04、EC-006、回环约束（真 mitmdump + curl + 假上游） |
| `uv run --directory bridges/python pytest -q` | `154 passed` | 2026-09-21 | 全量（L0+L1+L2） |
| `uv run --directory bridges/python python -m swufe_bridge.wrd_codec decode '<authserver 样本 URL>'` | `https://authserver.swufe.edu.cn/authserver/login?service=http%3A%2F%2Fjwxt.swufe.edu.cn%2Fsso%2Fjziotlogin`（退出码 0） | 2026-09-21 | TC-A01 的命令行复核 |
| `uv run --directory bridges/python python -m swufe_bridge.sidecar --config <cfg> --port 18082 --confdir <dir>` + `curl -x http://127.0.0.1:18082 --cacert <dir>/mitmproxy-ca-cert.pem https://jwxt.swufe.edu.cn/sso/jziotlogin?x=9` | `swufe-ready`；`swufe-debug` 请求/响应各一条（`rewritten=true`）；假上游观测 `path=/https/<token>/sso/jziotlogin?x=9` 且 `cookie=wrdvpn_session=SMOKE-SESSION-VALUE`；curl 得到 `location: https://jwxt.swufe.edu.cn/next` | 2026-09-21 | 手工 dev smoke（假上游），见 [M1 完成记录](../../docs/planning/milestones/M1-mitm-bridge.md) |
| 同上，`webvpnBase=https://webvpn.swufe.edu.cn`（无真实会话） | 上游连接为 `webvpn.swufe.edu.cn:443`，请求行 `GET https://webvpn.swufe.edu.cn/https/<token>/sso/jziotlogin`；响应 `HTTP/2 302`，`location: https://webvpn.swufe.edu.cn/login`（按设计不改写），`detail=set-cookie` 表示真实 Set-Cookie 已触发反向改写 | 2026-09-21 | 真实上游可达但无会话；页面级可达性由 L3/M4 验证 |
| `pnpm run docs:check` | `0 error(s), 0 warning(s)`（links + 双语配对 + spec 结构） | 2026-09-21 | 含 M1 同步的文档与 Spec 状态 |
| `pnpm run typecheck` | 无 error | 2026-09-21 | 文档检查脚本类型检查 |
| `uv run --directory bridges/python pytest tests/l0 -q` | `75 passed` | 2026-09-21 | M2：新增跨语言配置键兼容用例 |
| `uv run --directory bridges/python pytest tests/l1 -q` | `79 passed` | 2026-09-21 | M2：新增 `bridges/python/tests/l1/test_ca.py`（CA 生成入口 5 例） |
| `uv run --directory bridges/python pytest -q` | `160 passed` | 2026-09-21 | M2：L0+L1+L2 全量 |
| `pnpm --filter swufe-webvpn-bridge run typecheck` | 无 error | 2026-09-21 | M2：Main / Renderer / preload 三个 tsconfig |
| `pnpm --filter swufe-webvpn-bridge run test:unit` | `55 passed` | 2026-09-21 | M2：状态机、代理/证书/进程解析、sidecar 控制行、会话探测分类、AppStore、debug 转发、Orchestrator |
| `pnpm --filter swufe-webvpn-bridge run build` | 通过（`dist/main` + `dist/renderer` + `dist/preload/index.js`） | 2026-09-21 | M2：preload 由 esbuild 打包成单文件 |
| 真实应用 `pnpm start --user-data-dir=/tmp/m2-e2e`（CDP 驱动） | 未登录时开桥开关禁用；点「安装本机 CA」先出现风险模态（取消后 `security find-certificate … | wc -c` 仍为 0）；点「登录 WebVPN」→ 终端 `resolveProxy(...) = DIRECT`、状态变「已登录」；开桥 → `错误` + `CA_MISSING` 文案且 `networksetup -getwebproxy Wi-Fi` 仍为 `Enabled: No`；第二个实例 0s 退出（单实例锁） | 2026-09-21 | M2 实机 A 组（见 [M2 完成记录](../../docs/planning/milestones/M2-desktop-orchestration.md)） |
| CA 前置被替换的验证入口（`apps/desktop/test/fixtures/stub-ca-app.js`，其余实现真实）+ 假上游 `portal-stub.mjs` | 开桥后 6 个服务 `Enabled: Yes / 127.0.0.1:8080`；`curl -x http://127.0.0.1:8080 --cacert <confdir>/mitmproxy-ca-cert.pem https://jwxt.swufe.edu.cn/` → 上游收到 WRD 形态路径与注入 Cookie、响应被反向改写；非 allowlist 直连未改写；debug 事件同时到终端与渲染层；过期级联 8 秒内完成；退出（`before-quit`）清代理；`kill -TERM` 残留由下次启动 `recoverOnLaunch()` 清除；代理冲突拒启且 OS 未变 | 2026-09-21 | M2 实机 B 组（CA 信任库写入需管理员密码，故该检查被替换，见完成记录的「实现期决策与偏差」） |
| `uv run --directory bridges/python pytest tests/l0 -q` | `97 passed` | 2026-09-21 | M3：新增 `bridges/python/tests/l0/test_capture.py`（14 例：spec 构造、模式集推导、pending/apply、失败回滚与不重试）与 `test_config.py` 的 `capture.processes` 用例（7 例） |
| `uv run --directory bridges/python pytest tests/l1 -q` | `86 passed` | 2026-09-21 | M3：新增 `bridges/python/tests/l1/test_addon_capture.py`（7 例：`regular_listen_port`、`_capture_tick` 启用/停用/失败去重、重写配置后重试、`swufe-ready` 上报端口并可启动捕获循环） |
| `uv run --directory bridges/python pytest tests/l2 -q` | `7 passed` | 2026-09-21 | M3：新增「默认配置不产生 `swufe-capture`（捕获为 opt-in）」与「`capture.processes` 含逗号 ⇒ `swufe-error CONFIG_INVALID` + 退出码 2」 |
| `uv run --directory bridges/python pytest -q` | `190 passed` | 2026-09-21 | M3：L0+L1+L2 全量 |
| `pnpm --filter swufe-webvpn-bridge run typecheck` | 无 error | 2026-09-21 | M3：三个 tsconfig（Main/Renderer/preload） |
| `pnpm --filter swufe-webvpn-bridge run test:unit` | `70 passed` | 2026-09-21 | M3：新增/改写 parse（pattern/name/分组）、store（默认值/校验/归一化）、orchestrator（捕获 6 例）、sidecar-lines（`swufe-capture` 三键） |
| `pnpm --filter swufe-webvpn-bridge run build` | 通过（`dist/main` + `dist/renderer` + `dist/preload/index.js`） | 2026-09-21 | M3：构建产物用于实机界面验证 |
| `pnpm run docs:check` | `0 error(s), 0 warning(s)`（148 文件） | 2026-09-21 | M3：新增 ADR-0006（中英）与全部 M3 文档同步后的链接/双语/spec 结构检查 |
| `pnpm run typecheck` | 无 error | 2026-09-21 | 文档检查脚本类型检查 |
| M3 实机界面验证（真实应用 + CDP 驱动，`pnpm start --user-data-dir=/tmp/m3-e2e --remote-debugging-port=9222`） | 见下方「M3 体验打磨手工验证」：allowlist 增删/通配、捕获方式与应用勾选、日志面板、冲突模态全部符合预期，且重启后设置保留 | 2026-09-21 | 无管理员密码、无真实 WebVPN 会话；系统代理未被本 App 设置 |
| `pnpm run acceptance:check --out <dir> --user-data-dir /tmp/m4-acceptance`（桥关闭 / 桥运行 http 两种状态） | 桥关闭：`bridge-port: closed`、无 `FAIL`、退出码 0；桥运行（真 mitmdump + 真上游）：`bridge-port: open`、`bridge-smoke: 200 OK`、退出码 0；两次报告均在 `kit-selfcheck/` 与 `acceptance-macos/` | 2026-09-21 | T044 的器材自检；脱敏不变量见下一条 |
| 脱敏自检（哨兵 Cookie/密钥场景） | 报告中 `grep -c 'SMOKE-COOKIE-VALUE'` = 0、含 `cookieCount`、末尾 `redaction-self-check` = `PASS`；人为把 `wrdKey` 漏进白名单后同一检查变 `FAIL` 且退出码 1（该报告含哨兵值，**未入库**） | 2026-09-21 | NFR-003 / INV-001 的正负两向验证 |
| `uv run --directory bridges/python pytest -q`（M4 后） | `190 passed` | 2026-09-21 | 本轮只改 App/脚本，Python 层无回归 |
| `pnpm --filter swufe-webvpn-bridge run typecheck` / `pnpm --filter swufe-webvpn-bridge run test:unit`（M4 后） | 无 error / `71 passed`（新增「不带 `-Z` 取不到指纹」一例） | 2026-09-21 | 修复 `KI-008`/`KI-009`/`KI-010` 后 |
| 会话探测隔离实验（Electron 内 `net.request`，`/tmp/probe-experiment.js`） | 默认参数：`redirect event status=302 location=https://webvpn.swufe.edu.cn/login`；`useSessionCookies: true`：`response status=200 location=(none)`；`useSessionCookies: false`：同上 302 | 2026-09-21 | `KI-008` 的根因与修复判据（同一 Cookie 三种参数的一次对照） |
| 真实应用 M4 验收（`pnpm start --user-data-dir=/tmp/m4-acceptance --remote-debugging-port=9222`，`SWUFE_PROBE_INTERVAL_MS=8000`） | 见「M4 结果表」：TC-D02/E03/E01/D01/D04/C01/C02/F01/F04/D03/G04/C03/C04/E02/H01/H02/B05 通过；TC-G01/G02 失败；全过程无密码文件落盘，`bridge-config.json` 与 CA 私钥 0600 | 2026-09-21 | 需要 cherrchen 的动作：管理员密码（CA 安装/卸载）、CAS/MFA 登录、浏览器内登录 |
| 教务浏览器验收（真实 Chrome，系统代理路径；curl 与 Chrome 内 `fetch` 双向复核） | `http://jwxt.swufe.edu.cn/` 经桥 `200/925B`（网关 shim 页）、`/wengine-vpn/js/main.js` 经桥 `404`（网关根 `200/376922B`）、`/xtgl/index_initMenu.html` 经桥 `200/76854B` 且体被改写；浏览器实测白屏 / 页面不可交互 → TC-G01/G02 `Failed`（`KI-011`） | 2026-09-21 | `https` 形态经网关为 `302 → /wengine-vpn/failed`，故教务只能走 `http`；自动化导航在本环境反复卡死，关键观察由 cherrchen 手工完成 |

| `uv run --directory bridges/python pytest -q` | `198 passed`（L0 97 + L1 93 + L2 8） | 2026-09-21 | M5：新增 8 例——`bridges/python/tests/l1/test_addon_request.py` 4 例（网关自有路径直通）、`bridges/python/tests/l1/test_addon_response.py` 3 例（升级 / 不误升级 / 自有响应不改写）、`bridges/python/tests/l2/test_proxy_end_to_end.py::test_gateway_owned_path_and_promotion_end_to_end` 1 例 |
| 反向验证：临时把 `GATEWAY_ROOT_PREFIXES` 置空 + `_promote_to_gateway` 直接 `return False` 后重跑新增用例 | `5 failed`（`test_gateway_owned_path_is_not_token_wrapped`、`test_gateway_owned_authserver_path_is_not_token_wrapped`、`test_gateway_owned_response_is_not_reverse_rewritten`、`test_bootstrap_document_is_promoted`、`test_gateway_owned_path_and_promotion_end_to_end`），其余 3 例为反向守卫两向通过；随后恢复文件 | 2026-09-21 | M5：证明新增用例非空断言（撤掉实现即失败） |
| `pnpm --filter swufe-webvpn-bridge run typecheck` / `pnpm --filter swufe-webvpn-bridge run test:unit` | 无 error / `71 passed` | 2026-09-21 | M5：App 侧未改动，回归确认无影响 |
| `pnpm run docs:check` | `0 error(s), 0 warning(s)` | 2026-09-21 | M5：ADR-0007 中英配对与全部文档同步后 |
| `curl -sS -x http://127.0.0.1:8080 --cacert <caCert> -o /dev/null -w '%{http_code} %{size_download}\n' 'http://jwxt.swufe.edu.cn/wengine-vpn/js/main.js?ver=20211207'`（真实应用 + 系统代理路径，桥运行中） | `200 376922`（`application/javascript`） | 2026-09-21 | M5：网关自有路径直通的实机对照（修复前经桥为 `404`） |
| 真实 Chrome（系统代理路径，`--disable-features=HttpsUpgrades,…` 以复现文档记载的 `http` 入口）打开 `http://jwxt.swufe.edu.cn/` | 302 链 → CAS（`authserver`，`not-allowlisted`）→ 登录后桥日志出现 `{"host":"jwxt.swufe.edu.cn","direction":"response","detail":"promoted"}`，浏览器进入 `https://webvpn.swufe.edu.cn/http/<token>/xtgl/index_initMenu.html…` | 2026-09-21 | M5：升级规则的实机证据（TC-G01） |
| 同一浏览器内：教务首页 → 点「信息查询 → 学生成绩查询」 | 打开 `…/cjcx/cjcx_cxDgXscj.html?gnmkdm=N305005&layout=default`，标题「学生成绩查询」，无错误页，查询表单 + 表格渲染（5 个 `table`），页面正文含 `?vpn-7&ver=…` 的网关原生改写 | 2026-09-21 | M5：站内导航不跳飞（TC-G02） |
| 非 jwxt 主机回归（勾选 `*.swufe.edu.cn` 通配后）：Chrome 打开 `https://www.swufe.edu.cn/` → 站内点「学校概况」 | 地址栏保持 `www.swufe.edu.cn`（`location.host` 未变）、标题「西南财经大学」→「学校概况-西南财经大学」、无 `#main-frame-error`；桥日志 `rewritten=true` 且响应 `no-wrd-match`（该站页面不含 WRD 字面量，故无 body 改写可记） | 2026-09-21 | M5：普通 URL 空间未被误升级 |
| 同一轮另一台非 jwxt 主机：`curl -x http://127.0.0.1:8080 --cacert <caCert> https://lib.swufe.edu.cn/` | `302`，`location: https://webvpn.swufe.edu.cn/https/<lib-token>/`（该主机的入口文档同样是网关 bootstrap 页 ⇒ 同样升级，按 ADR-0007 属预期） | 2026-09-21 | M5：升级按判据发生，与主机无关 |
| `pnpm run acceptance:check --out /tmp/ki011-evidence --port 8080 --host jwxt.swufe.edu.cn --scheme http --user-data-dir /tmp/ki011-gateway --save-body` | `bridge-port: open`、`bridge-smoke: 302 Found`、`trust-store: installed: yes`、`redaction-self-check: PASS`；报告入库 `evidence/acceptance-macos/acceptance-darwin-20260921-154657.md`（`--save-body` 产物不入库） | 2026-09-21 | M5：脱敏证据（T044 器材） |
| 关桥后的系统代理与残留检查（`networksetup -getwebproxy/-getsecurewebproxy Ethernet`+`Wi-Fi`、`scutil --proxy`、`pgrep -fl swufe_bridge`） | 全部 `Enabled: No`、`HTTPEnable 0`/`HTTPSEnable 0`、无 sidecar 进程 | 2026-09-21 | M5：本改动未影响 NFR-004 |
| `KI-014` 定位：登录窗 CDP（`Network.enable` + `Log.enable` + `Page.reload`）与 `curl --http2 'https://authserver.swufe.edu.cn/authserver/swufeThemezxqr/static/css/bootstrap.min.css?v=…'` 连续 8 + 3 次 | CDP：`net::ERR_INCOMPLETE_CHUNKED_ENCODING`（`bootstrap.min.css`、`jquery-latest.min.js`），样式表 `cssRules.length = 0`；重载后 `cssRules = 1187`、`decodedBodySize = 121048`；curl 11 次中 3 次被截断（`33612`/`25136`/`26880` B，`curl: (18)`） | 2026-09-21 | M5 期间发现（cherrchen 报告登录页渲染错误）；根因在校方服务端，与桥/本项目无关，登记 `KI-014` |

| `pnpm --filter swufe-webvpn-bridge run typecheck` / `pnpm --filter swufe-webvpn-bridge run test:unit` | 无 error / `76 passed` | 2026-09-21 | `KI-013` 修复：新增 `apps/desktop/test/fake-ip.test.ts`（判据边界 2 例）与 3 例 Orchestrator 预检用例（命中拒绝且未触碰 OS、预检在端口探测之前、解析失败不阻断） |
| 真机 smoke（`pnpm exec tsx /tmp/ki013-smoke.mts`，真实 DNS + 真实 AppStore） | `webvpn.swufe.edu.cn = 202.115.115.140`；真实解析 → 开桥 `state = running`（无误报）；注入 `198.18.0.12` → `error.code = PROXY_CONFLICT`、OS 调用仅 `["proxy.read","proxy.read","proxy.read"]`、`sidecars = 0` | 2026-09-21 | `KI-013`：零误报与拒绝路径的双向证据（临时脚本未入库） |
| `pnpm run docs:check` | `0 error(s), 0 warning(s)`（178 文件；links / i18n / spec） | 2026-09-21 | `KI-013` 修复的文档同步后（含 ADR-0011 中英） |
| `uv run --directory bridges/python pytest -q` | `198 passed` | 2026-09-21 | `KI-013` 修复未触及 Python 侧，回归确认 |
| `pnpm run typecheck`（仓库根检查脚本） | 无 error | 2026-09-21 | — |
| `pnpm run spec:check` | `0 error` | 2026-09-21 | T001/T002 状态补记与 T049 追加后 |

> 只记录**实际执行过**的命令；未执行时写明原因，不得写「应该没问题」。

## 手工验证步骤

L3 教务浏览器验收（TC-G01 / TC-G02 / TC-G03）。

```text
前置条件：
1. macOS 与 Windows 各一台测试机，浏览器为 Chrome/Edge；
2. 测试者自有西财账号可用（账号不写入仓库），设备为授权设备；
3. CA 已安装并被系统信任；App 内已完成官方 WebVPN/CAS（含 MFA）登录；
4. allowlist 默认含 jwxt.swufe.edu.cn（或已手动添加），桥开关为开启；
5. 系统代理未被其它软件占用（无 Clash / mihomo / sing-box 等）。
步骤：
1. 在浏览器地址栏输入 https://jwxt.swufe.edu.cn/ 打开教务首页；
2. 点击页面内主要菜单/链接，完成一次常规页面导航；
3. 重复步骤 1–2 于另一侧桌面 OS（TC-G03）；
4. 观察状态条与调试日志（调试日志开启时）中的域名与改写结果。
预期结果：
1. 教务首页可加载（TC-G01）；
2. 页面内导航不因绝对 URL 跳飞到不可达的公网直连地址，登录态保持（TC-G02）；
3. 两侧 OS 均通过（目标；至少一侧通过为出口准则下限）；
4. 状态条与实际状态一致；日志仅含域名与是否改写成功，无响应正文/Cookie。
实际结果：待执行（M4；M1 已完成其中可自动化的部分：改写链路、反向改写与日志最小化）
```

M2 桌面编排手工步骤（TC-C01..C04、TC-D01..D04、TC-E01..E03）。

```text
前置条件：
1. macOS 测试机；`bridges/python` 已 `uv sync`，仓库根已 `pnpm install`；
2. 假上游：`node apps/desktop/test/fixtures/portal-stub.mjs --port 19080 --mode ok`；
3. `userData` 隔离目录（如 /tmp/m2-e2e）内 config.json 的 settings.webvpnBase 指向该假上游，debugLogging=true；
4. 有管理员权限时用真实入口 `pnpm start --user-data-dir=<dir>`；无管理员权限时改用
   `apps/desktop/test/fixtures/stub-ca-app.js`（仅替换 CA 信任检查，其余实现真实）。
步骤：
1. 启动应用 → 状态条「未登录」、开桥开关禁用（TC-D02 的前提）；
2. 点「安装本机 CA」→ 先出现风险提示模态（NFR-005）；确认后输入管理员密码完成安装，再用
   `security find-certificate -a -c mitmproxy /Library/Keychains/System.keychain | wc -c` 与
   `security verify-cert -c <confdir>/mitmproxy-ca-cert.pem -p ssl` 核对（TC-E01）；随后点「卸载本机 CA」核对回到 0（TC-E02）；
3. 点「登录 WebVPN」→ 在登录窗完成认证 → 状态条「已登录」（TC-D01）；
4. 点开桥开关 → 终端出现 `swufe-ready`，`networksetup -getwebproxy Wi-Fi` 与 `-getsecurewebproxy Wi-Fi` 变
   `Enabled: Yes / Server: 127.0.0.1 / Port: 8080`（TC-C02）；
5. `curl -sS -x http://127.0.0.1:8080 --cacert <confdir>/mitmproxy-ca-cert.pem https://jwxt.swufe.edu.cn/` → 得到上游响应，
   终端出现 `swufe-debug`（`rewritten=true`）；
6. 关桥 → 代理回到 `Enabled: No`（TC-C03）；再开桥后直接退出应用 → 同样回到 `Enabled: No`（TC-C04）；
7. 桥运行中把假上游切到过期模式（`curl 'http://127.0.0.1:19080/__mode?expired=1'`）→ 30 秒内出现
   「过期处理中」+ 模态 + 代理清空（TC-D03）；点 [去登录] 重登后回到「已登录」；
8. 先 `networksetup -setwebproxy Wi-Fi 127.0.0.1 7890 && networksetup -setwebproxystate Wi-Fi on` 再开桥 →
   模态拒绝且代理未被改动（TC-C01），随后 `-setwebproxystate Wi-Fi off` 复原；
9. 整个登录过程中终端不应出现 host 为 `webvpn.swufe.edu.cn`/`authserver.swufe.edu.cn` 的 `swufe-debug` 行（TC-D04）。
预期结果：以上 9 步均符合描述；TC-E01/TC-E02 需管理员密码，未执行时应记录为未验证而非通过。
实际结果：M2 已执行第 1、2（仅风险提示部分）、3、4（以 CA 前置被替换的入口）、5、6、7、8、9 步并通过；
   使用真实入口时第 2 步的信任库写入及其后的链路需管理员密码，本次未执行。
```

M3 体验打磨手工验证（TC-B05 / TC-H02 / TC-F04 / TC-G04 / TC-H01 / NFR-005）。

```text
前置条件：
1. macOS 测试机（本机）；`bridges/python` 已 `uv sync` 与仓库根 `pnpm install`；
2. 隔离 userData：`--user-data-dir=/tmp/m3-e2e`；
3. 以 `--remote-debugging-port=9222` 启动真实应用，用 CDP 在真实渲染层上执行点击/输入（等同手工操作）；
4. 未登录、未安装 CA，因此**不开桥**：本组验证界面、IPC、持久化与编排的互斥/冲突路径；
   真实进程捕获（只有所选应用经桥）需登录 + CA + 系统扩展授权，见「未验证 / 无法验证项」。

步骤与结果：
1. 启动后状态条「未登录」、捕获方式默认「系统代理（全部流量）」、候选应用 363 行且一个应用一行
   （Chrome 主进程与其 Helper 归并为 pattern `/Applications/Google Chrome.app/`）。
   Observed：符合；`listCaptureCandidates()` 无重复 pattern。
2. Allowlist：输入 `portal.swufe.edu.cn` 点「添加」⇒ 列表出现该主机、提示「已添加 …」；输入 `http://x/` ⇒
   提示「主机名不合法：http://x/（包含非法字符）」且列表不变；点「删除」⇒ 该主机消失；勾选 `*.swufe.edu.cn` ⇒ 勾选生效。
   Observed：符合。
3. 捕获应用：筛选框输入 `google chrome` ⇒ 列表只留匹配行；勾选 `Google Chrome` ⇒ 勾选生效并落盘；
   切到「指定应用」⇒ 状态行「进程捕获：启用中…」、`#proxy-state` 变为「系统代理：未由本 App 设置（捕获方式：指定应用）」；
   `networksetup -getwebproxy Wi-Fi` 仍为 `Enabled: No`。
   Observed：符合（未开桥，故本 App 未设置系统代理）。
4. 重启应用（关闭后重新 `pnpm start`）⇒ allowlist（含通配勾选）、捕获方式「指定应用」、已勾选的应用全部保留
   （`/tmp/m3-e2e/config.json`：`includeSwufeWildcard: true`、`captureMode: "selected-apps"`、
   `captureProcesses: ["/Applications/Google Chrome.app/"]`）。
   Observed：符合（TC-B05 / TC-H02）。
5. 日志面板：开「调试日志」⇒ 面板出现，表头「时间 | 域名 | 结果」，无记录；关开关 ⇒ 面板隐藏且记录清空。
   Observed：符合。
6. 捕获态：以真实推流（`onStatus`）把 `localCaptureEnabled` 置真 ⇒ 状态条「桥接中（进程捕获）」、状态行
   「进程捕获：已启用（1 个应用）」；再推 `captureError` ⇒ 状态行「进程捕获：启用失败 — macOS 系统扩展未授权」、
   引导文案与「重试」出现、状态条回到「桥接中」（桥状态不变）。
   Observed：符合（TC-H01 捕获态 / NFR-005 引导）。
7. 日志最小化：以真实推流发送携带额外字段（`cookie` / `body`）的 debug 事件 ⇒ 界面只渲染
   时间/域名/结果三列，额外字段不出现；累积 205 条后保留最近 200 条且最新在前；点「清空」⇒ 0 行。
   Observed：符合（TC-F04 / AC-009 的面板与最小化部分）。
8. 冲突路径（EC-009）：先把 Wi-Fi web 代理设为 `127.0.0.1:7890` 并启用，再在界面切到「指定应用」⇒
   提示「检测到系统代理已启用。请先关闭 Clash / mihomo / 其它 VPN 的系统代理后再试。」+ 弹出冲突模态 +
   单选回落到已保存的捕获方式；`config.json` 的 `captureMode` 未被改写。随后复原为 `Enabled: No / 127.0.0.1:8080`
   （`scutil --proxy`：`HTTPEnable 0`、`HTTPSEnable 0`）。
   Observed：符合（TC-G04 的冲突边界）。
9. 退出：关闭应用后无 `swufe_bridge` 进程残留、`networksetup -getwebproxy Wi-Fi` 为 `Enabled: No`（NFR-004 未回归）。
   Observed：符合。

实际结果：以上 9 步全部通过。
```

> 无手工验证时写 `不适用` 并说明理由。

### M4 双平台验收执行手册（交互式）

> 本小节是 M4 的执行协议（T043）：每一步给出**执行者**、**命令/动作**、**期望**与**证据落点**，
> 结果边执行边填入下方「M4 结果表」。macOS 侧本轮全量执行；**Windows 侧已于 2026-09-23 执行**，结果与 Windows 专用命令（`--scheme http`、`certutil`/`reg` 核对、管理员启动）见「M4 Windows 验收执行记录（2026-09-23）」。
> 角色分工：**cherrchen** 负责所有需要人的动作（管理员密码、CAS/MFA 登录、系统扩展授权、门户登出）；
> **执行者**负责启动真实应用、用 CDP 驱动界面与浏览器、采集全部证据。

```text
前置条件：
1. macOS 测试机（本机）；`bridges/python` 已 `uv sync`，仓库根已 `pnpm install`（见 docs/operations/development-run.md）；
2. 隔离 profile：`--user-data-dir=/tmp/m4-acceptance`；证据目录：`/tmp/m4-acceptance/evidence/`；
3. 测试者自有西财账号可用（含 MFA；账号与密码不入库、不写入任何文件）；
4. 启动时 `SWUFE_PROBE_INTERVAL_MS=8000`（缩短会话过期级联的观察窗口）；
5. 证据采集命令统一为：
   pnpm run acceptance:check --out /tmp/m4-acceptance/evidence --user-data-dir /tmp/m4-acceptance
6. 入库红线：真实 Cookie 值、响应头、教务页面正文与截图只留在 /tmp/m4-acceptance/；
   入库的只有脱敏报告、状态行、域名/布尔/计数与 URL。
```

| 步骤 | TC | 执行者 | 动作 / 命令 | 期望 | 证据落点 |
| ---- | -- | ------ | ----------- | ---- | -------- |
| 2.1 | — | 执行者 | `hub start name=m4-app application=pnpm args=["start","--user-data-dir=/tmp/m4-acceptance","--remote-debugging-port=9222"] env={"SWUFE_PROBE_INTERVAL_MS":"8000"}`；再用 `browser.open({app:{cdp_url:'http://127.0.0.1:9222'}})` 附着 | 主窗口出现，CDP 可附着；`getStatus().state === 'idle'` | 启动快照报告（步骤 2.1 的 `pnpm run acceptance:check` 输出） |
| 2.1b | — | 执行者 | `pnpm run acceptance:check --out /tmp/m4-acceptance/evidence --user-data-dir /tmp/m4-acceptance` | 生成 `acceptance-darwin-<ts>.md`，无 `FAIL` | 该报告 |
| 2.2 | TC-D02 | 执行者 | 点击 `#bridge-toggle` | `getStatus().error.code === 'NOT_LOGGED_IN'`、`state === 'idle'`、开关回到关 | 状态断言输出 + 报告 `system-proxy` 段（`Enabled: No`） |
| 2.3 | TC-E03 | 执行者 | 登录后、装 CA 前点击 `#bridge-toggle` | `error.code === 'CA_MISSING'`，未发生任何 OS 变更 | 状态断言输出 + 报告 `trust-store: installed: no` |
| 2.4 | TC-E01 | cherrchen | 点击 `#install-ca` → 风险提示模态 → 确认 → 输入管理员密码 | `security find-certificate -a -c mitmproxy /Library/Keychains/System.keychain \| wc -c` > 0；`security verify-cert -c <confdir>/mitmproxy-ca-cert.pem -p ssl` 退出码 0；`getCaStatus() === {installed:true,trusted:true}` | 两条 `security` 命令输出 + 报告 `trust-store` 段 + `#ca-state` 文案 |
| 2.5 | TC-D01 | cherrchen | 点击 `#login-button`，在登录窗完成统一身份认证（含 MFA） | `getSession().loggedIn === true`；`#status-text` 为「已登录」；profile 目录下无任何密码文件 | 状态断言输出 + 步骤 2.1b 重跑报告 + `find /tmp/m4-acceptance -name '*pass*'`（应为空） |
| 2.6 | TC-D04 | 执行者 | 取 `hub logs name=m4-app` 的全部 `swufe-debug` 行；另跑报告中的 `bypass-control` 段 | 登录过程中无 `host` 为 `webvpn.swufe.edu.cn` / `authserver.swufe.edu.cn` 的行；登录后这些主机的请求 `rewritten === false`（`Location` 仍为未包装的 `https://webvpn.swufe.edu.cn/login`） | 日志摘录 + 报告 `bypass-control` 段（响应头已脱敏） |
| 2.7 | TC-C01 | 执行者 | `SVC=$(networksetup -listallnetworkservices \| sed -n '2p')`；`networksetup -setwebproxy "$SVC" 127.0.0.1 7890 && networksetup -setwebproxystate "$SVC" on`；再点击 `#bridge-toggle` | `error.code === 'PROXY_CONFLICT'`、出现冲突模态、`-getwebproxy "$SVC"` 仍为 `Enabled: Yes / 127.0.0.1 / 7890`、无 sidecar 进程 | 冲突前后各一次报告（`system-proxy` 段 + `residue` 段） |
| 2.8 | TC-C02 / TC-F01 | 执行者 | 复原代理（`-setwebproxystate "$SVC" off`）后点击 `#bridge-toggle`；`curl -sS -x http://127.0.0.1:8080 --cacert <confdir>/mitmproxy-ca-cert.pem -D /tmp/m4-acceptance/headers.txt -o /tmp/m4-acceptance/jwxt.html https://jwxt.swufe.edu.cn/` | `state === 'running'` 且 `bridgePort` 有值；每个启用服务为 `Enabled: Yes / 127.0.0.1 / <bridgePort>`；`jwxt.html` 非空、状态 200/302；正文内不出现未改写的绝对 `https://jwxt.swufe.edu.cn/...`（`curl -D` 的 headers 文件不提交） | 报告 `bridge-port: open` + `bridge-smoke` 段；`networksetup` 输出；去掉 Cookie 行后的正文 grep 结果 |
| 2.9 | TC-G01 / TC-G02 | 执行者（cherrchen 提供会话） | 用**系统代理路径**（不设 `--proxy-server`）打开 `https://jwxt.swufe.edu.cn/`，点击 3–5 个一级入口（课程/成绩/选课等） | 每次导航的 `tab.url` host 属于 allowlist；`document.querySelector('#main-frame-error') === null`；登录态保持；无 `host endswith .swufe.edu.cn && rewritten=false` 的 `swufe-debug` 行 | 每次导航的四元组（链接文案 / `tab.url` / `document.title` / 是否出现错误页）与截图（只留在 /tmp）；日志按 host 汇总 |
| 2.10 | TC-F04 | 执行者 | 点击 `#debug-logging` 打开 → 经 Chrome 再访问教务 → 再关闭 | `#log-panel` 可见、表头为「时间/域名/结果」、`#log-rows` 有新增行且只含域名与结果；`swufe-debug` 行仅含 `ts/host/rewritten/direction/detail`；关闭后隐藏且行数归 0 | 前 10 行日志摘录（无正文/Cookie）+ 面板元素计数 |
| 2.11 | TC-D03 | cherrchen | 在门户/登录窗内执行登出；等待 ≤ 8 秒 | `state === 'idle'`、`systemProxyEnabled === false`、`networksetup` 为 `Enabled: No`、无 sidecar 残留、出现 `#session-expired-modal`；点「去登录」重登后回到「已登录」 | 级联前后状态断言 + 报告（`system-proxy` / `residue` 段）+ 实际触发的失效信号（收敛 Q-001） |
| 2.12 | TC-G04 | cherrchen + 执行者 | 切到 `#capture-mode-selected-apps` → 勾选 `Google Chrome` → cherrchen 在系统扩展授权提示内确认（5 秒窗口；超时点 `#capture-retry`） | 正向：Chrome 可打开教务且出现该主机的 `swufe-debug` 行；反向：`curl -m 15 https://jwxt.swufe.edu.cn/` 不经桥（校外直连失败即为符合预期）；收尾切回「系统代理」后 `localCaptureEnabled === false` | 报告 `system-proxy` 段（捕获态下 `Enabled: No`）+ 正向/反向日志 + `#capture-state` 文案 |
| 2.13 | TC-C03 / TC-C04 | 执行者 | 关桥（`#bridge-toggle`）→ 再开桥 → 退出应用（`before-quit` 清理完成后才退出） | 关桥后 `Enabled: No`；退出后 `Enabled: No`、无 sidecar 残留 | 两次报告（`system-proxy` / `residue` 段） |
| 2.14 | TC-E02 | cherrchen | 点击 `#uninstall-ca` → 输入管理员密码 | `security find-certificate -a -c mitmproxy /Library/Keychains/System.keychain \| wc -c` 为 0；`getCaStatus() === {installed:false}`；报告 `trust-store: installed: no` | 命令输出 + 报告 + `#ca-state` 文案 |
| 2.15 | — | 执行者 | 把 `/tmp/m4-acceptance/evidence/acceptance-*.md` 复制到 `specs/001-phase1-local-bridge/evidence/`；入库前再 `grep -i 'set-cookie\|wrdvpn_session\|wrdKey' <file>` 复核 | 入库报告无任何敏感值；结果表逐行填写 | `specs/001-phase1-local-bridge/evidence/` |

> 顺带覆盖（不单独开步）：TC-H01（各状态条文案与状态机一致，含「桥接中（进程捕获）」）、
> TC-H02（`*.swufe.edu.cn` 勾选保存）、TC-B05（allowlist 增删后重启仍在）。
> TC-A01..A05 / TC-B01..B03 由 L0 自动化覆盖，不在本手册内重复执行。

**M4 结果表**

> 执行时间：2026-09-21（macOS 本机，`darwin 24.6.0`）。证据：`evidence/acceptance-macos/`（脱敏快照）与本文件的「M4 执行的命令与结果」。
> 驱动方式：真实应用 + CDP（`--remote-debugging-port=9222`）；浏览器步骤在自动化导航卡死时改为 cherrchen 手工执行（见 TC-G01/G02）。
> 本轮修复的缺陷：`KI-008`（会话探测丢 Cookie）、`KI-009`（登录窗 ERR_ABORTED）、`KI-010`（CA 卸载缺 `-Z`）；未决阻断：`KI-011`。

| TC | 步骤 | 结果 | 证据 |
| -- | ---- | ---- | ---- |
| TC-D02 | 2.2 | Passed | 未登录时开关禁用（`#bridge-toggle.disabled = true`）+ 直接调 `startBridge()` → `error.code = NOT_LOGGED_IN`、未做任何 OS 变更；`evidence/acceptance-macos/acceptance-darwin-20260921-135037.md` |
| TC-E03 | 2.3 | Passed | 登录后开桥 → `CA_MISSING`；快照 `…-140511.md`（`trust-store: installed no`、6 个服务 12 行 `Enabled No`、无 sidecar） |
| TC-E01 | 2.4 | Passed（信任写入用应用自带的手动命令；自动路径失败见 `KI-007`） | `security find-certificate -a -c mitmproxy -Z …` 有输出、`security verify-cert … ; echo $?` = 0、`getCaStatus() = {installed:true,trusted:true}`、快照 `…-141044.md`（`trust-store: installed yes`、`verify-cert exit: 0`） |
| TC-D01 | 2.5 | Passed | `getSession() = {loggedIn:true, expiresAt:"2026-09-28T…"}`、`#status-text` = 「已登录」、`find /tmp/m4-acceptance -iname '*pass*'` 无输出；Cookie 名见 `KI-006` |
| TC-D04 | 2.6 | Passed | 登录期间无 `webvpn.swufe.edu.cn` / `authserver.swufe.edu.cn` 的 `swufe-debug` 行（登录分区 `resolveProxy(...) = DIRECT`）；桥运行期这两个主机均为 `not-allowlisted`（不改写、不二次包装）；快照 `…-150201.md` 的 `bypass-control` 段 |
| TC-C01 | 2.7 | Passed | Wi-Fi 设为 `127.0.0.1:7890` 且启用后开桥 → `PROXY_CONFLICT` + `#proxy-conflict-modal` 打开 + `Enabled: Yes / 127.0.0.1 / 7890` 未被改动 + 无 sidecar；快照 `…-141044.md` |
| TC-C02 | 2.8 | Passed | 桥 `running`、`bridgePort = 8080`；6 个启用服务全部 `Enabled: Yes / 127.0.0.1 / 8080`；快照 `…-150201.md`（`bridge-port: open`、`residue: 1 个 sidecar 进程`） |
| TC-F01 | 2.8 | Passed | 经桥 `http://jwxt.swufe.edu.cn/` → `302 Found`，`Location: http://jwxt.swufe.edu.cn/xtgl/login_slogin.html`（已反向改写为普通主机）；快照 `…-150201.md` 的 `bridge-smoke: 200 OK`；直连对照失败（校外不可达，符合预期） |
| TC-G01 | 2.9 | **Failed** | 根 URL 白屏、真实页不可交互；根因与候选解除路径见 `KI-011` 与下方「M4 教务浏览器验收记录」 |
| TC-G02 | 2.9 | **Failed** | 同上（页面不可交互，无法完成站内导航）。漏改判据的结论仍成立：allowlist 主机 `jwxt.swufe.edu.cn` 的请求行全部 `rewritten=true`，未发现漏改 |
| TC-F04 | 2.10 | Passed | `#log-panel` 可见、表头「时间/域名/结果」、累计 200 条上限且最新在前（例：`jwxt.swufe.edu.cn` → `响应改写（body）`）、仅域名与结果、关闭开关后隐藏且行数归 0、再开可见且 0 行 |
| TC-D03 | 2.11 | Passed | 服务端使 ticket 失效后 ≤8s：`state = error`(`SESSION_EXPIRED`)、`systemProxyEnabled = false`、`networksetup` 全 `Enabled: No`、无 sidecar、`#session-expired-modal` 打开；点「去登录」重登后回到「已登录」。日志原文：`会话探测：status=302 location=https://webvpn.swufe.edu.cn/login → expired` |
| TC-G04 | 2.12 | Passed | 切「指定应用」→ `Enabled: No`（互斥）、`localCaptureEnabled = true`、状态条「桥接中（进程捕获）」；被选中的 Chrome 经桥（`jwxt.swufe.edu.cn rewritten=true` + `response body`），未选中的 `curl` 不经桥（`Could not resolve host`，桥日志无对应行）；切回「系统代理」后 `Enabled: Yes / 127.0.0.1 / 8080`、`localCaptureEnabled = false` |
| TC-C03 | 2.13 | Passed | 关桥后 `state = idle`、6 个服务 `Enabled: No`、`scutil` 0/0、无 sidecar |
| TC-C04 | 2.13 | Passed | 再开桥（`Enabled: Yes`）后在应用内退出（`window.close()`，`before-quit` 清理）→ 全服务 `Enabled: No`、`scutil` 0/0、无 sidecar、Electron 进程退出码 0 |
| TC-E02 | 2.14 | Passed（修复 `KI-010` 后） | UI「本机 CA 已卸载」、`getCaStatus() = {installed:false}`、`security find-certificate -a -c mitmproxy -Z … \| wc -c` = 0；快照 `…-150701.md`（`trust-store: installed no`） |
| TC-H01 | 顺带 | Passed | 状态条覆盖五种状态（未登录 / 已登录 / 桥接中 / 桥接中（进程捕获）/ 错误 / 过期处理中）且均与状态机一致 |
| TC-H02 | 顺带 | Passed | 勾选 `启用 *.swufe.edu.cn` → 重启应用后仍为勾选（`config.json` 的 `includeSwufeWildcard: true`） |
| TC-B05 | 顺带 | Passed | 界面添加 `portal.swufe.edu.cn`（非法值 `http://x/` 被拒且不写入）→ 重启后仍在 → 删除后列表回落，`config.json` 回到默认 |
| TC-G03（Windows） | — | Deferred | `KI-001` |

**M4 教务浏览器验收记录（TC-G01 / TC-G02，M4 时为 `Failed`；已在 M5 修复复验通过——见下节「M5（`KI-011` 修复）执行记录」与 [ADR-0007](../../docs/architecture/adr/ADR-0007-gateway-owned-namespaces-and-native-mode-promotion.md)）**

执行方式：真实 Chrome（系统代理路径，不设 `--proxy-server`），一部分由执行者用 CDP 驱动、关键的页面观察与点击由 cherrchen 手工完成（自动化导航在本环境反复卡死，见下）；桥侧以 `swufe-debug` 行与脱敏快照取证。

实测链路（curl 与 Chrome 内 `fetch` 双向复核，均经桥）：

| 请求 | 结果 |
| ---- | ---- |
| `GET http://jwxt.swufe.edu.cn/`（经桥） | `200`，925 B —— 网关返回的**客户端 shim 页**（含 `__vpn_*` 变量与 `<script src="/wengine-vpn/js/main.js?ver=20211207">`） |
| `GET http://jwxt.swufe.edu.cn/wengine-vpn/js/main.js?ver=20211207`（经桥） | `404`（被加上 token 前缀后按「教务站内路径」取，教务侧 404） |
| `GET https://webvpn.swufe.edu.cn/wengine-vpn/js/main.js?ver=20211207`（网关根，带会话 Cookie） | `200`，376 922 B —— 该资源其实存在于网关根 |
| `GET http://jwxt.swufe.edu.cn/xtgl/index_initMenu.html`（经桥） | `200`，76 854 B，且响应体已被反向改写（`detail: body`；对比门户形态同页 79 734 B） |
| `GET https://webvpn.swufe.edu.cn/https/<token>/`（`www.swufe.edu.cn`，带会话 Cookie） | `200`（证明网关的 https 代理与 token 方案本身可用） |
| `GET https://webvpn.swufe.edu.cn/https/<token>/`（`jwxt.swufe.edu.cn`，带会话 Cookie） | `302 → /wengine-vpn/failed`（网关无法以 https 代理教务；`http` 形态可用） |

浏览器实测（cherrchen）：

1. `http://jwxt.swufe.edu.cn/` → **白屏**：shim 页只含脚本，其 `main.js` 经桥 404，页面不再引导进入教务；
2. `http://jwxt.swufe.edu.cn/xtgl/index_initMenu.html` → **有页面渲染、但不可交互**：未登录、用户状态不正确、点击任何控件无效、且**未出现** CAS 登录页；
3. 桥日志对应关系：`jwxt.swufe.edu.cn` 的请求行**全部** `rewritten=true`（无漏改），随后一批响应为 `no-wrd-match`（网关/教务返回的非 WRD 形态响应），与「脚本依赖 shim → 应用逻辑起不来」的判断一致。

根因：本部署的网关对每个 HTML 响应注入**客户端 shim**，该 shim 期望浏览器工作在 WebVPN URL 空间（`https://webvpn.swufe.edu.cn/<scheme>/<token>/…`），而透明桥让浏览器工作在普通 URL 空间，两者不兼容（详见 `KI-011`：`/wengine-vpn/...` 路径未经 token 直接取网关根、在 HTML 中剥离 shim、或接受教务以门户形态使用，三条候选均改公共契约，需 cherrchen 决策）。

补充观察：`http://jwxt.swufe.edu.cn/` 的 http 形态是教务唯一可经网关代理的形态（`https` 形态网关返回 `/wengine-vpn/failed`），故上述验证全部走 `http`；`--scheme http` 开关即为该事实而加到采集脚本上。



### M5（KI-011 修复）执行记录（2026-09-21）

> 范围：`KI-011` 的修复（网关自有命名空间直通 + bootstrap 文档升级到网关原生 URL 空间，[ADR-0007](../../docs/architecture/adr/ADR-0007-gateway-owned-namespaces-and-native-mode-promotion.md)）及其 macOS 实机复验（TC-G01 / TC-G02 / AC-007）。
> 驱动方式：真实应用（`pnpm start --user-data-dir=/tmp/ki011-gateway --remote-debugging-port=9222`）+ CDP 驱动界面与浏览器（系统代理路径，未设 `--proxy-server`）；cherrchen 负责需要人的动作（CAS/MFA、管理员密码）。
> 前置状态：TUN / 其它系统代理已关闭（`scutil --proxy` 为 `HTTPEnable 0`/`HTTPSEnable 0`，无 Clash/mihomo 进程），`git status --short` 仅含本轮改动。

**Phase 0：判定常数与证据（实现前取证）**

| 输入 | 实测值 | 来源 |
| ---- | ------ | ---- |
| 网关自有根命名空间 | `/wengine-vpn/`、`/authserver/` 未登录也可从网关根取到（`/wengine-vpn/js/js/wechat-font.js` → `200 737B`）；网关根 `/` 与任意 token 路径未登录一律 `302 → /login` | 本轮只读探测 + M4 记录 |
| 客户端 shim 运行时 | `https://webvpn.swufe.edu.cn/wengine-vpn/js/main.js?ver=20211207` → `200 376922B application/javascript` | 本轮只读探测 |
| bootstrap 引导页字节数 B | **925 B**（含 `__vpn_` 与 `/wengine-vpn/js/main.js`） | M4 实测（`KI-011`、上文 M4 记录） |
| 真实站点页字节数 | **76 854 B**（同一注入下） | M4 实测 |
| 判据可分性 | B（925）≤ 8192，真实页（76 854）> 8192 ⇒ 默认谓词「≤ 上限 + 同时含两个标记」可分，**不**需要备用谓词（正文引用谓词） | 由上两行推出 |
| 定常数 | `GATEWAY_BOOTSTRAP_MAX_BYTES = 8192`（B ≤ 8192 成立 ⇒ 取 8192） | [ADR-0007](../../docs/architecture/adr/ADR-0007-gateway-owned-namespaces-and-native-mode-promotion.md) |

**执行与结果**

| 步骤 | 命令 / 动作 | 观察 |
| ---- | ----------- | ---- |
| 1 | 起真实应用（隔离 profile `/tmp/ki011-gateway`），应用内完成 CAS/MFA 登录 | `getSession() = {loggedIn:true, expiresAt:"2026-09-28T07:44:48.776Z"}`；状态条「已登录」 |
| 2 | 安装本机 CA（风险提示模态 → 确认 → 管理员密码；macOS 15.6 的自动路径失败属 `KI-007`） | `security find-certificate -a -c mitmproxy -Z /Library/Keychains/System.keychain` 有 1 条；`security verify-cert -c <confdir>/mitmproxy-ca-cert.pem -p ssl` 退出码 0；`getCaStatus() = {installed:true,trusted:true}` |
| 3 | 开桥（系统代理路径） | `getStatus() = {state:"running", systemProxyEnabled:true, bridgePort:8080}`；6 个网络服务指向 `127.0.0.1:8080`（`acceptance:check` 的 `system-proxy` 段） |
| 4 | 直通对照：`/wengine-vpn/js/main.js` 经桥 | `200 376922` bytes `application/javascript`（`detail=gateway-root`）——修复前为经桥 `404` |
| 5 | 系统 Chrome（系统代理路径）打开入口 `http://jwxt.swufe.edu.cn/` | 302 链（`xtgl/login_slogin.html` → `authserver` CAS）后，桥日志出现 `jwxt.swufe.edu.cn` `direction=response` `detail=**promoted**`；浏览器落到 `https://webvpn.swufe.edu.cn/http/<token>/xtgl/index_initMenu.html?jsdm=xs&…`，标题「教学管理信息服务平台」，菜单与用户信息完整（**TC-G01 通过**） |
| 6 | 站内导航：点「信息查询 → 学生成绩查询」 | 打开 `…/cjcx/cjcx_cxDgXscj.html?gnmkdm=N305005&layout=default`，标题「学生成绩查询」，无 `#main-frame-error`，查询表单 + 5 个表格渲染；页面资产 URL 形如 `/http/<token>/…?vpn-7&ver=…`（网关服务端改写，桥不参与）——**TC-G02 通过** |
| 7 | 普通空间回归：勾选 `*.swufe.edu.cn` → Chrome 打开 `https://www.swufe.edu.cn/` → 点「学校概况」 | 地址栏 `www.swufe.edu.cn` 不变、标题「学校概况-西南财经大学」、无错误页；桥日志 `rewritten=true` + 响应 `no-wrd-match`（该站页面不含 WRD 字面量） |
| 8 | 另一非 jwxt 主机：`https://lib.swufe.edu.cn/` 经桥 | `302 → https://webvpn.swufe.edu.cn/https/<lib-token>/`——该主机入口文档同样是网关 bootstrap 页，按 ADR-0007「同样升级」（预期行为） |
| 9 | 收尾：关通配、关桥、退出应用 | 关桥后所有服务 `Enabled: No`、`scutil` 0/0、无 `swufe_bridge` 残留（NFR-004 未回归） |

**需要 cherrchen 的动作**：应用内 CAS/MFA 一次（登录窗）、CA 安装的管理员密码与（`KI-007` 情况下的）`sudo security add-trusted-cert …` 手动命令、以及浏览器内的 CAS（进入网关原生空间后浏览器需要自己的网关会话——这是 ADR-0007 记录的行为，桥不注入应用内会话）。

**本轮修复**：`KI-011` → `Fixed`（判据常数、修复点与复验方式见 [known-issues.md](known-issues.md)）。
**本轮新增**：`KI-014`（CAS 主题静态资源被服务端截断 → 登录窗样式丢失；规避 = 重载登录窗；与桥无关）。
**副作用与已知残留**：被升级主机的地址栏进入 `https://webvpn.swufe.edu.cn/<scheme>/<token>/…`；网关原生空间下桥的调试日志只能证明「已升级」，不能再逐条证明页面内跳转（由网关服务端改写负责）；`https` scheme token 对教务不可用（入口必须 `http://`，升级目标随之用 `/http/<token>/…`）。
**入库证据**：`evidence/acceptance-macos/acceptance-darwin-20260921-154657.md`（脱敏，`redaction-self-check: PASS`）；`--save-body` 产物与浏览器截图只留在 `/tmp/ki011-evidence/`，不入库。

### `KI-007` 修复复验执行记录（2026-09-21）

> 范围：`KI-007`（CA 自动安装）的修复（[ADR-0008](../../docs/architecture/adr/ADR-0008-ca-trust-authorization-in-app-session.md)）及其 macOS 真机复验（TC-E01 / TC-E02 / REQ-010 / AC-005）。
> 驱动方式：真实应用（`pnpm start --user-data-dir=/tmp/ki007-e2e/userdata --remote-debugging-port=9222`，经 hub 常驻）+ CDP 驱动界面；cherrchen 负责需要人的动作（系统管理员授权窗口）。
> 前置状态：TUN / 其它系统代理未启用；`git status --short` 只有本轮改动；基线 `security dump-trust-settings -d` 无本机 CA 条目（既有条目 `MicrodoneCA` 与本项目无关），系统钥匙串无 `mitmproxy` 证书。

**Phase 0：机制取证（终端，登录用户，无 sudo）**

| 输入 | 实测 | 结论 |
| ---- | ---- | ---- |
| `security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain <caCert>` | 退出码 1，`SecCertificateAddToKeychain: Write permissions error.`，无弹窗；钥匙串与信任设置均未变 | 写系统钥匙串必须 root（非 root 不会弹授权窗口） |
| `security add-certificates -k <登录钥匙串> <caCert>`（连续两次） | 首次成功；再次 `security: … already in <keychain>`，退出码 1 | 重复导入的失败形态 → 安装步骤 1 的容错判据 |
| `security add-trusted-cert -d -r trustRoot <caCert>`（**不带** `-k`） | 退出码 0；`SecurityAgent` 弹出 `SFAuthenticationWindow`（16:49:43 置前、16:49:48 关闭），`authorizationhost` 记录 `Verify basic credentials`；随后 `security trust-settings-export -d` 含该 CA 的 SHA-1 与新 `modDate` | 信任设置写入由系统授权窗口承担；不带 `-k` 时不动钥匙串（`trusted_cert_add` 仅在给了 `-k` 时调用 `SecCertificateAddToKeychain`） |
| 端到端信任：以该 CA 签发叶证书 + `openssl s_server`，`/usr/bin/curl`（SecureTransport） | `http=200`、退出码 0；`security verify-cert -c <caCert> -p ssl` 退出码 0 | 管理域信任真实生效（不是工具输出误读） |
| `security remove-trusted-cert -d <caCert>` / `security trust-settings-import -d <plist>`（普通用户） | 均阻塞：15s / 70s 无输出、无效果 | 管理域信任项无法由普通用户进程清除 |
| `security trust-settings-import -d <plist>`（osascript 提权 = root） | `SecTrustSettingsImportExternalRepresentation: The authorization was denied since no user interaction was possible. (1)` | 与 `KI-007` 同源：提权子进程不在 GUI 会话内 |

**执行与结果（应用内，CDP 驱动）**

| 步骤 | 命令 / 动作 | 观察 |
| ---- | ----------- | ---- |
| 1 | 起应用（隔离 profile `/tmp/ki007-e2e/userdata`） | 基线：`#ca-state` = 「未安装」、`#message` 为空、`getCaStatus() = {installed:false,trusted:false}`、`security find-certificate -a -c mitmproxy -Z /Library/Keychains/System.keychain \| wc -c` = 0 |
| 2 | 点 `#install-ca` → 风险模态（NFR-005）→ 确认 → 在系统管理员授权窗口输入密码（cherrchen） | `#message` = 「本机 CA 已安装并被系统信任。」；`#ca-state` = 「已安装并被系统信任」；`getCaStatus() = {installed:true,trusted:true}`；`security find-certificate -a -c mitmproxy -Z /Library/Keychains/System.keychain` → `SHA-1 hash: 474FA302A4B3C18DE314C873E5B75FAAB493D2AD`；`security trust-settings-export -d` 含 `474FA302…`；`security verify-cert -c <confdir>/mitmproxy-ca-cert.pem -p ssl` 退出码 0；以该 CA 签发叶证书 `curl` → `http=200`；`#message` 不含 `sudo`，全程未开终端 |
| 3 | 证书已在钥匙串时再次点安装（幂等） | 仍返回成功（`add-certificates` 的 `already in` 容错分支生效），`#message`、`#ca-state` 同上 |
| 4 | 点 `#uninstall-ca` → 授权窗口 | `#message` = 「本机 CA 已卸载。」；`#ca-state` = 「未安装」；`security find-certificate … \| wc -c` = 0；`getCaStatus() = {installed:false,trusted:true}`（`trusted` 仍为 `true` 属 `KI-010` 记录的信任项残留，UI/门禁以钥匙串成员资格判定） |
| 5 | 未装 CA 时开桥（TC-E03 门禁） | 未构造出端到端复现：本轮未登录，开桥前置校验先返回 `NOT_LOGGED_IN`（顺序见 `apps/desktop/src/main/orchestrator.ts`）；`getCaStatus() = {installed:false,…}` 即该门禁的输入，且门禁自 M4 起未改动 |

**Phase 2（取消路径）：未验证。** 三次尝试（应用内两次、终端 `osascript` 一次）均未取到「用户取消」样本——应用内的两次系统授权被满足、安装正常完成（其中一次在凭据缓存有效期内未弹窗），终端那次 `osascript` 授权窗口到本轮记录时仍在等待人工操作（进程已停止）。按计划口径记为未验证、不计入通过。取消分支的代码路径为 `runPrivilegedDarwin()` 把 osascript 的 `User canceled` 归一为 `已取消授权`，再由 `describeFailure()` 归入「已取消系统授权，未做任何更改。」（该正则取自 M2 起的既有实现，本轮未取得实机样本）。

**本轮修复**：`KI-007` → `Fixed`（安装改为「提权写系统钥匙串 + 应用进程写管理域信任设置」，见 [ADR-0008](../../docs/architecture/adr/ADR-0008-ca-trust-authorization-in-app-session.md)）；T023、T030 勾选。
**需要 cherrchen 的动作**：系统管理员授权窗口输入密码（步骤 2、4），以及一次未完成的「取消」操作（Phase 2）。
**已知残留**：管理域信任项在卸载后无法经 CLI 清除（`KI-010` 已记录）；安装是否弹窗取决于凭据缓存（同一会话内 `system.privilege.admin` 的 `timeout = 300` 内重复操作复用缓存凭据），见 ADR-0008 的 Consequences。

### `KI-013` 修复执行记录（2026-09-21）

> 范围：`KI-013`（Clash / mihomo 的 TUN + fake-ip DNS 让经桥上游挂起）——开桥前 fake-ip 预检（[ADR-0011](../../docs/architecture/adr/ADR-0011-refuse-start-on-fake-ip-dns.md)），及其对 REQ-004 / TC-C01 的扩展。
> 驱动方式：Electron-free 单测（`apps/desktop/test/`）+ 真机 smoke（真实 DNS、真实 `AppStore`，仅解析器为注入桩）；全程无需人工动作，未改动本机系统设置。

| 步骤 | 命令 / 动作 | 结果 |
| ---- | ---------- | ---- |
| 1 | `pnpm --filter swufe-webvpn-bridge run test:unit` | `76 passed`（新增 5 例：`fake-ip.test.ts` 判据边界 2 例 + `orchestrator.test.ts` 3 例） |
| 2 | 真机 smoke：真实解析 `webvpn.swufe.edu.cn`（`202.115.115.140`）后开桥 | 开桥正常（`state = running`）——真实环境无误报 |
| 3 | 真机 smoke：注入解析结果 `198.18.0.12` 后开桥 | `error.code = PROXY_CONFLICT`、`message` = 新文案；OS 调用仅 `["proxy.read","proxy.read","proxy.read"]`、`sidecars = 0`（未触碰系统代理、未启动桥） |
| 4 | 顺序判据：注入 fake-ip 且端口被占用（`portProbe = false`） | 仍返回 `PROXY_CONFLICT`（预检位于端口探测之前）；`orchestrator.test.ts` 同断言 |
| 5 | 解析失败（`getaddrinfo ENOTFOUND`） | 开桥照常 `running`（fail open，不阻断合法环境） |
| 6 | `pnpm run docs:check` / `pnpm run typecheck` | `0 error(s), 0 warning(s)`（178 文件；links / i18n / spec）/ 无 error |

**本轮修复**：`KI-013` → `Fixed`（用户可见行为 = 环境冲突在开桥前被拒绝，给出「关闭系统代理与 TUN 模式」的可执行文案，而不再是开桥后的静默挂起）；任务 T049 勾选；错误码集合不变（仍为 6 个，复用 `PROXY_CONFLICT`）。
**残留（已写入 `KI-013`）**：预检只覆盖 fake-ip 形态；`redir-host` 模式的 TUN 仍可能挂起，继续依赖 [development-run.md](../../docs/operations/development-run.md) §1 的前置条件。
**未做**：真实开启 Clash TUN 的复现样本（需 cherrchen 侧的网络环境介入）；判据与拒绝路径由单测覆盖，真机侧只验证了「不误报」方向。

## M4 Windows 验收执行记录（2026-09-23）

> 范围：M4 的 **Windows 侧全部真机项**（`KI-001` 的解除），按「M4 双平台验收执行手册」在 Windows 上执行；TC-G03 是本轮唯一需要 Windows 真机的 P0 教务用例。
> 执行环境：Windows 11 24H2（`win32 10.0.26200`、x64、中文界面）、Node v24.14.0、`uv` 0.11.17、Python 3.13.11、真实西财账号（CAS/MFA）、真实 Chrome 与 Windows 自带 curl（Schannel）。
> 驱动方式：真实应用 + CDP（`pnpm start --user-data-dir=C:/Users/chenj/AppData/Local/Temp/m4-win --remote-debugging-port=9222`，`SWUFE_PROBE_INTERVAL_MS=8000`）；界面动作经 CDP 驱动渲染层（等同手工操作），浏览器内观察与登录由 cherrchen 完成；TC-G04 需应用以管理员身份启动（UAC，pydivert）。
> 验收前置：开始时本机 mihomo 的 TUN 处于开启（`webvpn.swufe.edu.cn → 198.18.0.53`，即 `KI-013` 的 fake-ip 段），按前置条件由 cherrchen 关闭后再执行；证据命令统一为 `pnpm run acceptance:check --out <dir> --user-data-dir <dir> --scheme http`（教务经网关只能走 `http` 形态）。

### Windows 结果表

| TC | 结果 | 证据 |
| -- | ---- | ---- |
| TC-D02 | Passed | 未登录时桥开关为禁用态；直接调 `startBridge()` → `error.code = NOT_LOGGED_IN`；注册表 `ProxyEnable=0x0` 未被改动、无 `python.exe` 残留 |
| TC-D01 | Passed（cherrchen 完成 CAS/MFA） | `getSession() = {loggedIn:true, expiresAt:"2026-09-30T…"}`、状态条「已登录」；登录前先制造过 `NOT_LOGGED_IN` 陈旧错误，登录后状态回到 `idle`、错误消失（`KI-015` 修复的判据） |
| TC-D04 | Passed | 应用日志 `swufe-session 登录窗口 resolveProxy(https://webvpn.swufe.edu.cn) = DIRECT`；登录期间无 webvpn/authserver 的 `swufe-debug` 行；桥运行期这两个主机均为 `not-allowlisted` |
| TC-E03 | Passed | 登录后、未装 CA 时 `startBridge()` → `CA_MISSING`，`getCaStatus() = {installed:false,trusted:false}`，注册表与进程栈无变化 |
| TC-E01 | Passed（`KI-016`/`KI-017` 修复后） | 风险模态文案与设计一致 → 确认后 2.7s 成功、UI「已安装并被系统信任」、`getCaStatus() = {installed:true,trusted:true}`；独立核对：`HKCU\Software\Microsoft\SystemCertificates\Root\Certificates` 恰含该 CA 指纹键、`certutil -user -store Root` 仅此一条 |
| TC-E02 | Passed | 点「卸载本机 CA」→ UI「本机 CA 已卸载。」、`{installed:false,trusted:false}`；独立核对：用户根存储证书键数 0、`certutil -user -store Root` 返回「找不到对象」 |
| TC-C01 | Passed | 先把注册表置为 `ProxyEnable=0x1 / ProxyServer=127.0.0.1:7890` → 点开桥开关 → `PROXY_CONFLICT` + 冲突模态 + 开关回落；注册表未被改动；无 sidecar |
| TC-C02 | Passed | 复原后开桥 → `state=running`、`bridgePort=8080`、`systemProxyEnabled=true`、状态条「桥接中」；注册表 `ProxyEnable=0x1 / ProxyServer=127.0.0.1:8080` |
| TC-F01 | Passed | 经桥 `http://jwxt.swufe.edu.cn/` → `302 Found`、`Location: https://webvpn.swufe.edu.cn/http/77726476706e69737468656265737421fae0598869237f45780dc7a99c406d361f/`（升级到网关原生空间，[ADR-0007](../../docs/architecture/adr/ADR-0007-gateway-owned-namespaces-and-native-mode-promotion.md)）；`/xtgl/index_initMenu.html` 经桥 `200`（0.72s，响应体被反向改写） |
| TC-F04 | Passed | 日志窗（二级窗口）表头「时间/域名/结果」，真实流量行如 `jwxt.swufe.edu.cn 响应改写（promoted）`、`响应改写（body）`、`www.swufe.edu.cn 直连（not-allowlisted）`；`getDebugLogs()` 上限 200、最新在前、键集合恒为 `ts/host/rewritten/direction/detail` |
| TC-G03 | Passed（cherrchen 手工确认） | 真实 Chrome（系统代理路径、未设 `--proxy-server`）打开 `http://jwxt.swufe.edu.cn/`：入口被升级到网关原生 URL，桥日志出现 `jwxt.swufe.edu.cn` `response rewritten=true detail=promoted`，cherrchen 确认页面可打开并可操作（首次导航遇 `KI-019` 的偶发挂起，重开后正常）。**注**：Chrome 的 https 自动升级会让入口先变成 `https://jwxt.swufe.edu.cn/`（该网关不支持以 https 代理教务，返回 `/wengine-vpn/failed`），验收时用 `--disable-features=HttpsUpgrades` 或关闭「始终使用安全连接」 |
| TC-G04 | Passed（应用以管理员启动） | 「指定应用 = `chrome.exe`」下：`localCaptureEnabled=true`、`systemProxyEnabled=false`（互斥：注册表 `ProxyEnable=0x0`）、无捕获错误、状态条「桥接中（进程捕获）」、状态行「进程捕获：已启用（1 个应用）」；正向：被选中的 Chrome 请求出现在桥日志（`example.com rewritten=true` 及 Chrome 自身 telemetry 行）；反向：未选中的 `curl` 直连成功（`http=200`）且桥日志无对应行；切回「系统代理」→ `localCaptureEnabled=false`、`systemProxyEnabled=true` |
| TC-C03 | Passed | 关桥 → `state=idle`、`systemProxyEnabled=false`、注册表 `ProxyEnable=0x0`、无 sidecar |
| TC-C04 | Passed | 再开桥（`ProxyEnable=0x1`）后在应用内 `window.close()` 退出 → 进程退出码 0、注册表 `ProxyEnable=0x0`、无 `python.exe`/`electron.exe` 残留、`systemProxyManagedByApp=false` |
| TC-D03 | Passed | 用应用自身会话对门户执行 `GET /logout`（服务端使 ticket 失效）：15:19:47 触发 → 15:19:56（一个 8s 探测周期内）→ `state=error`(`SESSION_EXPIRED`)、`systemProxyEnabled=false`、注册表 `ProxyEnable=0x0`、无 sidecar、模态「会话已过期…取消/去登录」、状态条「过期处理中」；重登后回到「已登录」 |
| TC-H01 | Passed | 状态条在 Windows 覆盖「未登录 / 已登录 / 桥接中 / 桥接中（进程捕获）/ 错误 / 过期处理中」六种呈现且与状态机一致 |
| TC-H02 | Passed | 勾选 `启用 *.swufe.edu.cn` 后 `config.json` 的 `includeSwufeWildcard=true`；重启应用后仍为勾选（主窗口摘要「2 个主机（含 *.swufe.edu.cn）」） |
| TC-B05 | Passed | Allowlist 窗口：输入 `http://x/` → 「主机名不合法：http://x/」且不写入；添加 `portal.swufe.edu.cn` → 「已添加 portal.swufe.edu.cn。」+ 主窗口摘要实时更新；重启应用后仍在（`config.json` `hosts=[jwxt,portal]`） |

### Windows 侧逐条覆盖（REQ / NFR / AC）

| 项 | Windows 结果 |
| -- | ------------ |
| REQ-001 | Passed（TC-H01：六种状态条呈现与状态机一致） |
| REQ-002 | Passed（TC-D01 真实 CAS/MFA 登录、TC-D02 未登录拒绝、TC-D03 服务端失效后 ≤8s 级联） |
| REQ-003 | Passed（TC-C02/C03/C04 注册表三态 + TC-G04 真实捕获范围与停止） |
| REQ-004 | Passed（TC-C01：外部系统代理启用时以 `PROXY_CONFLICT` 拒绝且注册表未变；fake-ip 预检的真机命中见下方「验收前置」） |
| REQ-005 | Passed（TC-B05 / TC-H02 与重启持久化） |
| REQ-006 | Passed（L0/L1/L2 全绿：`198 passed`） |
| REQ-007 | Passed（TC-F01 的 `Location` 反向改写与 TC-G03 的 `promoted` 升级均在 Windows 实测） |
| REQ-008 | Passed（TC-D04；桥运行期 authserver/webvpn 均为 `not-allowlisted`） |
| REQ-009 | Passed（TC-F04 日志窗 + TC-H01） |
| REQ-010 | Passed（TC-E01/E02/E03 的 Windows 自动路径：`certutil -user` 无需管理员授权） |
| REQ-011 | Passed（TC-G03 在 Windows 真机通过） |
| NFR-003 | Passed（Windows 无 POSIX 模式位语义，会话文件/CA 私钥落在 `%APPDATA%` 每用户 profile；报告 `redaction-self-check` 通过、全程无密码文件） |
| NFR-004 | Passed（关桥 / 退出 / 会话失效三条路径均 `ProxyEnable=0x0` 且无残留进程；本轮同时修掉 `KI-018`——修复前该清理在 Windows 上根本不生效） |
| NFR-005 | Passed（安装 CA 的风险模态文案在 Windows 一致） |
| NFR-006 | Passed（Windows 侧 C02..C04/E01/E02/G04 与 TC-G03 全部通过） |
| NFR-007 | Passed（Windows 上四窗口文案均为中文，含模态与错误文案） |
| AC-001 | Passed（Windows：真实应用可启动、界面可交互、四窗口结构正常、单实例锁生效） |
| AC-002 | Passed（`loggedIn=true`、`expiresAt` 有值、无密码文件） |
| AC-003 | Passed（TC-C01） |
| AC-004 | Passed（TC-C02/C03/C04 + TC-G04） |
| AC-005 | Passed（TC-E01/E02 在当前用户根存储生效） |
| AC-006 | Passed（TC-B05 / TC-H02） |
| AC-007 | Passed（TC-G03：入口升级到网关原生 URL 后页面可打开并可操作） |
| AC-008 | Passed（TC-D03） |
| AC-009 | Passed（TC-F04） |
| AC-010 | Passed（TC-D04） |

### 执行的命令与结果（Windows，2026-09-23）

| 命令 | 结果 | 备注 |
| ---- | ---- | ---- |
| `uv sync --directory bridges/python` | 通过 | 生成 `bridges/python/.venv`（与本文件 M5 记录的 macOS 侧同一 lock） |
| `uv run --directory bridges/python pytest -q` | `198 passed`（L0 97 + L1 93 + L2 8，0 skipped） | 修 3 个平台性失败 + 1 个被静默跳过的安全用例后（`KI-020`）；L2 为真 mitmdump + Windows 自带 curl |
| `pnpm --filter swufe-webvpn-bridge run test:unit` | `108 passed` | 含本轮新增 `exec.test.ts` 3 例与 orchestrator 2 例 |
| `pnpm run typecheck` / `pnpm --filter swufe-webvpn-bridge run typecheck` | 无 error | 全项目 tsc |
| `pnpm run docs:check` | 0 error / 0 warning | links 190 / i18n 122 / spec 2 |
| `pnpm run acceptance:check --scheme http` | `bridge-smoke PASS 302 Found`、`trust-store installed: yes`、`bridge-port open`、`redaction-self-check PASS`、无 `FAIL` | 桥运行 + CA 已装时的终态报告 `evidence/acceptance-windows/acceptance-win32-20260923-154415.md`；同目录另归档初始态、运行态与 `KI-019` 命中样本（`bridge-smoke curl 退出码 28`） |

**验收前置（fake-ip 预检在 Windows 侧实际命中）**：本轮开始时本机 mihomo TUN 处于开启，`webvpn.swufe.edu.cn` 解析为 `198.18.0.53`（`198.18.0.0/15`），按 `KI-013` / [ADR-0011](../../docs/architecture/adr/ADR-0011-refuse-start-on-fake-ip-dns.md) 的口径由 cherrchen 关闭 TUN 后才开始执行；预检本身的判据与拒绝路径由 `apps/desktop/test/fake-ip.test.ts` / `orchestrator.test.ts` 与 macOS smoke 覆盖。

**本轮修复**：`KI-015`（登录后残留 `NOT_LOGGED_IN`）、`KI-016`（中文 Windows 下 certutil 检测失效 → CA 状态误判）、`KI-017`（`execFile` 的 stdin 管道使 certutil 挂起至超时）、`KI-018`（`reg query` 的 CRLF 使代理读写失效：漏报 `PROXY_CONFLICT` + 关桥不清代理）、`KI-020`（测试与证据工具的平台假设）；`KI-001` 置 `Fixed`。详见 [known-issues.md](known-issues.md)。

**当轮接受 / 未决（后续复核见下节）**：`KI-019`（经桥访问教务偶发挂起 12–45s：本轮 6 次自动化 smoke 中 3 次命中；桥侧已记录请求但响应未到，判定为上游侧，重载即恢复）——**2026-09-23 决策（cherrchen）：接受**，登记为 `Accepted`，解除条件（稳定环境复测并区分网关与网络路径）保留；仍未决：`KI-014`（CAS 主题资源被服务端截断，Windows 同样以重载规避；保持 `Open` 待决策）；不在验收路径：`KI-012`（`www.swufe.edu.cn` 经桥无响应在 Windows 复现）、`KI-006`（Q-001 的另两个失效信号）。

**证据落点**：`specs/001-phase1-local-bridge/evidence/acceptance-windows/`（4 份脱敏报告；真实 Cookie、教务页面正文与截图留在临时 profile，未入库）。

## KI-014 / KI-019 同日复核（2026-09-23）

> 目的：核对 Windows 验收后两个问题的归因，不改变历史验收结果。所有请求只记录状态、长度与耗时；Cookie、WRD token、正文未写入仓库。

- 环境：Windows 11 24H2；本机 TUN 仍开启，`webvpn.swufe.edu.cn` 与 `authserver.swufe.edu.cn` 分别解析到 `198.18.0.47` / `198.18.0.46`，默认路由指向 Meta Tunnel。固定真实 IP 分别为 `202.115.115.140` / `202.115.112.134`，部分请求绑定 Wi-Fi 源地址；绑定源地址不构成完全绕过 TUN 的证明。
- `KI-014`：以 Python 标准库 TLS/HTTP 请求 CAS `bootstrap.min.css`，真实 IP、fake-ip、真实 IP + Wi-Fi 源地址各 6 次，共 18 次均 `200`、`Content-Length=121048`、实收 121048 B（约 0.43–0.53s）。本轮未复现截断；2026-09-21 macOS 不经应用/桥的 `curl` 11 次中 3 次截断及 CDP 的 `ERR_INCOMPLETE_CHUNKED_ENCODING` 仍证明故障不依赖本产品。不能仅据此锁定 Tengine，故按外部传输风险接受并保留重载规避，`KI-014` → `Accepted`。
- `KI-019`：应用内重新完成 CAS/MFA 后，以相同 Cookie 和相同教务 WRD 路径对照。固定真实 IP、Wi-Fi 源地址的诊断桥 14 次；默认路由诊断桥 22 次；同路径直连及 20s 间隔、8 轮并发门户探测均快速返回教务 `302`，桥请求约 0.19–0.51s。诊断钩子在已观测请求中看到 `server_connect` → `server_connected` → `responseheaders`，无连接或流错误。历史验收的 3/6 次零字节超时未复现，无法定位当时停在本机 TUN/mitmproxy、传输网络还是网关；旧日志只证明请求改写钩子运行，旧直连对照访问的是不同路径。因此撤回「已证明上游成因」的归因，将 `KI-019` 从 `Accepted` 重开为 `Open`。
- 收尾：两个仅监听回环的诊断桥已停止，临时会话配置已删除；未改系统代理或 TUN 设置。下次发生挂起时需在同一轮记录连接阶段与同路径直连结果，方能满足本轮的非本地原因判定。

## KI-019 有界化与阶段证据（2026-09-23）

> 目的：把「可能无限挂起」变成「有界失败 + 一次自动重试」，并让上游各阶段（解析/TCP/TLS/首字节）的耗时与对端地址可采集；随后才能在现场用「同轮直连对照 + 阶段记录」区分本地与外部。本节只记录**已执行**的内容；现场复测未执行，故 `KI-019` 保持 `Open`。

**改动**：`bridges/python/swufe_bridge/upstream.py`（新增：网关主机建连 4s × 2 次尝试、`swufe-upstream` 记录与 `bridge-upstream.log` sink）、`sidecar.py`（在 `mitmdump()` 前安装上限）、`addon.py`（`server_connect` / `server_connected` / `server_connect_error` / `tls_*_server` / `responseheaders` / `error` 六个上游钩子、策略主机下发、`swufe-ready` 三键）、`scripts/diagnose-upstream.ts`（现场逐轮判定工具）、`scripts/acceptance-collect.ts`（`bridge-smoke` 遇到 502 记 `FAIL` 而不是 `PASS`）、根 `tsconfig.json`（`lib` 由 `ES2023` 提升到 `ES2024`，为 Node 24 的 `Promise.withResolvers`）。

| 命令 / 场景 | 结果 |
| ---- | ---- |
| `uv run --directory bridges/python pytest -q` | `217 passed`（L0 103 + L1 103 + L2 11；新增 6 + 10 + 3 例） |
| `pnpm --filter swufe-webvpn-bridge run test:unit` | `108 passed`（未受影响） |
| `pnpm run typecheck` | 无 error（含新脚本） |
| `pnpm run docs:check` | 0 error / 0 warning |
| L2：不可达上游（RFC 5737 `192.0.2.1`）经桥 `curl`（`tests/l2/test_upstream_stall.py::test_an_unreachable_gateway_gives_the_client_a_bounded_failure`） | `exit 0`、`HTTP/1.1 502 Bad Gateway`、用时 **8.1s**（≤ 2×4s+4s）；阶段记录 `connect_timeout`(4013ms) → `connect_retry` → `connect_timeout`(4005ms) → `connect_failed` → `error`，`addr` 含 `192.0.2.1:80` |
| L2：慢响应上游（`test_a_slow_but_answering_gateway_shows_up_as_a_response_record`） | `response` 记录 `ms >= SLOW_MS(3000)`、`detail=status=200` |
| L2：已连但不回字节的上游（`test_a_connected_but_silent_gateway_is_visible`） | 客户端 `curl -m 6` 退出码 28；桥侧记录 `connect_start` → `connect_done` → `error`（无 `response`）——**只可见、不可中断**（已写入 `KI-019` 已知边界） |
| `pnpm run acceptance:check --user-data-dir <隔离 profile>`（上游为 `http://192.0.2.1` 的桥） | `FAIL bridge-smoke 上游 502（KI-019 有界失败）：502 Bad Gateway`，退出码 1；不再出现 `curl 退出码 28` 被记 PASS 的情形 |
| `pnpm run diagnose:upstream`（本机假网关，`--rounds 2~3`） | 正常轮 `no-stall` + 同路径直连 200；注入「静默上游」后该轮判 `bridge-side` 并打印本轮阶段记录与 `Get-NetRoute` 实测；网关返回 `302 → /login` 时以「会话已过期」终止；`bridge-config.json` 缺失时明确报错退出 2；证据 JSONL 落在 `--out`（仓库外），grep 未命中 token/Cookie（`FAKE-TOKEN` / `SMOKE-VALUE` / `wrdvpn_session` 计数为 0） |
| 现场复测（真实会话 + 应用开桥，`--rounds 40`） | **未执行**：本机无应用会话（`%APPDATA%\swufe-webvpn-bridge` 不存在、无 Electron/sidecar 进程、系统代理 `ProxyEnable=0`）。按 §S6 判定表「不可诊断的情形不下结论」处理：`KI-019` 保持 `Open`，复测命令与判据已写入 [development-run.md](../../docs/operations/development-run.md) |

**文档同步**：[bridge-control-protocol.md](../../docs/api/bridge-control-protocol.md)（+en）（`swufe-upstream` 六键/阶段词表/`ms` 语义/触发条件/落点与上限/INV-001 约束、`swufe-ready` 三键、变更记录）、[development-run.md](../../docs/operations/development-run.md)（+en）（阶段复测用法与判据、`bridge-smoke` 502 的处置、常见故障行改为按阶段记录判因）、[testing-strategy.md](../../docs/development/testing-strategy.md)（+en）（用例基线 217 与「必须覆盖」新增上游有界化条目）。

## KI-019 现场复测（2026-09-23）

> 目的：在有真实会话的现场环境执行计划 §S6 的复测，用「同轮直连对照 + 阶段记录」区分本地与外部。执行者完成环境与自动化；CAS/MFA 登录由 cherrchen 本人完成。

**环境（与历史失败轮同形）**：Windows 11 24H2；应用以隔离 profile `%TEMP%\m4-win` 启动（`pnpm start --user-data-dir=… --remote-debugging-port=9222`，`SWUFE_PROBE_INTERVAL_MS=8000`），捕获方式「系统代理（全部流量）」，allowlist 含 `jwxt.swufe.edu.cn`；用户完成 CAS/MFA 后 `getSession() = {loggedIn:true, expiresAt:2026-09-30}`；桥 `running`、系统代理 `127.0.0.1:8080`、sidecar 由应用以 `<repo>\bridges\python\.venv\Scripts\python.exe -m swufe_bridge.sidecar` 拉起；`Get-NetRoute` 默认路由 `ifIndex 8 → 192.168.0.1`（**无 TUN 路由**）、`webvpn.swufe.edu.cn → 202.115.115.140`（非 fake-ip）。

| 命令 / 场景 | 结果 |
| ---- | ---- |
| 首次经桥请求（`curl -x 桥 -m 20 http://jwxt.swufe.edu.cn/`） | **复现挂起**：退出码 28、0 字节、20.0s |
| `pnpm run diagnose:upstream --user-data-dir <profile> --rounds 40`（间隔 15s） | **`bridge-side` 19 / `no-stall` 21 / `network-or-resolver` 0**；异常轮 `bridge_ms` 8017–8044ms、状态行 `(无状态行)` |
| 异常轮的阶段记录（每轮同形） | `connect_start → connect_done(54–68ms) → tls_start → tls_done(57–72ms，ALPN 未协商) → 无 response → error("Client disconnected.")`；同轮 Node 探针 DNS 10–19ms / TCP 54–68ms ok / TLS 108–135ms（h2）全绿 |
| 逐轮序列 | `SSSSSSSSSSSSS.........SS...S...S.....SS.` → 第 1–13 轮连续全挂、随后 9 轮全正常、其后零散命中（分钟级爆发，非均匀概率） |
| 同路径 + 同会话 Cookie 直连（不经桥；仓库 `wrd_codec` 构造同一 WRD URL，Python 原始 socket，18 次） | 全 `302`、0.23–0.33s，Location `/http/<token>/xtgl/login_slogin.html`（网关已转发到教务） |
| 经桥请求形态对照（各 10 次交替） | token+keep-alive 1/10 挂起；token+`Connection: close` 1/10；`User-Agent`+`Accept-Encoding: identity` 1/10；**网关自有路径 `/wengine-vpn/…` 0/10**（全 `200`，0.49–0.57s） |
| `--set http2=false` 试验（同配置/同 CA 副本另起 sidecar 于 18081，A/B 12×2） | 两臂均 0/12 挂起（时窗已过爆发期，无判别力）；两臂上游 `tls_done.detail` 均为 `None` → 该改动对本路径不生效（`tlsconfig.py` 镜像客户端 ALPN offers，明文 HTTP 客户端无 offers）。改动已回滚 |
| 建连有界化本轮是否触发 | **未触发**：19 个异常轮的网关建连均 54–68ms 成功，无 `connect_timeout`/`connect_failed`（少量 `connect_failed` 属并行其它主机流量）→ 本挂起形态发生在建连之后 |

**现场暴露并已修复的工具缺陷**（`scripts/diagnose-upstream.ts`，随本次复测提交）：① 直连对照不带 Cookie，网关必然回 `302 → /login`，原实现把它当会话失效而终止整轮 → 改为「对照只度量路径健康度，会话失效由**经桥响应** `302 → 网关登录页` 判定」；② `login_slogin.html` 含 `/login` 造成误判 → 改为按 `//<网关主机>/login` 精确匹配。另：本轮教务侧 SSO 未建立（网关对经桥根路径回 `302 → /xtgl/login_slogin.html`），`_promote_to_gateway` 不触发，harness 无法从 Location 取到 WRD 模板 → 同路径直连对照由执行者用仓库 codec 手工构造（见上表第 5 行）；在有教务 SSO 的会话下该对照自动成立。

**顺带发现并修复**：CA 安装（复测前置）触发 `KI-021`（Windows 系统「安全警告」对话框阻塞 `certutil`、默认 10s 超时先到）。修复=安装与卸载两步都按 120s（`PRIVILEGE_PROMPT_TIMEOUT_MS`）等待 + 超时改为带对话框引导的失败信息 + 渲染层提示文案平台中立；真机复验（2026-09-23）：按「触发后**等 15s（> 旧的 10s 上限）**再点『是(Y)』」执行安装与卸载，均成功（`{installed:true,trusted:true}` → 「本机 CA 已安装并被系统信任。」；`{installed:false,trusted:false}` → 「本机 CA 已卸载。」），控制台无 IPC 超时错误；单测断言两步超时均大于默认值（`test:unit` 110 passed）。`KI-021` 置 `Fixed`。

**结论**：挂起发生在**桥的上游请求/响应阶段**（已建连、已握手、上游不回任何字节），**非**本机网络/解析原因（同轮 DNS/TCP/TLS 全绿、同路径同 Cookie 直连 18/18 快速、网关自有路径 10/10 快速）。仍未区分「mitmproxy 发出的请求与直连请求的差异」与「网关侧对该请求的处理」。`KI-019` **保持 `Open`**，解除条件更新为「在与本轮同形的环境、且在爆发窗口内取得报文级证据（捕获 mitmproxy 上游请求字节或按 TCP 分段重放同一请求，并核对网关是否按连接/源走不同后端）」。**可见影响已被约束**：最坏情况下客户端在有界上限（本轮 8s 探针 / 验收 20s）内得到明确结果或错误，且挂起必然留下阶段记录。

**证据落点**：逐轮 JSONL 与 stdout 在系统临时目录（`%TEMP%\ki019-retest\…`，不入库；不含 Cookie/token/正文）；本轮关键数据已摘录于上表与本文件。复测后系统代理已由应用清除（`ProxyEnable=0x0`），应用与 sidecar 已停止（无残留进程），CA 仍安装在当前用户根存储（复测前置，可由应用「卸载本机 CA」移除）。

## 边界与异常场景

| 场景 | 期望行为 | 实际结果 | Status |
| ---- | -------- | -------- | ------ |
| EC-001 | 通配开启时 apex `swufe.edu.cn` 命中并按 WebVPN 改写（TC-B04） | L0：`match("swufe.edu.cn", wildcard=True) is True`，`notswufe.edu.cn` / `evilswufe.edu.cn` 为 False（`bridges/python/tests/l0/test_allowlist.py`） | Passed |
| EC-002 | `http://host:8080/x` 生成 `http-8080` scheme token 且可 decode 回主机（TC-A04） | L0：`encode_url("http://host:8080/x")` 含 `/http-8080/<token>/x`，`decode_url` 回 `http://host:8080/x`；`https://host:443/x` 不带端口段、`https://host:8000/x` 带 `-8000`；L1：addon 改写后 `path == /http-8080/<token>/x` | Passed |
| EC-003 | 非 allowlist 主机直连不改写，日志 `rewritten=false`（TC-B03、TC-F02） | L0：`example.com` 等不命中；L1：URL/Cookie/metadata 均不变且 `detail=not-allowlisted`；L2：`http://127.0.0.1:<direct>/plain` 正文原样返回、上游未收到注入 Cookie | Passed |
| EC-004 | 已是 WebVPN 形态的请求直通，不二次包装（TC-D04 相关检查） | L1：`https://webvpn.swufe.edu.cn/https/<token>/x`、`https://authserver.swufe.edu.cn/...`、配置的 `webvpnBase` 主机同名请求均原样透传（`bridges/python/tests/l1/test_addon_request.py::test_ec_004_*`）；客户端直连 webvpn 的响应（无改写元数据）也完全不改写 | Passed |
| EC-005 | 登录 WebView 访问 webvpn/authserver 主机不经本桥（TC-D04） | M2：登录分区固定 `setProxy({mode:'direct'})`，实机日志 `swufe-session 登录窗口 resolveProxy(...) = DIRECT`；登录期间无 webvpn/authserver 的 `swufe-debug` 行（证明未二次包装） | Passed（M2 部分：真实 CAS 会话下复验随 TC-D01） |
| EC-006 | allowlist 为空时拒绝开桥并返回 `ALLOWLIST_EMPTY`，UI 提示添加主机 | L2：sidecar 以退出码 `2` 结束并输出 `swufe-error ALLOWLIST_EMPTY allowlist 为空：请添加主机或启用 *.swufe.edu.cn`（`bridges/python/tests/l2/test_proxy_end_to_end.py`）；UI 提示属 M2/M3 | Passed（M1 部分） |
| EC-007 | Cookie 过期触发 `SESSION_EXPIRED`：停桥 → 清代理 → 停捕获 → 弹窗重登（TC-D03） | M2：探测到 `302 → /login` 后按「清代理 → 停 sidecar → 清会话 → 通知渲染层」级联，实机 8 秒内完成；`apps/desktop/test/orchestrator.test.ts` 断言调用顺序与最终状态（进程捕获在 M2 恒为关闭） | Passed（M2） |
| EC-008 | 系统代理已被占用时拒绝启动并提示 `PROXY_CONFLICT`（TC-C01） | M2：实机读到 `Enabled: Yes / 127.0.0.1:7890` 时返回 `PROXY_CONFLICT`，UI 模态提示，OS 设置与代理标记均未被改动、未启动 sidecar；单测断言冲突时不调用 `enable` | Passed（M2） |
| EC-009 | 系统代理已被其它软件占用时启用「指定应用」（M3） | 拒绝（`PROXY_CONFLICT`），捕获方式设置不落盘，界面回显原捕获方式并弹出代理冲突模态 | 单测：`apps/desktop/test/orchestrator.test.ts`「selecting apps is refused while another tool owns the system proxy」；实机（CDP 驱动真实应用）：先把 Wi-Fi web 代理设为 `127.0.0.1:7890` 并启用，再在界面切到「指定应用」⇒ 显示冲突文案 + 弹出模态 + 单选回落到已保存的捕获方式，`config.json` 的 `captureMode` 未被改写；随后已复原系统代理为 `Enabled: No` | Passed（M3） |
| EC-010 | 网关主机解析到 fake-ip 段（`198.18.0.0/15`，TUN 模式）时拒绝启动并返回 `PROXY_CONFLICT`（`KI-013` 修复，[ADR-0011](../../docs/architecture/adr/ADR-0011-refuse-start-on-fake-ip-dns.md)） | 单测：`apps/desktop/test/fake-ip.test.ts`（`198.18/198.19` 命中、`198.17/198.20` 与非法输入不命中）与 `apps/desktop/test/orchestrator.test.ts`（命中即拒绝且未触碰 OS、预检位于端口探测之前、解析失败不阻断）；真机 smoke：真实 DNS `webvpn.swufe.edu.cn → 202.115.115.140` 时正常开桥、注入 fake-ip 时拒绝且 OS 调用仅 `proxy.read` | Passed |

## 兼容性

| 维度 | 结论 | 依据 |
| ---- | ---- | ---- |
| 接口兼容 | 不适用（首次实现，无既有接口消费方） | 三个接口均为本 Spec 首次定义：[electron-ipc.md](../../docs/api/electron-ipc.md)、[bridge-control-protocol.md](../../docs/api/bridge-control-protocol.md)、[wrd-codec-library.md](../../docs/api/wrd-codec-library.md)；M1 已将 IF-002 从「候选方案」推进为方案 A（首版未定稿，无既有消费方） |
| 数据兼容 | 不适用（首次引入 `AllowlistConfig` / `SessionState` / `AppSettings`，无历史数据） | 无迁移需求：[design.md](design.md) §Data Model Changes、§Migration |
| 行为兼容 | 不适用（首次交付，无历史版本行为需要保持） | Phase 1 是首个交付版本；Linux/TUN/链式代理为 NG（[spec.md](spec.md)） |

## 安全

| 检查项 | 结论 | 依据 |
| ------ | ---- | ---- |
| 输入校验 | M1/M2/M3 已实现并验证 | `bridges/python/swufe_bridge/allowlist.normalize_host`（非法主机名抛 `InvalidHostError`）、`webvpn.swufe.edu.cn`/`authserver.swufe.edu.cn` 硬编码排除（INV-004）；M2/M3 的 IPC 侧参数校验（`setAllowlist`/`setCaptureMode`/`setCaptureProcesses`/`setDebugLogging`）与 App 侧主机名 / intercept pattern 校验（`apps/desktop/test/store.test.ts`：非空、不含逗号、去重、上限 32）；`bridges/python/tests/l0/test_allowlist.py`、`bridges/python/tests/l1/test_addon_request.py` |
| 权限 | 设计已定义；M1/M2/M3 已部分验证，M4 已在真实信任库上验证 | 运行时配置文件以 0600 写入（`write_runtime_config` 与 `ProxyOrchestrator.writeRuntimeConfig`）；实机确认 `<userData>/bridge-config.json` 与 CA 私钥均为 0600；CA 安装/卸载经管理员授权执行（M4：安装以应用自带的手动命令完成并被系统信任——自动路径失败见 `KI-007`；卸载修复 `KI-010` 后成功，钥匙串中不再有该证书）；macOS 进程捕获需系统扩展授权（M3 实现失败引导 + 重试，M4 实测真实范围通过，`KI-002` 置 `Fixed`） |
| 敏感数据 | M1/M2 已部分验证，M4 已加机器化自检 | 不存密码：会话保存在 Electron 持久分区，无任何密码落盘（M4 实机 `find` 确认）；Cookie 不进日志与诊断行（INV-001）；debug 事件跨 IPC 时只保留契约的五个键（防正文/Cookie 外泄）；`getSettings` 不返回 WRD key/IV；运行时配置文件 0600；CA 私钥仅本机（mitmproxy confdir，0600）；M4 新增的验收证据采集脚本对每份报告做 `redaction-self-check`（哨兵值正负两向验证：无泄漏 `PASS`、人为泄漏 `FAIL` + 退出码 1），入库报告已复核无 Cookie/密钥值 |
| 回环约束 | M1 已实现并验证 | sidecar 硬编码 `--listen-host 127.0.0.1`（无开关）＋ addon 越界复查（`LISTEN_NOT_LOOPBACK`）；L2 断言代理端口在非回环地址上不可达 |

## 文档同步

| 文档 | 是否需要更新 | 状态 |
| ---- | ------------ | ---- |
| [docs/requirements/](../../docs/requirements/README.md) | 是 | 已同步：REQ-001..REQ-011 / NFR-001..NFR-007 的规范定义在 requirements，本 Spec 只引用 ID（M1/M2 均未新增需求）；2026-09-21（`KI-013` 修复）：REQ-004 增补「网关主机解析到 fake-ip 段同样拒绝」的判据、AC 4 与边界例外 |
| [docs/operations/](../../docs/operations/README.md) | 是 | M2 已同步：配置落点（`<userData>/config.json`、`bridge-config.json`、`mitmproxy/`、登录分区）、开发期覆盖项与「持久文件为唯一来源」的配置优先级；M4 已同步：新增 [development-run.md](../../docs/operations/development-run.md)（+en，承载 T040：前置条件、启动、管理员权限操作、自检、常见故障、Windows 差异、停止与重置），README §3 指向该文件并补 TUN 模式前置条件（`KI-013`）；2026-09-21（`KI-013` 修复）：development-run 前置条件与「常见故障」更新为「fake-ip 形态已在开桥前拒绝、`redir-host` 形态仍需手动关闭」，并补 `KI-014` 的登录窗重载规避；README 告警行标注 `PROXY_CONFLICT` 的第二种成因；2026-09-23（`KI-019` 有界化）：development-run（中英）新增「经桥挂起的阶段复测」小节（`pnpm run diagnose:upstream` 用法、证据落点与判据、同形环境要求），§5 的 `bridge-smoke` 说明改为「`FAIL ... 上游 502（KI-019 有界失败）`按阶段复测判因」，§6 的「教务页长时间无响应」行改为按 `bridge-upstream.log` 阶段记录判因 |
| [docs/architecture/](../../docs/architecture/README.md) | 是 | M5 已同步：新增 [ADR-0007](../../docs/architecture/adr/ADR-0007-gateway-owned-namespaces-and-native-mode-promotion.md)（中英）并在 [ADR 索引](../../docs/architecture/adr/README.md) 登记，[components.md](../../docs/architecture/components.md) / [interfaces.md](../../docs/architecture/interfaces.md) / [data-flow.md](../../docs/architecture/data-flow.md) 补「网关自有命名空间直通 + bootstrap 文档升级」；M1 已同步：[interfaces.md](../../docs/architecture/interfaces.md)（IF-002 方案 A 定稿）；M2 已同步：[components.md](../../docs/architecture/components.md)（Electron 组件的代码位置与状态已落地，Windows 适配「实现待 M4 真机」）；M3 已同步：新增 [ADR-0006](../../docs/architecture/adr/ADR-0006-local-capture-mode-and-mutual-exclusion.md)（中英）并在 [ADR 索引](../../docs/architecture/adr/README.md) 登记，[components.md](../../docs/architecture/components.md) / [interfaces.md](../../docs/architecture/interfaces.md) / [data-flow.md](../../docs/architecture/data-flow.md) / [data-model.md](../../docs/architecture/data-model.md) 更新捕获方式、`capture` 配置键、`swufe-capture` 行与 `AppSettings.captureMode` / `captureProcesses`；2026-09-21（`KI-013` 修复）：`components.md` / `interfaces.md` / `data-flow.md` 补「开桥前 fake-ip 预检」与 `PROXY_CONFLICT` 的第二种成因（中英），[ADR 索引](../../docs/architecture/adr/README.md) 增列 ADR-0011 |
| [docs/api/](../../docs/api/README.md) | 是 | M1 已同步：[bridge-control-protocol.md](../../docs/api/bridge-control-protocol.md)（方案 A 定稿）、[wrd-codec-library.md](../../docs/api/wrd-codec-library.md)（Python 实现映射）；M2 已同步：[bridge-control-protocol.md](../../docs/api/bridge-control-protocol.md)（CA 生成入口与 M2 落点）、[electron-ipc.md](../../docs/api/electron-ipc.md)（`getSettings` / `onStatus` / `onSessionExpired`）；M3 已同步：[electron-ipc.md](../../docs/api/electron-ipc.md)（`setCapturePids` → `setCaptureProcesses` + 新增 `setCaptureMode`、`captureError`、`CaptureCandidate.pattern`、`AppSettingsView` 与错误码前缀约定，中英）、[bridge-control-protocol.md](../../docs/api/bridge-control-protocol.md)（`capture` 配置键、`swufe-capture` 诊断行、`--mode regular@<port>`，中英）；2026-09-21（`KI-013` 修复）：[electron-ipc.md](../../docs/api/electron-ipc.md) 的 `startBridge` 错误行、错误码表 `PROXY_CONFLICT` 行与示例拒绝消息更新为「系统代理被占用或 fake-ip（TUN）」（中英）；2026-09-23（`KI-019` 有界化）：[bridge-control-protocol.md](../../docs/api/bridge-control-protocol.md)（中英）新增 `swufe-upstream` 诊断行（键/阶段词表/`ms` 语义/触发条件/落盘与上限/脱敏）与 `swufe-ready` 的三键 `upstream_*`、变更记录追加一行；`electron-ipc.md` 未变（该行 Electron 侧不解析） |
| ADR | 是一部分 | M3 新增 [ADR-0006](../../docs/architecture/adr/ADR-0006-local-capture-mode-and-mutual-exclusion.md)：进程捕获用 mitmproxy `local` 模式且与系统代理互斥（中英 + 索引）；M1 未新增 ADR（未改架构/公共接口/数据模型/安全模型）；IF-002 的实现方式选择属实现阶段决策，记录于 [bridge-control-protocol.md](../../docs/api/bridge-control-protocol.md)；2026-09-21（`KI-013` 修复）新增 [ADR-0011](../../docs/architecture/adr/ADR-0011-refuse-start-on-fake-ip-dns.md)：fake-ip（TUN）环境同样以 `PROXY_CONFLICT` 拒绝开桥（中英 + 索引；扩展 ADR-0004 的判据，不取代它） |
| [docs/development/](../../docs/development/README.md) | 是 | M5 已同步：testing-strategy 的用例基线更新为 198 Python + 71 App 单测；M1 已同步：testing-strategy（分层/命名/运行命令与 CI）、coding-conventions（语言/目录/命名/错误处理）、dependency-policy（uv 与依赖登记）、development-workflow（分支与提交、CI）；M2 已同步：testing-strategy（App 单测层与 `app-tests.yml`）、coding-conventions（TS 目录/命名/模块格式）、dependency-policy（electron/esbuild/tsx/typescript/@types/node 记录）；M3 已同步：testing-strategy 补「进程捕获：L0/L1 注入式单测 + L3 手工范围验证」与用例基线（190 Python + 70 App 单测）；2026-09-21：development-workflow 的 CI 工作流数由 2 修正为 3（补 `app-tests.yml`，既有漂移）、testing-strategy 的环境隔离与前置条件更新为 fake-ip 预检语义、用例基线更新为 198 Python + 76 App 单测；2026-09-23（`KI-019` 有界化）：testing-strategy（中英）的用例基线更新为 217 Python（L0 103 + L1 103 + L2 11），「必须覆盖」新增「上游有界化与阶段证据（`KI-019`）」条目（L0/L1/L2 用例与 `pnpm run diagnose:upstream` 的分工） |
| [docs/planning/](../../docs/planning/roadmap.md) | 是 | M5 已同步：M4 里程碑的 TC-G01/TC-G02 退出条件按复验结果勾选并写明「Windows 延期」，roadmap 与 milestones/README 状态行同步（教育浏览器验收已在 macOS 侧达成）；M1 已同步：[M1 里程碑](../../docs/planning/milestones/M1-mitm-bridge.md) 置 `Done`；M2 已同步：[M2 里程碑](../../docs/planning/milestones/M2-desktop-orchestration.md) 置 `Done` 并记录证据与遗留项；M3 已同步：[M3 里程碑](../../docs/planning/milestones/M3-experience-polish.md) 置 `Done`（退出条件勾选 + 完成记录 + 实现期偏差）、[roadmap](../../docs/planning/roadmap.md) 与 [milestones/README](../../docs/planning/milestones/README.md) 状态行同步；M4 已同步：[M4 里程碑](../../docs/planning/milestones/M4-acceptance.md) 由 `Planned` 改为 `In Progress` 并写入完成记录与遗留问题、[roadmap](../../docs/planning/roadmap.md) 与 [milestones/README](../../docs/planning/milestones/README.md) 状态行同步为 `In Progress` |
| `.en.md` 配对 | 是 | 已同步：`docs/**` 改动均成对更新（含 M5 新增的 ADR-0007 中英与受影响的 planning/development/architecture 文档；`pnpm run docs:check` 的 i18n 检查 0 error / 0 warning）；Spec 目录不属双语强制范围；2026-09-21（`KI-013` 修复）：ADR-0011 与 requirements/architecture/api/operations/development/security/ui-ux 的改动均成对更新（`pnpm run docs:check` 178 文件，0 error / 0 warning） |

## 2026-09-23 Code Review 缺陷修复复验

本次按既有 REQ-002/003/010、NFR-004 与 TC-D01/D03、TC-C03/C04、TC-E02 的判据修复异常路径；不改变已记录的 M4/M5 历史实机结果。

| 修复路径 | 自动化证据 | 结果 |
| -------- | ---------- | ---- |
| 系统代理命令部分成功、回滚或清理失败；持久归属标记保留并于后续启动重试 | `apps/desktop/test/system-proxy-writes.test.ts`、`orchestrator.test.ts`：macOS/Windows 命令序列、部分写入、停止/过期/启动恢复 | Passed（注入式 App 单测；Windows 真机仍待 `KI-001`） |
| 捕获方式切换失败时不保存目标模式；代理写入与回滚均失败时停桥，避免两种捕获同时运行 | `apps/desktop/test/orchestrator.test.ts`：两个切换方向及双重失败路径 | Passed（注入式 App 单测） |
| 登录页已有 Cookie 但会话无效时不判定为已登录；停监测、重登或并发探测后忽略旧结果 | `apps/desktop/test/session-guard.test.ts`、`orchestrator.test.ts`：探测分类、代次与重叠清理 | Passed（App 单测；真实 CAS/MFA 回归待后续实机会话验证） |
| CA 状态与卸载目标按本地证书指纹匹配，保留其它同名 CA | `apps/desktop/test/cert-parse.test.ts`、`cert-manager.test.ts`：同名证书列表与 macOS/Windows 删除参数 | Passed（注入式 App 单测；Windows 真机仍待 `KI-001`） |

回归命令：`pnpm --filter swufe-webvpn-bridge run build`、`test:unit`（103 passed）、`test:ui`（36 passed）、`UV_CACHE_DIR=/private/tmp/swufe-review-uv-cache uv run --directory bridges/python pytest -q`（198 passed）、`pnpm run docs:check`（0 error / 0 warning），均通过。Python 测试输出 42 条依赖弃用告警；UI 测试有 jsdom `getComputedStyle` 未实现提示，均未造成用例失败。Spec 仍为 `Implemented`；Windows 真机验收按 `KI-001` 留待后续执行。

## 未验证 / 无法验证项

| 项 | 原因 | 已尝试 | 需要谁决策 |
| -- | ---- | ------ | ---------- |
| 经桥访问教务的偶发挂起（`KI-019`，`Open`） | 2026-09-23 Windows 真机验收 6 次 smoke 中 3 次 12–45s 零字节超时；旧对照访问网关根而非相同 WRD 路径，桥请求日志也早于上游连接，不能据此排除本地路径。桥侧当时既无上游超时也无阶段记录，继续采样无法产出区分证据 | 复核轮（未复现）与 2026-09-23 现场复测（`bridge-side` 19/40，见「KI-019 现场复测（2026-09-23）」）已执行：异常轮阶段记录恒为 `connect_start → connect_done(54–68ms) → tls_start → tls_done(57–72ms) → 无 response → error`，同轮 DNS/TCP/TLS 全绿；同路径 + 同会话 Cookie 直连 18/18 快速、网关自有路径 10/10 快速 → 已排除本机网络/解析原因；`--set http2=false` 试验对本路径不生效（已回滚） | cherrchen（在爆发窗口内取得报文级证据：捕获 mitmproxy 上游请求字节或按 TCP 分段重放同一请求，并核对网关是否按连接/源走不同后端；据此定位后修复或按外部风险接受。复测命令与判据见 [development-run.md](../../docs/operations/development-run.md)） |
| 会话 Cookie 名与另两个失效信号（Q-001 / DQ-001） | 另两个信号（`Set-Cookie` 清空、连续改写后 302 到 CAS）本轮未观测到（本轮用的是服务端使 ticket 失效 → 探测 `302 → /login`） | M4 已采集并只记名：`wengine_vpn_ticketwebvpn_swufe_edu_cn`、`route`、`show_vpn`、`heartbeat`、`show_faq`；已确认信号原文 `会话探测：status=302 location=https://webvpn.swufe.edu.cn/login → expired`；登记为 `KI-006`；**2026-09-21 决策（cherrchen）**：本轮不补实现，也不以现有信号正式收敛 Q-001（保持 `Open`，待真实会话环境再观测） | cherrchen（在真实会话环境下观测后再决定是否补实现/收敛） |

> 已解除的旧条目：TC-E01/TC-E02（系统信任库写入，见 `KI-007`/`KI-010`）、TC-G04 的真实范围（`KI-002` 置 `Fixed`）、日志面板与真实桥联动（`KI-003` 置 `Fixed`）；**M5（2026-09-21）**：L3 教务浏览器验收（TC-G01、TC-G02）已从本表移除——`KI-011` 修复后 macOS 实机复验通过，见「M5（`KI-011` 修复）执行记录」。**2026-09-23（Windows 真机）**：Windows 全部真机项已从本表移除——按 M4 手册执行 TC-D01..D04 / TC-C01..C04 / TC-E01/E02/E03 / TC-F01 / TC-F04 / TC-G03 / TC-G04 / TC-H01/H02 / TC-B05 并通过，`KI-001` 置 `Fixed`，见「M4 Windows 验收执行记录（2026-09-23）」。**2026-09-21（`KI-007` 修复）**：CA **自动**安装已从本表移除——安装改为「提权写系统钥匙串 + 应用进程写管理域信任设置」（[ADR-0008](../../docs/architecture/adr/ADR-0008-ca-trust-authorization-in-app-session.md)），应用内一次点击即可完成，见「`KI-007` 修复复验执行记录（2026-09-21）」。**2026-09-21（`KI-013` 修复）**：TUN/fake-ip 干扰已在本轮消除（fake-ip 形态由开桥前预检拒绝，`KI-013` 置 `Fixed`，见「`KI-013` 修复执行记录（2026-09-21）」）；真实开启 TUN 的复现样本仍未采集，但判据由单测覆盖、真机侧已验证不误报。

## 结论

- [x] 映射表无 `Pending`（已无 `Pending`/`Failed` 行：M5 后教务浏览器验收转为 `Passed`；Windows 真机项已于 2026-09-23 全部执行并通过，`KI-001` 置 `Fixed`）
- [x] 执行的命令与结果已记录
- [x] 文档影响已处理
- [ ] Spec 状态可推进到 `Verified`

> 当前：macOS 与 Windows 的既定 P0 用例和教务浏览器验收均已通过（Windows 2026-09-23 实测，`KI-001` 已 `Fixed`）；本轮将 CAS 资源截断 `KI-014` 置 `Accepted`，重载登录窗为现有规避。教务请求偶发挂起 `KI-019` 曾在 Windows 验收中出现，本轮未复现且无法排除本地路径，重新置 `Open`。
> 因此 Spec 001 保持 `Implemented`。推进 `Verified` 的本轮附加条件是定位 `KI-019` 并证实其非本地原因，或修复已确认的本地原因并复验；当前证据尚不满足。
> **2026-09-23（`KI-019` 有界化 + 现场复测）**：挂起已不再表现为「无限等待」——桥对网关主机的上游建连限制为 4s × 2 次尝试，两次都超时后客户端得到 `502 Bad Gateway`，并新增 `swufe-upstream` 阶段记录、`<userData>/bridge-upstream.log` 与现场判因工具 `pnpm run diagnose:upstream`（同轮直连对照）。本机实测（不经校园网）：有界失败 8.1s 内返回 502、慢响应与「已连但不响应」三类路径均可在日志中区分（见「`KI-019` 有界化与阶段证据（2026-09-23）」）。**同日现场复测已执行**（真实会话，cherrchen 完成登录；默认路由直连、无 TUN）：40 轮中 `bridge-side` **19**、`no-stall` 21、`network-or-resolver` 0；异常轮阶段记录恒为「网关建连成功（54–68ms）→ TLS 握手成功（57–72ms）→ 上游不回任何字节 → 客户端断开」，而同轮 DNS/TCP/TLS 探针全绿、同路径 + 同会话 Cookie 直连 18/18 快速、网关自有路径 10/10 快速（见「KI-019 现场复测（2026-09-23）」）。据此**排除本机网络/解析原因**，把问题定位到「桥的上游请求/响应阶段」；`--set http2=false` 候选经代码与实测证明对本路径不生效（改动已回滚）。因尚未取得报文级证据以区分 mitmproxy 请求与网关侧处理，`KI-019` 保持 `Open`、Spec 001 仍为 `Implemented`；解除条件见 [known-issues.md](known-issues.md) 的 `KI-019`。另：复测前置的 CA 安装暴露 `KI-021`（Windows 的 CA 安装/卸载系统对话框阻塞 `certutil`），本轮已修复并真机复验（安装与卸载均按「等 15s 再点『是(Y)』」成功），条目置 `Fixed`。
