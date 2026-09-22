# Feature: Phase 1 本机桥（001-phase1-local-bridge）

> Spec ID: 001
> Status: In Progress
> Owner: cherrchen
> Created: 2026-09-20
> Related: REQ-001..REQ-011 / NFR-001..NFR-007 / ADR-0001..ADR-0006
> 界面结构提示（2026-09-23）：本 Spec 的**界面结构部分**已被 [spec 002](../002-desktop-ui-multiwindow/spec.md) 取代——REQ-009 的日志面板位置、REQ-005 的 allowlist 编辑界面、REQ-003 的候选应用列表归属改为「主窗口 + 三个非模态二级窗口」（新增 [REQ-012](../../docs/requirements/functional-requirements.md)）。本 Spec 的结论与历史验收证据（含 AC-009 等）保留不变，界面结构的当前事实以 002 为准。

## Status

`Draft | Approved | In Progress | Implemented | Verified | Archived`

当前为 `Implemented`（2026-09-21）：M1（桥核心）已实现并通过 L0/L1/L2——桥 sidecar、WRD codec、allowlist 匹配与持久化、请求改写与响应反向改写、配置热更新、L0 CI；M2（桌面编排）已实现并通过 App 单测与 macOS 实机端到端验证——Electron 壳、登录 WebView 与 Session Broker（防环）、Proxy Orchestrator（代理冲突检测、系统代理与 sidecar 生命周期）、Cert Manager（含独立 CA 生成入口与安装前风险提示）、会话过期级联（停桥 → 清代理 → 弹窗重登）、退出清代理与残留自愈。M3（体验打磨）已实现——可编辑 allowlist UI、一级「捕获方式」与进程捕获（mitmproxy local 模式）、调试日志面板、捕获态状态与授权引导文案，人工验证结果见 [verification.md](verification.md)；M4（验收）的 **macOS 侧已执行**（2026-09-21，真实应用 + CDP + 真实 CAS/MFA 会话）：登录/未登录拒绝、开桥与系统代理、代理冲突、会话失效级联、进程捕获真实范围、日志面板、退出清代理、CA 安装（经应用自带手动命令）与卸载均通过；M4 期间教务浏览器验收（TC-G01/TC-G02）因网关客户端 shim 与透明桥不兼容而失败（`KI-011`，P0）。**M5（2026-09-21，`KI-011` 修复后的复验）**：网关自有命名空间直通 + bootstrap 文档升级到网关原生 URL 空间（[ADR-0007](../../docs/architecture/adr/ADR-0007-gateway-owned-namespaces-and-native-mode-promotion.md)）在 macOS 实机复验通过——教务首页可打开、站内导航可操作（TC-G01/TC-G02/AC-007），其它 allowlist 主机仍留在普通 URL 空间；`uv run --directory bridges/python pytest -q` = 198 passed、App 单测 71、`docs:check` 0 error/0 warning。仍有两类未完成：Windows 侧全部真机项延期（`KI-001`）、CA 的自动安装路径在 macOS 15.6 上失败（`KI-007`）与个别直连主机/环境干扰（`KI-012`/`KI-013`），因此本 Spec 为 `Implemented`，**不**推进到 `Verified`（`Verified` 需要 P0 全绿，仍差 Windows 侧）。证据见 [verification.md](verification.md) 的 M4/M5 记录、[M1 里程碑](../../docs/planning/milestones/M1-mitm-bridge.md)、[M2 里程碑](../../docs/planning/milestones/M2-desktop-orchestration.md)、[M3 里程碑](../../docs/planning/milestones/M3-experience-polish.md) 与 [M4 里程碑](../../docs/planning/milestones/M4-acceptance.md)。

## Background

学校校外访问校内 Web 资源依赖网瑞达（Wengine）WebVPN `webvpn.swufe.edu.cn`，统一身份认证经 `authserver.swufe.edu.cn`（CAS，可含 MFA）。长期事实见 [docs/overview/project-overview.md](../../docs/overview/project-overview.md)、[docs/requirements/](../../docs/requirements/README.md) 与 [docs/architecture/overview.md](../../docs/architecture/overview.md)。

Phase 1 预研（M0）已完成：WRD URL 编解码已由原型 `wrd_codec.py` 在实机 URL 上验证，需求规格已与产品方对齐（2026-09-20）。本 Spec 是该 Phase 的唯一交付 Spec，记录从需求到验证的完整链路。

