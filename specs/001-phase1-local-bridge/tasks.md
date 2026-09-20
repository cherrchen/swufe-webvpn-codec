# Tasks: Phase 1 本机桥（001-phase1-local-bridge）

> Spec ID: 001
> Status: In Progress
> Owner: cherrchen
> Last Updated: 2026-09-21

> 本文件供 Coding Agent **逐条执行**。任务必须足够小、可独立验证、说明输入输出与依赖。
> **禁止**把「实现整个 Feature」当作一个任务。
> 状态：`- [ ]` 未完成，`- [x]` 已完成。完成后立即更新，不要批量事后补勾。

## Task 格式

```markdown
- [ ] T001 <动作，动词开头> — 输入：… — 输出：… — 依赖：无 — 验证：<命令或检查> — 关联：REQ-001 / AC-001
```

要求：

| 字段 | 说明 |
| ---- | ---- |
| ID | `T` + 三位序号，单调递增，不复用 |
| 动作 | 一个具体改动（改哪个文件/模块） |
| 输入 | 需要的前置信息或产物 |
| 输出 | 完成后仓库中的可观察结果（文件、行为） |
| 依赖 | 前置任务 ID，无则写 `无` |
| 验证 | 可执行的验证方式（命令、检查或手工步骤） |
| 关联 | 对应的需求/验收标准 ID |

> 阶段对应关系：Phase 1 → WBS 1（MS0）、Phase 2 → WBS 2（MS1）、Phase 3 → WBS 3（MS1）、Phase 4 → WBS 4（MS2–MS3）、Phase 5 → WBS 5（MS2）、Phase 6 → WBS 6（MS2–MS4）、Phase 7 → WBS 7（MS4/M5 候选）。里程碑退出条件见 [plan.md](plan.md)。

## Phase 1 — 文档与治理（WBS 1）

- [ ] T001 建立并注册 Phase 1 Spec 五个文件 — 输入：归档原包 `docs/archive/2026-09-20-swufe-webvpn-bridge-docs-v1.0/`、事实清单 — 输出：`specs/001-phase1-local-bridge/{spec,design,plan,tasks,verification}.md` 可被引用，`docs/planning/roadmap.md` Spec 索引含 001 行 — 依赖：无 — 验证：`npm run spec:check` 无 error；链接检查通过 — 关联：REQ-001..REQ-011 / NFR-001..NFR-007
- [ ] T002 补齐开源许可与安全说明（WBS 1.2，后置，M5 候选） — 输入：[design.md](design.md) §Security Considerations、[docs/security/README.md](../../docs/security/README.md)、G-004 / NFR-003 — 输出：`LICENSE`（MIT）与安全/风险声明（HTTPS 解密范围、CA 可卸载、仅服务有权使用 WebVPN 的用户） — 依赖：T001 — 验证：检查许可文件与风险声明存在且链接可达 — 关联：G-004 / NFR-003

## Phase 2 — WRD 与核心库（WBS 2）

- [x] T003 固化 WRD codec 库（Python 权威实现） — 输入：归档原型 `99-appendix/wrd_codec.py`、[docs/api/wrd-codec-library.md](../../docs/api/wrd-codec-library.md) — 输出：可导入的 codec 模块，实现 `encryptHost` / `decryptHost` / `encodeUrl` / `decodeUrl`，默认 `key = iv = wrdvpnisthebest!` 且可配置覆盖 — 依赖：无 — 验证：`python -c` 对 authserver 样本 decode 得 `authserver.swufe.edu.cn`（TC-A01）、重编码一致（TC-A02） — 关联：REQ-006 / NFR-002 / ADR-0005
- [x] T004 建立 codec 向量测试 — 输入：T003 模块、归档样本（authserver / jwxt / 带端口） — 输出：L0 测试文件，覆盖样本 URL 解密、重编码一致、jwxt 编码可回解、`http-8080` scheme token、错误 key 失败 — 依赖：T003 — 验证：运行 L0 测试，TC-A01..TC-A05 全部通过 — 关联：REQ-006 / NFR-002 / AC-007
- [x] T005 实现 allowlist 匹配库 — 输入：[docs/architecture/data-model.md](../../docs/architecture/data-model.md) 的匹配算法 — 输出：`match(host)` 函数：精确命中、`includeSwufeWildcard` 时匹配 apex `swufe.edu.cn` 与 `.swufe.edu.cn` 后缀、`webvpn.swufe.edu.cn`/`authserver.swufe.edu.cn` 硬编码排除 — 依赖：无 — 验证：L0 测试 TC-B02、TC-B03、TC-B04 通过 — 关联：REQ-005 / REQ-008 / EC-001 / EC-003
- [x] T006 实现 allowlist 持久化与默认值 — 输入：T005、`AllowlistConfig` 实体定义 — 输出：`userData/config.json` 读写（`hosts`、`includeSwufeWildcard`、`updatedAt`；默认 `{"hosts":["jwxt.swufe.edu.cn"],"includeSwufeWildcard":false}`）与主机名小写化/合法性校验 — 依赖：T005 — 验证：L1 测试 TC-B01（默认含 jwxt）、TC-B05（增删后重启仍在） — 关联：REQ-005 / AC-006

