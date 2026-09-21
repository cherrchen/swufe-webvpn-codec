# ADR-0011: fake-ip（TUN / 虚拟网卡）环境同样以 `PROXY_CONFLICT` 拒绝开桥

## Status

`Accepted`

## Date

`2026-09-21`

## Decision Owners

`cherrchen`

## Context

[ADR-0004](ADR-0004-refuse-start-when-system-proxy-in-use.md) 把「开桥前检测环境冲突、冲突则拒绝」固定为一条原则，但它只检查**系统代理**（macOS 的 `networksetup`、Windows 的 WinINET 读到的 HTTP/HTTPS 代理项）。

M4 验收实测（2026-09-21，见 `KI-013`）暴露出第二类冲突：本机同时运行 Clash / mihomo 的 **TUN（虚拟网卡）模式**时，其 fake-ip DNS 会把上游域名解析到 `198.18.0.0/15`（RFC 2544 保留的基准测试段，Clash / mihomo / sing-box 的默认 fake-ip 地址池），经桥的请求（含教务）**大面积挂起**而不是报错。此时：

- 系统代理可能并没有被占用，因此 `PROXY_CONFLICT` 不会触发；
- 用户看到的是「开桥后浏览器一直转圈」，桥状态仍是 `running`，日志里也没有失败行——与 ADR-0004「拒绝而不是半工作」的原则相反；
- 该前置条件此前只写在文档（[development-run.md](../../operations/development-run.md)、[testing-strategy.md](../../development/testing-strategy.md)）里，不读文档的用户必然踩到。

约束：错误码集合被 [coding-conventions.md](../../development/coding-conventions.md) 冻结为 6 个（`PROXY_CONFLICT` / `CA_MISSING` / `NOT_LOGGED_IN` / `SESSION_EXPIRED` / `BRIDGE_CRASH` / `ALLOWLIST_EMPTY`），新增错误码属公共接口变化；开桥路径上的检查必须**零误报**（拒绝一个本来可用的环境是不可接受的）；检测不能引入平台相关实现（Windows 真机项 `KI-001` 尚不可验证）。

## Decision

`startBridge` 在**系统代理冲突检查之后、端口探测之前**增加一条 fake-ip 预检，命中即拒绝启动：

- 解析对象 = 当前配置的网关主机（`settings.webvpnBase`，默认 `https://webvpn.swufe.edu.cn`）——它就是桥经 WRD 改写后实际连往的上游；
- 判据 = 解析出的任一 IPv4 地址落在 `198.18.0.0/15`（`apps/desktop/src/main/fake-ip.ts` 的 `isFakeIpAddress`，纯函数）；
- 命中时返回**既有错误码** `PROXY_CONFLICT`，不新增错误码；用户可见文案同时覆盖两种成因（系统代理被占用 / 存在 TUN 模式）并给出可执行动作（关闭 Clash / mihomo / 其它 VPN 的**系统代理与 TUN 模式**），界面沿用既有冲突模态；
- 解析失败或超时按「不阻断」处理（fail open）：DNS 抖动不得阻塞本可成功的开桥；
- 判据为「已是 fake-ip」这种**确定性状态**，不做全量 DNS 探测、不检查默认路由或虚拟网卡接口、不缓存结果；
- 仅在 `startBridge` 生效；切换捕获方式（`selected-apps`）不做该预检，因为它不建立上游连接；
- 本 ADR **不取代** [ADR-0004](ADR-0004-refuse-start-when-system-proxy-in-use.md)：系统代理的冲突判据、错误码与「只清除本 App 设置过的代理」语义保持不变，两条判据在同一开桥路径上并列生效；
- 生效时间：`2026-09-21` 起；执行责任人：cherrchen。

## Alternatives

| 备选方案 | 优点 | 缺点 | 未采纳原因 |
| -------- | ---- | ---- | ---------- |
| 什么都不做（只保留文档里的前置条件） | 实现成本为零 | 用户遇到的是静默挂起，桥状态仍为 `running`，没有可读信号；与 ADR-0004 的原则不一致 | 实测挂起发生在关键路径上，必须留下可读、可执行的失败信号 |
| 新增独立错误码（如 `TUN_INTERFERENCE`） | 归因更精确，文案可完全分开 | 错误码集合被 coding-conventions 冻结；新增属公共接口变化，UI/文档/测试需一并扩展 | 语义与「环境冲突」同族，复用既有错误码与模态即可满足用户动作需求 |
| 检测默认路由 / 虚拟网卡接口 | 覆盖面更广（redir-host 模式的 TUN 也能发现） | 平台相关且误报面大（企业 VPN、其它正常隧道接口会被拒）；Windows 侧需另一套实现且当前无法真机验证 | 零误报优先：fake-ip 段是「已被实测确认会导致挂起」的充分信号 |
| 检测到 fake-ip 后仅告警、不阻断 | 不改变任何现有可用路径 | 告警时桥已经必然挂起，用户仍需自行回退；需要新增告警通道与状态字段 | 与 ADR-0004 的「拒绝而不是半工作」不一致，且没有把用户从挂起里救出来 |

## Consequences

### Positive

- 用户得到的是「拒绝 + 可执行动作」，而不是开桥后的静默挂起；
- 无新增错误码、无新增 UI 通道：复用 ADR-0004 的冲突模态与文案位；
- 误报几乎不可能：`198.18.0.0/15` 是保留段，正常站点解析不会落在其中；
- 判据与平台无关，Windows 侧无需另一套实现（`KI-001` 延期不影响本决策落地）。

### Negative

- 只覆盖 fake-ip 形态：`redir-host` 模式的 TUN 仍可能挂起，继续依赖文档前置条件（已在 `KI-013` 的残留说明中写明）；
- 每次开桥多一次网关主机的 DNS 解析（毫秒级，失败即跳过），且不缓存；
- `webvpnBase` 被改成非默认值时同样按该地址判断（解析目标即实际上游，语义仍成立）。

### Risks

| 风险 | 可能性 | 影响 | 缓解措施 |
| ---- | ------ | ---- | -------- |
| DNS 返回 `198.18.0.0/15` 但不是 TUN 干扰（理论上只有 fake-ip 工具会这样做） | 极低 | 用户被拒绝开桥 | 冲突文案直接给出关闭 TUN / fake-ip 的动作用户可自行恢复；解析失败时 fail open |
| 用户环境中 TUN 使用非默认 fake-ip 段 | 低 | 仍会挂起（漏检） | 文档前置条件保留；`KI-013` 记录该残留并保留后续扩展空间 |
| 把「网关主机解析失败」误当成「可以开桥」 | 低 | 开桥后在运行期暴露上游问题 | 解析失败只跳过预检，不改变桥自身的错误/日志路径（`BRIDGE_CRASH` 仍覆盖上游不可达的显式失败） |

## References

- 相关需求：REQ-004（开桥前环境冲突检测）、NFR-004
- 相关 Spec：[specs/001-phase1-local-bridge/spec.md](../../../specs/001-phase1-local-bridge/spec.md)、`KI-013`
- 相关 ADR：[ADR-0004](ADR-0004-refuse-start-when-system-proxy-in-use.md)
- 相关实现：[fake-ip.ts](../../../apps/desktop/src/main/fake-ip.ts)、`ProxyOrchestrator.runStart()`
