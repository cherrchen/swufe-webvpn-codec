# Verification: iOS Proxy Client Plugins

> Spec ID: 003  
> Status: In Progress  
> Owner: cherrchen  
> Last Updated: 2026-10-01

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

N02 真机结果为 Failed，其余 N03–N10 仍 Pending。当前本地实现对无 ticket、stored session 可用的已分类 Gateway 请求注入，其中 WRD 包装资源必须能解码到当前 Routing Scope 的目标域；Stash 以同 URL 的 headers-only `$done` 输出。`/login` 已见于既有真机链路，排除注入；用户另已确认正常 Gateway logout 精确端点为 `/logout`，本地实现清除 Session 且不注入，响应入口也阻止重新保存 ticket。callback 真实路径仍未确认，未知路径默认不注入。时钟到期、上述 logout 或与 stored ticket 一致的请求收到明确 ticket 删除才清理共享 Session；CAS-only redirect 保留 Gateway Session。

2026-09-25 tyxycg 脱敏日志复核：用户确认在打开 tyxycg 前 Safari WebVPN 页面和 Stash Tile 均显示已登录。21:22:22–28 Gateway request 捕获 ticket，CAS 结束后 Gateway 返回 200；21:22:39 tyxycg 请求 `route=rewrite`，随后 gateway WRD 请求 `decodedOriginalHost=tyxycg.swufe.edu.cn`、`requestTicket=missing`、`storedSession=captured`、`sessionAction=inject`。21:22:42 gateway 响应 302 到 raw authserver，`serviceHost=webvpn.swufe.edu.cn`，表明 Gateway 自身重进登录，而非已认证后 tyxycg 自行要求 CAS。21:22:49 旧实现把 ticket 删除响应判为全局失效并清理，随后 tyxycg 请求为 `NOT_LOGGED_IN`；这一清理不能单独证明 Safari 的 stored ticket 失效。21:23:12 `/logout` 的请求与响应均显示 `sessionAction=clear`，之后 Tile `session=missing`。日志证明 request 脚本作出了注入决定；尚不证明 Stash 向上游实际发送了修改后的 Cookie，也无法判断 ticket 是否在登录后轮换、Cookie 集是否完整或 Gateway 是否绑定其它客户端状态。原始日志不写入仓库。

诊断 follow-up：原生 WRD gateway 响应的防环 early-return 曾只输出 `entered`，导致 21:22:39–40 首次注入后的响应状态不可见。现已在该分支加入安全 response trace：`gatewayKind`、`decodedOriginalHost`、`ticketSetCookie=none/new/same/rotated/expired/expired-ignored`、`locationGatewayKind` 与既有 host/serviceHost；request capture 另记录 `ticketRelation` 的分类，不记录 ticket 值或 WRD token。下轮真机要先观察首次 WRD 注入后的响应是继续资源访问、回 `/login`，还是下发新的/删除 ticket，并核对 Stash 上游实际 Cookie header 是否存在。

用户补充：可登录的 `jwxt` 用例发生在 Safari，失败的 `tyxycg` 用例发生在独立 App/WKWebView；前者使用 Safari 自身 Cookie Jar，不能作为跨 App 注入成功的对照。`tyxycg` 在 Settings 当前选 HTTP，Core 会对该主机强制编码为 WRD `/http/`，即使源请求是 HTTPS；原日志未记录 WRD 协议段，也未确认目标实际要求的协议。下一轮先在同一独立 App、同一 Safari 登录状态下分别试 tyxycg 的 HTTP 与 HTTPS 站点设置，比较首个 WRD 响应；单独改变此设置，不同时改变 Session/CAS 逻辑。协议不匹配目前仅是待验证假设。

