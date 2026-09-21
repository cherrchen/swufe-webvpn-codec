# ADR-0007: 网关自有命名空间直通，且 bootstrap 文档升级到网关原生 URL 空间

## Status

`Accepted`

## Date

`2026-09-21`

## Decision Owners

`cherrchen`

## Context

本部署的学校 WebVPN 网关（`webvpn.swufe.edu.cn`）是**应用层反向代理**，且带一套自有的客户端改写运行时（下称 shim）。透明桥的既定策略是「客户端侧始终使用真实主机名，仅上行改走 WebVPN」（REQ-007），两者在 `KI-011` 上正面冲突，阻塞了第一期验收（TC-G01 / TC-G02）。

与决策相关的事实（均为实机实测，见 [verification.md](../../../specs/001-phase1-local-bridge/verification.md) 的 M4 与本轮记录）：

- 在**普通 URL 空间**下，网关对每个经它代理的 HTML 响应注入 shim：内联 `__vpn_*` 变量（实测 `__vpn_protocol_host=https://webvpn.swufe.edu.cn`）与 `<script src="/wengine-vpn/js/main.js?ver=20211207">`。该 `main.js` 从网关根可取（200 / 376 922 B），是厂商的客户端改写运行时（`vpnGlobal`、`vpn_eval`、`vpn_rewrite_url`、`vpn_inject_script`、XHR/CORS 钩子、IndexedDB）。
- `/wengine-vpn/` 与 `/authserver/` 是**网关自有根命名空间**，不属于任何被代理站点：未登录也能从网关根取到 `/wengine-vpn/js/js/wechat-font.js`（200）；登录页正文里的资源是根相对 `/authserver/swufeThemezxqr/…`。
- 透明桥把 allowlist 主机的**每个** path 都编码成 WRD 形态，于是浏览器在 `jwxt.swufe.edu.cn` origin 上请求相对路径 `/wengine-vpn/js/main.js` 被改写成 `https://webvpn.swufe.edu.cn/http/<token>/wengine-vpn/js/main.js`：经桥 **404**（网关根直取为 **200 / 376 922 B**）→ shim 永不启动。
- 后果：`http://jwxt.swufe.edu.cn/` 返回网关的 925 B shim 引导页并**白屏**；`/xtgl/index_initMenu.html` 经桥 200 / 76 854 B 且体已被反向改写，但页面脚本依赖 shim → 渲染出来却不可交互（未登录态、控件无效）。TC-G01 / TC-G02 失败，AC-007 不可达成。
- 判据可分：shim 引导页 925 B，而带同样注入的真实页 76 854 B（同一主机的实测值，量级差 >80×）。
- 网关**原生 URL 空间**（`https://webvpn.swufe.edu.cn/<scheme>/<token>/…`）下不再注入该 shim：链接由网关在服务端改写（实测资产 URL 形如 `/http/<token>/…?vpn-7&ver=…`），页面可正常交互。另实测：`https` scheme token 对 `jwxt.swufe.edu.cn` 不可用（网关返回 `/wengine-vpn/failed`），教务只能以 `http` 形态经网关代理。
- 未登录时网关对任意路径统一返回同一份 CAS 登录页，因此**不能**用状态码判断路径是否存在。

三条候选解除路径（网关自有路径不经 token / 在 HTML 中剥离 shim / 接受教务以门户形态使用）都会改公共契约，需先决策——本 ADR 即该决策。

## Decision

1. **网关自有路径前缀不经 token，直接取自网关根。** 命中 allowlist 的主机，请求路径以 `/wengine-vpn/` 或 `/authserver/` 开头时（`bridges/python/swufe_bridge/addon.py` 的 `GATEWAY_ROOT_PREFIXES`），桥把上行目标改为 `{webvpnBase}{path}`（含 query），只注入会话 Cookie，**不**做 WRD 编码；此类响应不做任何反向改写（它们是网关自己的资源，不含被代理站点的 URL）。判定按「路径以该前缀开头」，因此 `/xtgl/wengine-vpn/x` 这类站点自有路径仍走 token 改写。
2. **命中 bootstrap 判据的 HTML 文档升级到网关原生 URL 空间。** 对已做过 WRD 改写的 `GET` / `HEAD` 响应，若 `Content-Type` 为 `text/html`、正文长度 ≤ `GATEWAY_BOOTSTRAP_MAX_BYTES`（8192 B）且同时含 `GATEWAY_BOOTSTRAP_MARKERS`（`__vpn_` 与 `/wengine-vpn/js/main.js`），桥以 `302` + `Cache-Control: no-store` 把该文档换成同一 URL 的 WRD 形态（`bridges/python/swufe_bridge/addon.py` 的 `_promote_to_gateway`）。入口地址栏保持普通 URL，**其它 allowlist 主机仍留在普通 URL 空间**。
3. **判据只决定「是否升级」**，不改变 allowlist 语义，也不改变 `Location` → `Set-Cookie` → 正文反向改写的主契约；升级后该主机后续流量由浏览器直接在网关原生空间发起，`webvpn.swufe.edu.cn` 与 `authserver.swufe.edu.cn` 仍为 `not-allowlisted` 直通（INV-004 防环不变）。
4. **执行责任人**：cherrchen。

## Alternatives

