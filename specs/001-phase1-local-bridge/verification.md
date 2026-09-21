# Verification: Phase 1 本机桥（001-phase1-local-bridge）

> Spec ID: 001
> Status: In Progress
> Owner: cherrchen
> Last Updated: 2026-09-21

> 本文件建立 **Requirement → Verification** 映射，是「Feature 是否完成」的判定依据。
> 规则见 [verification-strategy.md](../../docs/verification/verification-strategy.md)。
> Feature **不因为「代码写完了」被视为完成**；状态必须推进到 `Verified`。
> 当前进度：M1（桥核心）、M2（桌面编排）与 M3（体验打磨）已实现；M1 通过 L0/L1/L2，M2 通过 App 单测与 macOS 实机端到端验证，M3 通过新增的 L0/L1/App 单测与 macOS 实机界面验证（见下表 `Passed` 行与「执行的命令与结果」M3 段）。仍未验证的是：CA 写入/移除系统信任库（TC-E01/TC-E02，需管理员密码）、进程捕获在真实授权下的「只有所选应用经桥」范围验证（TC-G04 的 L3 部分，需测试者本人在系统扩展授权提示内确认）、Windows 真机项与教务浏览器验收（M4）。故 Feature 整体仍为 `In Progress`。

## 映射表

> 测试用例编号与分层沿用归档测试用例集（`docs/archive/2026-09-20-swufe-webvpn-bridge-docs-v1.0/02-testing/02-test-cases.md`）；层级定义见 [docs/development/testing-strategy.md](../../docs/development/testing-strategy.md)。M1 覆盖的自动化用例已 `Passed`，其余保持 `Pending` 并标注 M1 已通过的部分。