2026-09-25 后续 HTTP/HTTPS 真机日志（用户报告：HTTP 页面内 API WebView 组件出现 `errMsg: request:fail`；HTTPS 进入 CAS，登录后落在 Gateway 根页，App 仍不可访问）：HTTP 组约 21:36:59 的 tyxycg 请求先改写，随后 Gateway WRD `decodedOriginalHost=tyxycg.swufe.edu.cn` 且 `sessionAction=inject`；首批 WRD 响应包含 403 和 200，当前脱敏日志没有请求路径/关联 ID，不能把 403 精确归因到报错的 API。约 21:37:00 Gateway-owned 200 下发旋转后的 ticket；随后 WRD 出现客户端自带 ticket，但约 21:37:01 又转入 Gateway `/login`。HTTPS 组约 21:37:55 同样执行注入，首批 WRD 302 到 Gateway `/login`，登录响应通过 Set-Cookie 删除 ticket，存储随之清除；CAS 回来后 Gateway `/login` 再 302 到根页。约 21:38:19 再访问 tyxycg 时，WRD 响应 302 到一个 Gateway-owned 路径，其精确路径在当前日志中不可见。两组都未证明 Gateway Session 跨 App 复用成功；CAS 的 `serviceHost=webvpn.swufe.edu.cn` 表明已见的 CAS 往返属于 Gateway 登录链，不是已确认的 tyxycg 业务 CAS。用户在 Stash 界面找不到相应上游请求详情，因此实际上游 Cookie header 是否存在仍未确认。原始日志不写入仓库。

下一版 Safe Trace 增加 `sourceScheme`、`targetScheme`、`responseVisibleTicket` 和 `locationGatewaySignal`。`responseVisibleTicket` 只表示 Stash 响应脚本所见 `$request.headers` 是否包含核心 ticket，不能证明上游收到它；`locationGatewaySignal=failed` 仅在 Location 精确指向仓库已有证据的 `/wengine-vpn/failed` 时输出。所有字段只输出协议或分类，不输出 Cookie、WRD token、完整 URL/query 或 service URL。下一轮先复核这些字段与首次 WRD 响应，必要时继续寻找宿主上游请求头的独立证据。N02 保持 Failed。

2026-09-25 0.1.13-m2 本地回归（不是真机结论）：Core 75 个测试、Stash 31 个测试、两包 typecheck、Stash bundle scan、`docs:check`、`spec:check` 与 `git diff --check` 均通过。新增测试覆盖 HTTP/HTTPS 目标协议分类、响应脚本可见 ticket 标记和 `/wengine-vpn/failed` Location 分类的脱敏性；真实 Stash 响应脚本是否能看到改写后的 header 尚待真机。

2026-09-25 用户指出独立 App 尝试登录时 Stash Tile 随即显示会话失效，而 Safari 中访问 `http://tyxycg.swufe.edu.cn/h5?school=swufe` 可登录。现有 21:37:55 日志显示：App 的 Gateway `/login` 请求无 ticket，响应却通过 Set-Cookie 删除 ticket；旧 Adapter 不区分客户端，直接清除全局 `swufe.session.v1`，因此这个 Tile 状态是可解释的本地误判。0.1.14-m2 修复为：只有删除信号对应的请求 ticket 与当前 stored ticket 一致，才清理共享 Session；无 ticket/不同 ticket 的响应记为 `ticketSetCookie=expired-ignored`。这只避免误清 Safari 捕获的 Session，并不能证明 App 的 Gateway 请求已成功复用，N02 仍 Failed。Safari 浏览器成功使用自身 Cookie Jar，不能替代同一独立 App 的对照。

0.1.14-m2 本地回归（不是真机结论）：Core 75 个测试与 typecheck、Stash 32 个测试与 typecheck、Stash bundle scan、`docs:check`、`spec:check` 和 `git diff --check` 均通过。新增 Adapter 测试证明无 ticket/不同 ticket 的删除响应不清 Safari stored Session，也不写失效状态；匹配的 ticket 删除仍清理。