仓库布局已在 M5 之后按 [ADR-0009](../../docs/architecture/adr/ADR-0009-monorepo-layout.md) 迁移为 `apps/<app>` + `bridges/<bridge>`（Electron 应用在 `apps/desktop/`、Python 桥在 `bridges/python/`）；本 Spec 记录的历史证据产生于迁移前的旧布局，文中路径已按新布局标注。

## Problem

WebVPN 是**应用层反向代理**，不是 SSLVPN/TUN，因此本机普通浏览器/应用无法以「真实内网主机名」透明访问校内 HTTP/HTTPS 服务：用户只能在 WebVPN 门户内使用其改写后的 URL。

由此产生的具体痛点：校内站点（尤其教务系统）页面内存在大量绝对 URL，离开 WebVPN 形态后会跳飞到不可达的公网直连；Cookie 的 `Domain` 也可能被写到错误域。因此无法在常规浏览器的书签/多标签下正常使用。

不做的影响：只能在 WebVPN 门户内逐页操作，无法用本机浏览器直接访问 `https://jwxt.swufe.edu.cn/...`，效率与可用性受限。

## Goals

> 目标与其成功判据的规范定义在 [docs/overview/goals-and-non-goals.md](../../docs/overview/goals-and-non-goals.md)（Source of Truth）；本表只引用 ID。

| ID | 目标（摘要） | 成功判据 |
| -- | ------------ | -------- |
| G-001 | 完成官方登录后，allowlist 内主机自动经 WebVPN 访问 | 见 [G-001](../../docs/overview/goals-and-non-goals.md) |
| G-002 | 体验：从「已登录」到「浏览器打开教务」≤ 3 次点击 | 见 [G-002](../../docs/overview/goals-and-non-goals.md) |
| G-003 | 安全：无密码落盘；CA 可一键卸载；关闭后无残留系统代理 | 见 [G-003](../../docs/overview/goals-and-non-goals.md) |
| G-004 | 架构保持日后可开源（私用优先） | 见 [G-004](../../docs/overview/goals-and-non-goals.md) |

## Non-goals

| ID | 非目标 | 原因 |
| -- | ------ | ---- |
| NG-001 | SSH / 数据库 / SMB / 任意 TCP·UDP | 第一期只覆盖命中 allowlist 的 HTTP/HTTPS 流量改写 |
| NG-002 | 替代学校 SSLVPN 或 TUN 级真 VPN | 第一期不上 TUN；TUN/分流内核为后续阶段（PR-005 Won't now） |
| NG-003 | 与 Clash / mihomo / sing-box 对系统代理的链式共存 | 与其它系统代理叠加难以测试，改为检测到系统代理被占用即拒绝启动（[ADR-0004](../../docs/architecture/adr/ADR-0004-refuse-start-when-system-proxy-in-use.md)） |
| NG-004 | PAC | 无 PAC 需求；分流由本桥的 allowlist 匹配决定 |
| NG-005 | 存储密码或自动化填密码绕过 MFA | 安全约束：不存密码、不绕过统一身份认证流程 |
| NG-006 | 班级批量分发、应用商店上架 | 第一期以私用为主，不按批量分发设计安装与签名流程 |
| NG-007 | Linux | 第一期平台范围为 macOS / Windows（REQ-011） |
| NG-008 | 保证所有证书钉扎（pinning）应用可用 | HTTPS 解密不适用于启用证书钉扎的客户端，第一期不承诺 |

> 非目标的规范性定义见 [docs/overview/goals-and-non-goals.md](../../docs/overview/goals-and-non-goals.md)。

## User Stories

| ID | 角色 | 我想要 | 以便 | 优先级 |
| -- | ---- | ------ | ---- | ------ |
| US-001 | 西财师生（开发者本人优先） | 在校外完成官方 WebVPN（CAS/MFA）登录后，用本机普通浏览器直接访问教务等 allowlist 站点 | 不必在 WebVPN 门户内逐页操作 | Must |
| US-002 | 西财师生 | 一眼看到当前连接状态与错误原因 | 出现问题（代理冲突、未登录、会话过期）时知道下一步做什么 | Must |
| US-003 | 西财师生 | 自定义 allowlist（增删主机、可选启用 `*.swufe.edu.cn`） | 只让需要的校内站点经 WebVPN 改写，其余流量直连 | Must |
| US-004 | 西财师生 | 会话过期时被告知并自动清理（停桥、清代理、停进程捕获） | 不留下「半开」的系统代理，也不误以为还能访问 | Must |