| Requirement | Verification | Status |
| ----------- | ------------ | ------ |
| REQ-001 | TC-H01（L3 手工：状态条与状态机一致，含捕获态）；应用启动 smoke（TC-G01/TC-G03 前置，L3 手工） | Pending（TC-G01/TC-G03 属 M4）；M3 已通过：主窗口一级「捕获方式」区、可增删的 allowlist 与日志面板实机可用；状态条在捕获生效时显示「桥接中（进程捕获）」（渲染层以真实推流验证，桥未运行时保持「桥接中」）；M2 已通过：应用启动 smoke，且五个状态（未登录/已登录/桥接中/错误/过期处理中）实机可见并与状态机一致 |
| REQ-002 | TC-D01、TC-D02、TC-D03（L1 组件 + L3 手工：登录成功、未登录拒绝开桥、过期停桥清代理弹窗） | Pending（TC-D01 的真实 CAS 会话待 L3）；M2 已通过：TC-D02（未登录时开关禁用且 `startBridge` 返回 `NOT_LOGGED_IN`）、TC-D03（过期级联实机 8 秒内完成）、TC-D01（桩上游「打开门户 → 采集 Cookie → 已登录」）；M1 已通过：Cookie 注入与去重、配置热更新 |
| REQ-003 | TC-C02、TC-C03、TC-C04（L1 组件 / L2 集成：设代理、关桥清代理、退出清代理）；TC-G04（L3 手工：进程捕获的范围与停止） | Pending（TC-G04 中「只有所选应用经桥、未被选中的应用不经桥」需在真实系统扩展授权下复验，见「未验证 / 无法验证项」）；M2 已通过：TC-C02/C03/C04 实机——开桥把 6 个启用服务指向 `127.0.0.1:8080`，关桥/退出清空，异常退出残留由 `recoverOnLaunch()` 自愈；M1 已通过：sidecar 起桥、回环监听、结束进程即停止；M3 已通过：`--mode regular@<port>` 起桥且 `swufe-ready.listen_port` 等于 `--port`（L2）、捕获模式集推导/回滚/不重试（L0 `tests/l0/test_capture.py`）、addon 叠加与移除 `local:` 并回报 `swufe-capture`（L1 `tests/l1/test_addon_capture.py`）、互斥编排（`app/test/orchestrator.test.ts` 6 例）、实机切到「指定应用」不设置系统代理（`networksetup` 证据见「M3 手工验证记录」）、系统代理被占用时拒绝启用「指定应用」并弹出冲突模态（实机 CDP 驱动） |
| REQ-004 | TC-C01（L1 组件 / L2 集成：已有系统代理时拒绝启动，错误码 `PROXY_CONFLICT`） | Passed（M2：实机 `Enabled: Yes / 127.0.0.1:7890` 时拒绝启动、模态提示、OS 设置未被改动、未启动 sidecar；`app/test/orchestrator.test.ts` 断言冲突时不调用 `enable`） |
| REQ-005 | TC-B01..B05（L0 单元 + L1 组件：默认值、精确命中、非名单直连语义、通配、持久化）；TC-H02（L3 手工：通配勾选） | Passed：M3 实机通过 TC-B05 / TC-H02——界面添加 `portal.swufe.edu.cn` 后出现在列表、删除后回落，非法主机名显示「主机名不合法：…」且不写入，勾选 `*.swufe.edu.cn` 与增删结果在重启 App 后仍保留（`/tmp/m3-e2e/config.json` 证据）；M1/M2 已通过：TC-B01..B05 以及 App 侧 `<userData>/config.json` 的读写与校验（`app/test/store.test.ts`）与跨语言同文件用例（`tests/l0/test_config.py`） |
| REQ-006 | TC-A01..A05（L0 单元：codec 向量）；TC-F01（L2 集成：curl 经代理访问 allowlist 主机） | Passed（M1） |
| REQ-007 | TC-F03（L1 组件：`Location` 反向改写）；TC-G02（L3 手工：教务页面内导航不跳飞） | Pending（TC-G02 属 M4）；M1 已通过：`Location`、`Set-Cookie` Domain/Path、HTML/JS/JSON 反向改写与内容类型边界（`tests/l1/test_rewrite.py`、`tests/l1/test_addon_response.py`） |
| REQ-008 | TC-D04（L2 集成 / L3 手工：登录 WebView 无代理环）；TC-F02（L2 集成：非 allowlist 直连不改写） | Pending（TC-D04 在真实 CAS 会话下的复验随 TC-D01）；M2 已通过：登录分区 `setProxy({mode:'direct'})`，实机日志 `resolveProxy(...) = DIRECT` 且登录期间无 `swufe-debug` 行；M1 已通过：TC-F02 与「已是 WebVPN 形态的请求直通」 |
| REQ-009 | TC-F04（L2 集成 + L3 手工：调试日志仅域名与改写结果）；TC-H01（L3 手工：状态可见） | Pending（「开桥产生流量后逐条出现」与真实桥联动需登录与 CA，见「未验证 / 无法验证项」）；M3 已通过：日志面板三列（时间/域名/结果）、200 条上限、最新在前、清空、随开关显示/隐藏与关闭时清空——在真实渲染层上以真实 `onDebugLog` 推流验证，且事件携带的额外字段（cookie/body）不进入界面；M2 已通过：debug 事件经 IPC 到达渲染层且只保留契约的五个键（`app/test/sidecar-lines.test.ts`、`app/test/debug-relay.test.ts`）；M1 已通过：TC-F04 的 L2 部分（键集固定、无 Cookie/正文） |
| REQ-010 | TC-E01、TC-E02、TC-E03（L3 手工，需管理员权限：安装 CA、卸载 CA、未装 CA 提示 `CA_MISSING`） | Pending（TC-E01/TC-E02 需管理员密码写入系统信任库，本机无法提权，未在真实信任库上验证）；M2 已通过：TC-E03（未装 CA 时开桥返回 `CA_MISSING` 且未做任何 OS 变更）、安装前风险提示模态、CA 生成入口（`tests/l1/test_ca.py`） |
| REQ-011 | TC-G01（L3 手工：macOS 教务验收）；TC-G03（L3 手工：Windows 教务验收） | Pending（M4） |
| NFR-001 | 代码审查（TLS/HTTP2/证书签发实现来自 mitmproxy，无自研 PKI）；TC-E01（L3 手工：CA 生成于 mitmproxy 专用 confdir） | Passed（M2：CA 生成入口 `swufe_bridge/ca.py` 复用 mitmproxy `CertStore`，App 与 sidecar 使用同一 `<userData>/mitmproxy/` confdir，实机开桥即在该目录生成 CA）；M1 已通过：TLS/HTTP2/证书签发全部来自 mitmproxy（无自研 PKI） |
| NFR-002 | TC-A01..A05（L0 单元：与 `wrd_codec.py` 向量一致，含 authserver / jwxt 样本） | Passed（M1） |
| NFR-003 | TC-D01（L1/L3：登录后无密码文件）＋ TC-F04（L2/L3：日志不含正文/Cookie）＋ 人工检查（L3：CA 私钥与会话文件权限仅本机用户可读、不上传） | Passed（M2：实机 `bridge-config.json` 与 CA 私钥均为 0600；会话只以 `name/value/domain/path` 下发 sidecar，WRD key/IV 不跨 IPC（`getSettings` 只返回界面可见子集）；会话存于 Electron 持久分区，不写密码文件）；M1 已通过：TC-F04 的自动化部分与 0600 写入 |
| NFR-004 | TC-C03、TC-C04（L1/L2：关桥与退出清代理）；TC-D03（L3 手工：过期清代理） | Passed（M2：实机三种路径均清空系统代理——关桥、退出（`before-quit` 清理完成后才退出）、会话过期；异常退出残留由下次启动的 `recoverOnLaunch()` 清除；`app/test/orchestrator.test.ts` 断言只清本桥项） |
| NFR-005 | TC-E01（L3 手工：安装 CA 前展示风险提示文案）；进程捕获授权引导文案 | Passed（M2：点击「安装本机 CA」先弹出风险模态，文案与 ui-ux 一致；取消后未发生任何安装动作。真实安装动作未执行，见 TC-E01。M3：捕获失败时实机显示「启用失败 — <原因>」+ macOS 扩展授权引导文案 + 「重试」按钮，文案与 [ui-ux/main-window.md](../../docs/ui-ux/main-window.md) 一致） |
| NFR-006 | TC-G01（macOS）、TC-G03（Windows）（L3 手工） | Pending（M4：macOS 的编排链路已在 M2 实机验证，Windows 实现 + 单测完成、真机验证延 M4/T038） |
| NFR-007 | TC-H01、TC-H02（L3 手工：界面文案为中文优先） | Passed：M3 实机确认新增的捕获方式区、应用列表、日志面板与两条新文案全部为中文；M2 已通过：主窗口状态条、按钮、模态与错误文案全部为中文，实机可见 |

