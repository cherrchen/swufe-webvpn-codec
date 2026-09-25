# Verification: iOS Proxy Client Plugins

> Spec ID: 003  
> Status: In Progress  
> Owner: cherrchen  
> Last Updated: 2026-09-25

## 映射表

| Requirement | Verification | Status |
| --- | --- | --- |
| IOS-REQ-001 | G01/H01 + disable/update cases | Pending |
| IOS-REQ-002 | I01/I03 + G07/H04 | Pending |
| IOS-REQ-003 | C01..C10 + I02/I04 + N01/N07 | Pending |
| IOS-REQ-004 | B01..B09 + K04–K06 + M01–M04 | Pending |
| IOS-REQ-013 | K01..K21 | Pending |
| IOS-REQ-014 | M01..M09 | Pending |
| IOS-REQ-015 | K18..K23 + security review | Pending |
| IOS-REQ-016 | N01..N07 + Gateway host / Realm security review | Failed（N02：注入后仍进入 Gateway 登录；其余项待验证） |
| IOS-REQ-017 | N02/N04/N05/N06/N10 + classifier matrix | Pending |
| IOS-REQ-018 | N08/N09 + Trace allowlist / leakage review | Pending |
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

M3 Loon 新增回归门槛：G13（HTTP/80 与 WRD `/http/`）、G14/G15（首次 CAS 与已确认会话过期）、G16（原生 WebVPN URL 无自重定向）、G17（两阶段 URL 语义与响应体保留）、G18（脚本加载、日志和远程版本）。这些用例均为 `Pending`；Stash 的真机证据与本地修复不能代替 Loon 验证。执行方法见 [test-plan.md](test-plan.md)，风险边界见 [architecture.md](architecture.md)。

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
| AC-IOS-011 | N01/N02，Safari capture 与无 ticket direct Gateway injection 分开取证 | Pending |
| AC-IOS-012 | N03–N06/N10，ticket precedence / login intent / logout / Settings safety | Pending |
| AC-IOS-013 | N06–N08，Gateway/CAS Realm 隔离与 authserver pass-through | Pending |
| AC-IOS-014 | N08/N09，raw 与 WRD authserver 区分、tyxycg flow diagnosis | Pending |

## Settings Feature Requirement → Evidence

| Requirement | Test / Evidence | Status |
| --- | --- | --- |
| AC-SETTINGS-001 | K01, K09 + Stash Tile device capture | Pending |
| AC-SETTINGS-002 | K01/K02/K11 + bundle inventory, airplane/offline after install | Pending |
| AC-SETTINGS-003 | K04 + persisted V2 readback | Pending |
| AC-SETTINGS-004 | K05, L01 + valid hostname persisted | Pending |
| AC-SETTINGS-005 | K14–K15, L02–L03 | Pending |
| AC-SETTINGS-006 | K16 + route reserved-host negative cases | Pending |
| AC-SETTINGS-007 | K13 + Stash `$persistentStore` inspection without exposing secrets | Pending |
| AC-SETTINGS-008 | M04 immediate next-request test | Pending |
| AC-SETTINGS-009 | M02–M04 URL/header/body unchanged evidence | Pending |
| AC-SETTINGS-010 | M02–M03 gateway upstream Cookie absence | Pending |
| AC-SETTINGS-011 | K10/K21/K22/M05 origin-side request capture shows no upstream request, including handler exceptions | Pending |
| AC-SETTINGS-012 | bundle dependency/manifest scan | Pending |
| AC-SETTINGS-013 | architecture + bundle/request trace review | Pending |
| AC-SETTINGS-014 | L04–L07 migration fixture matrix | Pending |
| AC-SETTINGS-015 | L08 before/after session value equality | Pending |
| AC-SETTINGS-016 | config review + separate M06 interception and M01/M02 routing evidence | Pending |
| AC-SETTINGS-017 | M02/M03/M06/M07 selected vs unselected SWUFE host capture | Pending |

## Gateway Session Realm 新增验证记录

2026-09-25 最新 Stash M2 真机观察：Safari 完成 WebVPN 登录后，request/response 脚本捕获 Gateway ticket，并持久化到 `swufe.session.v1`；日志不包含 Cookie value。此证据支持 test case N01 = Passed，只确认 Safari 流量到 Plugin Gateway Session Store。它不证明第三方 App 的 direct Gateway request 已注入。

