# M4: 验收（Acceptance）

> Status: In Progress（2026-09-23：Windows 真机验收已通过；`KI-014` 已接受，`KI-019` 因本地与外部成因未区分而重新 `Open`，仍阻止里程碑完成）
> Owner: cherrchen
> Target: TBD（原包未定义日期）

## 目标

在真机与真实 WebVPN 上完成第一期验收，达到「可私用」：

- macOS 与 Windows 各自的桌面 OS 上跑通 P0 用例；
- 浏览器打开并操作教务 `jwxt.swufe.edu.cn`（TC-G01..TC-G03）；
- 缺陷收敛，已知问题成文，测试报告可供后续引用。

## 包含的 Specs

| Spec | 状态 | 依赖 |
| ---- | ---- | ---- |
| [001-phase1-local-bridge](../../../specs/001-phase1-local-bridge/spec.md) | Implemented（两侧 P0 与教务浏览器验收已通过；`KI-019` 待定位后方可评估 `Verified`） | M3 |

## 退出条件

- [x] macOS：应用可启动并完成登录/开桥/关桥/退出全链路（TC-D01/D02/D03/D04、TC-C01..C04、TC-E01/E02/E03、TC-F01/F04、TC-G04、TC-H01/H02、TC-B05 通过）
- [x] macOS：浏览器可打开教务首页（TC-G01，P0）——**M5（2026-09-21）通过**：`KI-011` 修复（网关自有命名空间直通 + bootstrap 文档升级，[ADR-0007](../../architecture/adr/ADR-0007-gateway-owned-namespaces-and-native-mode-promotion.md)）后，入口 `http://jwxt.swufe.edu.cn/` 被升级到 WebVPN 原生 URL 形态并正常打开（桥日志 `detail=promoted`）
- [x] macOS：教务站内导航可用，不因绝对 URL 跳飞到不可达地址（TC-G02，P0）——**M5（2026-09-21）通过**：网关原生空间下首页菜单与站内「学生成绩查询」均可交互、无错误页（同一 [ADR-0007](../../architecture/adr/ADR-0007-gateway-owned-namespaces-and-native-mode-promotion.md)）
- [x] Windows：重复 TC-G01 通过（TC-G03，P0）——**2026-09-23 通过**（Windows 11 24H2 真机）：入口 `http://jwxt.swufe.edu.cn/` 经桥被升级到 `https://webvpn.swufe.edu.cn/http/<token>/`（桥日志 `detail=promoted`），cherrchen 确认页面可打开并可操作；`/xtgl/index_initMenu.html` 经桥 `200` 且响应体被反向改写
- [x] 所有 P0 用例通过（TC-A01/A02/A03、TC-B01..TC-B03、TC-C01..TC-C04、TC-D01..TC-D04、TC-E01/E02、TC-F01/F02、TC-G01..TC-G03）——**macOS 侧（M5 后）与 Windows 侧（2026-09-23）均已全部通过**：Windows 复跑结果为 TC-D01..D04、TC-C01..C04、TC-E01/E02/E03、TC-F01/F04、TC-G03、TC-G04、TC-H01/H02、TC-B05 通过
- [ ] P1 用例无未决阻断缺陷——`KI-014`（CAS 资源截断）已按非应用/桥原因与重载规避置 `Accepted`；`KI-019`（经桥访问教务偶发挂起）原上游归因证据不足，2026-09-23 复核后重新 `Open`，需区分本机 TUN/mitmproxy 与外部路径
- [x] 教务浏览器验收在至少一侧桌面 OS 通过（目标两侧都过）——**2026-09-23 两侧均通过**：macOS 侧 TC-G01/TC-G02（M5）与 Windows 侧 TC-G03（M4 Windows 轮）
- [x] 已知问题列表已记录（`id/title/severity/status/linked_case/owner/note`，含验收期新增 `KI-007`..`KI-020`；`KI-001` 于 2026-09-23 置 `Fixed`）
- [x] 相关文档已同步（含双语配对：`development-run.md`、milestone/roadmap/testing-strategy 与 Spec 五文件）

> 出口口径：macOS 与 Windows 的 P0 用例及教务浏览器验收均已通过，`KI-001` 已 `Fixed`。`KI-014` 已接受外部传输风险；`KI-019` 的历史挂起虽在本轮同路径复核中未复现，但原「非本地」归因不成立，故 M4 与 Spec 001 暂不推进到 `Done` / `Verified`。复核方法与证据见 [verification.md](../../../specs/001-phase1-local-bridge/verification.md) 的「KI-014 / KI-019 同日复核」。

