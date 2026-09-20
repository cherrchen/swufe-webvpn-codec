# ADR-0001: 不在 sing-box / mihomo 内核内实现 WRD 改写

## Status

`Accepted`

## Date

`2026-09-20`

## Decision Owners

`cherrchen`

## Context

本机桥要把 allowlist 内主机（默认必含 `jwxt.swufe.edu.cn`）的普通 HTTP/HTTPS 请求改写成网瑞达 WebVPN 的 URL 形态——`https://webvpn.swufe.edu.cn/{http|https}[-{port}]/{iv_hex}{ct_hex}{path}?{query}`，其中仅 hostname 加密、path/query 明文——并附加 WebVPN 会话 Cookie；响应还需按优先级反向改写（REQ-006、REQ-007）。

WebVPN 是**应用层反向代理**，不是 SSLVPN/TUN。改写必须发生在能完整读写 HTTP 语义（方法、URL、头部、正文）的位置。sing-box / mihomo 这类内核工作在 TUN 或透明代理层，只能看到 CONNECT 的目标主机与端口，拿不到可改写的 HTTP 语义。

约束：Phase 1 的验收硬依赖本机浏览器能打开并操作教务（G-001）；NFR-001 要求不自研代理内核 / TLS / PKI；NFR-006 明确 TUN / 透明网关不阻塞第一期验收，属于后续阶段能力（PR-005）。因此现在必须定下改写所在的层级，否则桥核心与后续分流能力会互相绑死。

## Decision

将 WRD 的请求改写与响应反向改写统一实现于 mitm 层（mitmproxy 的 Regular proxy / local capture + 薄 WRD addon），**不在任何 TUN / 分流内核内部实现该改写**。

- 禁止把 WRD 语义写进 sing-box、mihomo 或同等内核的配置、插件或规则；
- 后续阶段引入 sing-box 时，其职责仅限 TUN 接管与本机分流，把命中的流量转发到本地桥端口（`127.0.0.1:<bridge_port>`），内核不感知 WebVPN 语义；
- 适用范围：本机桥的全部流量改写路径，自 Phase 1 起生效；
- 如需在其它层实现改写，必须新建 ADR 取代本条目；
- 执行责任人：cherrchen。

## Alternatives

| 备选方案 | 优点 | 缺点 | 未采纳原因 |
| -------- | ---- | ---- | ---------- |
| 什么都不做（不实现本机改写，用户继续手工拼 WebVPN URL） | 零开发成本；无新增风险面 | 无法满足 G-001「浏览器直接打开并操作教务」，PR-001..PR-003 全部落空 | 需求不满足，Phase 1 无交付价值 |
| 在 sing-box / mihomo 内核内直接实现 WRD 改写 | 无需额外 MITM 组件；分流与改写单进程 | 内核只见到 CONNECT 目标主机，无法把 HTTP 语义改写成 WebVPN 路径；改内核或写插件会把方案绑死在内核版本与插件 API 上 | 技术上不可行 |
| TUN + 用户态 HTTP 改写库（内核只做分流，改写交给用户态库） | 内核与改写解耦；可复用成熟 HTTP 库 | 需额外集成/自研用户态改写与 TLS 处理，复杂度显著上升，与 NFR-001 相悖 | 复杂度高，推迟到后续阶段（PR-005） |

## Consequences

### Positive

- 改写逻辑位于能读取完整 HTTP 语义的层，REQ-006 与 REQ-007 可在同一个 addon 内闭环；
- 分流与改写解耦：后续引入 TUN 分流时无需改动改写实现；
- 与 NFR-001 一致，代理内核不进入自研范围。

### Negative

- Phase 1 依赖 MITM CA：HTTPS 改写要求在本机信任 CA 并解密流量（REQ-010、NFR-005）；
- 不启用 TUN 时，非 HTTP(S) 流量以及不遵循系统代理的进程不在第一期覆盖范围内（REQ-011 / NG 列表）。

### Risks

| 风险 | 可能性 | 影响 | 缓解措施 |
| ---- | ------ | ---- | -------- |
| 用户拒绝安装本机 CA 或卸载后忘记重装 | 高 | 中 | 按 NFR-005 在安装时展示风险提示；以 `CA_MISSING` 错误码给出可操作提示；提供一键安装 / 卸载（REQ-010） |
| 后续引入 sing-box TUN 时与 mitm 层衔接复杂 | 中 | 中 | 第一期不上 TUN，先把桥与改写稳定；TUN 设计在后续阶段（PR-005）单独评审 |

## References

- 相关需求：REQ-006、REQ-007、REQ-010、NFR-001、NFR-006
- 相关 Spec：[specs/001-phase1-local-bridge/spec.md](../../../specs/001-phase1-local-bridge/spec.md)
- 相关 ADR：[ADR-0002](ADR-0002-reuse-mitmproxy-for-tls.md)（复用 mitmproxy 提供 MITM 能力，与本决策共同构成改写层的前提）
- 来源（归档原包，仅作历史出处）：[04-architecture-and-tech-selection.md §2 ADR-1](../../archive/2026-09-20-swufe-webvpn-bridge-docs-v1.0/01-requirements/04-architecture-and-tech-selection.md)
