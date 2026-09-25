# 测试用例：iOS Proxy Client Plugins

> Status: Approved  
> Spec ID: 003  
> Owner: cherrchen  
> Last Reviewed: 2026-09-25

状态以 verification.md 为准；本节 N01 是已有 Safari 登录捕获的 Stash 真机观察，其余 N 组新增验证均为 `Pending`。真实会话测试禁止把 Cookie/账号/MFA 写进证据文件。

## A. Codec

| ID | 场景 | 预期 |
| --- | --- | --- |
| IOS-TC-A01 | jwxt 编码 Python/JS | 完全相同 |
| IOS-TC-A02 | 已验证 WRD URL 解码 | 原 URL |
| IOS-TC-A03 | 多组 roundtrip | 语义一致 |
| IOS-TC-A04 | http | scheme token 正确 |
| IOS-TC-A05 | 非默认端口 | `https-8443` 等正确 |
| IOS-TC-A06 | query/fragment | hostname AES 之外保持 |
| IOS-TC-A07 | bad key | 明确错误 |
| IOS-TC-A08 | bad token | 明确错误、不崩溃 |
| IOS-TC-A09 | 共享 vectors | 100% 一致 |

## B. Routing Core compatibility

本组 B06/B07 覆盖现有通用 RoutingPolicy 的 wildcard 分支；不表示 Stash Settings V2 暴露 wildcard routing。Stash Settings exact-only 覆盖见 K/M 组。

| ID | 场景 | 预期 |
| --- | --- | --- |
| B01 | 默认 jwxt | rewrite |
| B02 | 普通互联网 | pass |
| B03 | gateway | 不 ordinary rewrite |
| B04 | authserver | 不 ordinary rewrite |
| B05 | wildcard off | 未列 swufe host pass |
| B06 | wildcard on | `x.swufe.edu.cn` rewrite |
| B07 | apex | 与既有规则一致 |
| B08 | 大写 host | normalize |
| B09 | 非法 host | 不注入 Session |

## C. Session

| ID | 场景 | 预期 |
| --- | --- | --- |
| C01 | gateway Cookie 含核心 ticket `wengine_vpn_ticketwebvpn_swufe_edu_cn` | 生成 Gateway SessionRecord |
| C02 | gateway 无 Cookie | 不写 Session |
| C03 | authserver Cookie | 不写 Session |
| C04 | 非 gateway Cookie | 不写 Session |
| C05 | reload | persistent 后可读 |
| C06 | clear | 幂等 |
| C07 | gateway changed | 旧 Session 无效 |
| C08 | corrupt JSON | 安全失败、不 dump |
| C09 | unknown schema | incompatible |
| C10 | newer Cookie | 状态按契约更新 |

## D. Request Rewrite

| ID | 场景 | 预期 |
| --- | --- | --- |
| D01 | allowlist + Session | gateway WRD + Cookie |
| D02 | allowlist + no Session | login_required |
| D03 | non-allowlist + Session | pass，无 Cookie |
| D04 | 带 Gateway ticket 的 gateway request | 保留客户端 Cookie、capture/refresh + pass |
| D05 | auth request | pass，不读 body |
| D06 | codec failure | fail-closed |
| D07 | Origin | 与 desktop 契约一致 |
| D08 | Referer | 与 desktop 契约一致 |
| D09 | Cookie leakage | 非 gateway 上游无 WebVPN Cookie |

## E. Response Rewrite

| ID | 场景 | 预期 |
| --- | --- | --- |
| E01 | WRD Location | ordinary URL |
| E02 | non-WRD Location | 保持 |
| E03 | Set-Cookie Domain | gateway → original host |
| E04 | Set-Cookie Path | 去 WRD prefix |
| E05 | HTML URL | 还原 |
| E06 | JS escaped slash | 保持转义风格 |
| E07 | JSON | URL 还原 |
| E08 | image/png | 不 body rewrite |
| E09 | body too large | skip + warning |
| E10 | gateway bootstrap | promotion 与 desktop 一致 |
| E11 | gateway root namespace | 不 ordinary reverse rewrite |