## Phase 3 — Bridge Sidecar（WBS 3）

- [x] T007 搭建 mitm 工程骨架 — 输入：[ADR-0002](../../docs/architecture/adr/ADR-0002-reuse-mitmproxy-for-tls.md)、[docs/api/bridge-control-protocol.md](../../docs/api/bridge-control-protocol.md) — 输出：可启动的 mitmdump sidecar 入口（监听本地端口、专用 confdir、addon 加载点），开发模式使用本机 Python venv — 依赖：无 — 验证：启动 sidecar 后可经 `127.0.0.1:<bridge_port>` 代理发起一次 HTTPS 请求 — 关联：REQ-003 / NFR-001
- [x] T008 实现请求改写 addon — 输入：T003、T005、T007 — 输出：addon 识别 `scheme/host/port/path/query`；命中 allowlist 时生成 WebVPN URL、上游改为 `webvpn.swufe.edu.cn`、附加 WebVPN Cookie、按需最小必要调整 `Host`/`Origin`/`Referer`；未命中保持直连 — 依赖：T003、T005、T007 — 验证：L2 集成测试 TC-F01（curl 经代理访问 allowlist 主机，上游见 WebVPN 形态）、TC-F02（非 allowlist 直连且 `rewritten=false`） — 关联：REQ-006 / REQ-008 / EC-003 / EC-004
- [x] T009 实现响应反向改写：`Location` — 输入：T008 — 输出：响应 `Location` 由 WebVPN 形态回写为普通主机名语义 — 依赖：T008 — 验证：L1 组件测试用假上游返回 WebVPN Location，客户端跟随落到普通主机名（TC-F03） — 关联：REQ-007 / R-001
- [x] T010 实现响应反向改写：`Set-Cookie` 的 Domain/Path — 输入：T008 — 输出：与主机名相关的 Cookie 域/路径被改写，避免写到错误域 — 依赖：T008 — 验证：L1 组件测试断言改写后的 Cookie 属性落到真实主机域 — 关联：REQ-007 / R-001
- [x] T011 实现响应反向改写：HTML/JS/JSON 绝对 URL — 输入：T008 — 输出：`text/html`、`application/javascript`、`application/json` 中的校内绝对 URL 改写；其它内容类型不改写 — 依赖：T008 — 验证：L1 组件测试（录制流量/假上游）断言绝对 URL 被改写，非目标内容类型原样透传 — 关联：REQ-007 / R-001
- [x] T012 实现 Cookie/配置热更新通道 — 输入：T006、T008、[docs/api/bridge-control-protocol.md](../../docs/api/bridge-control-protocol.md) — 输出：运行中可推送/重载 `{allowlist, cookies, debug}`（含 `wrdKey`/`wrdIv` 覆盖），且 Cookie 不写入日志、不出现在控制口响应 — 依赖：T006、T008 — 验证：L1 测试：改 allowlist 后无需重启生效；检查日志与控制口响应中无 Cookie — 关联：REQ-002 / REQ-005 / NFR-003 / ADR-0005 — M1 证据：`tests/l1/test_addon_reload.py`；控制面为方案 A（配置文件 mtime 轮询），无控制口响应可查（见 [bridge-control-protocol.md](../../docs/api/bridge-control-protocol.md)）
- [x] T013 实现控制/健康检查口（可选） — 输入：T007、[docs/api/bridge-control-protocol.md](../../docs/api/bridge-control-protocol.md) — 输出：仅本机 `127.0.0.1` 的 `GET /health`、`POST /config`、`POST /shutdown`（若未采用该方式则实现等价的热加载通路） — 依赖：T007、T012 — 验证：curl 调 `/health` 返回存活；`/shutdown` 优雅退出 — 关联：REQ-003 / NFR-004 — M1 证据：未采用控制口，按任务允许的「等价通路」实现：配置文件热加载 + `swufe-ready` / `swufe-error` 进程信号面 + 结束进程即优雅停止，端到端断言见 `tests/l2/test_proxy_end_to_end.py`