2026-09-25 0.1.14-m2 新一轮脱敏真机日志：约 22:00:14–15，tyxycg 源请求为 `sourceScheme=http targetScheme=http`，已改写；10 条 Gateway WRD 请求显示 `requestTicket=missing`、`storedSession=captured`、`sessionAction=inject`。首批 WRD 响应有 200，响应脚本看到请求 ticket `present`，但这仍不是上游实际收到 Cookie 的独立证明。约 22:00:16，一个 `gatewayKind=gateway-owned`、`responseVisibleTicket=missing` 的 200 响应下发新 ticket，旧 Adapter 将其记为 `ticketSetCookie=rotated` 并覆盖全局 stored Session；约 22:00:17 起 WRD 请求显示 ticket present/same，22:00:18–19 多条 tyxycg WRD 302 到 Gateway `/login`，后者 302 到 raw authserver，`serviceHost=webvpn.swufe.edu.cn`。约 22:00:25、39、41、47，无 ticket 的 `/login` 响应删除 ticket 均记为 `expired-ignored`；0.1.14 的误清修复已在真机生效。约 22:01:18 出现明确 `/logout` 请求/响应的 `sessionAction=clear`，之后 Tile 显示未登录属于预期清理。约 22:00:59–22:01:14 还有大量 tyxycg WRD 200，但日志没有客户端标识或请求关联 ID，不能断定这些与失败的 App API 属于同一链。浏览器可用而 App 失败仍为 N02 Failed；目前没有证据表明是 HTTP/HTTPS 配置不匹配，也没有证据把该 CAS 往返归为 tyxycg 业务 CAS。原始日志不写入仓库。

新发现的独立问题：已有 stored ticket 时，另一客户端无 ticket 的 Gateway-owned 响应仍可下发新 ticket；旧 Adapter 无条件接受这次 Set-Cookie rotation，会把 Safari 捕获的共享 ticket 换成未绑定到它的 ticket。时间顺序与随后 Gateway `/login` 一致，但尚不足以证明这就是 App 失败的唯一原因。0.1.15-m2 要求新 ticket 只在响应对应请求携带当前 stored ticket 时更新共享 Session；无 ticket/不同 ticket 的响应记为 `ticketSetCookie=unbound-ignored`，不输出 ticket 值。请求自带 ticket 的优先规则仍维持。下轮真机须观察是否仍发生 WRD→Gateway `/login`；即使不再污染 store，若 App 仍失败，继续检查请求头实际送达、Gateway 对辅助 Cookie/客户端状态的要求和 App API 对 302/CAS 的处理。

0.1.15-m2 本地回归（不是真机结论）：Core 75 个测试、Stash 33 个测试，两包 typecheck、Stash bundle scan、`docs:check`、`spec:check` 与 `git diff --check` 均通过。新增 Adapter 测试覆盖无 ticket/不同 ticket 请求的 Set-Cookie 不覆盖已有共享 Session，匹配的 ticket rotation 仍可更新。

2026-09-25 0.1.15-m2 App 失败在前、Web 成功在后的脱敏对照日志：约 22:09:43–22:10:17（用户标记为独立 App）有 8 次 tyxycg ordinary rewrite、10 次无 ticket Gateway WRD `sessionAction=inject`；WRD 响应既有 200 也有 14 次 302 到 Gateway `/login`，后者再跳 raw authserver，`serviceHost=webvpn.swufe.edu.cn`。22:09:44 两次无 ticket Gateway-owned 200 下发 ticket 均记为 `unbound-ignored`，证实 0.1.15 的响应侧隔离已运行；但紧接着两个 Gateway-owned 请求自带与 stored 不同的 ticket，request 侧按既定 B 优先规则 `sessionAction=capture`，会把新客户端 ticket 写入唯一的 `swufe.session.v1`。之后 App WRD 带 ticket 仍反复进入 Gateway `/login`。约 22:10:27–22:10:55（用户标记为 Web 成功）首次 tyxycg WRD request 的 ticket 与当时 stored ticket 不同，亦被 capture；随后同一目标约 49 次 WRD 200、2 次 301 和 1 次 307，另有一次 500，整体 Web 页面由用户确认为可用。可见浏览器使用自身 ticket 成功，而共享 store 在客户端切换时跟随不同 request ticket 改写；`captured` 状态本身不能证明所存 ticket 可在其它客户端复用。现有日志没有客户端标识、请求关联 ID 或安全的服务器验证信号，不能仅凭 200 与时间关系认定每个响应的调用方，也不能断言 Gateway 额外绑定条件的具体种类。22:09:55–22:10:17 `/login` 的 ticket 删除响应均为 `expired-ignored`，Session 未被误清；22:11:01 明确 `/logout` 才清理 Session。N02 继续 Failed。原始日志不写入仓库。