## F. 安全/隐私

| ID | 场景 | 预期 |
| --- | --- | --- |
| F01 | debug off | 无 traffic debug |
| F02 | debug on | 无 Cookie/body/token |
| F03 | notification | 无 Cookie/账号 |
| F04 | storage audit | 无 username/password/MFA |
| F05 | Settings V2 routing wildcard | no wildcard route; only selected exact hosts |
| F06 | remote asset | HTTPS |
| F07 | reset | Session 清除 |
| F08 | exception | stack 不带敏感 input |

## G. Loon

| ID | 场景 | 预期 |
| --- | --- | --- |
| G01 | 导入 `.plugin` | 成功 |
| G02 | 参数页 | 默认正确 |
| G03 | Script load | request/response 执行 |
| G04 | persistent store | 跨脚本可读 |
| G05 | login notification | 节流 + openUrl |
| G06 | login URL | 记录 App 内/外行为 |
| G07 | CAS/MFA | 完成 redirect |
| G08 | gateway observation | request script 观察 |
| G09 | Safari jwxt | 可访问 |
| G10 | disable | 不再 rewrite |
| G11 | update | schema 兼容数据保留 |
| G12 | QUIC | 稳定进入 HTTP script |
| G13 | Safari 打开 `http://jwxt.swufe.edu.cn/` | HTTP/80 命中 request/response 脚本；上游使用 WRD `/http/` |
| G14 | 捕获 Cookie 后首次教务 CAS 往返 | 首次 CAS 302 保留 `captured`；回调仍可改写；成功响应后才标 `valid` |
| G15 | 已确认会话后再次跳 CAS | 按过期契约失效并可重登 |
| G16 | 浏览器进入原生 WebVPN `/http/<token>/` | 不反向改写网关 bootstrap；无指向当前 URL 的 302 或重定向循环 |
| G17 | Loon request/response URL 与 Header-only 响应 | 记录两阶段 URL 语义；Header 改写不清空业务 body |
| G18 | 插件更新后的日志定位 | 能区分未加载、脚本未执行与流量未命中；远程 bundle 使用预期版本，日志无敏感值 |

## H. Stash

| ID | 场景 | 预期 |
| --- | --- | --- |
| H01 | 导入 `.stoverride` | 成功 |
| H02 | Tile | 状态正确 |
| H03 | Tile URL | 记录 App 内/外 |
| H04 | CAS/MFA | redirect 成功 |
| H05 | gateway observation | request script 观察 |
| H06 | 返回 Stash | Tile 已登录 |
| H07 | Safari 访问 `http://jwxt.swufe.edu.cn/` | 命中脚本并经 WebVPN 可访问 |
| H08 | 教务主要页面 | 无关键跳转断裂 |
| H09 | HTTP/3 | 目标流量进入 HTTP Engine |
| H10 | disable | 不再 rewrite |
| H11 | provider update | bundle 正常加载 |
| H12 | expired | 状态失效并可重登 |

## I. 登录 P0 Gate

| ID | 判定 | 通过条件 |
| --- | --- | --- |
| I01 | Loon 内嵌网页 | 记录实际行为，不预设 |
| I02 | Loon 网页流量可观察 | gateway request 可见 |
| I03 | Stash 内嵌网页 | 记录实际行为，不预设 |
| I04 | Stash 网页流量可观察 | gateway request 可见 |
| I05 | 外部 Safari fallback | 若 App 内失败仍可登录并捕获 |
| I06 | Cookie jar 边界 | 行为明确记录 |

## J. 回归/发布

| ID | 场景 | 预期 |
| --- | --- | --- |
| J01 | desktop tests | 全绿 |
| J02 | docs check | 全绿 |
| J03 | JS lint/typecheck | 全绿 |
| J04 | bundle scan | 无 unresolved import/Node built-in |
| J05 | license | 清单完整 |
| J06 | rollback | 上一版可安装 |
| J07 | clean install | 不依赖旧数据 |

## K. Settings WebUI / pseudo API（Stash）

