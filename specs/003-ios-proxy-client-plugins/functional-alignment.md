# Stash / Loon 功能对照与对齐建议

> Status: Draft
>
> Spec ID: 003
>
> Owner: cherrchen
>
> Last Reviewed: 2026-10-02
>
> 中文主文档；英文对应：[functional-alignment.en.md](functional-alignment.en.md)

## 1. 用途与边界

本文供下一轮功能对齐评审与任务拆分使用，比较当前仓库中的实现，而非第三方客户端的完整能力。审查基线为 Git `648167b`：Stash Override 标识 `0.1.18-m2-bodydiag`，Tile provider 标识 `0.1.16-m2`；Loon 标识 `0.1.3-m3`。版本字符串不是功能完整程度的排名，也不证明远程 GitHub 制品已更新。

本轮仅新增分析文档、索引与验证记录，没有修改源码、测试、插件配置、bundle 或发布物。工作区已有的六个未跟踪 P0 文件不属于正式插件基线，也未改动。正式实现依据 `plugins/stash/src`、`plugins/loon/src`、共享包和正式 `.stoverride` / `.plugin`；P0 登录观察以 [verification.md](verification.md) 为准。

事实依据分为三层：源码/配置说明“实现了什么”，自动化说明“本地回归了什么”，设备记录说明“实际验证了什么”。下文的对齐建议均为 **Draft**，不改变 [PRD](prd.md)、[接口契约](interfaces.md)、既有 [tasks.md](tasks.md) 或 Spec 的 `In Progress` 状态。未收敛问题列入第 7 节，不作为已批准设计。

## 2. 总体结论

两端已共享 `webvpn-core-js` 和 `webvpn-plugin-runtime`，具备相同的 WRD 编解码、精确站点路由、Gateway Session 编排、Settings V2 与主要安全约束。Loon 并不缺少 Stash 的会话捕获、持久化或 direct Gateway 注入分支。当前功能对齐的主要工作是入口与运行开关、通知策略、宿主请求/响应映射、正文读取策略、兼容性与验证覆盖。

对齐目标建议定为“相同用户任务和业务不变式”，保留宿主必需的实现差异。尤其不能为了代码一致删除 Loon 的 Host 修正和相对 WRD Location 处理，也不能把 Stash 的 Tile 能力直接假定为 Loon 可用 API。Stash 后续开发暂停的既有安排见 [plan.md](plan.md)；本报告不解除该暂停。

### 2.1 证据入口

| 标识 | 文件与关键符号 | 用途 |
| --- | --- | --- |
| E1 | [Core request](../../packages/webvpn-core-js/src/rewrite/request.ts)：`rewriteRequest`；[gateway classifier](../../packages/webvpn-core-js/src/routing/gateway-request.ts) | WRD、Cookie、Origin/Referer、注入边界 |
| E2 | [Core response](../../packages/webvpn-core-js/src/rewrite/response.ts)、[body](../../packages/webvpn-core-js/src/rewrite/body.ts) | Location/Cookie/body、大小限制与 bootstrap |
| E3 | [shared runtime](../../packages/webvpn-plugin-runtime/src/runtime.ts)：`handlePluginRequest` / `handlePluginResponse` / `nativeGatewayRedirect` / `handleStatusTile` | 共用业务编排及宿主条件分支 |
| E4 | [Stash request](../../plugins/stash/src/request-entry.ts)、[response](../../plugins/stash/src/response-entry.ts)、[Tile](../../plugins/stash/src/tile-entry.ts)、[Adapter](../../plugins/stash/src/adapter.ts) | Stash `$done`、通知、存储映射 |
| E5 | [Loon Adapter](../../plugins/loon/src/adapter.ts)、[runtime](../../plugins/loon/src/runtime.ts)、[Generic](../../plugins/loon/src/generic-entry.ts) | 参数、版本、nonce、通知、Host 与执行保护 |
| E6 | [Stash Override](../../plugins/stash/swufe-webvpn.stoverride)、[Loon plugin](../../plugins/loon/swufe-webvpn.plugin) | 脚本匹配、读取 body、MitM、QUIC 与入口 |
| E7 | [Settings V2](../../packages/webvpn-core-js/src/runtime/settings-v2.ts)、[共享页面](../../packages/webvpn-plugin-runtime/src/settings-page.ts)、[Loon 页面](../../plugins/loon/src/settings-page.ts) | 配置能力、公开 DTO、nonce 与保存重试 |
| E8 | [Session](../../packages/webvpn-core-js/src/session/session.ts)、[状态模型](../../packages/webvpn-core-js/src/runtime/settings.ts)、[diagnostics](../../packages/webvpn-core-js/src/runtime/diagnostics.ts) | 状态、存储 key、日志与通知内容 |

