# Roadmap

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-20

**用途**：给出长期方向的分阶段视图，以及 Spec 索引。
**不写**：需求定义、技术方案、任务拆解。

---

## 阶段划分

| 阶段 | 目标摘要 | 关联 Goal | 时间段 | 状态 |
| ---- | -------- | --------- | ------ | ---- |
| [M0 预研](milestones/M0-pre-research.md) | WRD codec 验证、Phase 1 需求规格与文档包 | G-001 / G-002 / G-003 | TBD | Done |
| [M1 桥核心](milestones/M1-mitm-bridge.md) | mitm WRD addon（请求改写）、Cookie 注入、响应反向改写、单测/集成测 | G-001 | TBD | Planned |
| [M2 桌面编排](milestones/M2-desktop-orchestration.md) | Electron 壳、系统代理、CA、代理冲突检测、过期停桥 | G-001 / G-002 / G-003 | TBD | Planned |
| [M3 体验打磨](milestones/M3-experience-polish.md) | Allowlist UI、调试日志、进程捕获、文案 | G-002 / G-003 | TBD | Planned |
| [M4 验收](milestones/M4-acceptance.md) | macOS + Windows 教务浏览器验收、缺陷收敛 | G-001 / G-002 / G-003 | TBD | Planned |
| M5 开源准备（可选） | 开源清理、README、后续 TUN 设计备忘 | G-004 | TBD | Candidate |

> 时间段一律为 `TBD`：原包未定义日历时间（原包只给出里程碑顺序与依赖，未给日期）。里程碑的完成定义与退出条件见 [milestones/](milestones/README.md)；M5 只保留候选行，尚未建立里程碑文件。

## Spec 索引

每个 Feature Spec 在此登记一行；详细内容在 `specs/<id>-<name>/`。

| Spec | 标题 | 关联 REQ | 阶段 | Status | 链接 |
| ---- | ---- | -------- | ---- | ------ | ---- |
| 001-phase1-local-bridge | Phase 1 本机桥与教务浏览器验收 | REQ-001..REQ-011、NFR-001..NFR-007 | M1–M4 | Draft | [spec.md](../../specs/001-phase1-local-bridge/spec.md) |

> Phase 1 归属一个 Spec；建立后续 Spec 时按 [specs/README.md](../../specs/README.md) 再补一行。REQ/NFR 的规范定义在 [requirements/](../requirements/README.md)，本表只引用 ID。

## 排序原则

```text
1. 先保教务验收主路径：codec 固化 → Addon 请求改写 → 响应反向改写 → Electron 编排（登录 / 代理 / CA）→ 真机验收
2. 正确性与可逆性优先于功能数量（响应反向改写、CA 卸载、关闭后清系统代理属于主路径）
```

## 依赖与阻塞

| 项 | 依赖 | 阻塞原因 | 解除条件 |
| -- | ---- | -------- | -------- |
| M1 | M0 | 桥核心依赖已验证的 codec 结论与冻结的需求规格 | M0 已完成（codec 向量与需求规格就绪） |
| M2 | M1 | 桌面编排需要一个可用的桥与桥控制协议 | M1 退出条件满足（curl 经本地桥访问 allowlist 主机成功） |
| M3 | M2 | Allowlist UI / 调试日志 / 进程捕获建立在可开桥的 Electron 壳上 | M2 退出条件满足（登录、开桥、系统代理、CA 均可用） |
| M4 | M3 + macOS、Windows 各一台测试机 + 测试者自有西财测试账号 | 双平台 P0 用例与教务浏览器验收需要真机、真实 WebVPN 与账号 | 测试环境与账号就绪，且 M3 退出条件满足 |
| 外部阻塞 | 学校 WebVPN / 门户或 Cookie 策略变更 | URL 形态、Cookie 字段或登录流程由校方实现决定，变更会使改写或会话失效 | 集中式会话探测 + 快速补丁与重登流程（风险 R2） |
| 外部阻塞 | 默认密钥轮换 | WRD 默认 `key`/`iv` 变化会使 URL 改写与解码失败 | `wrdKey` / `wrdIv` 配置覆盖与热更新（见 [ADR-0005](../architecture/adr/ADR-0005-builtin-wrd-key-with-override.md)，风险 R6） |

## 明确不做（本期）

> 非目标由 [goals-and-non-goals.md](../overview/goals-and-non-goals.md) 定义，本表只引用 NG ID 并给出与排期相关的理由。

| 项 | 原因 | 关联非目标 |
| -- | ---- | ---------- |
| SSH / 数据库 / SMB / 任意 TCP·UDP | 第一期只覆盖命中 allowlist 的 HTTP/HTTPS 流量改写，不做任意 TCP/UDP 转发 | NG-001 |
| 替代学校 SSLVPN 或 TUN 级真 VPN | 第一期不上 TUN；TUN/分流内核属后续阶段候选（PR-005 Won't now） | NG-002 |
| 与 Clash / mihomo / sing-box 链式共存 | 与其它系统代理叠加难以测试，改为检测到系统代理被占用即拒绝启动（见 [ADR-0004](../architecture/adr/ADR-0004-refuse-start-when-system-proxy-in-use.md)） | NG-003 |
| PAC | 无 PAC 需求；分流由本桥的 allowlist 匹配决定 | NG-004 |
| 存储密码 / 自动填密码绕过 MFA | 安全约束：不存密码，CAS/MFA 由用户在登录 WebView 内完成 | NG-005 |
| 班级批量分发 / 应用商店上架 | 私用优先，第一期不做分发渠道 | NG-006 |
| Linux | 第一期只支持 macOS 与 Windows | NG-007 |
| 保证所有证书钉扎（pinning）应用可用 | MITM 不覆盖 pinning 客户端；只在文档中声明该边界 | NG-008 |

## 维护规则

- 阶段变化时更新本文件，并保持与 [goals-and-non-goals.md](../overview/goals-and-non-goals.md) 不冲突；
- Roadmap 不复制需求或设计内容，只做引用；
- 里程碑的退出条件写在 [milestones/](milestones/README.md)。