Status 取值：`Pending` / `Passed` / `Failed` / `N/A`（`N/A` 必须写明理由）。

## 验收标准覆盖

| Acceptance Criteria | 对应验证项 | Status |
| ------------------- | ---------- | ------ |
| AC-001 | TC-G01 / TC-G03（L3 手工：双平台启动 Electron 应用） | Pending（M4；M2 已通过 macOS 启动 smoke：`npm --prefix app start` 显示主窗口并可交互，单实例锁生效） |
| AC-002 | TC-D01（L1/L3：登录后 `loggedIn=true`）+ TC-F04（日志检查无 Cookie/密码） | Pending（真实 CAS 会话待 L3）；M2 已通过：桩上游下「登录 → `loggedIn=true` → 状态条已登录」，过程无密码文件；M1 已通过：日志检查部分 |
| AC-003 | TC-C01（L1/L2：系统代理已占用时拒绝启动并提示） | Passed（M2：实机模态提示 + OS 设置未变 + 未启动 sidecar） |
| AC-004 | TC-C02 / TC-C03 / TC-C04（L1/L2：开桥设代理、关桥清代理、退出清代理）+ TC-G04（M3：指定应用时不设置系统代理） | Passed（M2：实机 `networksetup` 三态证据；M3：捕获方式为「指定应用」时编排层不调用 `enable` 并在切换时撤销本 App 设置过的代理（`app/test/orchestrator.test.ts`），实机切换捕获方式后 `networksetup` 仍为 `Enabled: No`。「只有所选应用经桥」的范围验收见「未验证 / 无法验证项」） |
| AC-005 | TC-E01 / TC-E02（L3 手工：CA 安装与卸载在系统信任库生效） | Pending（M2：实现、风险提示与 `CA_MISSING` 已通过，但写入/移除系统信任库需管理员密码，未在真实信任库上验证） |
| AC-006 | TC-B01 / TC-B02 / TC-B05（L0/L1）+ TC-H02（L3 手工：默认含 jwxt、可增删、可勾选通配） | Passed：M3 实机通过界面增删主机与通配勾选，且重启 App 后仍保留（TC-B05 / TC-H02）；M1/M2 已通过：默认值、小写化/校验、持久化与跨语言同文件读取 |
| AC-007 | TC-G01 / TC-G02 / TC-G03（L3 手工：教务可打开并操作） | Pending（M4） |
| AC-008 | TC-D03（L3 手工：过期停桥、清代理、弹窗重登） | Passed（M2：实机 8 秒内完成停桥 + 清代理 + 模态「WebVPN 会话已失效…」+ [去登录]，重登后状态回到「已登录」） |
| AC-009 | TC-F04（L2 + L3：调试日志仅域名与改写结果） | Pending（面板行为与最小化已通过，但「开桥产生流量后逐条出现」需登录与 CA，见「未验证 / 无法验证项」）；M3 已通过：面板三列 / 200 条上限 / 清空 / 随开关显示隐藏（真实渲染层 + 真实 `onDebugLog` 推流），且额外字段（cookie/body）不进入界面；M2 已通过：debug 事件经 IPC 到渲染层且只保留五个键；M1 已通过：L2 部分 |
| AC-010 | TC-D04（L2/L3：登录 WebView 不经本桥） | Pending（真实 CAS 会话下的复验随 TC-D01）；M2 已通过：登录窗 `resolveProxy = DIRECT`、登录期间无 webvpn/authserver 的 `swufe-debug` 行 |

## 执行的命令与结果

