# ADR-0013: iOS 插件用共享 JS Core，AES-CFB128 以 aes-js 为块加密

## Status

`Accepted`

## Date

`2026-09-24`

## Decision Owners

`cherrchen`

## Context

Spec 003 需要在 Stash / Loon 脚本里复用 desktop 的 WRD URL 语义。Python 权威实现是 AES-128-CFB、segment 128 bit，token 为 `iv_hex + ciphertext_hex`。Web Crypto 与 Loon 公开 AES API 都没有 CFB。CryptoJS 已停止维护。`aes-js` 3.1.2 为 MIT、无 Node 依赖，但其自带 CFB 默认 segment 不是 128 bit。

## Decision

1. 移动端业务逻辑放在 `packages/webvpn-core-js`。该包不访问宿主全局，也不依赖 `node:crypto`。
2. 块加密固定使用 `aes-js@3.1.2`。CFB128 反馈由 Core 自己实现，并用 Python 共享向量约束，第一道门是实机 host token。
3. Desktop Python codec 保持不变。Loon 与 Stash 只写 Adapter。
4. 本决策自 2026-09-24 起生效；执行责任人 cherrchen。

## Alternatives

| 备选方案 | 优点 | 缺点 | 未采纳原因 |
| -------- | ---- | ---- | ---------- |
| 什么都不做，各宿主复制 Python | 无新依赖 | 两套协议实现会漂移 | 违反共享 Core |
| 直接使用 aes-js 的 CFB 模式 | 代码更少 | 默认 segment 与 Python CFB128 不一致 | 向量对不上 |
| CryptoJS | 现成 CFB | 上游已停止维护 | Spec 已排除 |

## Consequences

### Positive

- 两个宿主共用同一套编码、路由、会话与改写。
- 协议差异能被共享向量抓住。

### Negative

- 新增一个需随 bundle 审查的纯 JS 依赖。
- Core 必须自己维护 CFB128，而不能把模式交给库。

### Risks

| 风险 | 可能性 | 影响 | 缓解措施 |
| ---- | ------ | ---- | -------- |
| aes-js 停止更新 | 中 | 中 | 版本钉死；块加密可替换，向量仍在 |
| 宿主脚本体积变大 | 中 | 低 | bundle 扫描；M4 再做体积审查 |

## References

- 相关需求：IOS-REQ-005 / IOS-NFR-001 / IOS-REQ-011
- 相关 Spec：`specs/003-ios-proxy-client-plugins/`
- 相关 ADR：ADR-0005
- 外部资料：`https://github.com/ricmoo/aes-js`