## Functional Requirements

> 规范定义（说明、验收细节）在 [docs/requirements/functional-requirements.md](../../docs/requirements/functional-requirements.md)；本表只引用 ID。
> 来源列中的原包路径以 `docs/archive/2026-09-20-swufe-webvpn-bridge-docs-v1.0/` 为前缀（历史归档，非当前事实来源）。

| ID | 需求 | 优先级 | 来源 |
| -- | ---- | ------ | ---- |
| REQ-001 | Electron 应用外壳（登录窗、连接开关、捕获方式选择、可增删的 allowlist 管理、状态区、CA 安装/卸载、调试日志开关与日志面板；托盘非必须） | Must | FR-1（99-appendix/requirements-onepager-v1.0.md §4） |
| REQ-002 | 登录与会话（Session Broker）：不存学号/密码，只保存会话所需 Cookie 及最小附属状态；过期时停桥、清代理、停进程捕获并弹窗重登 | Must | FR-2（99-appendix/requirements-onepager-v1.0.md §4） |
| REQ-003 | 流量接管（TUN 之前）：两种捕获方式**互斥**且由显式 `captureMode` 控制——`system-proxy`（系统 HTTP/HTTPS 代理指向本地桥端口，全部流量）或 `selected-apps`（mitmproxy local 模式按进程捕获，仅所选应用经桥且本 App 不设置系统代理） | Must | FR-3（99-appendix/requirements-onepager-v1.0.md §4） |
| REQ-004 | 与其它代理共存：启动前检测系统代理，已被占用则拒绝启动并提示先关闭 Clash / mihomo / sing-box 等 | Must | FR-4（99-appendix/requirements-onepager-v1.0.md §4） |
| REQ-005 | Allowlist 路由：仅 allowlist 主机（含可选 `*.swufe.edu.cn`）经 WebVPN 改写；其余直连；默认必保 `jwxt.swufe.edu.cn`，可自定义增删 | Must | FR-5（99-appendix/requirements-onepager-v1.0.md §4） |
| REQ-006 | WRD 请求改写：WrdCodec 生成 WebVPN URL；上游改为 `webvpn.swufe.edu.cn`；附加 WebVPN Cookie；按需最小必要调整 `Host`/`Origin`/`Referer` | Must | FR-6（请求）（99-appendix/requirements-onepager-v1.0.md §4） |
| REQ-007 | 响应反向改写（浏览器验收硬依赖）：`Location`、`Set-Cookie` 的 Domain/Path、HTML/JS/JSON 中的校内绝对 URL；两条例外见 [ADR-0007](../../docs/architecture/adr/ADR-0007-gateway-owned-namespaces-and-native-mode-promotion.md)：网关自有根命名空间（`/wengine-vpn/`、`/authserver/`）直接取自网关根且其响应不反向改写，命中网关 bootstrap 判据的 HTML 文档升级到网关原生 URL 空间 | Must | FR-6（响应）（99-appendix/requirements-onepager-v1.0.md §4） |
| REQ-008 | 防环：访问 `webvpn.swufe.edu.cn` / `authserver.swufe.edu.cn` 不得进入本桥；已是 WebVPN 形态的请求直通 | Must | FR-2 防环 / FR-6 相关（99-appendix/requirements-onepager-v1.0.md §4） |
| REQ-009 | 可观测性：默认可见连接状态/allowlist/错误原因；界面提供调试日志面板（三列：时间、域名、结果；最多保留最近 200 条，默认不显示），仅记「域名 + 是否改写成功」，不含正文、请求体与 Cookie | Should（原包 FR-7 标为可选能力；对应用例 TC-F04 优先级 P1） | FR-7（99-appendix/requirements-onepager-v1.0.md §4） |
| REQ-010 | 证书生命周期：本机生成 MITM CA（复用 mitmproxy CA 机制，不自研 PKI）；一键安装到系统信任、一键卸载；私钥不上传 | Must | FR-8（99-appendix/requirements-onepager-v1.0.md §4） |
| REQ-011 | 平台支持：第一期 macOS、Windows 优先；Linux 不在范围 | Must | FR-9（99-appendix/requirements-onepager-v1.0.md §4） |