| 命令 | 结果 | 时间 | 备注 |
| ---- | ---- | ---- | ---- |
| `uv sync --frozen` | 通过（48 packages checked） | 2026-09-21 | lock 与 `pyproject.toml` 一致 |
| `uv run pytest tests/l0 -q` | `74 passed` | 2026-09-21 | TC-A01..A05、TC-B01..B05、运行时配置解析与热更新缓存 |
| `uv run pytest tests/l1 -q` | `74 passed` | 2026-09-21 | 请求改写、响应反向改写、日志最小化（INV-001）、配置热更新（T012） |
| `uv run pytest tests/l2 -q` | `6 passed` | 2026-09-21 | TC-F01/F02/F04、EC-006、回环约束（真 mitmdump + curl + 假上游） |
| `uv run pytest -q` | `154 passed` | 2026-09-21 | 全量（L0+L1+L2） |
| `uv run python -m swufe_bridge.wrd_codec decode '<authserver 样本 URL>'` | `https://authserver.swufe.edu.cn/authserver/login?service=http%3A%2F%2Fjwxt.swufe.edu.cn%2Fsso%2Fjziotlogin`（退出码 0） | 2026-09-21 | TC-A01 的命令行复核 |
| `uv run python -m swufe_bridge.sidecar --config <cfg> --port 18082 --confdir <dir>` + `curl -x http://127.0.0.1:18082 --cacert <dir>/mitmproxy-ca-cert.pem https://jwxt.swufe.edu.cn/sso/jziotlogin?x=9` | `swufe-ready`；`swufe-debug` 请求/响应各一条（`rewritten=true`）；假上游观测 `path=/https/<token>/sso/jziotlogin?x=9` 且 `cookie=wrdvpn_session=SMOKE-SESSION-VALUE`；curl 得到 `location: https://jwxt.swufe.edu.cn/next` | 2026-09-21 | 手工 dev smoke（假上游），见 [M1 完成记录](../../docs/planning/milestones/M1-mitm-bridge.md) |
| 同上，`webvpnBase=https://webvpn.swufe.edu.cn`（无真实会话） | 上游连接为 `webvpn.swufe.edu.cn:443`，请求行 `GET https://webvpn.swufe.edu.cn/https/<token>/sso/jziotlogin`；响应 `HTTP/2 302`，`location: https://webvpn.swufe.edu.cn/login`（按设计不改写），`detail=set-cookie` 表示真实 Set-Cookie 已触发反向改写 | 2026-09-21 | 真实上游可达但无会话；页面级可达性由 L3/M4 验证 |
| `npm run docs:check` | `0 error(s), 0 warning(s)`（links + 双语配对 + spec 结构） | 2026-09-21 | 含 M1 同步的文档与 Spec 状态 |
| `npm run typecheck` | 无 error | 2026-09-21 | 文档检查脚本类型检查 |
| `uv run pytest tests/l0 -q` | `75 passed` | 2026-09-21 | M2：新增跨语言配置键兼容用例 |
| `uv run pytest tests/l1 -q` | `79 passed` | 2026-09-21 | M2：新增 `tests/l1/test_ca.py`（CA 生成入口 5 例） |
| `uv run pytest -q` | `160 passed` | 2026-09-21 | M2：L0+L1+L2 全量 |
| `npm --prefix app run typecheck` | 无 error | 2026-09-21 | M2：Main / Renderer / preload 三个 tsconfig |
| `npm --prefix app run test:unit` | `55 passed` | 2026-09-21 | M2：状态机、代理/证书/进程解析、sidecar 控制行、会话探测分类、AppStore、debug 转发、Orchestrator |
| `npm --prefix app run build` | 通过（`dist/main` + `dist/renderer` + `dist/preload/index.js`） | 2026-09-21 | M2：preload 由 esbuild 打包成单文件 |
| 真实应用 `npm --prefix app start -- --user-data-dir=/tmp/m2-e2e`（CDP 驱动） | 未登录时开桥开关禁用；点「安装本机 CA」先出现风险模态（取消后 `security find-certificate … | wc -c` 仍为 0）；点「登录 WebVPN」→ 终端 `resolveProxy(...) = DIRECT`、状态变「已登录」；开桥 → `错误` + `CA_MISSING` 文案且 `networksetup -getwebproxy Wi-Fi` 仍为 `Enabled: No`；第二个实例 0s 退出（单实例锁） | 2026-09-21 | M2 实机 A 组（见 [M2 完成记录](../../docs/planning/milestones/M2-desktop-orchestration.md)） |
| CA 前置被替换的验证入口（`app/test/fixtures/stub-ca-app.js`，其余实现真实）+ 假上游 `portal-stub.mjs` | 开桥后 6 个服务 `Enabled: Yes / 127.0.0.1:8080`；`curl -x http://127.0.0.1:8080 --cacert <confdir>/mitmproxy-ca-cert.pem https://jwxt.swufe.edu.cn/` → 上游收到 WRD 形态路径与注入 Cookie、响应被反向改写；非 allowlist 直连未改写；debug 事件同时到终端与渲染层；过期级联 8 秒内完成；退出（`before-quit`）清代理；`kill -TERM` 残留由下次启动 `recoverOnLaunch()` 清除；代理冲突拒启且 OS 未变 | 2026-09-21 | M2 实机 B 组（CA 信任库写入需管理员密码，故该检查被替换，见完成记录的「实现期决策与偏差」） |
| `uv run pytest tests/l0 -q` | `97 passed` | 2026-09-21 | M3：新增 `tests/l0/test_capture.py`（14 例：spec 构造、模式集推导、pending/apply、失败回滚与不重试）与 `test_config.py` 的 `capture.processes` 用例（7 例） |
| `uv run pytest tests/l1 -q` | `86 passed` | 2026-09-21 | M3：新增 `tests/l1/test_addon_capture.py`（7 例：`regular_listen_port`、`_capture_tick` 启用/停用/失败去重、重写配置后重试、`swufe-ready` 上报端口并可启动捕获循环） |
| `uv run pytest tests/l2 -q` | `7 passed` | 2026-09-21 | M3：新增「默认配置不产生 `swufe-capture`（捕获为 opt-in）」与「`capture.processes` 含逗号 ⇒ `swufe-error CONFIG_INVALID` + 退出码 2」 |
| `uv run pytest -q` | `190 passed` | 2026-09-21 | M3：L0+L1+L2 全量 |
| `npm --prefix app run typecheck` | 无 error | 2026-09-21 | M3：三个 tsconfig（Main/Renderer/preload） |
| `npm --prefix app run test:unit` | `70 passed` | 2026-09-21 | M3：新增/改写 parse（pattern/name/分组）、store（默认值/校验/归一化）、orchestrator（捕获 6 例）、sidecar-lines（`swufe-capture` 三键） |
| `npm --prefix app run build` | 通过（`dist/main` + `dist/renderer` + `dist/preload/index.js`） | 2026-09-21 | M3：构建产物用于实机界面验证 |
| `npm run docs:check` | `0 error(s), 0 warning(s)`（148 文件） | 2026-09-21 | M3：新增 ADR-0006（中英）与全部 M3 文档同步后的链接/双语/spec 结构检查 |
| `npm run typecheck` | 无 error | 2026-09-21 | 文档检查脚本类型检查 |
| M3 实机界面验证（真实应用 + CDP 驱动，`npm --prefix app start -- --user-data-dir=/tmp/m3-e2e --remote-debugging-port=9222`） | 见下方「M3 体验打磨手工验证」：allowlist 增删/通配、捕获方式与应用勾选、日志面板、冲突模态全部符合预期，且重启后设置保留 | 2026-09-21 | 无管理员密码、无真实 WebVPN 会话；系统代理未被本 App 设置 |

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
1. macOS 测试机；仓库根已 `uv sync`，`app/` 已 `npm install`；
2. 假上游：`node app/test/fixtures/portal-stub.mjs --port 19080 --mode ok`；
3. `userData` 隔离目录（如 /tmp/m2-e2e）内 config.json 的 settings.webvpnBase 指向该假上游，debugLogging=true；
4. 有管理员权限时用真实入口 `npm --prefix app start -- --user-data-dir=<dir>`；无管理员权限时改用
   `app/test/fixtures/stub-ca-app.js`（仅替换 CA 信任检查，其余实现真实）。
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
1. macOS 测试机（本机）；仓库根已 `uv sync` 与 `npm --prefix app install`；
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
4. 重启应用（关闭后重新 `npm start`）⇒ allowlist（含通配勾选）、捕获方式「指定应用」、已勾选的应用全部保留
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