这轮结果暴露 Scope 冲突：现行 N03 要求请求自带 ticket B 时 B 优先且立即更新唯一 store；一旦独立 App 已有自己的 B，即使它无法通过 Gateway，该规则也会阻止注入 Safari 的 A，并可能把 store 改成 B。仅拦截响应侧的无 ticket rotation 无法解决请求侧覆盖。是否允许在 Gateway 明确拒绝 B 后进行受限回退，或引入并行候选 Session/可信度与客户端关联，需单独设计；当前证据不足以安全地把 A 强行覆盖到已有 B 的请求。CAS Cookie 跨 App 共享仍不在 M2 范围。

2026-09-25 用户明确授权推翻“客户端自带 ticket B 永远优先”的旧策略。0.1.16-m2 本地实现仅在 Gateway host、WRD 解码目标已选、stored Session 可用时，使用 stored 核心 ticket A 替换客户端不同的 B；其它客户端 Cookie 保留，URL 不变。login/logout/Settings/gateway-owned/unknown 不覆盖 B；root B 也保留，携 B 的 Gateway 根页 200 在没有未绑定的新 ticket 下发时才确认新 Session 并切换 store；已绑定的响应轮换 ticket 优先保留。冲突 B 的单次 request 不再把唯一 store 覆盖为 B，避免 0.1.15 日志中的 App Gateway-owned capture 污染。直接 `/logout`、时钟到期和匹配 ticket 删除仍清理；raw authserver 继续 PASS。该策略可能使浏览器已获得的较新 B 在 WRD 资源上被旧 A 暂时覆盖、导致浏览器访问失败；根页 200 确认或显式 logout 后重新登录是恢复路径。若 Gateway 绑定设备、连接或辅助 Cookie，仅替换核心 ticket 也可能不足。N02/N03 真机状态保持 Pending，不能以本地测试宣称 App 已可访问；CAS Cookie 跨 App 共享仍未实现。

0.1.16-m2 本地回归（不是真机结论）：Core 75 个测试、Stash 35 个测试，两包 typecheck、Stash bundle scan、`docs:check`、`spec:check`、`git diff --check` 均通过。Core/Adapter 覆盖 WRD 冲突 ticket 替换、Gateway-only 边界、非 ticket Cookie 保留、root/login/gateway-owned 不覆盖、冲突单次请求不污染 store、root 302 不确认而 root 200 确认、logout 与已有防环流程。新增 `responseTicketRelation` 只输出 same/different/missing 分类，供真机判断响应脚本可见的 ticket 与修改前 store 的关系；它不证明上游收到或接受 stored ticket。

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

### Stash 请求诊断（2026-09-25）

request/response 脚本新增安全摘要：每个被处理请求生成短 trace id；rewrite 请求把该 id 暂存供 response 脚本关联。request 规则启用 `require-body: true` 后，POST body 仅记录存在性与 UTF-8 字节长度，正文不输出且不计算 body hash。Stash `$done({url, headers})` 接口看不到改写后的 body，因此 `requestBodyPreserved=unknown`。启用 body 暴露会增加 Stash 缓冲内存占用。此暂存关联只保留最近一条待响应记录；并发同路径请求可能无法可靠配对，日志不得据此认定关联成功，需结合时间、method、host/path核对。

响应摘要记录 body 类型与长度、Content-Type、Set-Cookie 名称及启发式来源分类。`bodyOriginGuess=upstream-api` 只表示 wrapped-resource JSON 的启发式判断，不证明响应一定由 bctest 生成；`applicationSessionCandidate` 也只表示响应出现疑似应用 Cookie 名，不代表 session 有效。Cookie、Set-Cookie、Authorization、UA 原文及请求/响应正文不得进入日志。