## Phase 4 — Electron 应用（WBS 4）

- [ ] T014 建立 Electron 工程脚手架 — 输入：[ADR-0003](../../docs/architecture/adr/ADR-0003-electron-gui-for-phase-1.md)、[docs/api/electron-ipc.md](../../docs/api/electron-ipc.md) — 输出：可启动的 Main/Preload/Renderer 结构与应用窗口，开发模式可运行 — 依赖：无 — 验证：启动应用显示主窗口（TC-H01 前置） — 关联：REQ-001 / AC-001
- [ ] T015 注册 preload 契约与 IPC 通道 — 输入：T014、[docs/api/electron-ipc.md](../../docs/api/electron-ipc.md) — 输出：`window.swufeBridge` 暴露全部方法名与 `BridgeStatus`/`DebugLogEvent` 类型声明，通道注册可被 Renderer 调用 — 依赖：T014 — 验证：Renderer 调用一次 `getStatus` 返回 `idle` — 关联：REQ-001
- [ ] T016 实现登录 WebView 与 login/logout/getSession — 输入：T015 — 输出：内嵌窗口打开官方 WebVPN/CAS 供用户完成认证（含 MFA）；`login/logout/getSession` 返回 `{loggedIn, expiresAt?}` — 依赖：T015 — 验证：L3/手工完成 CAS 后 `loggedIn=true`（TC-D01）；未登录时 `startBridge` 返回 `NOT_LOGGED_IN`（TC-D02） — 关联：REQ-002 / AC-002
- [ ] T017 实现 Session Broker 的 Cookie 提取与持久化 — 输入：T016、`SessionState` 实体定义 — 输出：从登录 session partition 导出或按白名单拷贝 Cookie，写入 `userData/session.bin`（加密）或持久分区，权限收紧，不保存学号/密码 — 依赖：T016 — 验证：登录后会话文件存在且不含密码；Cookie 不会出现在日志（TC-D01、TC-F04） — 关联：REQ-002 / NFR-003 / AC-002 / R-002
- [ ] T018 实现防环 — 输入：T016 — 输出：登录 WebView 走 direct（或 bypass 含 `webvpn.swufe.edu.cn`、`authserver.swufe.edu.cn`）；已是 WebVPN 形态的请求直通不二次包装 — 依赖：T016、T008 — 验证：抓包/日志显示登录流量无 WRD 二次包装（TC-D04）；访问 webvpn 主机时 `rewritten=false` — 关联：REQ-008 / EC-004 / EC-005 / AC-010
- [ ] T019 实现会话失效检测与过期处理流程 — 输入：T017、T020、T026 — 输出：组合失效信号（探测 URL 返回登录页标记 / Set-Cookie 清空会话 / 连续改写后 302 到 CAS）触发 `SESSION_EXPIRED`：停桥 → 清系统代理 → 停进程捕获 → 弹窗重登 — 依赖：T017、T020 — 验证：模拟失效信号后桥停、系统代理清除、弹窗出现（TC-D03） — 关联：REQ-002 / EC-007 / AC-008 / R-002
- [ ] T020 实现 Proxy Orchestrator：冲突检测与系统代理 — 输入：T007、T029/T032（平台适配） — 输出：开桥前读 OS 代理——已启用且非本桥 ⇒ `PROXY_CONFLICT` 拒绝启动；否则设置 `127.0.0.1:<bridge_port>` 并记录「由本 App 设置」标记；关闭/退出仅在该标记存在时清除 — 依赖：T007 — 验证：TC-C01（已有代理拒绝启动且 OS 设置未变）、TC-C02（开桥设代理）、TC-C03（关桥清代理）、TC-C04（退出清代理） — 关联：REQ-003 / REQ-004 / EC-008 / AC-003 / AC-004 / NFR-004 / ADR-0004
- [ ] T021 实现 Proxy Orchestrator：sidecar 生命周期 — 输入：T007、T020 — 输出：spawn/stop mitmdump、桥状态机 `idle → starting → running`／`running → stopping → idle`／`starting → error → idle`，sidecar 异常退出报 `BRIDGE_CRASH` 且不留半开状态 — 依赖：T020 — 验证：开桥后状态为 `running`；杀 sidecar 后状态为 `error`（`BRIDGE_CRASH`），系统代理被清除 — 关联：REQ-003 / NFR-004
- [ ] T022 实现 Cert Manager：CA 生成 — 输入：T007、[ADR-0002](../../docs/architecture/adr/ADR-0002-reuse-mitmproxy-for-tls.md) — 输出：使用 mitmproxy 专用 confdir 生成本机 MITM CA（不自研 PKI），提供 `getCaStatus` — 依赖：T007 — 验证：首次运行生成 CA 文件且私钥仅本机；`getCaStatus.installed=false`（TC-E03 前置） — 关联：REQ-010 / NFR-001 / NFR-003
- [ ] T023 实现 Cert Manager：安装到系统信任 — 输入：T022、T030/T033（平台信任库） — 输出：`installCa` 先展示风险提示（本机 HTTPS 会被解密、仅限个人设备、可随时卸载），再写入系统信任库并回显状态 — 依赖：T022 — 验证：TC-E01（信任库可见本机 CA、UI 显示已安装、安装前有风险提示）；未装 CA 时开桥/访问 HTTPS 报 `CA_MISSING`（TC-E03） — 关联：REQ-010 / NFR-005 / AC-005
- [ ] T024 实现 Cert Manager：一键卸载 — 输入：T023 — 输出：`uninstallCa` 从系统信任库移除本机 CA，`getCaStatus` 回到未安装 — 依赖：T023 — 验证：TC-E02（信任移除、UI 状态同步） — 关联：REQ-010 / G-003 / AC-005
- [ ] T025 实现 Allowlist/开关/状态 UI — 输入：T006、T015、T020 — 输出：主窗口状态条（未登录/已登录未开桥/桥接中/错误/过期处理中）、桥开关（未登录时禁用）、allowlist 增删、`*.swufe.edu.cn` 勾选、错误原因文案（`PROXY_CONFLICT` 提示先关闭 Clash / mihomo / sing-box 等） — 依赖：T006、T015、T020 — 验证：TC-H01（状态与状态机一致）、TC-H02（通配勾选保存成功）、TC-B05（UI 增删后重启仍在） — 关联：REQ-001 / REQ-005 / REQ-009 / AC-006 / R-004
- [ ] T026 实现进程捕获 UI — 输入：T007、[docs/api/electron-ipc.md](../../docs/api/electron-ipc.md) — 输出：`listCaptureCandidates`/`setCapturePids` 与进程选择界面，关闭开关时一并停止捕获 — 依赖：T007、T015 — 验证：TC-G04（仅指定浏览器经 local 捕获生效；关闭后捕获停止） — 关联：REQ-003 / NFR-006
- [ ] T027 实现调试日志面板 — 输入：T008、T012 — 输出：`setDebugLogging` 开关与 `onDebugLog` 面板（域名 | 改写结果 | 时间），默认关闭且不含正文/Cookie — 依赖：T008、T012 — 验证：TC-F04（日志仅 `host`/`rewritten`/`ts`，无响应正文） — 关联：REQ-009 / NFR-003 / AC-009
- [ ] T028 实现 startBridge/stopBridge/getStatus 与桥状态机 — 输入：T015、T019、T020、T021、T022 — 输出：`BridgeStatus`（`state`/`loggedIn`/`systemProxyEnabled`/`localCaptureEnabled`/`bridgePort`/`error`）与开桥前置校验（会话、CA、allowlist 非空：`NOT_LOGGED_IN`/`CA_MISSING`/`ALLOWLIST_EMPTY`） — 依赖：T015、T019、T020、T021、T022 — 验证：TC-D02（未登录 `NOT_LOGGED_IN`）、allowlist 为空返回 `ALLOWLIST_EMPTY`（EC-006）、`getStatus` 各状态与实现一致（TC-H01） — 关联：REQ-001 / REQ-002 / REQ-010 / EC-006