| 备选方案 | 优点 | 缺点 | 未采纳原因 |
| -------- | ---- | ---- | ---------- |
| 什么都不做（接受白屏 / 不可交互） | 零改动、零风险 | TC-G01 / TC-G02 永远失败，AC-007 不可达成 | 与本期「教务可打开并操作」的验收目标直接冲突 |
| 在改写后的 HTML 中剥离 shim | 表面上不必进入网关原生空间 | 站点脚本依赖 shim 提供的符号与 URL 改写能力，剥离后的行为等价于当前故障态（白屏 / 不可交互）；识别「哪些注入属于 shim」需要脆弱的内容匹配 | 可行性未证实，且失败态与现状相同 |
| 所有 allowlist 主机一律升级到网关原生形态（不做判据） | 实现最少、规则只有一条 | 放弃「客户端侧始终使用真实主机名」的透明承诺：所有站点地址栏都进 `webvpn.swufe.edu.cn/<scheme>/<token>/…`，REQ-007 与 AC-007 的口径需整体改写 | 一次取消第一期的核心体验，代价大于收益 |
| 在桥内实现 shim 兼容层（自建 `vpnGlobal` 等符号与 URL 改写） | 可完全留在普通 URL 空间 | 需复刻厂商混淆运行时的行为（URL 改写、XHR/CORS 钩子、IndexedDB 缓存），网关一改版即失效 | 长期维护成本与不可控性远高于「把文档送回网关原生空间」 |
| 网关自有路径直通 + 剥离 shim（1 + 备选 2） | 自有资源不再 404 | shim 剥离的可行性问题原样保留 | 与备选 2 同因 |

## Consequences

### Positive

- 教务可打开并可操作：入口仍是 `http://jwxt.swufe.edu.cn/`，浏览器被 `302` 到网关原生形态后由网关自己的 shim 接管（实测首页、`xtgl/index_initMenu.html` 与站内「学生成绩查询」均可交互、链接不跳飞到不可达地址）；
- 其它 allowlist 主机的透明语义不变：非 bootstrap 页仍留在普通 URL 空间（实测 `www.swufe.edu.cn` 的站内导航保持普通主机名且页面完整渲染）；
- 直通规则同时修掉网关自有资源在普通 URL 空间下的 404（实测 `/wengine-vpn/js/main.js` 经桥 200 / 376 922 B，正文逐字节未改）；
- 判据是纯函数（`bridges/python/swufe_bridge/rewrite.py` 的 `is_gateway_bootstrap_html`），不需要真实网关即可 L1 覆盖。

### Negative

- 被升级主机的地址栏进入 `https://webvpn.swufe.edu.cn/<scheme>/<token>/…` 形态，用户看到的不再是 `jwxt.swufe.edu.cn`（REQ-007 的表述已按此限定）；
- 该空间依赖**浏览器自身**的网关会话：桥不向浏览器注入应用内会话（INV-004 防环与安全模型不允许），因此首次在该浏览器使用该主机时可能需要再做一次 CAS（实测确认，属预期行为）；
- 桥不再参与这些页面的改写：页面内 URL 改写与相对路径解析由网关服务端完成，出问题时桥的调试日志只能证明「已升级」，不能证明页面内某次跳转为何失败；
- 判据含经验常数（8192 B + 两个标记）：网关若改变引导页形态，升级会静默失效，需要用新的实测值更新常数。

### Risks

| 风险 | 可能性 | 影响 | 缓解措施 |
| ---- | ------ | ---- | -------- |
| 网关改版：引导页变大或不再含这两个标记 | 低 | 高 | 常数与谓词集中在 `bridges/python/swufe_bridge/rewrite.py`；实测字节数与复验命令记录在 [verification.md](../../../specs/001-phase1-local-bridge/verification.md) 的 M5 记录，改版时按同法重测并更新 |
| 真实站点页恰好 ≤ 8192 B 且含这两个标记 ⇒ 误升级 | 低 | 中 | 实测真实页与引导页量级差 >80×（76 854 B vs 925 B）；L1 用例锁定「含同样注入的大页面不升级」 |
| 用户以为「登录一次就够」，在网关原生空间遇到第二次 CAS | 中 | 中 | 在 spec / verification / development-run 写明该行为；应用内的 CAS/MFA 登录窗仍然只需一次 |
| `https` scheme token 对部分主机不可用（教务只能 `http`） | 已实测 | 中 | 保留既有事实记录：入口用 `http://`，升级目标由入口 scheme 决定（`/http/<token>/…`） |

## References

- 相关需求：REQ-006、REQ-007、REQ-008、REQ-011、NFR-006、AC-007
- 相关 Spec：[specs/001-phase1-local-bridge/](../../../specs/001-phase1-local-bridge/spec.md)（design.md §Proposed Solution、verification.md 的 M5 记录、known-issues.md 的 `KI-011`）
- 相关 ADR：[ADR-0001](ADR-0001-wrd-rewrite-in-mitm-layer.md)（改写放 mitm 层）、[ADR-0004](ADR-0004-refuse-start-when-system-proxy-in-use.md)（冲突时拒绝而不是半工作）、[ADR-0006](ADR-0006-local-capture-mode-and-mutual-exclusion.md)（捕获方式互斥）
- 实现依据：`bridges/python/swufe_bridge/addon.py`（`GATEWAY_ROOT_PREFIXES`、`_promote_to_gateway`、`METADATA_WRD_URL`、`METADATA_GATEWAY_ROOT`）、`bridges/python/swufe_bridge/rewrite.py`（`GATEWAY_BOOTSTRAP_MARKERS`、`GATEWAY_BOOTSTRAP_MAX_BYTES`、`is_gateway_bootstrap_html`）