> 新需求编号一旦确定，必须同步登记到 [functional-requirements.md](../../docs/requirements/functional-requirements.md)。

## Non-functional Requirements

| ID | 类别 | 要求 | 判据 |
| -- | ---- | ---- | ---- |
| NFR-001 | maintainability | 不自研代理内核/TLS/PKI：TLS/HTTP2/证书签发优先交给 mitmproxy 或同等成熟栈 | 代码审查：TLS/证书签发实现来自 mitmproxy，无自研 PKI 代码（[ADR-0002](../../docs/architecture/adr/ADR-0002-reuse-mitmproxy-for-tls.md)） |
| NFR-002 | reliability | WRD codec 实现必须与已验证原型 `wrd_codec.py` 的向量一致（含 authserver / jwxt 样本） | TC-A01..A05（L0 单元）全部通过 |
| NFR-003 | security | 不存密码；Cookie 存用户目录且权限收紧；调试日志默认关且不含正文/Cookie；CA 私钥仅本机 | TC-D01（无密码文件）、TC-F04（日志仅域名与结果）、人工检查（CA 私钥与会话文件的权限：仅本机用户可读、不上传/不外发） |
| NFR-004 | security | 关闭、会话过期或退出后不得留下「半开」系统代理（仅清除本 App 设置过的代理） | TC-C03、TC-C04、TC-D03 通过 |
| NFR-005 | usability | 安装 CA 时必须展示风险提示（本机 HTTPS 会被解密，仅限个人设备，可随时卸载） | TC-E01 手工检查：安装前展示提示文案 |
| NFR-006 | portability | 第一期 macOS + Windows；TUN/透明网关不阻塞第一期验收 | TC-G01（macOS）、TC-G03（Windows）通过 |
| NFR-007 | usability | 界面与文案中文优先；开源时补英文 README 可后置 | TC-H01、TC-H02 手工检查：界面文案为中文 |

## Constraints

> 架构级约束（C-001..C-004）的规范定义在 [docs/architecture/overview.md](../../docs/architecture/overview.md)；下表是本 Spec 范围内的交付约束（SC-xxx，编号独立）。

| 约束 | 来源 | 影响 |
| ---- | ---- | ---- |
| SC-001 学校仅提供 WebVPN（应用层反向代理），非 SSLVPN/TUN | [docs/overview/project-overview.md](../../docs/overview/project-overview.md)、[ADR-0001](../../docs/architecture/adr/ADR-0001-wrd-rewrite-in-mitm-layer.md) | 本机桥只能覆盖 HTTP/HTTPS；SSH/数据库/SMB/任意 TCP·UDP 不在范围（NG-001）；TUN 后置 |
| SC-002 统一身份经 CAS（可含 MFA），必须由用户本人完成 | REQ-002、NG-005 | 不存密码、不自动填密码、不绕过 MFA；会话仅以 Cookie 形式保存 |
| SC-003 HTTPS 需解密才能改写 ⇒ 依赖本机 MITM CA | [ADR-0001](../../docs/architecture/adr/ADR-0001-wrd-rewrite-in-mitm-layer.md)、[ADR-0002](../../docs/architecture/adr/ADR-0002-reuse-mitmproxy-for-tls.md) | 必须实现 CA 安装/卸载与风险提示；证书钉扎应用不保证可用（NG-008） |
| SC-004 第一期平台范围为 macOS/Windows，且不与其它系统代理链式共存 | REQ-011、[ADR-0004](../../docs/architecture/adr/ADR-0004-refuse-start-when-system-proxy-in-use.md) | 系统代理已被占用时拒绝启动；Linux 与 TUN 后置 |
| [ADR-0001](../../docs/architecture/adr/ADR-0001-wrd-rewrite-in-mitm-layer.md) 不在 sing-box/mihomo 内核内实现 WRD 改写 | ADR-0001（Status: Accepted，2026-09-20） | 改写位于 mitm 层，sing-box 仅作未来 TUN/分流壳；第一期依赖 MITM CA |
| [ADR-0002](../../docs/architecture/adr/ADR-0002-reuse-mitmproxy-for-tls.md) 复用 mitmproxy 而非自研 TLS/MITM 栈 | ADR-0002（Status: Accepted，2026-09-20） | Python 运行时需随 App 分发或由系统安装 |
| [ADR-0003](../../docs/architecture/adr/ADR-0003-electron-gui-for-phase-1.md) Phase 1 采用 Electron 而非纯 CLI | ADR-0003（Status: Accepted，2026-09-20） | 包体积增大，换取登录与状态体验 |
| [ADR-0004](../../docs/architecture/adr/ADR-0004-refuse-start-when-system-proxy-in-use.md) 系统代理被占用时拒绝启动 | ADR-0004（Status: Accepted，2026-09-20） | 实现简单，用户需切换工具 |
| [ADR-0005](../../docs/architecture/adr/ADR-0005-builtin-wrd-key-with-override.md) WRD 默认密钥内置并保留配置覆盖 | ADR-0005（Status: Accepted，2026-09-20） | 默认 `key = iv = wrdvpnisthebest!`；`wrdKey`/`wrdIv` 可配置覆盖（风险 R-006） |
| [ADR-0006](../../docs/architecture/adr/ADR-0006-local-capture-mode-and-mutual-exclusion.md) 进程捕获用 mitmproxy local 模式，且与系统代理**互斥** | ADR-0006（Status: Accepted，2026-09-21） | 捕获方式二选一由 `captureMode` 显式控制；`local:` 与 `regular@<port>` 共存使桥端口始终可用；系统代理被其它软件占用时拒绝启用「指定应用」（REQ-003 / REQ-004） |