## 3. 已对齐的功能基线

“相同”表示共用实现或一致的输出语义；不是两宿主均已通过设备验收。各行证据使用上表标识。

| 功能 | 两端当前实现 | 证据 / 验证边界 |
| --- | --- | --- |
| WRD 协议 | 同一 JS codec，Python 权威测试向量；支持 HTTP/HTTPS、端口、path/query/fragment | E1；Core codec tests；实际目标协议由站点配置覆盖 |
| 站点路由 | 默认仅启用教务；精确 SWUFE 子域、自定义项增删、内置项开关；gateway/authserver 永久保留 | E1/E7；未选站点 PASS，不注入 Session |
| 站点协议 | 每站 HTTP/HTTPS；未设 HTTPS 的站点默认 HTTP；保存后下一请求读取 | E1/E7；同一源 HTTPS URL 也可能编码为 WRD `/http/`，这是配置语义 |
| 登录与 Session 捕获 | 官方 Safari WebVPN/CAS/MFA；从 Gateway Cookie/Set-Cookie 捕获并本地保存，不保存 CAS Cookie/密码/MFA | E3/E8；Gateway Session 与业务站点/CAS 的 Cookie Jar 分开 |
| 跨客户端注入 | 普通已选目标改写后注入；direct Gateway 无 ticket 时只允许已选 WRD 或无 query 根页 GET/HEAD 等已分类路径 | E1/E3；`gateway-owned` / login / logout / unknown 不在 direct 注入允许集合 |
| 冲突 ticket | 已选 WRD 使用 stored 核心 ticket 替换客户端不同 ticket，保留其它 Cookie；冲突单次请求不覆盖共享 store | E1/E3；根页携新 ticket 获得 200，在允许的响应条件下才确认切换 |
| 会话轮换与失效 | 绑定 stored ticket 的 Set-Cookie 更新/删除、时钟到期、精确 `/logout` 清理；其它客户端无/不同 ticket 的响应不污染已有会话 | E3/E8；CAS-only 页面或跳转不清 Gateway Session |
| 普通请求头 | Cookie 合并、已选 Origin/Referer 改写；request `$done` 不输出 body，以宿主保留原正文 | E1/E4/E5；是否事先读取 body 仍不同，见 ALIGN-05 |
| 页面导航 | 有会话且获得 rewrite 决策的页面 GET（根路径或 Accept 含 `text/html`）合成 302 到完整 Gateway URL；POST/HEAD/非文档 GET 透明改写 | E3/E4/E5；Loon 已复用 Stash `nativeGatewayRedirect` |
| 响应反向改写 | 原始站点 URL 上下文中改 Location、Set-Cookie Domain/Path 和 HTML/JS/JSON WRD 引用；正文默认 1 MiB guard | E2/E3；原生 Gateway WRD 页面 body/bootstrap PASS，避免自 promotion；不是所有网关页面都反向改写 |
| Settings 本地 API | 同一保留路径、V2 schema、JSON、16 KiB、一用 token、两分钟 TTL、来源检查、本地错误；更新不触碰 Session | E3/E7；Loon GET 另有更严格 bootstrap 来源门禁 |
| Settings 保存体验 | 保存前刷新 token；失败保留草稿并恢复重试；深浅色、safe area、登录按钮、迁移提醒 | E7；两页面处理器均有 VM 回归 |
| 数据迁移 | V1 → V2，关闭旧 wildcard routing，移除越界项并给出摘要；Session schema 独立 | E7/E8；同 key 名不意味着两个 App 共享 persistent store |
| 诊断与分发 | Safe Trace 分类/脱敏；无原始 pathname、认证值或正文；自包含 IIFE，GitHub 分发，无 BoxJS/远程 Settings backend | E3/E8；debug=false 仍有脱敏 system 诊断，见第 5 节 |
| 网络范围 | wildcard SWUFE MitM 为拦截范围，精确站点为路由范围；只拒绝 SWUFE suffix 的 QUIC | E6；规则存在不证明 wildcard/TCP 回落设备通过 |