## Phase 5 — 系统适配（WBS 5）

- [ ] T029 实现 macOS 系统代理读写适配 — 输入：T020 — 输出：macOS 平台侧读取/设置/清除系统 HTTP/HTTPS 代理的实现（含「由本 App 设置」标记语义） — 依赖：T020 — 验证：macOS 上 TC-C02/C03/C04 通过 — 关联：REQ-003 / REQ-011 / NFR-006
- [ ] T030 实现 macOS 证书信任库适配 — 输入：T022 — 输出：macOS 侧 CA 写入/移除系统信任库的实现（需管理员权限） — 依赖：T022 — 验证：macOS 上 TC-E01/TC-E02 通过 — 关联：REQ-010 / REQ-011
- [ ] T031 实现 macOS 权限引导 — 输入：T026 — 输出：辅助功能/网络扩展类授权缺失时的引导文案与状态提示，不阻塞系统代理路径 — 依赖：T026 — 验证：手工步骤：拒绝授权后 UI 给出可执行引导且系统代理路径仍可用 — 关联：REQ-003 / NFR-006 / R-004
- [ ] T032 实现 Windows 系统代理读写适配 — 输入：T020 — 输出：Windows 平台侧读取/设置/清除系统 HTTP/HTTPS 代理的实现 — 依赖：T020 — 验证：Windows 上 TC-C02/C03/C04 通过 — 关联：REQ-003 / REQ-011 / NFR-006
- [ ] T033 实现 Windows 证书存储适配 — 输入：T022 — 输出：Windows 侧 CA 写入/移除系统证书存储的实现 — 依赖：T022 — 验证：Windows 上 TC-E01/TC-E02 通过 — 关联：REQ-010 / REQ-011

