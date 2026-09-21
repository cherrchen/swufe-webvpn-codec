# Verification: Phase 1 本机桥（001-phase1-local-bridge）

> Spec ID: 001
> Status: In Progress
> Owner: cherrchen
> Last Updated: 2026-09-21

> 本文件建立 **Requirement → Verification** 映射，是「Feature 是否完成」的判定依据。
> 规则见 [verification-strategy.md](../../docs/verification/verification-strategy.md)。
> Feature **不因为「代码写完了」被视为完成**；状态必须推进到 `Verified`。
> 当前进度：M1（桥核心）、M2（桌面编排）、M3（体验打磨）已实现；M4 的 **macOS 交互式验收已执行完毕**（真实应用 + CDP + 真实 CAS/MFA 会话，2026-09-21）：登录、开桥、系统代理、会话失效级联、进程捕获、日志面板、CA 安装/卸载等用例通过，验收期修复了三个缺陷（`KI-008` 会话探测丢 Cookie、`KI-009` 登录窗 ERR_ABORTED、`KI-010` CA 卸载缺 `-Z`）；M4 期间教务浏览器验收（TC-G01/TC-G02）失败（根因 `KI-011`）。**M5（2026-09-21，`KI-011` 修复后复验）**：网关自有命名空间直通 + bootstrap 文档升级（[ADR-0007](../../docs/architecture/adr/ADR-0007-gateway-owned-namespaces-and-native-mode-promotion.md)）在 macOS 实机复验通过——TC-G01/TC-G02 转为 `Passed`，macOS 侧出口条件（含「教务浏览器验收至少一侧通过」）**已满足**。仍有两类未完成：Windows 侧全部真机项延期（`KI-001`），以及 `KI-007`（CA 自动安装，macOS 15.6 下 osascript 提权无法写信任设置）、`KI-013`（TUN 干扰需环境预检/文案）、`KI-014`（CAS 主题资源被服务端截断，需重载登录窗）等未决项。故本 Feature 推进到 `Implemented`，**不**推进到 `Verified`（`Verified` 需要 P0 全绿，仍差 Windows 侧）。

## 映射表

> 测试用例编号与分层沿用归档测试用例集（`docs/archive/2026-09-20-swufe-webvpn-bridge-docs-v1.0/02-testing/02-test-cases.md`）；层级定义见 [docs/development/testing-strategy.md](../../docs/development/testing-strategy.md)。M1 覆盖的自动化用例已 `Passed`，其余保持 `Pending` 并标注 M1 已通过的部分。

