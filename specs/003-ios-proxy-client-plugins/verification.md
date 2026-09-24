# Verification: iOS Proxy Client Plugins

> Spec ID: 003  
> Status: In Progress  
> Owner: cherrchen  
> Last Updated: 2026-09-24

## 映射表

| Requirement | Verification | Status |
| --- | --- | --- |
| IOS-REQ-001 | G01/H01 + disable/update cases | Pending |
| IOS-REQ-002 | I01/I03 + G07/H04 | Pending |
| IOS-REQ-003 | C01..C10 + I02/I04 | Pending |
| IOS-REQ-004 | B01..B09 | Passed |
| IOS-REQ-005 | A01..A09 | Passed |
| IOS-REQ-006 | D01..D09 | Passed |
| IOS-REQ-007 | E01..E11 | Passed |
| IOS-REQ-008 | H02/H06/H12 + Loon notification cases | Pending |
| IOS-REQ-009 | F01..F08 | Pending |
| IOS-REQ-010 | G12/H09 | Pending |
| IOS-REQ-011 | bundle/version smoke | Passed |
| IOS-REQ-012 | G11/H11/J06 | Pending |
| IOS-NFR-001 | A09 | Passed |
| IOS-NFR-002 | F04 | Pending |
| IOS-NFR-003 | D09 | Passed |
| IOS-NFR-004 | architecture/code review | Passed |
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
| AC-IOS-003 | A09 | Passed |
| AC-IOS-004 | D03/D09 | Passed |
| AC-IOS-005 | B03/B04 | Passed |
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

2026-09-24 M1/M2 本地检查（不是真机结论）：

- `pnpm --filter webvpn-core-js test`：47 passed。覆盖 A/B/C/D/E 与 F01/F02/F03/F05/F08，以及 Core 源码不含 `$request`、`$persistentStore`、`$done`、`node:crypto`、`Buffer`。`debug` 关闭时 `direction: "system"` 的 `entered` 仍保留，query 被脱敏。
- `pnpm --filter webvpn-core-js typecheck`：通过。
- `uv run --directory bridges/python pytest tests/l0/test_wrd_vectors_shared.py tests/l0/test_wrd_codec.py -q`：25 passed。共享向量与 Python codec 一致，含实机 `SAMPLE_HOST_TOKEN`。
- `pnpm --filter swufe-webvpn-stash test`：Adapter 5 passed；`plugins/stash/dist/{request,response,tile}.js` bundle 扫描通过（无 `node:`、`fs`、`crypto`、`Buffer`、未打包的 import/export）。
- `pnpm --filter swufe-webvpn-stash typecheck`：通过。
- Gate B（向量全绿、Core 无宿主 API）在本地通过。T024 的 Stash 导入、T026 的 HTTP/3 回落（IOS-TC-H09）和 T027 教务 E2E 仍待真机。`.stoverride` 的 script URL 指向 `main` 上的 raw 路径；合并前导入会 404。

2026-09-24 Safari 安全连接失败已定位：把 `webvpn` / `authserver` / `jwxt` 的 `:443` 放进 `force-http-engine` 后，HTTPS 不进入 HTTP 脚本，Safari 显示无法建立安全连接。去掉该项后，23:36:22 起请求与响应脚本都有 `entered`，主机从 `webvpn.swufe.edu.cn` 到 `authserver.swufe.edu.cn`，用户可以打开 WebVPN。M2 覆盖已改回 GitHub raw 脚本、MitM，以及仅这三台主机的 QUIC `REJECT`，不再包含 `force-http-engine`。`$persistentStore.write` 按 Stash 文档使用 `(value, key)`。H09 与教务 E2E 仍未通过。

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
| Session 不进日志/通知 | Passed | F01..F03 单元测试 |
| 非 gateway 不注入 Session | Passed | D09 |
| authserver 不持久化认证 Cookie | Passed | C03 |
| MitM scope 最小化 | Pending | 配置审查 + 真机 |

## 文档同步

P0 结论写在本 Feature 文档包内。Spec 003 现为 `In Progress`。AES backend 已记入 ADR-0013。README、requirements 与 architecture 正文的全量同步仍留在 M4 T033。

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

当前结论：**不可推进到 Verified**。M1 与 Stash 自动项已有本地证据；T024 导入、T026 HTTP/3（H09）与 T027 教务 E2E 仍待真机。

2026-09-24 登录态本地检查（不是真机结论）：

- 普通 `webvpn` 响应 302 到 `authserver` 不再把会话标成失效，也不再 `clear()`。已改写的教务响应再跳回 CAS 仍会清会话。
- `pnpm --filter webvpn-core-js test`：48 passed。`pnpm --filter swufe-webvpn-stash test`：7 passed，并重新生成 `plugins/stash/dist/{request,response,tile}.js`。
- Tile `interval` 改为 30 秒，脚本只读本机会话。真机仍须重新导入 Override 后，登录并打开教务，确认 Tile 变为「已登录」、`jwxt` 走 rewrite。不要记录 Cookie 值。

## Stash 真机步骤（T027，尚未执行）

2026-09-25 本地修复：Stash 响应脚本现在同时接受 `$request.url` 为 WRD 上游 URL 或原始 `jwxt` URL。此前仅识别前者；若宿主提供后者，`deriveRewriteContext()` 返回 `null`，Location/Set-Cookie/body 的反向改写全部跳过。新增原始 URL 的回归用例，`pnpm --filter swufe-webvpn-stash test`（9 passed，bundle scan 通过）和 `typecheck` 通过。Stash 对本机实际提供哪种 URL 尚待真机日志确认，不能据此将 H07 标为 Passed。

2026-09-25 用户报告手机端没有任何日志。尚无法据此确定脚本未执行，因为 Stash 的 `console.log` 写入独立的**脚本日志**，不在普通运行日志中。为区分加载阶段，M2 Tile 的静态默认文字改为「脚本未运行 · 检查远程资源」；Tile 脚本执行后会覆盖为「未登录」/「已登录」等状态。三个远程脚本 URL 加入本次版本参数，以便更新覆写时区分旧缓存。真机复测时：无 Tile → 检查覆写是否导入并启用；显示静态默认文字 → 检查远程资源下载/脚本运行；显示动态文字 → Tile 脚本已运行，再检查独立脚本日志与 MitM/HTTP Engine。上述判断尚待真机执行。

1. 将 `plugins/stash/dist/*.js` 与 `plugins/stash/swufe-webvpn.stoverride` 推到 `main` 之后，再从 GitHub raw 导入 override。合并前 URL 会 404。
2. 打开 Tile「打开网页登录」，完成 CAS/MFA。确认 Tile 变为「已登录」。不要记录 Cookie 值。
3. 用 Safari 打开 `https://jwxt.swufe.edu.cn`，走教务主路径，看跳转是否仍落在校内主机名上。
4. 在 Stash 连接里确认 `jwxt` / `webvpn` / `authserver` 的 QUIC 被拒绝、TCP 进入 HTTP Engine（IOS-TC-H09）。未确认前不要把 H09 标成 Passed。