## 4. 实现差异矩阵

类别：“体验”表示用户可见能力不同；“策略”表示可以评审统一；“宿主”表示有明确平台适配依据；“覆盖”表示测试/交付证据不同。`ALIGN-*` 仅为本文建议编号，尚未登记为实现任务。

| ID / 类别 | Stash 当前实现 | Loon 当前实现 | 影响与建议 |
| --- | --- | --- | --- |
| ALIGN-01 / 体验 | 首页 Tile 每 30 秒刷新；未登录/失效进入登录，已登录进入 Settings；Override 静态 openUrl 仍指向登录 | Generic 分别提供设置/登录，经通知点击打开；显示运行时状态，无定时 Tile | 统一“查看状态、打开设置、重新登录”任务；保留不同 UI。Loon 缺少与 Tile 等价的自动刷新展示，但本报告不假定宿主有 Tile API。E4/E5/E6/E8 |
| ALIGN-02 / 体验 | runtime 读 persisted `enabled/debug`；正式 Override 未提供相应参数控件 | `[Argument] enabled/debug` 逐请求覆盖 V2 运行开关；关闭转发仍可用 Settings | 两端 Settings 页都没有全局 enabled/debug 控件。建议评审 Stash 是否增加可达入口；明确宿主参数与持久值优先级。E5/E6/E7 |
| ALIGN-03 / 策略 | 默认每事件 60 秒；共享 `notifyThrottled` 写 throttle 时只存当前事件，交替事件会丢掉之前时间戳 | 登录/失效 30 分钟，错误 10 分钟；Adapter 合并已有事件时间戳 | Stash 更频繁，且交替事件会破坏独立节流记忆。建议先统一保留事件时间戳，再由产品决定时间间隔；Generic 主动运行通知不走该自动错误节流。E3/E5 |
| ALIGN-04 / 宿主 | Settings nonce 来自宿主 `globalThis.crypto.getRandomValues`；无安全随机源时 GET API 503 | Safari Web Crypto 生成 nonce，以 GET bootstrap header 提交；要求精确 HTTPS origin/API path、Settings 页 Referer 与无冲突 Origin | 两端安全结果应一致，来源实现保留差异；不能将 Loon bootstrap 原样移植为 Stash 的既定方案。E3/E5/E7；ADR-0014/0016 |
| ALIGN-05 / 策略 | Settings 和普通 request 都 `require-body: true` | 仅 Settings request `requires_body=true`；普通业务 request 不读 body | Stash 与 IOS-NFR-005 的普通 header-only request 不读 body 目标有差距，也会读取 auth 请求 body。建议 Stash 收敛，Settings 写请求例外保留，设备验证实际 POST/上传保留。E6 |
| ALIGN-06 / 策略 | 一个 broad response rule，所有匹配响应均要求 body | raw authserver 只读 header；HTML/JS/JSON 走正文 rule，其余只读 header | 两端 Core 支持类型相同，宿主读取成本/隐私面不同。建议 Stash 评估分流能力；不能只改 `require-body=false` 而丢失文本改写。Core guard 在读取后生效，不等于宿主内存 guard。E2/E6 |
| ALIGN-07 / 宿主 | URL rewrite 输出 `{url,headers}`，不主动重设 Host | 移除所有大小写 Host，设置唯一 `Host = new URL(url).host`，含非默认端口 | Loon 有旧 Host 保留的设备故障证据；Stash 未证明同样需要。保持 Loon 修正，对 Stash 先验证实际 Host/连接目标。页面 GET 合成导航与此透明请求分支分开验收。E4/E5 |
| ALIGN-08 / 宿主 | 原生/上游 Gateway WRD 响应 PASS，不改相对 Location | 相同 PASS 分支内，仅 3xx 同源、可解码、非自跳转相对 WRD Location 补成完整 Gateway URL | 补偿 Loon 暴露上游 URL 时浏览器仍在原域解析的问题；不是 Loon 多做一次通用反向解码。Stash 应先确认 URL 上下文再决定是否适配。E3：`absoluteGatewayRedirect` |
| ALIGN-09 / 覆盖 | env 读 `$environment` 版本/平台；无最低版本声明或 HTTP runtime build gate | `.plugin` 声明 3.5.1(983)；HTTP Adapter 从 `$loon` 解析 build，低于 983/无法解析则业务 PASS、Settings 本地 503 | Stash 最低版本 TBD，不能凭 Loon 数字补一个。两端数据 schema 检查已有，但不等于宿主版本检查；Loon Generic 不经过该 HTTP build gate。E4/E5/E6 |
| ALIGN-10 / 宿主 | write 把 `null` 映射为空串，只有显式 `false` 判失败（兼容 void）；read 将空串视为不存在 | write 把 `null` 映射 `undefined` 删除单 key，原样使用布尔结果 | 保持 native store API 差异，统一“逻辑删除/失败不保存”的契约和回归。不得复制 Loon 删除语法到 Stash。E4/E5 |
| ALIGN-11 / 覆盖 | entry 外层异常 request/response `$done({})`；Settings handler 内已有本地 catch | HTTP executor 有单次 done 保护，外层异常若属于 Settings namespace 返回本地 500，否则 PASS | Stash 在 shared handler 之前（如绑定 runtime）抛错，外层仍可能对 Settings PASS；属于本地终结防线差异，设备是否触发 TBD。建议覆盖 entry 级异常，而非声称共有 handler 没有保护。E3/E4/E5 |
| ALIGN-12 / 策略 | business regex 无域名结束边界、区分大小写；Settings 专用 regex 仅匹配无端口 HTTPS 文本 | URL authority regex 明确 `swufe.edu.cn` 后只允许端口/斜线，忽略大小写；Settings rule 排第一 | Stash regex 可文本匹配 `jwxt.swufe.edu.cn.evil.example` 等外观相似域；Core 精确 hostname 检查仍 PASS，不能据此断言 Cookie 泄漏。建议收敛脚本触发边界并验证实际 MitM 范围，单独检查两端规则优先级。E1/E6 |
| ALIGN-13 / 覆盖 | 37 项 Adapter 测试为主；少量实际 entry VM；无正式 Override 结构/匹配专用测试文件 | 48 项 runtime VM 编译并执行三个实际 entry，断言一次 done；4 项 plugin 文本检查 | 总数不是能力排名；建议补齐 Stash 配置/宿主边界覆盖，沿用共享语义 fixtures。两页面处理器测试目前位于 Stash suite，但同时执行 Loon HTML。测试文本不证明宿主 parser。 |
| ALIGN-14 / 覆盖 | request/response provider `0.1.18-m2-bodydiag`，Tile provider `0.1.16-m2`；Stash entry 日志无同等语义版本串 | 三 bundle provider 均 `0.1.3-m3`，entry trace 带此版本 | 两端 build banner 都含 Git commit；`main/...?...v=` 只是缓存标识，不是不可变版本地址。建议统一制品清单、缓存更新与回滚口径，不能直接把版本号改成相同或宣称缓存混装已发生。E4/E5/E6；build scripts |

