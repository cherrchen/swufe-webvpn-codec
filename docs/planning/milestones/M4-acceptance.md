# M4: 验收（Acceptance）

> Status: In Progress
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
| [001-phase1-local-bridge](../../../specs/001-phase1-local-bridge/spec.md) | Implemented（M5 后；`Verified` 待 Windows 侧 `KI-001`） | M3 |

## 退出条件

- [x] macOS：应用可启动并完成登录/开桥/关桥/退出全链路（TC-D01/D02/D03/D04、TC-C01..C04、TC-E01/E02/E03、TC-F01/F04、TC-G04、TC-H01/H02、TC-B05 通过）
- [x] macOS：浏览器可打开教务首页（TC-G01，P0）——**M5（2026-09-21）通过**：`KI-011` 修复（网关自有命名空间直通 + bootstrap 文档升级，[ADR-0007](../../architecture/adr/ADR-0007-gateway-owned-namespaces-and-native-mode-promotion.md)）后，入口 `http://jwxt.swufe.edu.cn/` 被升级到 WebVPN 原生 URL 形态并正常打开（桥日志 `detail=promoted`）
- [x] macOS：教务站内导航可用，不因绝对 URL 跳飞到不可达地址（TC-G02，P0）——**M5（2026-09-21）通过**：网关原生空间下首页菜单与站内「学生成绩查询」均可交互、无错误页（同一 [ADR-0007](../../architecture/adr/ADR-0007-gateway-owned-namespaces-and-native-mode-promotion.md)）
- [ ] Windows：重复 TC-G01 通过（TC-G03，P0）——**延期**：机器不在本轮可访问环境（`KI-001`）
- [ ] 所有 P0 用例通过（TC-A01/A02/A03、TC-B01..TC-B03、TC-C01..TC-C04、TC-D01..TC-D04、TC-E01/E02、TC-F01/F02、TC-G01..TC-G03）——**macOS 侧已全部通过**（M5 后 TC-G01/TC-G02 转通过）；**未满足的只有 TC-G03**（Windows 真机项延期，`KI-001`）
- [ ] P1 用例无未决阻断缺陷——**未满足**：`KI-011` 已 `Fixed`（M5），`KI-007` 已 `Fixed`（2026-09-21，[ADR-0008](../../architecture/adr/ADR-0008-ca-trust-authorization-in-app-session.md)）；仍未决的是 `KI-013`（TUN 干扰）、`KI-014`（CAS 主题资源被服务端截断，需重载登录窗）
- [x] 教务浏览器验收在至少一侧桌面 OS 通过（目标两侧都过）——**M5（2026-09-21）已满足**：macOS 侧 TC-G01/TC-G02 通过；Windows 侧仍待 `KI-001` 解除后按 [development-run.md](../../operations/development-run.md) 复跑
- [x] 已知问题列表已记录（`id/title/severity/status/linked_case/owner/note`，含验收期新增 `KI-007`..`KI-014`；M5 后 `KI-011` 置 `Fixed`）
- [x] 相关文档已同步（含双语配对：`development-run.md`、milestone/roadmap/testing-strategy 与 Spec 五文件）

> 出口口径：macOS 侧（含教务浏览器验收）已全部通过；Windows 侧显式延期。**「至少一侧桌面 OS 通过」这一下限已在 M5（2026-09-21）达成**，但「所有 P0 通过」仍差 TC-G03（Windows，`KI-001`）、「P1 无未决阻断缺陷」仍有 `KI-013`/`KI-014`，故本里程碑保持 `In Progress`，Spec 001 推进到 `Implemented`（未到 `Verified`）。

验收环境：macOS 与 Windows 各一台测试机、Chrome/Edge、mitmproxy 与 curl；测试账号为测试者自有西财账号（不写入仓库），仅在授权设备上使用。
本轮实测补充：**验收前必须关闭其它代理工具的 TUN / 虚拟网卡模式**（Clash/mihomo fake-ip 会让经桥的上游连接挂起，见 `KI-013`）；教务只能以 `http://jwxt.swufe.edu.cn/...` 形态经网关代理（`https` 形态网关返回 `/wengine-vpn/failed`）。

## 风险

| 风险 | 影响 | 应对 |
| ---- | ---- | ---- |
| R5 学校政策限制自动化（低/高） | 验收时若被判定为不合规访问，项目需停更或改为手动转换 | 私用优先、文档声明用途边界；必要时降级为手动转换并保留结论 |
| R1 教务前端大量动态绝对 URL（中/高） | 站内导航可能在运行时动态拼接 URL，验收不通过 | 验收以「可操作关键路径」为主，不绑定 DOM；以响应改写分层与调试日志定位漏改 |
| R2 Cookie 字段变更（中/高） | 验收期间会话注入或过期判定失效，阻塞手工验收 | 探测集中 + 快速补丁；必要时重登后重跑相关用例 |

### M5 复验记录（2026-09-21，`KI-011` 修复后）

