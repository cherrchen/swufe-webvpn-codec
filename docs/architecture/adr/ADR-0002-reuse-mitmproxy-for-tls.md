# ADR-0002: 复用 mitmproxy 而非自研 TLS / MITM 栈

## Status

`Accepted`

## Date

`2026-09-20`

## Decision Owners

`cherrchen`

## Context

要把 HTTP/HTTPS 请求改写成 WebVPN 形态并反向改写响应，本机桥必须做 HTTPS 中间人：为每个目标主机动态签发证书、终止 TLS、处理 HTTP/2 与连接复用，并在客户端信任本机 CA 后解密流量（REQ-006、REQ-007、REQ-010）。这套 PKI 与 TLS 栈自研成本高、出错即成为安全漏洞（证书校验、算法协商、协议降级、密钥存储），早期原型（rwppa 类）已显示该路线的负担。

约束：NFR-001 明确不自研代理内核 / TLS / PKI，TLS、HTTP2、证书签发优先交给 mitmproxy 或同等成熟栈；REQ-010 建议复用 mitmproxy CA 机制，CA 私钥仅本机（NFR-003）；REQ-003 要求同时支持「系统代理指向本地桥端口」与「mitmproxy local（或等价）按进程捕获」。因此必须现在就选定 MITM 运行时，因为它决定后续打包与部署形态。

## Decision

复用 mitmproxy 作为本机桥的 MITM 与代理运行时（Regular proxy + local capture + 薄 WRD addon），**不自研 TLS 终止、HTTP/2 处理与证书签发栈**。

- 证书签发、CA 生命周期与 confdir 使用 mitmproxy 的既有机制：CA 存放于 mitmproxy 专用 confdir，私钥仅留在本机（REQ-010、NFR-003）；
- WRD 改写只以薄 addon 形式挂在 mitmproxy 之上，不修改 mitmproxy 本体；
- 代理内核、TLS、PKI 的采购式复用自 Phase 1 起生效，适用于 macOS 与 Windows 两侧；
- 如需替换 MITM 运行时（自研或换用其它栈），必须新建 ADR 取代本条目；
- 执行责任人：cherrchen。

## Alternatives

| 备选方案 | 优点 | 缺点 | 未采纳原因 |
| -------- | ---- | ---- | ---------- |
| 什么都不做（不实现 HTTPS 解密与改写） | 无 MITM 风险；无 CA 信任需求 | 教务等站点以 HTTPS 为主，无法完成 REQ-006 / REQ-007，G-001 不成立 | 无法完成 HTTPS 改写，需求不满足 |
| 自研 MITM / TLS 栈（如早期 rwppa 类实现） | 完全可控；无外部运行时依赖；打包体积小 | PKI 与 TLS 安全成本高，证书签发、协议细节、私钥保护都需自行保证，维护面长期存在 | 成本高且与 NFR-001 直接冲突 |
| 使用 Proxifier 等现成商业代理工具 | 无需自己处理 TLS；开箱可用 | 闭源、不可定制，无法嵌入 allowlist 改写、Cookie 注入与响应反向改写逻辑 | 不可定制，无法承载 WRD 语义 |

## Consequences

### Positive

- 直接获得经过验证的 TLS / HTTP2 与证书签发能力，安全边界由成熟项目承担（NFR-001）；
- 证书与 CA 生命周期沿用 mitmproxy 机制，REQ-010 的安装 / 卸载只需包装其 confdir（避免自研 PKI）；
- local capture 与 Regular proxy 两种接管方式同源，REQ-003 的两条路径不需要两套实现。

### Negative

- Python 运行时需随 App 分发（嵌入式解释器）或要求系统安装，打包体积与代码签名复杂度上升（R3）；
- 桥的核心能力受 mitmproxy 的 addon API 与版本行为约束，升级需回归验证；
- 调试与排障会同时涉及 TypeScript 侧与 Python sidecar 两侧。

### Risks

| 风险 | 可能性 | 影响 | 缓解措施 |
| ---- | ------ | ---- | -------- |
| mitm 嵌入体积与代码签名问题（R3） | 中 | 中 | 发布形态延后到实现阶段确定（嵌入式 Python 或分发 `mitmproxy` 可执行文件）；在打包阶段做一次体积与签名验证 |
| mitmproxy 版本升级改变 addon 行为导致改写回归 | 中 | 中 | 锁定依赖版本；以 L1/L2 分层测试（录制流量 + 假上游）覆盖 addon 行为 |
| CA 私钥落盘位置不当 | 低 | 高 | 使用 mitmproxy 专用 confdir 并收紧权限，私钥仅本机、不上传（NFR-003） |

## References

- 相关需求：REQ-003、REQ-006、REQ-007、REQ-010、NFR-001、NFR-003
- 相关 Spec：[specs/001-phase1-local-bridge/spec.md](../../../specs/001-phase1-local-bridge/spec.md)
- 相关 ADR：[ADR-0001](ADR-0001-wrd-rewrite-in-mitm-layer.md)（改写放在 mitm 层，本决策提供其 MITM 能力）
- 来源（归档原包，仅作历史出处）：[04-architecture-and-tech-selection.md §2 ADR-2、§3 技术选型对比](../../archive/2026-09-20-swufe-webvpn-bridge-docs-v1.0/01-requirements/04-architecture-and-tech-selection.md)
