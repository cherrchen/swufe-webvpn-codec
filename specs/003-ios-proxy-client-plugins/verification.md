# Verification: iOS Proxy Client Plugins

> Spec ID: 003  
> Status: Approved  
> Owner: cherrchen  
> Last Updated: 2026-09-24

## 映射表

| Requirement | Verification | Status |
| --- | --- | --- |
| IOS-REQ-001 | G01/H01 + disable/update cases | Pending |
| IOS-REQ-002 | I01/I03 + G07/H04 | Pending |
| IOS-REQ-003 | C01..C10 + I02/I04 | Pending |
| IOS-REQ-004 | B01..B09 | Pending |
| IOS-REQ-005 | A01..A09 | Pending |
| IOS-REQ-006 | D01..D09 | Pending |
| IOS-REQ-007 | E01..E11 | Pending |
| IOS-REQ-008 | H02/H06/H12 + Loon notification cases | Pending |
| IOS-REQ-009 | F01..F08 | Pending |
| IOS-REQ-010 | G12/H09 | Pending |
| IOS-REQ-011 | bundle/version smoke | Pending |
| IOS-REQ-012 | G11/H11/J06 | Pending |
| IOS-NFR-001 | A09 | Pending |
| IOS-NFR-002 | F04 | Pending |
| IOS-NFR-003 | D09 | Pending |
| IOS-NFR-004 | architecture/code review | Pending |
| IOS-NFR-005 | request/body policy review + perf | Pending |
| IOS-NFR-006 | expired flow | Pending |
| IOS-NFR-007 | F01..F03 | Pending |
| IOS-NFR-008 | real-device matrix | Pending |
| IOS-NFR-009 | J01 | Pending |

Status：`Pending` / `Passed` / `Failed` / `N/A`。

## 验收标准覆盖

| Acceptance Criteria | 对应验证项 | Status |
| --- | --- | --- |
| AC-IOS-001 | I01..I06 + 至少一宿主 E2E | Pending |
| AC-IOS-002 | G09/H07 | Pending |
| AC-IOS-003 | A09 | Pending |
| AC-IOS-004 | D03/D09 | Pending |
| AC-IOS-005 | B03/B04 | Pending |
| AC-IOS-006 | H12 + Loon equivalent | Pending |
| AC-IOS-007 | F01..F08 | Pending |
| AC-IOS-008 | G01/G10/G11 + H01/H10/H11 | Pending |
| AC-IOS-009 | J01 | Pending |
| AC-IOS-010 | I01..I04 已记录；I05/I06 仍 Pending | Passed |

## 执行的命令与结果

2026-09-24 本地检查（不是真机结论）：

- `node --check`：`plugins/loon/p0-probe.js`、`plugins/stash/p0-probe.js`、`plugins/stash/p0-tile.js` 通过。
- Loon `.plugin` 含 generic / http-request / http-response、`requires-body=false`，MitM 仅为 `webvpn.swufe.edu.cn` 与 `authserver.swufe.edu.cn`。
- Stash `.stoverride` 含 Tile URL、`script-providers` 本地相对路径、`require-body: false` 与同样的 MitM 主机。
- 用虚构 Cookie / query / WRD 路径跑探测脚本：日志只有 host、无 query 的 path、Cookie 名、Set-Cookie 名、Location host；Cookie 值、Authorization、body、query、长十六进制 token 未出现。通知文案只有登录提示和 `https://webvpn.swufe.edu.cn`。

I01–I04 已有 2026-09-24 真机结论，见下方。探测脚本没有把 Session 写入持久存储，所以「sessionCaptured」只表示脚本看见了 Cookie 名。

## P0 真机记录

日期：2026-09-24。未记录机型、iOS 版本、网络和 Stash 版本。日志只保留了 Cookie 名。

Loon 3.5.1(998)，运行环境 Loon Tunnel：

- inAppWeb: no（通知打开系统 Safari）
- redirectChainCompleted: yes（`webvpn /` 302 到 `/login`，再 302 到 `authserver`；随后 `webvpn /` 返回 200）
- requestScriptObservedGateway: yes（请求与响应脚本都有 `webvpn.swufe.edu.cn`）
- sessionCaptured: 看见 Cookie 名，未持久化
- cookieNames: `heartbeat`、`show_faq`、`show_vpn`、`route`、`wengine_vpn_ticketwebvpn_swufe_edu_cn`
- notes: 导出里没有 `POST /authserver/login`。`authserver` 的登录页和后续接口被脚本看见。

Stash，脚本 `swufe-webvpn-p0-probe`：

- inAppWeb: no（Tile 打开系统 Safari）
- redirectChainCompleted: yes（含 `POST /authserver/login` 后 302 回 `webvpn`，门户接口 200）
- requestScriptObservedGateway: yes
- sessionCaptured: 看见与 Loon 相同的 gateway Cookie 名，未持久化
- notes: 版本号未记录。

Q-001、Q-002 因此关闭。Gate A 通过。I05（Safari 是否总能捕获）只在这两次成功路径上看到，不单独标 Passed。I06 Cookie jar 边界未做专门验证。

## 手工验证步骤

完整步骤见 [test-plan.md](test-plan.md) 的 P0/E2E 模板。

## 边界与异常场景

见 [test-cases.md](test-cases.md) B/C/D/E/F 系列。

## 兼容性

| 维度 | 结论 | 依据 |
| --- | --- | --- |
| desktop | Pending | J01 |
| Loon | Pending | G 系列 |
| Stash | Pending | H 系列 |
| storage schema | Pending | C08/C09/G11/H11 |

## 安全

| 检查项 | 结论 | 依据 |
| --- | --- | --- |
| 不存账号密码/MFA | Pending | F04 |
| Session 不进日志/通知 | Pending | F01..F03 |
| 非 gateway 不注入 Session | Pending | D09 |
| authserver 不持久化认证 Cookie | Pending | C03 |
| MitM scope 最小化 | Pending | 配置审查 + 真机 |

## 文档同步

P0 结论写在本 Feature 文档包内。Spec 003 已标为 `Approved`（Gate A + 文档评审）；长期 `docs/**` 与 ADR 在 M1/M4 按 [project-management.md §12](project-management.md) 同步，尚未开始。

## 未验证 / 无法验证项

| 项 | 原因 | 已尝试 | 需要的动作 |
| --- | --- | --- | --- |
| openUrl App 内呈现 | 2026-09-24 两边都打开系统 Safari | Loon 3.5.1(998) 通知；Stash Tile | 已记录。Stash 版本未记 |
| in-app web → Script 可观察性 | Safari 流量在 MitM 开启后进入脚本 | Loon 与 Stash 日志均见到 gateway | 已记录 |
| 最小 Session Cookie 集 | 只见到与 desktop 相同的一组名字，尚未做裁剪实验 | P0 日志中的 Cookie 名 | OQ-003 仍 Open |
| Loon 局部 QUIC 策略 | 需实际配置验证 | 尚未真机 | M2 |
| body size/time limit | 宿主运行时限制 | 尚未压测 | M4 |

## 结论

- [ ] 映射表无 Must `Pending`
- [ ] 实际执行命令/真机证据已记录
- [ ] 安全红线全部通过
- [ ] 长期文档与 ADR 已同步
- [ ] Spec 状态可推进到 `Verified`

当前结论：**不可推进到 Verified**；这是实施前的完整验证计划。