**范围**：`KI-011`（网关客户端 shim 与透明桥不兼容）的修复与 macOS 实机复验；修复方案见 [ADR-0007](../../architecture/adr/ADR-0007-gateway-owned-namespaces-and-native-mode-promotion.md)（网关自有命名空间直通 + bootstrap 文档升级到网关原生 URL 空间）。

**结果**：TC-G01 通过（入口 `http://jwxt.swufe.edu.cn/` → 桥日志 `detail=promoted` → 网关原生空间首页完整渲染）、TC-G02 通过（站内「学生成绩查询」可交互、链接不跳飞）；非 jwxt 主机（`www.swufe.edu.cn`）仍留在普通 URL 空间；`/wengine-vpn/js/main.js` 经桥 200 / 376 922 B（修复前经桥 404）；`lib.swufe.edu.cn` 因同样是 bootstrap 页而同样升级（预期）。回归：`uv run pytest -q` = 198 passed、App 单测 71 passed、`docs:check` 0 error / 0 warning、关桥后系统代理与进程均无残留。

**证据**：[specs/001-phase1-local-bridge/verification.md](../../../specs/001-phase1-local-bridge/verification.md) 的「M5（`KI-011` 修复）执行记录」；脱敏快照 `specs/001-phase1-local-bridge/evidence/acceptance-macos/acceptance-darwin-20260921-154657.md`。

**本轮新增问题**：`KI-014`（CAS 主题静态资源被服务端截断 → 登录窗样式丢失，重载可恢复；与桥无关）。

**仍未完成**：Windows 全部真机项（`KI-001`）；`KI-013`（TUN 干扰）、`KI-014`。（该轮记录的 `KI-007` 已于 2026-09-21 修复，见 [ADR-0008](../../architecture/adr/ADR-0008-ca-trust-authorization-in-app-session.md)）

## 完成记录

**执行时间**：2026-09-21（macOS 本机，`darwin 24.6.0`，应用 `--user-data-dir=/tmp/m4-acceptance`，`SWUFE_PROBE_INTERVAL_MS=8000`）。

**执行方式**：真实应用 + CDP（`--remote-debugging-port=9222`）驱动界面，浏览器步骤关键观察由 cherrchen 手工完成（自动化导航在本环境反复卡死）；两侧平台共用的脱敏证据采集脚本为 `npm run acceptance:check`（T044）。

**证据**：
- [specs/001-phase1-local-bridge/verification.md](../../../specs/001-phase1-local-bridge/verification.md) 的「M4 双平台验收执行手册」+「M4 结果表」+「M4 教务浏览器验收记录」+「执行的命令与结果」M4 段；
- 脱敏快照：`specs/001-phase1-local-bridge/evidence/acceptance-macos/`（7 份）与 `evidence/kit-selfcheck/`（5 份，T044 自检）；
- 缺陷台账：[known-issues.md](../../../specs/001-phase1-local-bridge/known-issues.md)（`KI-001`..`KI-013`）。

**通过项**：TC-D01/D02/D03/D04、TC-C01/C02/C03/C04、TC-E01（经应用自带手动命令）/E02/E03、TC-F01/F04、TC-G04、TC-H01/H02、TC-B05；`uv run pytest -q` = 190 passed、`npm --prefix app run test:unit` = 71 passed、`npm --prefix app run typecheck` / `npm run typecheck` 无 error、`npm run docs:check` = 0 error/0 warning。

**失败项**：TC-G01、TC-G02（教务浏览器验收）。根因（`KI-011`）：本部署网关对每个 HTML 响应注入客户端 shim（`__vpn_*` + `<script src="/wengine-vpn/js/main.js">`），该 shim 期望浏览器工作在 WebVPN URL 空间；透明桥把该相对路径加 token 前缀 → 经桥 404（网关根为 200/376 922B）→ 首页白屏、真实页渲染但不可交互。三条候选解除路径（网关自有路径不经 token / HTML 中剥离 shim / 接受教务以门户形态使用）均改公共契约，需 cherrchen 决策并补 ADR。

**延期项**：Windows 全部真机项（`KI-001`）。

**验收期修复的缺陷**：`KI-008`（会话探测未带分区 Cookie ⇒ 任何真实会话被判过期、桥被自毁；P0）、`KI-009`（登录窗初始加载 ERR_ABORTED 被判致命 ⇒ 误导报错 + 页面停在只有扫码入口的初始渲染；P1）、`KI-010`（CA 卸载缺 `-Z` ⇒ 取不到指纹、无法卸载；P1）。

**遗留问题**：`KI-011`（P0 阻断教务验收）、`KI-012`（个别直连主机经 mitmproxy 无响应，环境相关）、`KI-013`（TUN 干扰需环境预检/文案补充）、`KI-006`（Q-001 另两个失效信号）。（该轮的 `KI-007` 已于 2026-09-21 修复：CA 安装改为「提权写钥匙串 + 应用进程写信任设置」，见 [ADR-0008](../../architecture/adr/ADR-0008-ca-trust-authorization-in-app-session.md)）