| ID | 场景 | 预期 |
| --- | --- | --- |
| K01 | 从 Tile 打开 Settings URL | Stash synthetic HTML 页面成功渲染；不依赖学校服务返回此路径 |
| K02 | bundle 离线打开 | 已缓存脚本无需远端 UI/CDN 即可提供 HTML/CSS/JS；首次未缓存情形单独记录 |
| K03 | Dark Mode / safe-area | 可读、无横向溢出，状态/错误不只靠颜色 |
| K04 | Toggle builtin | 打开/关闭 jwxt 后保存得到对应 enabled state |
| K05 | 添加合法 hostname | `foo.swufe.edu.cn` 保存为 normalized custom host |
| K06 | 删除 custom host | 保存后路由列表不含它；builtin 无删除操作 |
| K07 | 成功/失败反馈 | Saved；存储失败保留编辑数据并提示重试 |
| K08 | 未登录进入 Settings | 设置/保存可用；独立登录按钮打开官方 WebVPN |
| K09 | Tile 状态 URL | logged out → login；ready → Settings；动态更新能力需设备确认；静态 Settings fallback 可用 |
| K10 | unknown Settings path/method | 本地合成 404/405；未触达真实 upstream |
| K11 | GET HTML | `200 text/html; charset=utf-8`、bundle 内资源、no-store |
| K12 | GET settings | JSON 无 Session、CAS Cookie、Authorization、MFA、WRD secret |
| K13 | valid POST | token 与 schema 校验后写 v2，返回 `{ok:true}` |
| K14 | invalid JSON/schema | `INVALID_JSON` / `INVALID_SETTINGS`；不写入，不回显 body |
| K15 | malformed/illegal host | URL、path、userinfo、IP、localhost、wildcard、外部域均拒绝 |
| K16 | reserved hosts | gateway/authserver 大小写或末尾点变体规范化后拒绝 |
| K17 | duplicate hosts | builtin/custom 等价项拒绝 `DUPLICATE_HOST` |
| K18 | oversized body | 超出 byte cap 返回 `BODY_TOO_LARGE`；不解析/写入，日志无 body |
| K19 | invalid/expired/reused token | 返回 `UNAUTHORIZED`，不写入；成功 token 只能消费一次 |
| K20 | Origin/Referer/Content-Type | 跨源、不匹配 Origin、错误 Content-Type 请求拒绝 |
| K21 | Settings namespace priority | 不触发 Session Capture、WRD 编码、业务 body rewrite |
| K22 | Settings handler/storage exception | 本地 synthetic 500；不得走 request-entry 的 catch-and-pass 到真实 gateway |
| K23 | secure nonce generation unavailable | 本地 synthetic `503 SETTINGS_UNAVAILABLE`；不签发弱 token、不开放 POST、不请求 upstream |

## L. Settings normalization / migration

| ID | 场景 | 预期 |
| --- | --- | --- |
| L01 | uppercase + whitespace + trailing dot | ` JWXT.SWUFE.EDU.CN. ` → `jwxt.swufe.edu.cn` |
| L02 | URL input `https://jwxt.swufe.edu.cn/foo?a=1` | 拒绝；UI 明确只收 hostname |
| L03 | path / port / userinfo / wildcard | 拒绝 |
| L04 | V1 defaults | 迁移为 jwxt builtin enabled 与 V2 defaults |
| L05 | V1 in-scope exact custom host | 映射为 normalized `customHosts` |
| L06 | V1 external/reserved/invalid/wildcard | 丢弃并显示无 hostname 明文的 warning；Routing 不扩张 |
| L07 | v2 write failure | 保留 v1，fail closed，无 wildcard fallback |
| L08 | migration with existing session | `swufe.session.v1` 值不变 |

## M. Dynamic Routing / Interception Security