## 边界与异常场景

| 场景 | 期望行为 | 实际结果 | Status |
| ---- | -------- | -------- | ------ |
| EC-001 | 通配开启时 apex `swufe.edu.cn` 命中并按 WebVPN 改写（TC-B04） | L0：`match("swufe.edu.cn", wildcard=True) is True`，`notswufe.edu.cn` / `evilswufe.edu.cn` 为 False（`tests/l0/test_allowlist.py`） | Passed |
| EC-002 | `http://host:8080/x` 生成 `http-8080` scheme token 且可 decode 回主机（TC-A04） | L0：`encode_url("http://host:8080/x")` 含 `/http-8080/<token>/x`，`decode_url` 回 `http://host:8080/x`；`https://host:443/x` 不带端口段、`https://host:8000/x` 带 `-8000`；L1：addon 改写后 `path == /http-8080/<token>/x` | Passed |
| EC-003 | 非 allowlist 主机直连不改写，日志 `rewritten=false`（TC-B03、TC-F02） | L0：`example.com` 等不命中；L1：URL/Cookie/metadata 均不变且 `detail=not-allowlisted`；L2：`http://127.0.0.1:<direct>/plain` 正文原样返回、上游未收到注入 Cookie | Passed |
| EC-004 | 已是 WebVPN 形态的请求直通，不二次包装（TC-D04 相关检查） | L1：`https://webvpn.swufe.edu.cn/https/<token>/x`、`https://authserver.swufe.edu.cn/...`、配置的 `webvpnBase` 主机同名请求均原样透传（`tests/l1/test_addon_request.py::test_ec_004_*`）；客户端直连 webvpn 的响应（无改写元数据）也完全不改写 | Passed |
| EC-005 | 登录 WebView 访问 webvpn/authserver 主机不经本桥（TC-D04） | M2：登录分区固定 `setProxy({mode:'direct'})`，实机日志 `swufe-session 登录窗口 resolveProxy(...) = DIRECT`；登录期间无 webvpn/authserver 的 `swufe-debug` 行（证明未二次包装） | Passed（M2 部分：真实 CAS 会话下复验随 TC-D01） |
| EC-006 | allowlist 为空时拒绝开桥并返回 `ALLOWLIST_EMPTY`，UI 提示添加主机 | L2：sidecar 以退出码 `2` 结束并输出 `swufe-error ALLOWLIST_EMPTY allowlist 为空：请添加主机或启用 *.swufe.edu.cn`（`tests/l2/test_proxy_end_to_end.py`）；UI 提示属 M2/M3 | Passed（M1 部分） |
| EC-007 | Cookie 过期触发 `SESSION_EXPIRED`：停桥 → 清代理 → 停捕获 → 弹窗重登（TC-D03） | M2：探测到 `302 → /login` 后按「清代理 → 停 sidecar → 清会话 → 通知渲染层」级联，实机 8 秒内完成；`app/test/orchestrator.test.ts` 断言调用顺序与最终状态（进程捕获在 M2 恒为关闭） | Passed（M2） |
| EC-008 | 系统代理已被占用时拒绝启动并提示 `PROXY_CONFLICT`（TC-C01） | M2：实机读到 `Enabled: Yes / 127.0.0.1:7890` 时返回 `PROXY_CONFLICT`，UI 模态提示，OS 设置与代理标记均未被改动、未启动 sidecar；单测断言冲突时不调用 `enable` | Passed（M2） |
| EC-009 | 系统代理已被其它软件占用时启用「指定应用」（M3） | 拒绝（`PROXY_CONFLICT`），捕获方式设置不落盘，界面回显原捕获方式并弹出代理冲突模态 | 单测：`app/test/orchestrator.test.ts`「selecting apps is refused while another tool owns the system proxy」；实机（CDP 驱动真实应用）：先把 Wi-Fi web 代理设为 `127.0.0.1:7890` 并启用，再在界面切到「指定应用」⇒ 显示冲突文案 + 弹出模态 + 单选回落到已保存的捕获方式，`config.json` 的 `captureMode` 未被改写；随后已复原系统代理为 `Enabled: No` | Passed（M3） |