本地自动化覆盖：`plugins/stash/tests/adapter.test.ts` 的安全 POST/响应摘要用例；Stash 真机验证仍未执行。真机步骤：打开 Stash 独立脚本日志，保持 WebVPN 已登录，在 Sciyard App 执行一次登录，回传同一 trace 的 `request-enter`、`rewrite` 与 `response` 行，以及随后一条 bctest 请求行。不要回传请求或响应正文、Cookie 值或 Authorization。

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

## Loon M3 本地实现与验证（2026-10-01）

任务分类：Spec 003 M3 Feature。用户已确认暂停 Stash 后续开发、Loon 复用 Stash 本地设置页；不引入第三方 BoxJS。Stash 既有设备 Failed/Pending 记录保留，不能因冻结视作通过。Spec 003 整体继续 In Progress，Loon 本地实现完成也不等同于真机验收或发布。

| 工作 | 本地证据 | 本地状态 | 设备状态 |
| --- | --- | --- | --- |
| T059 共享 runtime 抽取 | Stash 原有 36 个测试、typecheck、三 bundle scan；原 API/存储 key 保持兼容 | Passed | 既有 Stash 风险不变 |
| T016/T055 Loon request/response 与 Gateway Session | Loon VM：HTTP/80、透明 POST body 保留、stored ticket 优先、logout、ticket rotation/删除绑定、CAS-only redirect、native bootstrap 防环、header-only/body mapping | Passed | G/N 系列 Pending |
| T019 通知节流 | 30 分钟登录/过期、10 分钟错误；独立事件时间戳；openUrl 与 Generic | Passed | G05/O06 Pending |
| T056 Safe Trace | raw/WRD authserver 分类与敏感值负向测试 | Passed | N07–N09 Pending |
| T060 Settings 页面/API | O02–O05 VM：无 host crypto 的 browser bootstrap、来源、nonce/replay/TTL、schema/reserved host/16 KiB、storage false/exception、Settings short-circuit、下一请求路由/V1迁移不改 Session | Passed | O02–O04/K/M 等价设备项 Pending |
| T017/T018/T061 制品 | 新语法文本检查、Build guard、脚本执行与各一次 done；request/response/generic IIFE；bundle scan；workspace/CI 配置 | Passed | parser/import 与设置页 GET 已真机确认；原始教务 HTTP 改写失败，见下方 Bug 记录；其它门槛 Pending |

### 执行命令与结果

本地 pnpm 11 默认在 run 前检查依赖；本次安装忽略 Electron 安装脚本，因此执行脚本时使用 `pnpm_config_verify_deps_before_run=false` 前缀，避免触发重复安装/网络元数据校验。该设置没有写入仓库配置。初次 offline install 缺少缓存 tarball，已用 `CI=true pnpm install --ignore-scripts --no-frozen-lockfile` 完成安装；lockfile 仅新增 workspace importer/link，未升级第三方依赖。

| 命令（pnpm 命令均使用上述临时前缀） | 结果 |
| --- | --- |
| `pnpm --filter swufe-webvpn-loon run typecheck` | Passed |
| `pnpm --filter swufe-webvpn-loon run test` | 40 Passed；随后 build 与三 bundle scan Passed |
| `pnpm --filter webvpn-plugin-runtime run typecheck` | Passed |
| `pnpm --filter swufe-webvpn-stash run typecheck/test`（分别执行） | Passed；36 tests、build、bundle scan Passed |
| `pnpm --filter webvpn-core-js run typecheck/test`（分别执行） | Passed；75 tests（包括 Python 权威 codec vectors） |
| `pnpm --filter swufe-webvpn-bridge run typecheck/test:unit/test:ui`（分别执行） | 三命令 Passed；UI 36 tests；jsdom 仍输出不支持 pseudo-element getComputedStyle 的警告，测试通过 |
| `UV_CACHE_DIR=/tmp/swufe-loon-uv-cache uv run --no-sync --directory bridges/python pytest -q` | 219 Passed / 1 Failed；见下节 |
| 同上环境的 `pytest tests/l2/test_upstream_stall.py::test_an_unreachable_gateway_gives_the_client_a_bounded_failure -q --disable-warnings` | 单独复跑同一 Failure |
| `pnpm run docs:check` / `pnpm run typecheck` / `git diff --check` | Passed |