## Phase 6 — 测试与验收（WBS 6）

- [x] T034 接入 L0 自动化测试（CI） — 输入：T004、T005、T006 — 输出：CI 每次 PR 运行 codec 向量与 allowlist 函数测试 — 依赖：T004、T005、T006 — 验证：CI 上 L0 全部通过（TC-A01..A05、TC-B01..B04） — 关联：NFR-002 — M1 证据：`.github/workflows/python-tests.yml`（`uv sync --frozen` + `uv run pytest tests/l0 -q`）
- [x] T035 编写 L1 组件测试（addon 对录制流量/假上游） — 输入：T008..T012 — 输出：本地 L1 测试集，覆盖请求改写决策与三类响应改写、Cookie 处理 — 依赖：T008..T012 — 验证：L1 全部通过（TC-F02、TC-F03） — 关联：REQ-006 / REQ-007 — M1 证据：`tests/l1/`（请求改写、响应三类反向改写、Cookie、日志最小化、热更新）
- [x] T036 编写 L2 集成测试（mitmdump + curl 经代理访问假 WebVPN） — 输入：T007、T008 — 输出：本地 L2 测试脚本，断言上游看到 WebVPN 形态与直连分流 — 依赖：T007、T008 — 验证：L2 通过（TC-F01） — 关联：REQ-006 / REQ-008 — M1 证据：`tests/l2/test_proxy_end_to_end.py`（真 mitmdump + curl + 假 WebVPN 上游）
- [ ] T037 执行 macOS 教务手工验收 — 输入：T020..T028、真实账号与授权设备 — 输出：macOS 验收记录（TC-G01 打开教务首页、TC-G02 页面内导航不跳飞） — 依赖：T020..T028 — 验证：TC-G01、TC-G02 通过（不绑定 DOM，以关键路径可操作为准） — 关联：REQ-006 / REQ-007 / AC-007 / R-001
- [ ] T038 执行 Windows 教务与进程捕获手工验收 — 输入：T032、T033、T026 — 输出：Windows 验收记录（TC-G03 教务首页；TC-G04 进程捕获） — 依赖：T032、T033、T026 — 验证：TC-G03、TC-G04 通过 — 关联：REQ-011 / AC-001 / AC-007
- [ ] T039 缺陷修复与已知问题列表 — 输入：T034..T038 的执行记录 — 输出：P0 全部通过、P1 无未决阻断缺陷，已知问题列表（`id/title/severity/status/linked_case/owner/note`）已记录 — 依赖：T034..T038 — 验证：出口准则逐条核对（所有 P0 通过、P1 无未决阻断、教务验收至少一侧通过、已知问题已记录） — 关联：AC-001..AC-010

## Phase 7 — 打包（WBS 7）

- [ ] T040 编写开发版运行说明 — 输入：T014、T007 — 输出：开发运行说明（本机 Node + Python venv + mitmdump 的启动步骤与前置条件） — 依赖：T014、T007 — 验证：按说明在干净环境可启动开发版并通过 L0/L1 — 关联：NFR-006
- [ ] T041 构建安装包骨架（后置） — 输入：T040 — 输出：Electron 打包配置与 sidecar 外置的安装包构建脚本 — 依赖：T040 — 验证：构建产物可安装启动并开桥 — 关联：REQ-011 / R-003
- [ ] T042 确定 sidecar 分发形态并验证体积 — 输入：T041、[spec.md](spec.md) Q-002 / DQ-002 — 输出：嵌入式 Python 与外置 `mitmproxy` 可执行文件的取舍结论与体积记录 — 依赖：T041 — 验证：记录两种形态的包体积与启动验证结果；跨平台分发说明完整 — 关联：REQ-011 / NFR-001 / R-003

## 注意事项

- 同一文件的任务应串行，或先指定集成责任人；
- 需要外部决策的任务先标记阻塞，不要用猜测推进；
- 任务完成但验证未通过时，保持未勾选，并在 [verification.md](verification.md) 中记录 `Failed`；
- 发现新任务时追加到对应 Phase，不要扩大既有任务范围。