## 兼容性

| 维度 | 结论 | 依据 |
| ---- | ---- | ---- |
| 接口兼容 | 不适用（首次实现，无既有接口消费方） | 三个接口均为本 Spec 首次定义：[electron-ipc.md](../../docs/api/electron-ipc.md)、[bridge-control-protocol.md](../../docs/api/bridge-control-protocol.md)、[wrd-codec-library.md](../../docs/api/wrd-codec-library.md)；M1 已将 IF-002 从「候选方案」推进为方案 A（首版未定稿，无既有消费方） |
| 数据兼容 | 不适用（首次引入 `AllowlistConfig` / `SessionState` / `AppSettings`，无历史数据） | 无迁移需求：[design.md](design.md) §Data Model Changes、§Migration |
| 行为兼容 | 不适用（首次交付，无历史版本行为需要保持） | Phase 1 是首个交付版本；Linux/TUN/链式代理为 NG（[spec.md](spec.md)） |

## 安全

| 检查项 | 结论 | 依据 |
| ------ | ---- | ---- |
| 输入校验 | M1/M2/M3 已实现并验证 | `swufe_bridge/allowlist.normalize_host`（非法主机名抛 `InvalidHostError`）、`webvpn.swufe.edu.cn`/`authserver.swufe.edu.cn` 硬编码排除（INV-004）；M2/M3 的 IPC 侧参数校验（`setAllowlist`/`setCaptureMode`/`setCaptureProcesses`/`setDebugLogging`）与 App 侧主机名 / intercept pattern 校验（`app/test/store.test.ts`：非空、不含逗号、去重、上限 32）；`tests/l0/test_allowlist.py`、`tests/l1/test_addon_request.py` |
| 权限 | 设计已定义；M1/M2/M3 部分验证 | 运行时配置文件以 0600 写入（`write_runtime_config` 与 `ProxyOrchestrator.writeRuntimeConfig`）；实机确认 `<userData>/bridge-config.json` 与 CA 私钥均为 0600；CA 安装/卸载需管理员权限（TC-E01/TC-E02 未在真实信任库上验证）；macOS 进程捕获需系统扩展授权（M3 已实现失败引导 + 重试，真实授权范围见「未验证 / 无法验证项」） |
| 敏感数据 | M1/M2 部分验证 | 不存密码：会话保存在 Electron 持久分区，无任何密码落盘；Cookie 不进日志与诊断行（INV-001）；debug 事件跨 IPC 时只保留契约的五个键（防正文/Cookie 外泄）；`getSettings` 不返回 WRD key/IV；运行时配置文件 0600；CA 私钥仅本机（mitmproxy confdir，0600） |
| 回环约束 | M1 已实现并验证 | sidecar 硬编码 `--listen-host 127.0.0.1`（无开关）＋ addon 越界复查（`LISTEN_NOT_LOOPBACK`）；L2 断言代理端口在非回环地址上不可达 |