N02 真机结果为 Failed，其余 N03–N10 仍 Pending。当前本地实现对无 ticket、stored session 可用的已分类 Gateway 请求注入，其中 WRD 包装资源必须能解码到当前 Routing Scope 的目标域；Stash 以同 URL 的 headers-only `$done` 输出。`/login` 已见于既有真机链路，排除注入；用户另已确认正常 Gateway logout 精确端点为 `/logout`，本地实现清除 Session 且不注入，响应入口也阻止重新保存 ticket。callback 真实路径仍未确认，未知路径默认不注入。明确 ticket 删除、时钟到期或上述 logout 会清理 Session；CAS-only redirect 保留 Gateway Session。

2026-09-25 tyxycg 脱敏日志复核：用户确认在打开 tyxycg 前 Safari WebVPN 页面和 Stash Tile 均显示已登录。21:22:22–28 Gateway request 捕获 ticket，CAS 结束后 Gateway 返回 200；21:22:39 tyxycg 请求 `route=rewrite`，随后 gateway WRD 请求 `decodedOriginalHost=tyxycg.swufe.edu.cn`、`requestTicket=missing`、`storedSession=captured`、`sessionAction=inject`。21:22:42 gateway 响应 302 到 raw authserver，`serviceHost=webvpn.swufe.edu.cn`，表明 Gateway 自身重进登录，而非已认证后 tyxycg 自行要求 CAS。21:22:49 出现明确 ticket 失效清理，随后 tyxycg 请求为 `NOT_LOGGED_IN`；21:23:12 `/logout` 的请求与响应均显示 `sessionAction=clear`，之后 Tile `session=missing`。日志证明 request 脚本作出了注入决定；尚不证明 Stash 向上游实际发送了修改后的 Cookie，也无法判断 ticket 是否在登录后轮换、Cookie 集是否完整或 Gateway 是否绑定其它客户端状态。原始日志不写入仓库。

诊断 follow-up：原生 WRD gateway 响应的防环 early-return 曾只输出 `entered`，导致 21:22:39–40 首次注入后的响应状态不可见。现已在该分支加入安全 response trace：`gatewayKind`、`decodedOriginalHost`、`ticketSetCookie=none/new/same/rotated/expired`、`locationGatewayKind` 与既有 host/serviceHost；request capture 另记录 `ticketRelation` 的分类，不记录 ticket 值或 WRD token。下轮真机要先观察首次 WRD 注入后的响应是继续资源访问、回 `/login`，还是下发新的/删除 ticket，并核对 Stash 上游实际 Cookie header 是否存在。

用户补充：可登录的 `jwxt` 用例发生在 Safari，失败的 `tyxycg` 用例发生在独立 App/WKWebView；前者使用 Safari 自身 Cookie Jar，不能作为跨 App 注入成功的对照。`tyxycg` 在 Settings 当前选 HTTP，Core 会对该主机强制编码为 WRD `/http/`，即使源请求是 HTTPS；原日志未记录 WRD 协议段，也未确认目标实际要求的协议。下一轮先在同一独立 App、同一 Safari 登录状态下分别试 tyxycg 的 HTTP 与 HTTPS 站点设置，比较首个 WRD 响应；单独改变此设置，不同时改变 Session/CAS 逻辑。协议不匹配目前仅是待验证假设。

2026-09-25 后续 HTTP/HTTPS 真机日志（用户报告：HTTP 页面内 API WebView 组件出现 `errMsg: request:fail`；HTTPS 进入 CAS，登录后落在 Gateway 根页，App 仍不可访问）：HTTP 组约 21:36:59 的 tyxycg 请求先改写，随后 Gateway WRD `decodedOriginalHost=tyxycg.swufe.edu.cn` 且 `sessionAction=inject`；首批 WRD 响应包含 403 和 200，当前脱敏日志没有请求路径/关联 ID，不能把 403 精确归因到报错的 API。约 21:37:00 Gateway-owned 200 下发旋转后的 ticket；随后 WRD 出现客户端自带 ticket，但约 21:37:01 又转入 Gateway `/login`。HTTPS 组约 21:37:55 同样执行注入，首批 WRD 302 到 Gateway `/login`，登录响应通过 Set-Cookie 删除 ticket，存储随之清除；CAS 回来后 Gateway `/login` 再 302 到根页。约 21:38:19 再访问 tyxycg 时，WRD 响应 302 到一个 Gateway-owned 路径，其精确路径在当前日志中不可见。两组都未证明 Gateway Session 跨 App 复用成功；CAS 的 `serviceHost=webvpn.swufe.edu.cn` 表明已见的 CAS 往返属于 Gateway 登录链，不是已确认的 tyxycg 业务 CAS。用户在 Stash 界面找不到相应上游请求详情，因此实际上游 Cookie header 是否存在仍未确认。原始日志不写入仓库。