| Requirement | Verification | Status |
| ----------- | ------------ | ------ |
| REQ-001 | TC-H01（L3 手工：状态条与状态机一致，含捕获态）；应用启动 smoke（TC-G01/TC-G03 前置，L3 手工） | Passed（M5：macOS 侧全部通过——TC-G01 复验通过（教务首页可打开并可操作，见「M5（KI-011 修复）执行记录」）；TC-G03 仍延 Windows，见 `KI-001`）；M4 曾 `Failed`（TC-G01/TC-G02 失败，根因见 `KI-011`；TC-G03 延 Windows，见 `KI-001`）——应用启动与界面部分通过：M4 实机状态条覆盖含「桥接中（进程捕获）」在内的六种呈现且与状态机一致（TC-H01）、日志面板与真实桥端到端联动（TC-F04）；M3 已通过：主窗口一级「捕获方式」区、可增删的 allowlist 与日志面板实机可用；状态条在捕获生效时显示「桥接中（进程捕获）」（渲染层以真实推流验证，桥未运行时保持「桥接中」）；M2 已通过：应用启动 smoke，且五个状态（未登录/已登录/桥接中/错误/过期处理中）实机可见并与状态机一致 |
| REQ-002 | TC-D01、TC-D02、TC-D03（L1 组件 + L3 手工：登录成功、未登录拒绝开桥、过期停桥清代理弹窗） | Passed（M4：TC-D01 在真实 CAS/MFA 会话下通过、TC-D02 通过、TC-D03 以服务端使 ticket 失效触发并在 ≤8s 内完成级联且重登后回到「已登录」；过程中修复 `KI-008`（探测丢 Cookie）与 `KI-009`（登录窗 ERR_ABORTED））；M2 已通过：TC-D02（未登录时开关禁用且 `startBridge` 返回 `NOT_LOGGED_IN`）、TC-D03（过期级联实机 8 秒内完成）、TC-D01（桩上游「打开门户 → 采集 Cookie → 已登录」）；M1 已通过：Cookie 注入与去重、配置热更新 |
| REQ-003 | TC-C02、TC-C03、TC-C04（L1 组件 / L2 集成：设代理、关桥清代理、退出清代理）；TC-G04（L3 手工：进程捕获的范围与停止） | Passed（M4：TC-C02/C03/C04 与 TC-G04 的真实范围全部实机通过——捕获与系统代理互斥（`Enabled: No`）、正向「被选中的 Chrome 经桥」、反向「未选中的 curl 不经桥」、切回系统代理即恢复）；M2 已通过：TC-C02/C03/C04 实机——开桥把 6 个启用服务指向 `127.0.0.1:8080`，关桥/退出清空，异常退出残留由 `recoverOnLaunch()` 自愈；M1 已通过：sidecar 起桥、回环监听、结束进程即停止；M3 已通过：`--mode regular@<port>` 起桥且 `swufe-ready.listen_port` 等于 `--port`（L2）、捕获模式集推导/回滚/不重试（L0 `bridges/python/tests/l0/test_capture.py`）、addon 叠加与移除 `local:` 并回报 `swufe-capture`（L1 `bridges/python/tests/l1/test_addon_capture.py`）、互斥编排（`apps/desktop/test/orchestrator.test.ts` 6 例）、实机切到「指定应用」不设置系统代理（`networksetup` 证据见「M3 手工验证记录」）、系统代理被占用时拒绝启用「指定应用」并弹出冲突模态（实机 CDP 驱动） |
| REQ-004 | TC-C01（L1 组件 / L2 集成：已有系统代理时拒绝启动，错误码 `PROXY_CONFLICT`） | Passed（M2：实机 `Enabled: Yes / 127.0.0.1:7890` 时拒绝启动、模态提示、OS 设置未被改动、未启动 sidecar；`apps/desktop/test/orchestrator.test.ts` 断言冲突时不调用 `enable`） |
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
> 结果边执行边填入下方「M4 结果表」。macOS 侧本轮全量执行；Windows 侧见 `KI-001`（延期）。
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
| [docs/requirements/](../../docs/requirements/README.md) | 是 | 已同步：REQ-001..REQ-011 / NFR-001..NFR-007 的规范定义在 requirements，本 Spec 只引用 ID（M1/M2 均未新增需求） |
| [docs/operations/](../../docs/operations/README.md) | 是 | M2 已同步：配置落点（`<userData>/config.json`、`bridge-config.json`、`mitmproxy/`、登录分区）、开发期覆盖项与「持久文件为唯一来源」的配置优先级；M4 已同步：新增 [development-run.md](../../docs/operations/development-run.md)（+en，承载 T040：前置条件、启动、管理员权限操作、自检、常见故障、Windows 差异、停止与重置），README §3 指向该文件并补 TUN 模式前置条件（`KI-013`） |
| [docs/architecture/](../../docs/architecture/README.md) | 是 | M5 已同步：新增 [ADR-0007](../../docs/architecture/adr/ADR-0007-gateway-owned-namespaces-and-native-mode-promotion.md)（中英）并在 [ADR 索引](../../docs/architecture/adr/README.md) 登记，[components.md](../../docs/architecture/components.md) / [interfaces.md](../../docs/architecture/interfaces.md) / [data-flow.md](../../docs/architecture/data-flow.md) 补「网关自有命名空间直通 + bootstrap 文档升级」；M1 已同步：[interfaces.md](../../docs/architecture/interfaces.md)（IF-002 方案 A 定稿）；M2 已同步：[components.md](../../docs/architecture/components.md)（Electron 组件的代码位置与状态已落地，Windows 适配「实现待 M4 真机」）；M3 已同步：新增 [ADR-0006](../../docs/architecture/adr/ADR-0006-local-capture-mode-and-mutual-exclusion.md)（中英）并在 [ADR 索引](../../docs/architecture/adr/README.md) 登记，[components.md](../../docs/architecture/components.md) / [interfaces.md](../../docs/architecture/interfaces.md) / [data-flow.md](../../docs/architecture/data-flow.md) / [data-model.md](../../docs/architecture/data-model.md) 更新捕获方式、`capture` 配置键、`swufe-capture` 行与 `AppSettings.captureMode` / `captureProcesses` |
| [docs/api/](../../docs/api/README.md) | 是 | M1 已同步：[bridge-control-protocol.md](../../docs/api/bridge-control-protocol.md)（方案 A 定稿）、[wrd-codec-library.md](../../docs/api/wrd-codec-library.md)（Python 实现映射）；M2 已同步：[bridge-control-protocol.md](../../docs/api/bridge-control-protocol.md)（CA 生成入口与 M2 落点）、[electron-ipc.md](../../docs/api/electron-ipc.md)（`getSettings` / `onStatus` / `onSessionExpired`）；M3 已同步：[electron-ipc.md](../../docs/api/electron-ipc.md)（`setCapturePids` → `setCaptureProcesses` + 新增 `setCaptureMode`、`captureError`、`CaptureCandidate.pattern`、`AppSettingsView` 与错误码前缀约定，中英）、[bridge-control-protocol.md](../../docs/api/bridge-control-protocol.md)（`capture` 配置键、`swufe-capture` 诊断行、`--mode regular@<port>`，中英） |
| ADR | 是一部分 | M3 新增 [ADR-0006](../../docs/architecture/adr/ADR-0006-local-capture-mode-and-mutual-exclusion.md)：进程捕获用 mitmproxy `local` 模式且与系统代理互斥（中英 + 索引）；M1 未新增 ADR（未改架构/公共接口/数据模型/安全模型）；IF-002 的实现方式选择属实现阶段决策，记录于 [bridge-control-protocol.md](../../docs/api/bridge-control-protocol.md) |
| [docs/development/](../../docs/development/README.md) | 是 | M5 已同步：testing-strategy 的用例基线更新为 198 Python + 71 App 单测；M1 已同步：testing-strategy（分层/命名/运行命令与 CI）、coding-conventions（语言/目录/命名/错误处理）、dependency-policy（uv 与依赖登记）、development-workflow（分支与提交、CI）；M2 已同步：testing-strategy（App 单测层与 `app-tests.yml`）、coding-conventions（TS 目录/命名/模块格式）、dependency-policy（electron/esbuild/tsx/typescript/@types/node 记录）；M3 已同步：testing-strategy 补「进程捕获：L0/L1 注入式单测 + L3 手工范围验证」与用例基线（190 Python + 70 App 单测） |
| [docs/planning/](../../docs/planning/roadmap.md) | 是 | M5 已同步：M4 里程碑的 TC-G01/TC-G02 退出条件按复验结果勾选并写明「Windows 延期」，roadmap 与 milestones/README 状态行同步（教育浏览器验收已在 macOS 侧达成）；M1 已同步：[M1 里程碑](../../docs/planning/milestones/M1-mitm-bridge.md) 置 `Done`；M2 已同步：[M2 里程碑](../../docs/planning/milestones/M2-desktop-orchestration.md) 置 `Done` 并记录证据与遗留项；M3 已同步：[M3 里程碑](../../docs/planning/milestones/M3-experience-polish.md) 置 `Done`（退出条件勾选 + 完成记录 + 实现期偏差）、[roadmap](../../docs/planning/roadmap.md) 与 [milestones/README](../../docs/planning/milestones/README.md) 状态行同步；M4 已同步：[M4 里程碑](../../docs/planning/milestones/M4-acceptance.md) 由 `Planned` 改为 `In Progress` 并写入完成记录与遗留问题、[roadmap](../../docs/planning/roadmap.md) 与 [milestones/README](../../docs/planning/milestones/README.md) 状态行同步为 `In Progress` |
| `.en.md` 配对 | 是 | 已同步：`docs/**` 改动均成对更新（含 M5 新增的 ADR-0007 中英与受影响的 planning/development/architecture 文档；`pnpm run docs:check` 的 i18n 检查 0 error / 0 warning）；Spec 目录不属双语强制范围 |