## 文档同步

| 文档 | 是否需要更新 | 状态 |
| ---- | ------------ | ---- |
| [docs/requirements/](../../docs/requirements/README.md) | 是 | 已同步：REQ-001..REQ-011 / NFR-001..NFR-007 的规范定义在 requirements，本 Spec 只引用 ID（M1/M2 均未新增需求） |
| [docs/operations/](../../docs/operations/README.md) | 是 | M2 已同步：配置落点（`<userData>/config.json`、`bridge-config.json`、`mitmproxy/`、登录分区）、开发期覆盖项与「持久文件为唯一来源」的配置优先级 |
| [docs/architecture/](../../docs/architecture/README.md) | 是 | M1 已同步：[interfaces.md](../../docs/architecture/interfaces.md)（IF-002 方案 A 定稿）；M2 已同步：[components.md](../../docs/architecture/components.md)（Electron 组件的代码位置与状态已落地，Windows 适配「实现待 M4 真机」）；M3 已同步：新增 [ADR-0006](../../docs/architecture/adr/ADR-0006-local-capture-mode-and-mutual-exclusion.md)（中英）并在 [ADR 索引](../../docs/architecture/adr/README.md) 登记，[components.md](../../docs/architecture/components.md) / [interfaces.md](../../docs/architecture/interfaces.md) / [data-flow.md](../../docs/architecture/data-flow.md) / [data-model.md](../../docs/architecture/data-model.md) 更新捕获方式、`capture` 配置键、`swufe-capture` 行与 `AppSettings.captureMode` / `captureProcesses` |
| [docs/api/](../../docs/api/README.md) | 是 | M1 已同步：[bridge-control-protocol.md](../../docs/api/bridge-control-protocol.md)（方案 A 定稿）、[wrd-codec-library.md](../../docs/api/wrd-codec-library.md)（Python 实现映射）；M2 已同步：[bridge-control-protocol.md](../../docs/api/bridge-control-protocol.md)（CA 生成入口与 M2 落点）、[electron-ipc.md](../../docs/api/electron-ipc.md)（`getSettings` / `onStatus` / `onSessionExpired`）；M3 已同步：[electron-ipc.md](../../docs/api/electron-ipc.md)（`setCapturePids` → `setCaptureProcesses` + 新增 `setCaptureMode`、`captureError`、`CaptureCandidate.pattern`、`AppSettingsView` 与错误码前缀约定，中英）、[bridge-control-protocol.md](../../docs/api/bridge-control-protocol.md)（`capture` 配置键、`swufe-capture` 诊断行、`--mode regular@<port>`，中英） |
| ADR | 是一部分 | M3 新增 [ADR-0006](../../docs/architecture/adr/ADR-0006-local-capture-mode-and-mutual-exclusion.md)：进程捕获用 mitmproxy `local` 模式且与系统代理互斥（中英 + 索引）；M1 未新增 ADR（未改架构/公共接口/数据模型/安全模型）；IF-002 的实现方式选择属实现阶段决策，记录于 [bridge-control-protocol.md](../../docs/api/bridge-control-protocol.md) |
| [docs/development/](../../docs/development/README.md) | 是 | M1 已同步：testing-strategy（分层/命名/运行命令与 CI）、coding-conventions（语言/目录/命名/错误处理）、dependency-policy（uv 与依赖登记）、development-workflow（分支与提交、CI）；M2 已同步：testing-strategy（App 单测层与 `app-tests.yml`）、coding-conventions（TS 目录/命名/模块格式）、dependency-policy（electron/esbuild/tsx/typescript/@types/node 记录）；M3 已同步：testing-strategy 补「进程捕获：L0/L1 注入式单测 + L3 手工范围验证」与用例基线（190 Python + 70 App 单测） |
| [docs/planning/](../../docs/planning/roadmap.md) | 是 | M1 已同步：[M1 里程碑](../../docs/planning/milestones/M1-mitm-bridge.md) 置 `Done`；M2 已同步：[M2 里程碑](../../docs/planning/milestones/M2-desktop-orchestration.md) 置 `Done` 并记录证据与遗留项；M3 已同步：[M3 里程碑](../../docs/planning/milestones/M3-experience-polish.md) 置 `Done`（退出条件勾选 + 完成记录 + 实现期偏差）、[roadmap](../../docs/planning/roadmap.md) 与 [milestones/README](../../docs/planning/milestones/README.md) 状态行同步 |
| `.en.md` 配对 | 是 | 已同步：`docs/**` 改动均成对更新（`npm run docs:check` 的 i18n 检查通过）；Spec 目录不属双语强制范围 |