下一版 Safe Trace 增加 `sourceScheme`、`targetScheme`、`responseVisibleTicket` 和 `locationGatewaySignal`。`responseVisibleTicket` 只表示 Stash 响应脚本所见 `$request.headers` 是否包含核心 ticket，不能证明上游收到它；`locationGatewaySignal=failed` 仅在 Location 精确指向仓库已有证据的 `/wengine-vpn/failed` 时输出。所有字段只输出协议或分类，不输出 Cookie、WRD token、完整 URL/query 或 service URL。下一轮先复核这些字段与首次 WRD 响应，必要时继续寻找宿主上游请求头的独立证据。N02 保持 Failed。

2026-09-25 0.1.13-m2 本地回归（不是真机结论）：Core 75 个测试、Stash 31 个测试、两包 typecheck、Stash bundle scan、`docs:check`、`spec:check` 与 `git diff --check` 均通过。新增测试覆盖 HTTP/HTTPS 目标协议分类、响应脚本可见 ticket 标记和 `/wengine-vpn/failed` Location 分类的脱敏性；真实 Stash 响应脚本是否能看到改写后的 header 尚待真机。

2026-09-25 本地回归：`pnpm --filter webvpn-core-js test` 75 passed，`typecheck` 通过；`pnpm --filter swufe-webvpn-stash test` 30 passed，bundle scan 与 `typecheck` 通过。覆盖 gateway classifier、ticket B precedence、direct WRD 注入、Settings/authserver 排除、`/logout` 请求与响应清理、过期、Set-Cookie rotation、CAS-only redirect 与既有 bootstrap/response reverse rewrite 防环；新增原生 WRD response 的安全状态/轮换诊断测试。`pnpm docs:check`、`pnpm spec:check` 与 `git diff --check` 通过。Stash 官方 [Rewrite HTTP 文档](https://stash.wiki/en/script/rewrite-requests) 的 `$done(value)` 字段表允许只返回 `headers`；目标设备上的 headers-only 行为仍待验证。

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

2026-09-25 Settings V2 本地检查（不是真机结论）：

- `pnpm --filter webvpn-core-js test` 与 `pnpm --filter webvpn-core-js typecheck` 通过。覆盖 L01–L08、K15–K17、K23、M01–M04，以及 Settings 404/405 与超限 POST 不写 v2。
- `pnpm --filter swufe-webvpn-stash test` 与 `pnpm --filter swufe-webvpn-stash typecheck` 通过。Stash 请求在业务改写前返回合成 HTML/JSON；异常返回本地 500；未选主机 PASS 且不写 Session。bundle 扫描额外拒绝常见 CDN 主机名。
- `.stoverride` 0.1.5-m2 写入了 `*.swufe.edu.cn:443`、`DOMAIN-SUFFIX` QUIC `REJECT`，以及覆盖子域的脚本匹配。`force-http-engine` 仍只有 `jwxt.swufe.edu.cn:80`。请求脚本改为 `require-body: true`，以便 Settings POST 能在脚本内按 16 KiB 上限本地拒绝。wildcard 导入、HTTP/3 回落和教务 E2E 仍未在设备上证实，AC-SETTINGS 保持 Pending。

2026-09-25 重定向环与 HTTP 入口回归：0.1.6-m2 把业务 request 改回 `require-body: false`，只对 `https://webvpn.swufe.edu.cn/__swufe_bridge__` 保留 `require-body: true`。`force-http-engine` 仍只有 `jwxt.swufe.edu.cn:80`，MitM 恢复显式 `jwxt.swufe.edu.cn:443` 并保留 `*.swufe.edu.cn:443`。教务 HTTP 文档导航仍在 request 阶段 302 到 `/http/`；浏览器已在网关 `/http/` 或 `/https/` 上时响应原样返回，且不再写出指向当前 URL 的 302。H07 仍须用 `http://jwxt.swufe.edu.cn/` 真机复验，本地测试不能标 Passed。

2026-09-25 设置页为每个已选主机提供 HTTP/HTTPS 选择，缺省为 HTTP，只有选 HTTPS 的主机写入 `hostSchemes`。改写使用该协议，不再跟随浏览器地址栏。0.1.9-m2 须重新导入后在设置页确认默认是 HTTP，并把 `http://resource.swufe.edu.cn/` 打开为 `/http/`。

2026-09-25 0.1.7-m2 日志：`resource.swufe.edu.cn` 的 request 已 `rewrite`，随后浏览器请求 `https://resource.swufe.edu.cn/wengine-vpn/failed`。自定义站点的文档导航此前不会像教务 HTTP 那样在 request 阶段进入原生 WebVPN URL，网关 shim 因此停在失败页。0.1.8-m2 对选中主机的 HTTP/HTTPS 文档导航都返回指向 WebVPN 的 302，并在浏览器已处于网关 `/http/` 或 `/https/` 时原样返回响应。`force-http-engine` 增加 `*.swufe.edu.cn:80`，仍不包含 `:443`。自定义 HTTP 主机须真机复验，不能标 Passed。

2026-09-25 0.1.6-m2 真机：Tile 有日志，request/response 没有 `entered`。已登录 Tile 指向 `https://webvpn.swufe.edu.cn/__swufe_bridge__/`，但该路径没有脚本接管，官方 WebVPN 把它带到登录页；`http://jwxt.swufe.edu.cn/` 也没有进入脚本。原因是同一条 `swufe-webvpn-request` 配了两条 `require-body` 不同的规则，HTTP script 段没有挂上。0.1.7-m2 把设置页拆成独立 provider `swufe-webvpn-request-settings`（`require-body: true`），业务 request 保持 `swufe-webvpn-request` 且 `require-body: false`。`force-http-engine` 仍只有 `jwxt.swufe.edu.cn:80`。H07 仍须用 `http://jwxt.swufe.edu.cn/` 真机复验：request 与 response 都应出现 `entered`，已登录 Tile 应打开设置页而不是官方登录页。本地测试不能标 Passed。

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
| Interception vs Routing scope | Pending | Override + user notice review; M02/M06/M07 device evidence |

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
| Settings pseudo route body response / content type | Existing Stash Demo contains no synthetic Settings endpoint | Not tested | T040–T043 device checks |
| Stash wildcard MitM and script match on arbitrary subdomain | Existing override lists only jwxt/gateway/authserver | Not tested in this repository/device evidence | T046 / M06 |
| wildcard HTTP force-engine behavior | Existing config has only jwxt:80 | Not tested | T046; adopt static fallback if unsupported |
| suffix-scoped QUIC reject in Override | Demo currently has three exact QUIC rules | Official syntax exists; repo config/device behavior unverified | T046 / M07 |
| CSRF nonce random source/Origin visibility | No Settings API exists in current adapter | Not tested; must be prerequisite | T039 |
| Tile dynamic URL to Settings | Current tile ViewModel always links gateway login | Official API allows override, project device behavior untested | T044 / K09 |

## 结论

- [ ] 映射表无 Must `Pending`
- [ ] 实际执行命令/真机证据已记录
- [ ] 安全红线全部通过
- [ ] 长期文档与 ADR 已同步
- [ ] Spec 状态可推进到 `Verified`

当前结论：**不可推进到 Verified**。M1 与 Stash 自动项已有本地证据；T024 导入、T026 HTTP/3（H09）与 T027 教务 E2E 仍待真机。

2026-09-24 登录态本地检查（不是真机结论）：

- 普通 `webvpn` 响应 302 到 `authserver` 不再把会话标成失效，也不再 `clear()`。当时的本地记录称已改写的教务响应再跳回 CAS 会清会话；这条历史实现观察与本次冻结的设计冲突，不能作为接受行为。T058 要求回归为：仅 CAS 页面/redirect 不清除 Gateway Session，失效必须有独立 Gateway 证据。
- `pnpm --filter webvpn-core-js test`：48 passed。`pnpm --filter swufe-webvpn-stash test`：7 passed，并重新生成 `plugins/stash/dist/{request,response,tile}.js`。
- Tile `interval` 改为 30 秒，脚本只读本机会话。真机仍须重新导入 Override 后，登录并打开教务，确认 Tile 变为「已登录」、`jwxt` 走 rewrite。不要记录 Cookie 值。

## Stash 真机步骤（T027，尚未执行）

2026-09-25 本地修复：Stash 响应脚本现在同时接受 `$request.url` 为 WRD 上游 URL 或原始 `jwxt` URL。此前仅识别前者；若宿主提供后者，`deriveRewriteContext()` 返回 `null`，Location/Set-Cookie/body 的反向改写全部跳过。新增原始 URL 的回归用例，`pnpm --filter swufe-webvpn-stash test`（9 passed，bundle scan 通过）和 `typecheck` 通过。Stash 对本机实际提供哪种 URL 尚待真机日志确认，不能据此将 H07 标为 Passed。

2026-09-25 用户报告手机端没有任何日志。尚无法据此确定脚本未执行，因为 Stash 的 `console.log` 写入独立的**脚本日志**，不在普通运行日志中。为区分加载阶段，M2 Tile 的静态默认文字改为「脚本未运行 · 检查远程资源」；Tile 脚本执行后会覆盖为「未登录」/「已登录」等状态。三个远程脚本 URL 加入本次版本参数，以便更新覆写时区分旧缓存。真机复测时：无 Tile → 检查覆写是否导入并启用；显示静态默认文字 → 检查远程资源下载/脚本运行；显示动态文字 → Tile 脚本已运行，再检查独立脚本日志与 MitM/HTTP Engine。上述判断尚待真机执行。

2026-09-25 更新正式 M2 覆写后，用户报告 Tile 显示「已登录」，并提供 Stash 独立脚本日志。脱敏统计：Tile 有 10 次 `entered`；request 有 55 次 `entered`、18 次 `session-captured`、37 次 `pass`；response 有 48 次 `entered`、48 次 `pass`；无脚本错误。request/response 中只出现 `webvpn.swufe.edu.cn` 与 `authserver.swufe.edu.cn`，没有 `jwxt.swufe.edu.cn`。因此已确认覆写的 Tile 与登录脚本运行、会话被捕获；H07 教务访问和 H09 QUIC 回落仍待打开教务页后的新日志验证。日志内容未复制进文档。

2026-09-25 用户指出教务内网服务入口为 HTTP，使用先前步骤中的 HTTPS 地址出现连接异常。桌面端 Spec 001 M5 真机通过的入口也是 `http://jwxt.swufe.edu.cn/`，WebVPN 上游路径为 `/http/`。Stash 覆写补入仅 `jwxt.swufe.edu.cn:80` 的 `force-http-engine`，供 Tunnel 中的 HTTP 请求进入脚本；HTTPS 443 的既有 MitM 配置不变。H07 需用 HTTP 入口重新真机验证，不能因本地测试通过而标 Passed。

2026-09-25 HTTP 入口复测日志：`jwxt` 的 request 脚本有 26 次 `entered`、17 次 `rewrite`、9 次 `NOT_LOGGED_IN`；response 脚本有 2 次 `SESSION_EXPIRED`。在 HTTP 主路径中，`/` 和 `/xtgl/login_slogin.html` 已进入改写，后者的 CAS 跳转被当作会话过期并清除，紧接着 `/sso/jziotlogin` 被判 `NOT_LOGGED_IN`，与用户所见白屏相符。原因是 request 在收到上游成功响应前就把刚捕获的 Cookie 标为 `valid`，使首次 CAS 往返误触发失效清理。修复为：只在教务的 2xx 响应后确认会话；初次 CAS 跳转保留 `captured` 会话；已确认会话后来跳回 CAS 仍按过期处理。另修复 response-entry 在仅改写 Header、无可用 body 时输出空 body 的问题。Stash Adapter 11 个测试通过，H07 仍须真机复验。

2026-09-25 再次复测 Safari 报「太多重定位」。脱敏时间线：教务 CAS 回调后约 17:11:54 首次进入 WebVPN `/http/<token>/`，随后同一路径在 17:11:55–17:12:03 连续出现三十余次；每次响应脚本都记为 `rewrite status=200`。根因是响应脚本无法从 `$request.url` 区分透明改写的上游请求与浏览器已进入的 WebVPN 原生请求，反复把原生 bootstrap `302` promotion 到自身。Stash 修复改为教务文档导航在 request 脚本直接返回指向 WebVPN 原生 URL 的 `302`，原生 WebVPN 响应不再做反向改写。Adapter 回归覆盖原生跳转选择和 bootstrap 原样返回；H07 仍待真机重新验证。

1. 将 `plugins/stash/dist/*.js` 与 `plugins/stash/swufe-webvpn.stoverride` 推到 `main` 之后，再从 GitHub raw 导入 override。合并前 URL 会 404。
2. 打开 Tile「打开网页登录」，完成 CAS/MFA。确认 Tile 变为「已登录」。不要记录 Cookie 值。
3. 用 Safari 明确打开 `http://jwxt.swufe.edu.cn/`，确认 request 日志出现 `jwxt` 的 `rewrite` 且 WebVPN URL 使用 `/http/`；继续走教务主路径，观察是否按网关 bootstrap 规则升级到原生 WebVPN URL 空间。
4. 在 Stash 连接里确认 `jwxt` / `webvpn` / `authserver` 的 QUIC 被拒绝、TCP 进入 HTTP Engine（IOS-TC-H09）。未确认前不要把 H09 标成 Passed。