## 未验证 / 无法验证项

| 项 | 原因 | 已尝试 | 需要谁决策 |
| -- | ---- | ------ | ---------- |
| Windows 真机项（TC-C02/C03/C04、TC-E01/E02 on Windows、TC-G03/G04） | **本轮延期**：Windows 测试机不在本轮可访问环境内（`KI-001`） | 实现与单测已完成（`apps/desktop/test/system-proxy-parse.test.ts`、`apps/desktop/test/cert-parse.test.ts`）；Windows 步骤已写入 [development-run.md](../../docs/operations/development-run.md) 的「Windows 差异」与 [verification.md](verification.md) 的 M4 手册；跨平台采集脚本 `pnpm run acceptance:check` 可在 Windows 直接产出同类脱敏证据 | cherrchen（提供可访问的 Windows 测试机；解除条件按时序写入 `KI-001`） |
| 会话 Cookie 名与另两个失效信号（Q-001 / DQ-001） | 另两个信号（`Set-Cookie` 清空、连续改写后 302 到 CAS）本轮未观测到（本轮用的是服务端使 ticket 失效 → 探测 `302 → /login`） | M4 已采集并只记名：`wengine_vpn_ticketwebvpn_swufe_edu_cn`、`route`、`show_vpn`、`heartbeat`、`show_faq`；已确认信号原文 `会话探测：status=302 location=https://webvpn.swufe.edu.cn/login → expired`；登记为 `KI-006` | cherrchen（是否需要为另两个信号补实现，或以现有信号收敛 Q-001） |