Python L2 已有不可达网关测试失败：客户端收到预期 502 并满足时限，但 `192.0.2.1:80` 诊断为 `stage=error, detail=server closed connection`，测试要求包含 `connect_failed`。单独复跑仍失败；本轮 `apps/desktop` 和 `bridges/python` 无代码改动。该测试不由 JS/Loon bundle 驱动；未在本轮修改其既有行为/断言。Python L0/L1 与其它 L2 项均包含在全量 219 Passed 中，不能宣称 Python 全量绿。

后续独立修复（2026-10-01，Spec 001 T050）：上述失败由不可控的 TEST-NET 测试地址引起；改用本地未监听端口，另补连接后关闭的阶段测试。Python 全量复验 221 Passed；桌面类型检查、110 单测与 36 UI 用例 Passed。详见 [Spec 001 修复记录](../001-phase1-local-bridge/verification.md)。保留上表的提交前历史失败证据；本次修复不改变 Loon 设备 Pending 或 KI-019 风险状态。

### 兼容性、安全和文档影响

- Codec/session/settings schema 与桌面 IPC/登录隔离不变；新增共享 runtime 是对 Stash 实现的抽取，保留其导出与 native navigation workaround，现有 Stash bundles 同步重建。
- Loon native store 使用布尔写结果、undefined 单 key 删除；Settings 所有异常本地合成响应，不向 Gateway 泄露 body。Browser nonce bootstrap 与风险边界记录于 ADR-0016，POST 仍走既有 Core 防护。
- 没有新增第三方运行时依赖；AES 继续使用已固定的 aes-js 3.1.2。bundle 无 runtime import、Node crypto/fs/Buffer 或 CDN UI。CI 工作流已配置，本次仅执行本地等价命令，没有声称 GitHub CI 已运行。
- 已同步 Spec 003 的 scope/design/interfaces/UI/plan/tasks/test/verification、AGENTS/README 中英状态、architecture/components/interfaces、local API 索引、security、testing strategy、roadmap 和 ADR-0016 中英决策。
- 未执行 Loon 真机：缺少本轮可控制的设备/宿主会话。T020/T021/T057、O 系列设备验收与 M4 性能/发布仍 Pending；真实 upstream Cookie、两阶段 URL、wildcard MitM、QUIC 回落、Settings 来源/超限 body 必须由设备取证。
- `.plugin` 中 raw URL 指向 main；本轮文件未推送，远程 URL 不能视作已发布。可按 Loon README 导入本地 bundles 先验收；正式 release/rollback 不属于本轮交付状态。


## Loon 原始教务 URL 失败与 Host 修复（2026-10-01）

任务分类：Spec 003 M3 Bug，T062/T063，G13/G17。

### 真机证据与状态

- 使用 iPhone 镜像实际观察：改用 GitHub raw 导入后，插件已解析 Settings/business request、response 与 Generic；开启 Loon，Safari 设置入口显示本地 SWUFE WebVPN 页。仅确认设置页读取，保存/CSRF/超限等设备项仍 Pending。此前误导入 GitHub blob 页不作为有效插件的失败证据。
- `http://jwxt.swufe.edu.cn/` 命中「SWUFE 请求」，23:15:01 的请求约 34 ms 失败，收发均 0 B。请求详情显示 URL 已改为 WebVPN `/http/<wrd>/` 且有 Gateway ticket Cookie；Host 仍是 `jwxt.swufe.edu.cn`，概述的修改后地址也仍为教务主机。记录不含真实 Cookie、账号或完整请求头。
- 用户真人对照确认：直接访问同一原生 WRD URL 可进入，教务已登录成功。这证明原生 WebVPN 路径可用；不替代原始教务域名经 Loon 透明改写的验收。