验收环境：macOS 与 Windows 各一台测试机、Chrome/Edge、mitmproxy 与 curl；测试账号为测试者自有西财账号（不写入仓库），仅在授权设备上使用。
本轮实测补充：**验收前必须关闭其它代理工具的 TUN / 虚拟网卡模式**（Clash/mihomo fake-ip 会让经桥的上游连接挂起，见 `KI-013`；2026-09-21 起 fake-ip 形态已由开桥前预检拒绝，`redir-host` 形态仍需手动关闭，见 [ADR-0011](../../architecture/adr/ADR-0011-refuse-start-on-fake-ip-dns.md)）；教务只能以 `http://jwxt.swufe.edu.cn/...` 形态经网关代理（`https` 形态网关返回 `/wengine-vpn/failed`）。**2026-09-23 Windows 侧补充**：① Chrome / Edge 会把入口自动升级为 `https://`，验收时需用 `--disable-features=HttpsUpgrades` 或关闭「始终使用安全连接」；② 「指定应用」捕获不做 DNS 拦截，教务（无公网解析）只能用默认的「系统代理」模式；③ Windows 自带 curl 校验本机 CA 需 `--ssl-no-revoke`；④ 经桥访问教务存在偶发挂起（`KI-019`），重载即恢复。

## 风险

| 风险 | 影响 | 应对 |
| ---- | ---- | ---- |
| R5 学校政策限制自动化（低/高） | 验收时若被判定为不合规访问，项目需停更或改为手动转换 | 私用优先、文档声明用途边界；必要时降级为手动转换并保留结论 |
| R1 教务前端大量动态绝对 URL（中/高） | 站内导航可能在运行时动态拼接 URL，验收不通过 | 验收以「可操作关键路径」为主，不绑定 DOM；以响应改写分层与调试日志定位漏改 |
| R2 Cookie 字段变更（中/高） | 验收期间会话注入或过期判定失效，阻塞手工验收 | 探测集中 + 快速补丁；必要时重登后重跑相关用例 |

### M5 复验记录（2026-09-21，`KI-011` 修复后）

**范围**：`KI-011`（网关客户端 shim 与透明桥不兼容）的修复与 macOS 实机复验；修复方案见 [ADR-0007](../../architecture/adr/ADR-0007-gateway-owned-namespaces-and-native-mode-promotion.md)（网关自有命名空间直通 + bootstrap 文档升级到网关原生 URL 空间）。

**结果**：TC-G01 通过（入口 `http://jwxt.swufe.edu.cn/` → 桥日志 `detail=promoted` → 网关原生空间首页完整渲染）、TC-G02 通过（站内「学生成绩查询」可交互、链接不跳飞）；非 jwxt 主机（`www.swufe.edu.cn`）仍留在普通 URL 空间；`/wengine-vpn/js/main.js` 经桥 200 / 376 922 B（修复前经桥 404）；`lib.swufe.edu.cn` 因同样是 bootstrap 页而同样升级（预期）。回归：`uv run --directory bridges/python pytest -q` = 198 passed、App 单测 71 passed、`docs:check` 0 error / 0 warning、关桥后系统代理与进程均无残留。

**证据**：[specs/001-phase1-local-bridge/verification.md](../../../specs/001-phase1-local-bridge/verification.md) 的「M5（`KI-011` 修复）执行记录」；脱敏快照 `specs/001-phase1-local-bridge/evidence/acceptance-macos/acceptance-darwin-20260921-154657.md`。

**本轮新增问题**：`KI-014`（CAS 主题静态资源被服务端截断 → 登录窗样式丢失，重载可恢复；与桥无关）。

**仍未完成**：`KI-014`。（该轮记录的 `KI-007` 已于 2026-09-21 修复，见 [ADR-0008](../../architecture/adr/ADR-0008-ca-trust-authorization-in-app-session.md)；`KI-013` 已于 2026-09-21 修复，见 [ADR-0011](../../architecture/adr/ADR-0011-refuse-start-on-fake-ip-dns.md)；Windows 全部真机项已于 2026-09-23 补齐，见下节）

### M4 Windows 侧执行记录（2026-09-23）

**范围**：`KI-001`（Windows 真机项）的解除——按「M4 双平台验收执行手册」在 Windows 11 24H2 真机执行全部 Windows 项。

**环境**：`win32 10.0.26200`（x64、中文界面）、Node v24.14.0、`uv` 0.11.17、Python 3.13.11、真实西财账号（CAS/MFA）、真实 Chrome 与 Windows 自带 curl（Schannel）；隔离 profile；`SWUFE_PROBE_INTERVAL_MS=8000`；TC-G04 以管理员身份启动应用（UAC）。

**结果**：TC-G03（教务经桥可打开并可操作，入口 `detail=promoted`）、TC-D01..D04、TC-C01..C04、TC-E01/E02/E03、TC-F01、TC-F04、TC-G04（真实捕获：互斥 + 正向 + 反向）、TC-H01/H02、TC-B05 全部通过；命令侧 `pytest` `198 passed`、App 单测 `108 passed`、`typecheck` 无 error、`docs:check` 0 error/0 warning、`pnpm run acceptance:check --scheme http` 无 `FAIL`。