> 已解除的旧条目：TC-E01/TC-E02（系统信任库写入，见 `KI-007`/`KI-010`）、TC-G04 的真实范围（`KI-002` 置 `Fixed`）、日志面板与真实桥联动（`KI-003` 置 `Fixed`）；**M5（2026-09-21）**：L3 教务浏览器验收（TC-G01、TC-G02）已从本表移除——`KI-011` 修复后 macOS 实机复验通过，见「M5（`KI-011` 修复）执行记录」。**2026-09-21（`KI-007` 修复）**：CA **自动**安装已从本表移除——安装改为「提权写系统钥匙串 + 应用进程写管理域信任设置」（[ADR-0008](../../docs/architecture/adr/ADR-0008-ca-trust-authorization-in-app-session.md)），应用内一次点击即可完成，见「`KI-007` 修复复验执行记录（2026-09-21）」。

## 结论

- [x] 映射表无 `Pending`（已无 `Pending`/`Failed` 行：M5 后教务浏览器验收转为 `Passed`；未完成项为 Windows 真机项延期（`KI-001`，已在相关行的状态文案中显式标注））
- [x] 执行的命令与结果已记录
- [x] 文档影响已处理
- [ ] Spec 状态可推进到 `Verified`

> 当前：M1/M2/M3 已交付；M4 的 macOS 交互式验收已执行完毕（2026-09-21），新增 `Passed`：REQ-002、REQ-003、REQ-008、REQ-009、REQ-010、NFR-003/NFR-004 的 M4 部分、AC-002、AC-005、AC-009、AC-010，以及 TC-D01/D02/D03/D04、TC-C01..C04、TC-E01/E02/E03、TC-F01/F04、TC-G04、TC-H01/H02、TC-B05；**M5（2026-09-21，`KI-011` 修复后复验）**：REQ-001、REQ-007、REQ-011、NFR-006、AC-001、AC-007 转为 `Passed`（macOS 侧的教务浏览器验收 TC-G01/TC-G02 通过），因此 macOS 侧出口条件全部满足；`Deferred` 仅剩 Windows 全部真机项（`KI-001`）。未决问题：P1 `KI-013`（TUN 干扰）/`KI-014`（CAS 主题资源被服务端截断）、P2 `KI-006`/`KI-012`（`KI-007` 的 CA 自动安装已于 2026-09-21 修复，见 [ADR-0008](../../docs/architecture/adr/ADR-0008-ca-trust-authorization-in-app-session.md)）。Feature 状态推进到 `Implemented`，但 `Verified` 仍需 P0 全绿（Windows 侧），故不推进；M4 里程碑同理保持 `In Progress`（见 [docs/planning/milestones/M4-acceptance.md](../../docs/planning/milestones/M4-acceptance.md)）。
> 因此 macOS 侧的出口条件「所有 P0 用例通过（macOS 侧）」与「教务浏览器验收在至少一侧通过」**已满足**，Feature 推进到 `Implemented`；`Verified` 仍需 P0 全绿（Windows 侧 TC-G03 延期，`KI-001`），M4 里程碑保持 `In Progress`（见 [docs/planning/milestones/M4-acceptance.md](../../docs/planning/milestones/M4-acceptance.md)）。