| 验证项 | 状态 | 证据 / 边界 |
| --- | --- | --- |
| raw 插件解析与 Settings 页面 GET | Passed | 镜像显示已解析脚本及本地设置页；其它 Settings 设备项未验证 |
| 原生 WRD URL 进入教务并登录 | Passed（用户真人验收） | 同一转写资源可进入；不证明透明改写 |
| G13 原始 HTTP/80 教务 URL（0.1.0-m3） | Failed | 命中 Script，URL 已改、Host 未同步，0 B 快速失败 |
| T062 Host authority 修复（0.1.1-m3） | Passed（本地） | 修复前新增 4 个回归测试失败；修复后 Loon 44 tests、typecheck、bundle scan 通过 |
| T063 G13/G17 修复后设备恢复 | Pending | 本地制品尚未分发到设备；不能把 Host 修复视作已证明故障恢复 |

### 修复范围与 Open Questions

Loon Adapter 在 URL rewrite 的 `$done({url,headers})` 映射中移除大小写不同的旧 Host，设置唯一 `Host = new URL(url).host`；支持非默认网关端口、WRD 与 Gateway-owned 路径，其余头及 Cookie 保留，POST body 仍按宿主契约通过省略保留。PASS、headers-only Gateway 注入与 Settings synthetic response 不变。共享 Core/Stash、存储与安全模型未修改；属于既有上游 URL 契约的 Adapter 修复，无需新 ADR。三 bundle 与 `.plugin` cache version 同步为 `0.1.1-m3`。

Open：旧 Host 保留是已复现的输出缺陷，但它是否是唯一导致 0 B 失败的原因仍待 T063；尤其须复核 Loon 的 HTTP→HTTPS 连接切换、实际目的地址/端口与响应 URL 语义。复验时先加载同版本本地 bundle 或分发后的 raw 制品，确认日志版本后访问原始 `http://jwxt.swufe.edu.cn/` 并操作教务；若仍失败，保留本条 Failed 证据并继续取证，不宣称修复完成。


## Loon 302 相对 WRD 路径与重复包装修复（2026-10-01）

任务分类：Spec 003 M3 Bug，T064/G17。用户提供的脱敏结构表明：浏览器出现 `https://jwxt.swufe.edu.cn/https/<wrd>/xtgl/dl_loginForward.html`，下一次发往网关的路径成为 `/http/<wrd>/https/<wrd>/xtgl/dl_loginForward.html`，`/wengine-vpn/cookie` 的目标 path 也含 WRD 包装前缀。镜像已观察到这类教务域名 + WRD path 的请求，以及“您访问的页面不存在”的页面。未保存用户提供的真实 Cookie/账号/完整 header。

代码与本地复现：Core 已支持相对 WRD Location 解码，但共享 runtime 对 Gateway WRD 响应整体 PASS。在 Loon response 暴露改写后上游 URL、Safari 仍保留原站点 URL 的场景，相对 WRD Location 因 PASS 留给浏览器按原站点域解析，后续 request 会再次包装。新增回归在旧实现返回 `{}` 而失败。尚未取得现场原始 302 头及 response `$request.url` 的直接证据，因此该上下文是已复现的故障机制，现场的唯一触发原因仍待 G17 确认。

0.1.2-m3：仅在 Loon、启用转发、有效 Gateway WRD response 上，把 3xx 的同源、可解码且非自跳转的相对 WRD Location 补成绝对网关 URL。保留 header 大小写及其它 header，不重写原生 bootstrap/body，不改外部/未知/非 3xx 目标。原始 browser URL 的响应仍使用既有 Core 解码，普通请求的 Host 修复保留。此处理不依赖跨请求推测原始浏览器 URL，在上下文不足时导航到官方 Gateway；不新增 session/key/权限，属于宿主响应映射修复，无需新 ADR。Stash 行为不变，其 bundle 随共享源重建。