### 4.1 需要保留的宿主差异

Nonce 的安全来源、Host 修正、响应 URL 上下文、native store 删除、通知 `url`（Stash）/`openUrl`（Loon）、Tile/Generic、Stash HTTP/80 force-engine 与 Loon 新 Script 语法均应保留适配边界。对齐的是输入输出语义与用户可完成的操作，而不是 `$done` 或配置文本逐字相同。

### 4.2 脚本匹配边界的本地复核

从正式配置读取正则，用 Node `RegExp` 对构造 URL 进行只读检查，得到如下结果；未发起网络请求。这只证明脚本规则文本差异，不证明这些 URL 会进入实际 MitM，更不证明 Core 会向它们注入 Cookie。

| 构造 URL | Stash business regex | Loon business regex |
| --- | --- | --- |
| `http://jwxt.swufe.edu.cn/` | 匹配 | 匹配 |
| `https://jwxt.swufe.edu.cn.evil.example/` | 匹配 | 不匹配 |
| `https://swufe.edu.cn@evil.example/` | 匹配 | 不匹配 |
| `https://JWXT.SWUFE.EDU.CN/` | 不匹配 | 匹配 |

## 5. 两端共同的未完成项与解释边界

以下不是“另一端缺了一个已有功能”。

| 项目 | 当前事实 / 限制 | 下一步依据 |
| --- | --- | --- |
| 跨 App/WKWebView 真正可用 | 共享注入分支和 Loon VM 独立客户端模拟已存在；Stash tyxycg 历史设备失败保留，后续 stored-ticket 策略复验未完成；Loon 未取得跨 App 上游接受证据 | T054/T057、N02–N10；不能以 Safari 教务可进入判为跨 App 成功 |
| Gateway Cookie 最小集合 | `captureSession` 保存所见 Gateway Cookie header；Set-Cookie 处理识别核心 ticket，但捕获并非只保存核心 ticket | E8、Spec Q-003；辅助 Cookie 的最小必要集合仍待取证，不能声称已完全最小化 |
| 显式/未知 login intent | Core 按已知 pathname 分类并排除 login/logout/unknown；当前 `RequestDTO` / `rewriteRequest` 中未见独立 `loginIntent` 字段或 intent 分类器 | PRD IOS-REQ-016/017、interfaces 契约、T052/T053；下一轮确认完整意图策略，不能把已知路径保护称为完整实现 |
| 状态完整性 | Tile/Generic 与 Settings 公共状态主要为未登录、已登录、过期、不兼容；`captured` 也可显示已登录。没有主动上游探活、MitM 就绪检测或独立“正常”状态；Settings 页面状态随读取更新，不定时轮询 | IOS-REQ-008；明确“本地有会话”与“上游接受会话”的区别，MitM 未就绪不能被脚本自行证明 |
| 开关可见性 | 公共 Settings DTO 仅公开站点字段；页面不显示全局 enabled/debug，也不直接说明转发关闭状态 | ALIGN-02；是否增加公开状态/开关是待评审接口与产品变更 |
| 自定义站点暂停 | customHosts 是“存在即启用”，页面只有添加/删除与协议，未提供自定义项独立 disable 保留 | 目前两端相同；是否新增暂停能力 TBD，不能算单端缺失 |
| 诊断开关语义 | debug=false 过滤 traffic 诊断，但 entry 和 shared `emit` 仍输出脱敏 system 事件；关闭 debug 不等于绝对无日志 | IOS-REQ-009、F01 与现有入口诊断口径；下一轮明确文案/验收，不删除排错证据或扩大日志 |
| 正文与网络边界 | 1 MiB Core body guard、16 KiB Settings guard 已有；宿主读取上限、超限仍本地终结、wildcard MitM、QUIC/TCP 回落没有完整设备证据 | Gate D/M4、K/M/G/H/O 对应设备项 |
| 更新与回滚 | 两端自包含 bundle 和扫描均有；当前 raw 指向可变 main，完整版本锁定/rollback smoke 不等于已完成 | IOS-REQ-012、M4；需版本固定制品和独立设备升级/回滚验证 |

