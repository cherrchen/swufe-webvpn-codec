# 非功能需求

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-20

**用途**：定义质量属性与约束。非功能需求同样需要可验证的判据，否则只是口号。
**不写**：具体实现手段（例如「使用 Redis」属于设计，应写入 Spec 或 ADR）。

---

## 模板

```markdown
### NFR-001 <名称>

- Category: performance | reliability | security | usability | maintainability | portability | observability | compliance
- Status: Proposed
- Priority: Must

**要求**
……

**验证方式**
……（测量方法、阈值、运行环境）

**不达标时的后果**
……
```

## 清单

| ID | 类别 | 要求摘要 | 验证方式 | Status |
| -- | ---- | -------- | -------- | ------ |
| NFR-001 | maintainability | 不自研代理内核/TLS/PKI，TLS/HTTP2/证书签发交给成熟栈 | 代码与依赖审查：确认无自研 PKI/代理内核 | Accepted |
| NFR-002 | reliability | WRD codec 与已验证原型 `wrd_codec.py` 向量一致 | TC-A01..TC-A05 向量 | Accepted |
| NFR-003 | security | 不存密码；Cookie 存用户目录且权限收紧；日志默认关且不含正文/Cookie；CA 私钥仅本机 | 文件与权限检查 + TC-D01 + TC-F04 | Accepted |
| NFR-004 | security | 关闭、过期或退出后不留「半开」系统代理（仅清本 App 设置过的代理） | TC-C03 / TC-C04 / TC-D03 | Accepted |
| NFR-005 | usability | 安装 CA 时必须展示风险提示（HTTPS 会被解密、仅限个人设备、可随时卸载） | TC-E01 + UI 文案检查 | Accepted |
| NFR-006 | portability | 第一期 macOS + Windows；TUN/透明网关不阻塞第一期验收 | 双平台构建与启动（测试计划 §7） | Accepted |
| NFR-007 | usability | 界面与文案中文优先；开源时补英文 README 可后置 | UI 文案检查 | Accepted |

### NFR-001 不自研代理内核与 TLS/PKI

- Category: maintainability
- Status: Accepted
- Priority: Must
- Related: [ADR-0002](../architecture/adr/ADR-0002-reuse-mitmproxy-for-tls.md) / [REQ-003](functional-requirements.md)

**要求**
不实现完整的代理内核、TLS 栈与 PKI；TLS/HTTP2 处理与证书签发优先交给 mitmproxy 或同等成熟栈。

**验证方式**
代码与依赖审查：确认证书签发、TLS 终止、HTTP/2 处理均来自 mitmproxy（或同等成熟栈），仓库内不存在自研 PKI 与自研代理内核实现。

**不达标时的后果**
需自行承担 MITM PKI 与协议的长期安全维护成本，出现协议兼容与漏洞响应风险，并直接违反 ADR-0002。

### NFR-002 WRD codec 向量一致

- Category: reliability
- Status: Accepted
- Priority: Must
- Related: [ADR-0005](../architecture/adr/ADR-0005-builtin-wrd-key-with-override.md) / [REQ-006](functional-requirements.md)

**要求**
WRD codec 实现必须与已验证原型 `wrd_codec.py` 的向量一致，至少覆盖 authserver 与 jwxt 样本。

**验证方式**
在 CI 中运行 L0 单元向量 TC-A01..TC-A05，对样本 URL 断言加解密结果与原型一致（TC-A01 authserver 解密、TC-A02 authserver 重加密一致、TC-A03 jwxt 编码稳定、TC-A04 带端口 `http-8080`、TC-A05 错误 key 行为）。

**不达标时的后果**
改写后的 WebVPN URL 与网瑞达服务端约定不符，教务页面无法打开，第一期验收直接失败。

### NFR-003 凭据与日志最小化

- Category: security
- Status: Accepted
- Priority: Must
- Related: G-003 / [REQ-002](functional-requirements.md) / [REQ-009](functional-requirements.md) / [REQ-010](functional-requirements.md)

**要求**
不存储密码；会话 Cookie 存放在用户目录且权限收紧；调试日志默认关闭且不含响应正文、请求体与 Cookie；CA 私钥仅存本机、不上传。

**验证方式**
检查用户目录中不存在密码文件（TC-D01）；检查会话文件与 CA 私钥的文件权限被收紧；开启调试日志产生流量后，检查记录仅含 `ts/host/rewritten/direction/detail` 且无正文与 Cookie（TC-F04）。