本地验证：Loon 47 tests、Loon 与共享 runtime typecheck、bundle scan 通过；Stash 36 tests 与 bundle scan 通过；docs/spec/diff 检查通过。覆盖原始 URL / 上游 URL 两种 Location 语义、浏览器下一请求无双重包装、query 保留、绝对/外部/非法/自跳转/非 3xx/禁用转发负向用例与 bootstrap 防环。

设备状态：Pending。需加载 0.1.2-m3，重新从 `http://jwxt.swufe.edu.cn/` 发起；确认 302 Location 要么为解码后的原始教务 URL，要么为完整官方 Gateway URL，下一请求仅含单层 WRD 路径，页面与 Cookie 查询 path 无混拼。已有错误 URL 需从入口重新开始，不能只刷新旧的嵌套路径。


## Loon 请求阶段原生网关导航（2026-10-02）

T065/G13/G17：用户复检 0.1.1-m3，HTTP 教务根请求完成 URL/Host 改写并注入 Gateway Session，但请求记录为 NO Response Header、发送 674 B/接收 0 B。该证据不证明存在 302 循环，也不证明实际连接目标/端口；现场根因仍未确定。未保存真实 Cookie 或完整请求头。

0.1.3-m3 在 Loon Adapter 复用 Stash 的 nativeGatewayRedirect：仅 rewrite 决策的页面 GET（根路径或 Accept 含 text/html）向浏览器合成完整 Gateway WRD URL 的 302 + Cache-Control: no-store。后续原生 Gateway 请求通过既有 headers-only 注入 Session；原生 bootstrap 响应保持原样。POST/HEAD/非文档 GET 保留透明 URL/Host 改写且省略 body；Settings、禁用/未选站点和未登录 PASS 不生成导航跳转。此变更用于绕开页面请求的跨 host/scheme 透明连接和浏览器原域名上下文，复用已有宿主适配契约，无存储/权限变更，无需新 ADR。

设备复验 Pending：更新插件及脚本，确认 entered 版本 0.1.3-m3，从 http://jwxt.swufe.edu.cn/ 新开导航；首个请求应为插件合成 302，Location 为完整官方网关 URL，下一请求应为单层 WRD 且进入真实响应；继续验证教务页面与操作。若仍失败，采集原生 Gateway 请求的状态/错误与连接目标，不把本地测试视作真机通过。

本地验证：Loon 50 tests、构建与 bundle scan Passed；Loon typecheck、docs:check、spec:check 与 git diff --check Passed。新增页面 HTTP/HTTPS 导航、query 保留、下一原生请求注入及 bootstrap 防环、非文档 GET/HEAD 回归；既有 POST body、省略 body、未选/禁用/Settings 和相对 WRD Location 用例通过。设备仍 Pending。


### 0.1.3-m3 用户真机复验（2026-10-02）

用户在本轮修复发布并通知复验后确认：现在已能成功进入 jwxt。记录为原始教务入口访问恢复 Passed（用户真人验收），关联 T065/G13 的页面进入结果；沿用本轮已提供的设备环境 Loon 3.5.1 (998)。未另行取得本次完整请求/响应链或脚本版本截图，因此不把 302 头、单层 WRD 路径和底层连接机制逐项标为已取证，也不认定先前无响应的唯一根因。

| 验证项 | 状态 | 证据 / 边界 |
| --- | --- | --- |
| 0.1.3-m3 修复后原始教务入口进入 | Passed（用户真人验收） | 用户确认已成功进入 jwxt |
| G17 完整重定向链、路径与 Header-only 行为 | Pending | 本次未提供完整响应链 |
| 修复后教务页面内操作 / POST 提交 | Pending | 本次仅确认进入页面，未确认具体操作 |

上述结论更新 T065 的设备页面进入结果，不追溯标记 0.1.1/0.1.2 通过；其余 M3/M4 设备验收与 Spec 状态不变。