## Edge Cases

| ID | 场景 | 期望行为 |
| ---- | ---- | -------- |
| EC-001 | allowlist 开启 `*.swufe.edu.cn` 通配时命中 apex `swufe.edu.cn` | 按 `host == "swufe.edu.cn"` 或 `endswith(".swufe.edu.cn")` 命中并改写（TC-B04） |
| EC-002 | allowlist 主机带端口，如 `http://host:8080/x` | `scheme_token` 形如 `http-8080`，URL 可 decode 回主机（TC-A04） |
| EC-003 | 非 allowlist 主机（如 `example.com`） | 直连、不改写；调试日志 `rewritten=false`（TC-B03、TC-F02） |
| EC-004 | 请求已是 WebVPN 形态（目标 `webvpn.swufe.edu.cn`） | 直通，不做二次包装（`webvpn.swufe.edu.cn`、`authserver.swufe.edu.cn` 硬编码排除） |
| EC-005 | 登录 WebView 访问 `webvpn.swufe.edu.cn` / `authserver.swufe.edu.cn` | 不进入本桥（session 直连或 bypass 列表），无代理环（TC-D04） |
| EC-006 | allowlist 为空时开启桥 | 拒绝启动，错误码 `ALLOWLIST_EMPTY`，UI 提示添加主机 |
| EC-007 | WebVPN 会话 Cookie 过期/失效 | 触发失效检测 → 停桥 → 清系统代理 → 停进程捕获 → 弹窗重登（`SESSION_EXPIRED`，TC-D03） |
| EC-008 | 系统代理已被其它软件占用 | 拒绝启动，错误码 `PROXY_CONFLICT`，提示先关闭 Clash / mihomo / sing-box 等（TC-C01） |
| EC-009 | 捕获方式切到「指定应用」但系统代理已被其它软件占用 | 拒绝启用（错误码 `PROXY_CONFLICT`，提示先关闭该代理），捕获方式设置不落盘，界面回显原捕获方式（TC-G04） |

## Out of Scope

- SSH / 数据库 / SMB / 任意 TCP·UDP（NG-001）
- 替代学校 SSLVPN 或 TUN 级真 VPN（NG-002）
- 与 Clash / mihomo / sing-box 等对系统代理的链式共存（NG-003）
- PAC（NG-004）
- 存储密码或自动化填密码绕过 MFA（NG-005）
- 班级批量分发、应用商店上架（NG-006）
- Linux（NG-007）
- 保证所有证书钉扎（pinning）应用可用（NG-008）

> 本 Spec 范围 = M1–M4（[docs/planning/roadmap.md](../../docs/planning/roadmap.md)）；M5「开源准备」为候选阶段，不在本 Spec 承诺内。

## Open Questions