**不达标时的后果**
出现凭据泄露面，违反安全目标 G-003；一旦明文落盘或进入日志，用户需自行轮换凭据。

### NFR-004 不留「半开」系统代理

- Category: security
- Status: Accepted
- Priority: Must
- Related: G-003 / [REQ-002](functional-requirements.md) / [REQ-003](functional-requirements.md)

**要求**
关闭桥接、会话过期或退出应用后，不得留下「半开」的系统代理；清除操作仅针对本 App 设置并标记过的代理设置。

**验证方式**
TC-C03（运行中关桥后系统代理恢复为未由 App 占用）、TC-C04（桥运行中退出 App 结果同 TC-C03）、TC-D03（会话过期自动停桥并清代理）；且验证当系统代理并非本 App 设置时不被本 App 清除。

**不达标时的后果**
用户网络在 App 关闭后仍被劫持到已停止的本地端口，表现为「全部网站打不开」，且用户难以自行定位。

### NFR-005 CA 安装风险提示

- Category: usability
- Status: Accepted
- Priority: Must
- Related: G-003 / [REQ-010](functional-requirements.md)

**要求**
安装 CA 时必须展示风险提示：本机 HTTPS 会被解密并改写、仅限个人设备使用、可随时卸载。

**验证方式**
TC-E01 安装流程中检查提示是否在安装前出现；UI 文案检查确认包含上述三项要素（解密范围、仅限个人设备、可随时卸载）。

**不达标时的后果**
用户在不知情下信任本机 MITM CA，构成知情同意缺失，也违反安全目标 G-003 的「危险操作可逆」前提。

### NFR-006 平台范围

- Category: portability
- Status: Accepted
- Priority: Must
- Related: [ADR-0003](../architecture/adr/ADR-0003-electron-gui-for-phase-1.md) / [REQ-011](functional-requirements.md)

**要求**
第一期支持 macOS 与 Windows；TUN/透明网关不属于第一期（见 [非目标](../overview/goals-and-non-goals.md)），且不阻塞第一期验收。

**验证方式**
在 macOS 与 Windows 各一台测试机上构建并启动 Electron 开发版与 mitm sidecar（测试计划 §7 环境），确认主路径可执行；TUN 相关项不作为验收入口。

**不达标时的后果**
验收范围蔓延到 TUN/内核态接管，第一期延期；或某一桌面平台无法启动，导致教务浏览器验收无法满足「至少一侧通过」。

### NFR-007 中文优先的界面与文案

- Category: usability
- Status: Accepted
- Priority: Should
- Related: G-004 / [REQ-001](functional-requirements.md)

**要求**
界面与文案中文优先；开源时补充英文 README 可后置。

**验证方式**
UI 文案检查：主窗口、状态条、错误提示（CA 风险提示、代理冲突提示、会话过期提示）均为中文且表述与设计一致。

**不达标时的后果**
目标用户（西财师生）理解成本上升，错误提示不可执行；不阻塞第一期功能验收，但计入体验债。

## 各类别提示

| 类别 | 需要明确的内容 |
| ---- | -------------- |
| performance | 延迟、吞吐、并发、数据规模、测量环境 |
| reliability | 可用性目标、故障恢复、幂等性、数据一致性 |
| security | 信任边界、认证、授权、输入校验、密钥管理（→ [security/](../security/README.md)） |
| usability | 可学习性、错误提示、可访问性 |
| maintainability | 模块化、可测试性、文档义务 |
| portability | 支持平台、运行时版本、依赖约束（→ [dependency-policy.md](../development/dependency-policy.md)） |
| observability | 日志、指标、追踪要求 |
| compliance | 法规、许可证、数据保留 |

## 与 ADR 的关系

若某条非功能需求导致难以逆转的技术选择，应额外建立 ADR，并在本条目的 `Related` 中引用。
本期适用：NFR-001 → [ADR-0002](../architecture/adr/ADR-0002-reuse-mitmproxy-for-tls.md)；NFR-002 → [ADR-0005](../architecture/adr/ADR-0005-builtin-wrd-key-with-override.md)；NFR-006 → [ADR-0003](../architecture/adr/ADR-0003-electron-gui-for-phase-1.md)。
