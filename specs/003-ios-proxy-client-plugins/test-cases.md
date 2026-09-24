# 测试用例：iOS Proxy Client Plugins

> Status: Approved  
> Spec ID: 003  
> Owner: cherrchen  
> Last Reviewed: 2026-09-24

状态初始均为 `Pending`。真实会话测试禁止把 Cookie/账号/MFA 写进证据文件。

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

## B. Routing

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
| C01 | gateway Cookie | 生成 SessionRecord |
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
| D04 | gateway request | pass + 可捕获 Session |
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
| F05 | wildcard default | false |
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