**本轮新增/修复的缺陷**：`KI-015`（登录成功后残留「尚未登录」错误）、`KI-016`（中文 Windows 下 `certutil` 检测失效 → CA 已导入却报「查不到该证书」）、`KI-017`（`execFile` 的 stdin 管道使 `certutil` 挂起至 10s 超时 → CA 安装必失败）、`KI-018`（`reg query` 的 CRLF 使 WinINET 代理读写恒为空 → 漏报 `PROXY_CONFLICT` 且关桥/退出不清代理）、`KI-020`（测试与证据工具的平台假设：模式位、Schannel curl、`ifconfig` 缺失导致回环约束用例静默跳过、HTTP/2 头名大小写）；`KI-001` 置 `Fixed`。

**Windows 验收当轮记录（后续复核已覆盖状态）**：`KI-019` 当时按疑似上游风险标为 `Accepted`，`KI-014` 当时为 `Open`；同日复核后 `KI-019` 重新 `Open`、`KI-014` 置 `Accepted`，见 [known-issues.md](../../../specs/001-phase1-local-bridge/known-issues.md) 与 [verification.md](../../../specs/001-phase1-local-bridge/verification.md)。

**证据**：[specs/001-phase1-local-bridge/verification.md](../../../specs/001-phase1-local-bridge/verification.md) 的「M4 Windows 验收执行记录（2026-09-23）」（含结果表、逐条 REQ/NFR/AC 覆盖与命令结果）；脱敏快照 `specs/001-phase1-local-bridge/evidence/acceptance-windows/`（4 份）；缺陷台账 [known-issues.md](../../../specs/001-phase1-local-bridge/known-issues.md) 的「Windows 真机验收新增」。

## 完成记录

**执行时间**：2026-09-21（macOS 本机，`darwin 24.6.0`，应用 `--user-data-dir=/tmp/m4-acceptance`，`SWUFE_PROBE_INTERVAL_MS=8000`）。

**执行方式**：真实应用 + CDP（`--remote-debugging-port=9222`）驱动界面，浏览器步骤关键观察由 cherrchen 手工完成（自动化导航在本环境反复卡死）；两侧平台共用的脱敏证据采集脚本为 `pnpm run acceptance:check`（T044）。

**证据**：
- [specs/001-phase1-local-bridge/verification.md](../../../specs/001-phase1-local-bridge/verification.md) 的「M4 双平台验收执行手册」+「M4 结果表」+「M4 教务浏览器验收记录」+「执行的命令与结果」M4 段；
- 脱敏快照：`specs/001-phase1-local-bridge/evidence/acceptance-macos/`（7 份）与 `evidence/kit-selfcheck/`（5 份，T044 自检）；
- 缺陷台账：[known-issues.md](../../../specs/001-phase1-local-bridge/known-issues.md)（`KI-001`..`KI-013`）。

**通过项**：TC-D01/D02/D03/D04、TC-C01/C02/C03/C04、TC-E01（经应用自带手动命令）/E02/E03、TC-F01/F04、TC-G04、TC-H01/H02、TC-B05；`uv run --directory bridges/python pytest -q` = 190 passed、`pnpm --filter swufe-webvpn-bridge run test:unit` = 71 passed、`pnpm --filter swufe-webvpn-bridge run typecheck` / `pnpm run typecheck` 无 error、`pnpm run docs:check` = 0 error/0 warning。

**失败项**：TC-G01、TC-G02（教务浏览器验收）。根因（`KI-011`）：本部署网关对每个 HTML 响应注入客户端 shim（`__vpn_*` + `<script src="/wengine-vpn/js/main.js">`），该 shim 期望浏览器工作在 WebVPN URL 空间；透明桥把该相对路径加 token 前缀 → 经桥 404（网关根为 200/376 922B）→ 首页白屏、真实页渲染但不可交互。三条候选解除路径（网关自有路径不经 token / HTML 中剥离 shim / 接受教务以门户形态使用）均改公共契约，需 cherrchen 决策并补 ADR。

**延期项**：Windows 全部真机项（`KI-001`）。

**验收期修复的缺陷**：`KI-008`（会话探测未带分区 Cookie ⇒ 任何真实会话被判过期、桥被自毁；P0）、`KI-009`（登录窗初始加载 ERR_ABORTED 被判致命 ⇒ 误导报错 + 页面停在只有扫码入口的初始渲染；P1）、`KI-010`（CA 卸载缺 `-Z` ⇒ 取不到指纹、无法卸载；P1）。

**遗留问题**：`KI-011`（P0 阻断教务验收）、`KI-012`（个别直连主机经 mitmproxy 无响应，环境相关）、`KI-013`（TUN 干扰需环境预检/文案补充，已于 2026-09-21 修复，见 [ADR-0011](../../architecture/adr/ADR-0011-refuse-start-on-fake-ip-dns.md)）、`KI-006`（Q-001 另两个失效信号，2026-09-21 决策维持 `Open`）。（该轮的 `KI-007` 已于 2026-09-21 修复：CA 安装改为「提权写钥匙串 + 应用进程写信任设置」，见 [ADR-0008](../../architecture/adr/ADR-0008-ca-trust-authorization-in-app-session.md)）