### 5.1 文档与实现的漂移

下轮对齐还需同步已有文档，但本轮不改写已接受 ADR 或重定需求：

- [ADR-0016](../../docs/architecture/adr/ADR-0016-loon-local-settings-runtime.md) Decision 1 仍称 native redirect 只在 Stash 使用；当前 Loon 也已复用，最新行为见 [interfaces.md](interfaces.md) 的 Loon M3 契约和 T065 验证记录。按仓库规则，后续应通过增补/后继决策处理 Accepted ADR，不能静默重写历史正文。
- [design.md](design.md) Security Considerations 仍有“客户端已有 ticket 时保留并 capture/refresh”的概括；最新策略对已选 WRD 使用 stored ticket，权威细节见 [interfaces.md](interfaces.md) 与 PRD。下一轮同步概述时保留 login/root/unknown 的例外。
- [verification.md](verification.md) 顶部早期总述称 G13–G18 均 Pending，后续已记录 Loon G13 页面进入 Passed；它只证明入口恢复，G17/页面内操作仍 Pending。后续应整合最新粒度，避免读早期概述或历史失败记录误判当前状态。

## 6. 建议对齐顺序与验收输入

以下仅为候选工作包，不新增已批准 T 编号，也不解除 Stash 暂停。先确认是否重启 Stash，以及第 7 节的产品选择，再按现有 Spec 流程更新需求/任务/验证。