## 未验证 / 无法验证项

| 项 | 原因 | 已尝试 | 需要谁决策 |
| -- | ---- | ------ | ---------- |
| L3 教务浏览器验收（TC-G01..G03） | 需要真实西财账号与授权设备完成 CAS/MFA，且设备需信任本机 CA | M2 已用假上游验证登录链路与编排全流程（Cookie 采集、状态、防环日志、过期级联）；M1 已就改写链路取证（L0/L1/L2 共 154 用例通过；真实 `webvpn.swufe.edu.cn` 的可达性与门户登录 302 已在手工 smoke 中确认），页面级验收仍待 M4 | cherrchen（测试者本人提供账号与设备） |
| CA 安装/卸载（TC-E01、TC-E02） | 写入/移除系统信任库需要交互式输入管理员密码，无人值守会话无法提权（本机 `sudo -n` 不可用） | M2 已实现完整路径（macOS `security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain <caCert>` / `security delete-certificate -Z <sha1>`，Windows 侧 `certutil -user`），并实测了安装前风险提示、取消后无副作用、`CA_MISSING` 与 CA 生成入口（`tests/l1/test_ca.py`） | cherrchen（在自有测试机提权执行） |
| 进程捕获的真实范围（TC-G04 的 L3 部分） | 需要在 macOS 系统扩展授权提示内确认（由测试者本人点击），且开桥需先安装 CA（管理员密码）与完成真实 WebVPN 登录；本验证会话不具备该条件 | M3 已用全部可自动化与可实机化的部分取证：`local:` 模式集的推导/回滚/不重试（`tests/l0/test_capture.py`）、addon 叠加/移除并回报 `swufe-capture`（`tests/l1/test_addon_capture.py`）、`--mode regular@<port>` 的端口上报（L2）、编排互斥与冲突拒绝（`app/test/orchestrator.test.ts`）、实机界面（捕获方式、候选应用归并、勾选持久化、冲突模态、失败引导），以及未开桥时本 App 不设置系统代理（`networksetup` 证据） | cherrchen（在测试机授权系统扩展后按 M3 里程碑「手工验证步骤」执行第 3–6 步） |
| 日志面板与真实桥联动（TC-F04 的端到端部分） | 需要开桥（登录 + CA 信任）后产生 `swufe-debug` 事件 | M3 已在真实渲染层以真实 `onDebugLog` 推流验证面板行为、200 条上限、清空与开关联动，并以契约束验证 `swufe-debug` 键集（L1/L2、`app/test/sidecar-lines.test.ts`） | cherrchen（装 CA 并登录后开桥跑一次流量） |
| Windows 真机项（TC-C02/C03/C04、TC-E01/E02 on Windows、TC-G03/G04） | 需要 Windows 测试机 | M2 已完成实现与单测（`app/test/system-proxy-parse.test.ts`、`app/test/cert-parse.test.ts`）；按计划在 M4/T038 做真机验证 | cherrchen（提供 Windows 测试机） |
| 会话 Cookie 名称与失效信号（Q-001 / DQ-001） | 需实机抓取 WebVPN 会话确认具体 Cookie 名与失效信号组合 | M1 已确认「未登录时上游返回 `https://webvpn.swufe.edu.cn/login` 302 且不改写」；M2 已把该信号实现为 `classifyProbe`（302 → `/login` 或 CAS 主机判过期）并实机验证级联；Cookie 名与另两个信号（Set-Cookie 清空、连续改写后 302 到 CAS）仍需实机确认 | cherrchen（以实机验证结论回写实现与文档） |

## 结论

- [ ] 映射表无 `Pending`（仍有三类受外部条件阻塞：TC-E01/TC-E02 的系统信任库写入、进程捕获真实授权范围（TC-G04 的 L3 部分）与日志面板的真实桥联动、Windows/真机项）；因此 M3 的 TC-G04 退出条件与 T026 保持未勾选（标注「部分完成」），其余 M3 退出条件与 T025/T027/T031 已勾选
- [x] 执行的命令与结果已记录
- [x] 文档影响已处理
- [ ] Spec 状态可推进到 `Verified`

> 当前：M1（桥核心）、M2（桌面编排）与 M3（体验打磨）已交付。M2 相关用例大量 `Passed`（REQ-004、NFR-001/NFR-003/NFR-004/NFR-005、AC-003/AC-004/AC-008 等）；M3 新增 `Passed`：REQ-005、NFR-007、AC-004（含互斥部分）、AC-006、EC-009，以及 REQ-001/REQ-003/REQ-009/AC-009 的 M3 部分。仍有三类受外部条件阻塞：系统信任库写入（TC-E01/E02）、进程捕获真实授权范围（TC-G04 的 L3 部分）、日志面板与真实桥的联动，加上 M4 的双平台与教务浏览器验收。因此 Feature 保持 `In Progress`，不推进到 `Verified`。