| ID | 场景 | 预期 |
| --- | --- | --- |
| M01 | selected hostname | WebVPN WRD rewrite；Session 仅发往 gateway upstream |
| M02 | unselected intercepted SWUFE hostname | 完整 PASS，URL/header/body 不变，Cookie 不注入 |
| M03 | builtin disabled | jwxt PASS，无 Cookie 注入 |
| M04 | custom removed | 下一请求立即 PASS，无需重导入 Override |
| M05 | Settings namespace | 永不发送到 gateway upstream |
| M06 | wildcard MitM config import | 真机确认 wildcard 子域捕获及 allowlist 内外行为 |
| M07 | wildcard QUIC rule | `DOMAIN-SUFFIX,swufe.edu.cn` + `PROTOCOL,QUIC` 只拒绝必要范围，TCP 回落脚本可观察；无全局 UDP/443 拒绝 |
| M08 | gateway/authserver | 官方登录流正常；不进入普通 target rewrite |
| M09 | external ordinary domain | 不新增 MitM/rewrite；无 WebVPN Cookie |

## N. Gateway Session Realm / Direct Gateway Reuse / Safe Auth Trace

N01 已通过。N02 在 2026-09-25 的 tyxycg 真机尝试中观察到代理执行注入，但 Gateway 仍要求重新登录，故记录为 `Failed`；其它未取得完整脱敏证据的 N 组用例保持 `Pending`。用户已确认正常 Gateway logout 的实际 pathname 为 `/logout`；其余未确认 endpoint 使用分类 fixture，不把 fixture 名称写成 WebVPN 实际 pathname。

| ID | 场景 | 预期 | Status |
| --- | --- | --- | --- |
| N01 | Safari 完成 WebVPN 登录 | Stash 脚本捕获含核心 ticket 的 Gateway Cookie，并持久化为 `swufe.session.v1`；证据不包含 Cookie value | Passed（2026-09-25 最新 Stash M2 观察；详见 verification） |
| N02 | 第三方 App/WKWebView 无 Gateway Cookie 直接请求 Gateway；stored Session ready；`WRAPPED_RESOURCE` 且 login intent 为 none | 代理层向 gateway request 注入 stored Gateway Session；同一客户端 Cookie Jar 不需要有 ticket；WebVPN 不应仅因客户端缺 Cookie 而重新进入 Gateway login | Failed（2026-09-25：Safari 页面与 Tile 均显示已登录后，执行注入仍跳 Gateway 登录；stored 内部状态为 `captured`） |
| N03 | request 带 ticket B，stored ticket 为 A | 保留请求 Cookie B、不附加或替换为 A；capture/refresh B 到 store 并 PASS | Pending |
| N04 | stored Gateway Session 已过期或核心 ticket 缺失 | 不注入；PASS/允许官方登录继续；不得只因出现 CAS 页面/redirect 清除 stored Gateway Session；只有独立 Gateway 失效证据才能清除 | Pending |
| N05 | 用户确认的 Gateway `https://webvpn.swufe.edu.cn/logout` request（可带 query） | 不注入旧 Session；请求时清除 `swufe.session.v1`；响应不得重新存入 ticket；Stash 真机脚本命中与清理结果仍待取证 | Pending |
| N06 | `https://webvpn.swufe.edu.cn/__swufe_bridge__/...` Settings Namespace | 本地 synthetic response；不注入、不 capture、不请求 upstream | Pending |
| N07 | raw `authserver.swufe.edu.cn` request | PASS；无 Gateway Session 注入；无 CAS Cookie/credential 捕获或保存 | Pending |
| N08 | raw authserver 与 gateway 上 WRD-wrapped authserver URL 并存 | Safe Auth Trace 分别记录 request host/route kind 与 decoded original host；`service` 只记录 target hostname；不记录 query、token 或 ticket value；不会把 authserver 加入普通 Routing Scope | Pending |
| N09 | `tyxycg.swufe.edu.cn` 跨 App 流程 | Trace 可区分 gateway ticket 缺失/未注入后由 Gateway login redirect 到 CAS，与 Gateway 已认证访问业务站后由业务系统继续 redirect 到 CAS；后者不被误判为 Gateway Session 复用失败，也不因 CAS 页面单独清除 stored Gateway Session | Pending |
| N10 | `GATEWAY_ROOT` 显式重新登录意图 | 即使 stored Gateway Session ready，也不注入旧 Session；意图未知时采取同样的 no-injection 行为，保留官方登录流程 | Pending |