| 顺序 / 工作包 | 建议范围与落点 | 可独立验收的结果 | 关联 |
| --- | --- | --- | --- |
| 1 / 保护既有业务基线 | 保留共享 Core、ticket 策略、两端 native navigation；整理原始 URL/上游 URL、POST/HEAD/页面 GET 输入 fixture | 两端会话/路由相同；输出差异仅限已声明宿主映射；原生 bootstrap 无自跳转、无双层 WRD | E1–E5；G13/G16/G17、H07、N 系列 |
| 2 / Settings 本地终结与正文策略 | Stash entry 外层 Settings 异常保护；评估普通 request header-only 与 response 分流；范围 regex 边界 | Settings 任意方法/异常/超限都无 upstream；业务 POST/上传原字节保留；auth 不读 body；大正文仍有 header 处理 | ALIGN-05/06/11/12；IOS-NFR-005、K10/K21/K22、M05 |
| 3 / 入口与运行开关 | Stash 状态/设置/登录可达性；Loon 状态提示；决定是否提供全局开关与公开 disabled 状态 | 未登录也能设置站点；关闭转发不关 Settings；重新登录入口明确；参数/存储/页面含义不冲突 | ALIGN-01/02；IOS-REQ-008、H02/H06、O01/O06 |
| 4 / 通知与兼容性 | 保留每事件时间戳；决定时间间隔；验证 Stash 最低版本/安全随机能力 | 交替事件不绕过节流；记录兼容版本，未知能力有可操作提示；nonce 不退化为弱随机 | ALIGN-03/04/09/10；G05、K/O nonce 项 |
| 5 / 回归与制品 | Stash config/entry VM 对照；明确 Tile provider 更新；固定完整版本发布和回滚；同步漂移文档 | 来源可追踪、bundle 无 Node/CDN、各 entry 一次终结；同一安装组合 smoke；文档状态与证据一致 | ALIGN-13/14；G18/H14、IOS-REQ-011/012 |
| 6 / 各宿主独立设备验收 | 页面进入之后继续真实教务操作/POST、跨 App、两阶段 URL、wildcard、QUIC、Settings 写入/超限 | 按宿主记录环境和逐项 Passed/Failed/Pending；不继承另一端或 VM 的通过状态 | T020/T021/T027/T054/T057，M4 |