| ID | 问题 | 影响 | 状态 | 阻塞实现？ |
| -- | ---- | ---- | ---- | ---------- |
| Q-001 | 会话 Cookie 名称与失效信号需以实机为准（探测 URL 返回登录页标记 / Set-Cookie 清空会话 / 连续改写后 302 到 CAS，实现可组合） | Session Broker 的会话提取与过期检测实现（REQ-002、EC-007） | Open（M4 已部分收敛：Cookie 名为 `wengine_vpn_ticketwebvpn_swufe_edu_cn` + `route`/`show_vpn`/`heartbeat`/`show_faq`（只记名），已确认信号为探测 `302 → /login`；另两个信号未观测，见 `KI-006`） | No |
| Q-002 | mitm sidecar 分发形态未定：嵌入式 Python 还是外置 `mitmproxy` 可执行文件 | 打包体积、安装流程与跨平台分发（NFR-001、REQ-011） | Open | No（开发版先用本机 Python venv + mitmdump；发布方案实现阶段定） |
| Q-003 | 产品名「SWUFE WebVPN Bridge」为原包标注的暂定名 | 文档、包名与发布物料 | Open | No（仓库名 `swufe-webvpn-codec` 与 `package.json` name 不变） |

## Acceptance Criteria

> 每条必须可验证，并与 [verification.md](verification.md) 的矩阵一一对应；取自原包验收清单（`99-appendix/requirements-onepager-v1.0.md` §8）。

- [x] AC-001：当在 macOS 与 Windows 上运行安装/开发版时，系统应能启动 Electron 应用并显示主窗口（REQ-001；TC-G01 / TC-G03）——**M5（2026-09-21）macOS 通过**：应用启动、界面与两条 TC 的教务首页部分（TC-G01）全部通过；Windows 仍延期（`KI-001`）
- [x] AC-002：当用户完成官方 WebVPN/CAS 登录时，UI 应显示「已登录」状态，且日志中不出现 Cookie 明文或密码（REQ-002；TC-D01 / TC-F04）
- [x] AC-003：当系统代理已被其它软件占用时，用户开启桥，系统应拒绝启动并提示先关闭该代理（REQ-004；TC-C01）
- [x] AC-004：当捕获方式为「系统代理」且桥开启时，系统 HTTP/HTTPS 代理应指向本桥；当捕获方式为「指定应用」时，本 App 不设置系统代理且只有所选应用的流量经桥；当桥关闭或 App 退出时，应清除本 App 设置的系统代理（REQ-003；TC-C02 / TC-C03 / TC-C04 / TC-G04）
- [x] AC-005：当用户点击「安装证书」/「卸载证书」时，系统应把本机 MITM CA 加入/移出系统信任库，并在 UI 反映当前状态（REQ-010；TC-E01 / TC-E02）
- [x] AC-006：当首次启动或重置配置时，allowlist 应默认含 `jwxt.swufe.edu.cn`，用户可增删主机并可启用 `*.swufe.edu.cn` 通配（REQ-005；TC-B01 / TC-B02 / TC-B05 / TC-H02）
- [x] AC-007：当桥运行且 CA 已信任时，本机浏览器访问 `jwxt.swufe.edu.cn` 应能打开页面并完成常规导航操作（REQ-006 / REQ-007；TC-G01 / TC-G02 / TC-G03）——**M5（2026-09-21）macOS 通过**：入口 `http://jwxt.swufe.edu.cn/` 在首次进入时被升级到 WebVPN 原生 URL 形态（`https://webvpn.swufe.edu.cn/http/<token>/…`，见 [ADR-0007](../../docs/architecture/adr/ADR-0007-gateway-owned-namespaces-and-native-mode-promotion.md)），随后在网关原生模式下操作（首页、菜单、站内「学生成绩查询」均可交互，链接不跳飞到不可达地址）；其它 allowlist 主机（实测 `www.swufe.edu.cn`）保持普通主机名。TC-G03 仍延期（`KI-001`）
- [x] AC-008：当 WebVPN 会话过期时，系统应停桥、清除系统代理、停止进程捕获并弹窗提示重新登录（REQ-002 / REQ-003；TC-D03）
- [x] AC-009：当调试日志开启时，界面日志面板（时间、域名、结果三列，最多保留最近 200 条）应仅包含域名与是否改写成功，不含响应正文、请求体与 Cookie；开关关闭时面板隐藏且记录清空（REQ-009；TC-F04）
- [x] AC-010：当登录 WebView 访问 `webvpn.swufe.edu.cn` / `authserver.swufe.edu.cn` 时，流量应不经过本桥（无代理环）（REQ-008；TC-D04）
