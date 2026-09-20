# M1: 桥核心（Bridge Core）

> Status: Planned
> Owner: cherrchen
> Target: TBD（原包未定义日期）

## 目标

让桥在没有桌面壳的情况下先跑通，保证改写逻辑正确且可回归：

- mitm 工程骨架 + 薄 WRD addon：对命中 allowlist 的请求生成 WebVPN URL、改上游为 `webvpn.swufe.edu.cn`、附加 WebVPN Cookie（REQ-006）；
- 响应反向改写必做：`Location`、`Set-Cookie` 的 Domain/Path、HTML/JS/JSON 中的校内绝对 URL（REQ-007）；
- 只改写 allowlist 主机，其余直连；登录相关主机不做二次包装（REQ-005、REQ-008）；
- L0/L1 自动化测试可稳定重跑。

## 包含的 Specs

| Spec | 状态 | 依赖 |
| ---- | ---- | ---- |
| [001-phase1-local-bridge](../../../specs/001-phase1-local-bridge/spec.md) | Draft | M0（已完成） |

## 退出条件

- [ ] `curl` 经本地桥 + 真实或模拟 WebVPN 访问 allowlist 主机成功（TC-F01，P0）
- [ ] 非 allowlist 主机不改写、按直连语义处理（TC-F02，P0）
- [ ] L0 通过：codec 向量（TC-A01..TC-A05）与 allowlist 匹配函数（TC-B01..TC-B04）
- [ ] L1 通过：addon 对录制流量 / 假上游的请求改写与响应反向改写（含 `Location` 反向改写 TC-F03）
- [ ] 响应改写优先级落地：`Location` → `Set-Cookie` Domain/Path → HTML/JS/JSON 绝对 URL → 其它内容类型不改写（REQ-007）
- [ ] 防环成立：`webvpn.swufe.edu.cn` / `authserver.swufe.edu.cn` 与已是 WebVPN 形态的请求直通（REQ-008）
- [ ] 相关文档已同步（含双语配对）；无阻塞类缺陷

## 风险

| 风险 | 影响 | 应对 |
| ---- | ---- | ---- |
| R1 教务前端大量动态绝对 URL（中/高） | 响应改写漏改时浏览器跳飞到不可达地址，G-001 不成立 | 响应改写分层（先保导航路径）；必要时降级为「书签式 WebVPN URL」辅助 |
| R2 Cookie 字段变更（中/高） | 会话注入失效，改写请求被判未登录 | 会话探测与 Cookie 读取集中在 Session Broker 一处，便于快速补丁与重登 |
| R6 默认密钥轮换（低/中） | 改写与解码失败 | `wrdKey`/`wrdIv` 配置可覆盖并支持热更新（见 [ADR-0005](../../architecture/adr/ADR-0005-builtin-wrd-key-with-override.md)） |

## 完成记录

尚未开始；完成后在此记录完成时间、证据（命令与结果摘要）与遗留问题。