每个工作包的设备证据只保留版本、方法、域名/固定路径分类、状态码、跳转分类、注入/保留的布尔结果和操作结果；不保存 Cookie 值、真实账号、认证参数或完整 header/body。“上游实际发送/接受会话”须有独立证据，不能只引用 Script 的决策日志。

## 7. Open Questions（下轮评审）

| ID | 需要明确的问题 | 可先做的工作 |
| --- | --- | --- |
| ALIGN-Q01 | 是否解除 Stash 暂停，还是先在 Loon 完成验证，仅维护共享安全回归？ | 本报告保留全部差异，不启动 Stash 功能开发 |
| ALIGN-Q02 | 两端是否需要相同全局 enabled/debug 入口？选宿主控件、本地页面还是组合；参数优先级如何解释？ | 先定义“关闭转发仍能设置/登录”的可观察行为，不扩充 API |
| ALIGN-Q03 | 是否采用 Loon 30/10 分钟通知间隔；主动 Generic 与自动错误是否分别定义？ | 时间戳保留问题可与产品时间参数拆开 |
| ALIGN-Q04 | Loon 有无适合自动展示状态的宿主能力，是否只要求按需 Generic + Settings？ | 不假定有 Tile；以现有通知/页面可达性评估体验 |
| ALIGN-Q05 | Stash 最低版本、安全随机源、Settings 来源信息与响应规则优先级在目标版本是否可靠？ | 先设备取证；能力不明时维持现有 fail-closed/静态范围退化约束 |
| ALIGN-Q06 | 页面进入 Gateway 后，产品是否接受原生网关 URL；“保留原域名”目标如何描述已采用导航 workaround？ | 区分页面 GET 与透明 API 请求验收，不取消已有可用路径 |
| ALIGN-Q07 | login intent、callback 和真实跨 App Session 的剩余契约如何收敛？ | 复用 T052/T053/T054/T057，不新增 CAS Cookie 共享或猜测 callback |

## 8. 本轮验证与文档影响

已执行当前测试进行事实复核，使用 `exec vitest run`，没有调用带 dist 重建的 package `test` 脚本。测试中的 entry 构建为内存输出；未写入正式 bundle。结果：

| 命令 | 结果 | 证明范围 |
| --- | --- | --- |
| `pnpm --filter webvpn-core-js exec vitest run` | 76 Passed | codec、routing、session、rewrite、Settings Core |
| `pnpm --filter swufe-webvpn-stash exec vitest run` | 42 Passed | Adapter、request/response entry、两端页面处理器 |
| `pnpm --filter swufe-webvpn-loon exec vitest run` | 52 Passed | Loon entry VM 与 plugin 文本契约 |
| 两宿主各自目录执行 `node scripts/scan-bundle.mjs` | Passed | 现有六个 bundle 的依赖隔离；不证明远程版本或设备加载 |
| `pnpm_config_verify_deps_before_run=false pnpm run docs:check` | Passed；0 errors / 0 warnings | 链接、中英配对、Spec 结构 |
| `git diff --check` | Passed | 已跟踪文档补丁空白检查 |

设备结果仍引用 [verification.md](verification.md)：Stash Safari capture 已有设备证据，跨 App 历史失败与新版策略待验收；Loon parser/Settings GET 和教务入口有通过记录，保存、教务内操作、完整链路及跨 App 仍未完整验收。本轮未执行真机、远程发布核验或 M4 压测。

文档更新矩阵：仅新增 Spec 对照文件及英文副本，更新 Spec/文档索引，并在 verification 登记本轮证据。需求、接口、数据模型、架构、安全策略、依赖、实现任务和测试方式均未修改，因此相应长期正文无需同步；不新建 ADR。后续一旦接受运行开关/状态 DTO/nonce 等变更，再评估 ADR 和契约影响。
