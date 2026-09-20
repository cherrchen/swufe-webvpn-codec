# ADR-0005: WRD 默认密钥内置并保留配置覆盖

## Status

`Accepted`

## Date

`2026-09-20`

## Decision Owners

`cherrchen`

## Context

WRD URL 形态用 AES-128-CFB（`segment_size=128`）加密 hostname，`https://webvpn.swufe.edu.cn/{http|https}[-{port}]/{iv_hex}{ct_hex}{path}?{query}`，其中 iv 与密文以十六进制拼接、path/query 保持明文。加解密需要 key 与 iv。实机地址栏 URL 已验证该校部署的默认值为 `key = iv = wrdvpnisthebest!`；门户若轮换密钥，硬编码的分发方式将导致全部改写失效（R6）。

约束：NFR-002 要求 codec 与已验证原型 `wrd_codec.py` 的向量一致（含 authserver / jwxt 样本）；G-002 要求从「已登录」到「浏览器打开教务」≤3 次点击，任何要求用户先查密钥的手工配置都会破坏该体验；WRD codec 库 API（`encryptHost` / `decryptHost` / `encodeUrl` / `decodeUrl`）本身接受可选 key/iv 参数。因此需要现在就定下默认值与覆盖机制。

## Decision

把默认 `wrdKey` 与 `wrdIv` 内置为 `wrdvpnisthebest!`，**同时在 `AppSettings` 中保留配置覆盖点**，使门户轮换密钥时可热更新而不必发新版。

- 内置默认值：`AppSettings.wrdKey = wrdIv = "wrdvpnisthebest!"`；
- 覆盖：用户 / 维护者可通过配置修改 `wrdKey`、`wrdIv`，WrdCodec 的 `encryptHost(host, key?, iv?)`、`decryptHost(token, key?, iv?)`、`encodeUrl(ordinaryUrl, webvpnHost?)` 在使用时接受显式 key/iv，缺省回落到内置值；
- 禁止在运行时向 portal 抓取密钥（第一期不做，见备选）；
- 密钥不是用户机密：不因该值引入额外的日志或落盘限制，但调试日志仍不得记录 Cookie 与正文（NFR-003）；
- 自 Phase 1 起生效；执行责任人：cherrchen。

## Alternatives

| 备选方案 | 优点 | 缺点 | 未采纳原因 |
| -------- | ---- | ---- | ---------- |
| 什么都不做（既不内置默认值，也不提供覆盖点） | 无额外实现 | codec 没有可用密钥，`encodeUrl` 无法工作，G-001 不成立 | 需求不满足 |
| 运行时从 portal 抓取密钥 | 理论上自动跟随轮换 | 需要额外的抓取与解析路径（页面结构变化即失效），增加未验证的运行时依赖，且无实机证据支持该接口 | 第一期不做，复杂度与不确定性不划算 |
| 强制用户手填 key / iv | 无需内置任何常量 | 用户需自行从浏览器开发者工具定位密钥，破坏 G-002 的点击预算，且多数用户无法完成 | 体验差，直接违反 G-002 意图 |

## Consequences

### Positive

- 开箱可用：默认值与实机已验证一致，教务改写路径无需任何配置即可工作（G-001、NFR-002）；
- 轮换可恢复：门户更换密钥时，改配置即可继续工作，无需等待新版本发布（R6）；
- codec 与 mitm addon 同进程共享缺省值来源，避免两处常量漂移。

### Negative

- 默认值随版本固化，配置未更新时若门户轮换会直接导致改写失败（表现为 `SESSION_EXPIRED` 之外的改写错误，需靠日志定位）；
- 明文默认密钥出现在仓库与打包产物中，属于已知且可接受的公开常量。

### Risks

| 风险 | 可能性 | 影响 | 缓解措施 |
| ---- | ------ | ---- | -------- |
| 默认密钥轮换导致改写全部失效（R6） | 低 | 中 | 保留 `wrdKey` / `wrdIv` 覆盖点；调试日志暴露改写失败的主机名，便于快速定位并改配置 |
| codec 与配置默认值不一致（例如仅改其中一处） | 低 | 中 | 默认值单一来源，配置缺省即回落内置值；以 L0 codec 向量测试锁定行为（NFR-002） |

## References

- 相关需求：REQ-006、NFR-002、NFR-003
- 相关 Spec：[specs/001-phase1-local-bridge/spec.md](../../../specs/001-phase1-local-bridge/spec.md)
- 相关 ADR：[ADR-0001](ADR-0001-wrd-rewrite-in-mitm-layer.md)（改写层承载 codec 调用）、[ADR-0002](ADR-0002-reuse-mitmproxy-for-tls.md)（codec 与 mitm 同进程 Python）
- 来源（归档原包，仅作历史出处）：[04-architecture-and-tech-selection.md §2 ADR-5](../../archive/2026-09-20-swufe-webvpn-bridge-docs-v1.0/01-requirements/04-architecture-and-tech-selection.md)
