# Verification: Phase 1 本机桥（001-phase1-local-bridge）

> Spec ID: 001
> Status: Draft
> Owner: cherrchen
> Last Updated: 2026-09-20

> 本文件建立 **Requirement → Verification** 映射，是「Feature 是否完成」的判定依据。
> 规则见 [verification-strategy.md](../../docs/verification/verification-strategy.md)。
> Feature **不因为「代码写完了」被视为完成**；状态必须推进到 `Verified`。

## 映射表

> 测试用例编号与分层沿用归档测试用例集（`docs/archive/2026-09-20-swufe-webvpn-bridge-docs-v1.0/02-testing/02-test-cases.md`）；层级定义见 [docs/development/testing-strategy.md](../../docs/development/testing-strategy.md)。实现未开始，状态全部 `Pending`。

| Requirement | Verification | Status |
| ----------- | ------------ | ------ |
| REQ-001 | TC-H01（L3 手工：状态条与状态机一致）；应用启动 smoke（TC-G01/TC-G03 前置，L3 手工） | Pending |
| REQ-002 | TC-D01、TC-D02、TC-D03（L1 组件 + L3 手工：登录成功、未登录拒绝开桥、过期停桥清代理弹窗） | Pending |
| REQ-003 | TC-C02、TC-C03、TC-C04（L1 组件 / L2 集成：设代理、关桥清代理、退出清代理）；TC-G04（L3 手工：进程捕获） | Pending |
| REQ-004 | TC-C01（L1 组件 / L2 集成：已有系统代理时拒绝启动，错误码 `PROXY_CONFLICT`） | Pending |
| REQ-005 | TC-B01..B05（L0 单元 + L1 组件：默认值、精确命中、非名单直连语义、通配、持久化）；TC-H02（L3 手工：通配勾选） | Pending |
| REQ-006 | TC-A01..A05（L0 单元：codec 向量）；TC-F01（L2 集成：curl 经代理访问 allowlist 主机） | Pending |
| REQ-007 | TC-F03（L1 组件：`Location` 反向改写）；TC-G02（L3 手工：教务页面内导航不跳飞） | Pending |
| REQ-008 | TC-D04（L2 集成 / L3 手工：登录 WebView 无代理环）；TC-F02（L2 集成：非 allowlist 直连不改写） | Pending |
| REQ-009 | TC-F04（L2 集成 + L3 手工：调试日志仅域名与改写结果）；TC-H01（L3 手工：状态可见） | Pending |
| REQ-010 | TC-E01、TC-E02、TC-E03（L3 手工，需管理员权限：安装 CA、卸载 CA、未装 CA 提示 `CA_MISSING`） | Pending |
| REQ-011 | TC-G01（L3 手工：macOS 教务验收）；TC-G03（L3 手工：Windows 教务验收） | Pending |
| NFR-001 | 代码审查（TLS/HTTP2/证书签发实现来自 mitmproxy，无自研 PKI）；TC-E01（L3 手工：CA 生成于 mitmproxy 专用 confdir） | Pending |
| NFR-002 | TC-A01..A05（L0 单元：与 `wrd_codec.py` 向量一致，含 authserver / jwxt 样本） | Pending |
| NFR-003 | TC-D01（L1/L3：登录后无密码文件）＋ TC-F04（L2/L3：日志不含正文/Cookie）＋ 人工检查（L3：CA 私钥与会话文件权限仅本机用户可读、不上传） | Pending |
| NFR-004 | TC-C03、TC-C04（L1/L2：关桥与退出清代理）；TC-D03（L3 手工：过期清代理） | Pending |
| NFR-005 | TC-E01（L3 手工：安装 CA 前展示风险提示文案） | Pending |
| NFR-006 | TC-G01（macOS）、TC-G03（Windows）（L3 手工） | Pending |
| NFR-007 | TC-H01、TC-H02（L3 手工：界面文案为中文优先） | Pending |

Status 取值：`Pending` / `Passed` / `Failed` / `N/A`（`N/A` 必须写明理由）。

## 验收标准覆盖

| Acceptance Criteria | 对应验证项 | Status |
| ------------------- | ---------- | ------ |
| AC-001 | TC-G01 / TC-G03（L3 手工：双平台启动 Electron 应用） | Pending |
| AC-002 | TC-D01（L1/L3：登录后 `loggedIn=true`）+ TC-F04（日志检查无 Cookie/密码） | Pending |
| AC-003 | TC-C01（L1/L2：系统代理已占用时拒绝启动并提示） | Pending |
| AC-004 | TC-C02 / TC-C03 / TC-C04（L1/L2：开桥设代理、关桥清代理、退出清代理） | Pending |
| AC-005 | TC-E01 / TC-E02（L3 手工：CA 安装与卸载在系统信任库生效） | Pending |
| AC-006 | TC-B01 / TC-B02 / TC-B05（L0/L1）+ TC-H02（L3 手工：默认含 jwxt、可增删、可勾选通配） | Pending |
| AC-007 | TC-G01 / TC-G02 / TC-G03（L3 手工：教务可打开并操作） | Pending |
| AC-008 | TC-D03（L3 手工：过期停桥、清代理、弹窗重登） | Pending |
| AC-009 | TC-F04（L2 + L3：调试日志仅域名与改写结果） | Pending |
| AC-010 | TC-D04（L2/L3：登录 WebView 不经本桥） | Pending |

## 执行的命令与结果

| 命令 | 结果 | 时间 | 备注 |
| ---- | ---- | ---- | ---- |
| `—` | 未执行：实现未开始（2026-09-20） | 2026-09-20 | 仓库当前为文档仓库，无可运行实现；M1 起按 [tasks.md](tasks.md) 登记实际命令与输出 |

> 只记录**实际执行过**的命令；未执行时写明原因，不得写「应该没问题」。

## 手工验证步骤

L3 教务浏览器验收（TC-G01 / TC-G02 / TC-G03）。

```text
前置条件：
1. macOS 与 Windows 各一台测试机，浏览器为 Chrome/Edge；
2. 测试者自有西财账号可用（账号不写入仓库），设备为授权设备；
3. CA 已安装并被系统信任；App 内已完成官方 WebVPN/CAS（含 MFA）登录；
4. allowlist 默认含 jwxt.swufe.edu.cn（或已手动添加），桥开关为开启；
5. 系统代理未被其它软件占用（无 Clash / mihomo / sing-box 等）。
步骤：
1. 在浏览器地址栏输入 https://jwxt.swufe.edu.cn/ 打开教务首页；
2. 点击页面内主要菜单/链接，完成一次常规页面导航；
3. 重复步骤 1–2 于另一侧桌面 OS（TC-G03）；
4. 观察状态条与调试日志（调试日志开启时）中的域名与改写结果。
预期结果：
1. 教务首页可加载（TC-G01）；
2. 页面内导航不因绝对 URL 跳飞到不可达的公网直连地址，登录态保持（TC-G02）；
3. 两侧 OS 均通过（目标；至少一侧通过为出口准则下限）；
4. 状态条与实际状态一致；日志仅含域名与是否改写成功，无响应正文/Cookie。
实际结果：待执行
```

> 无手工验证时写 `不适用` 并说明理由。

## 边界与异常场景

| 场景 | 期望行为 | 实际结果 | Status |
| ---- | -------- | -------- | ------ |
| EC-001 | 通配开启时 apex `swufe.edu.cn` 命中并按 WebVPN 改写（TC-B04） | — | Pending |
| EC-002 | `http://host:8080/x` 生成 `http-8080` scheme token 且可 decode 回主机（TC-A04） | — | Pending |
| EC-003 | 非 allowlist 主机直连不改写，日志 `rewritten=false`（TC-B03、TC-F02） | — | Pending |
| EC-004 | 已是 WebVPN 形态的请求直通，不二次包装（TC-D04 相关检查） | — | Pending |
| EC-005 | 登录 WebView 访问 webvpn/authserver 主机不经本桥（TC-D04） | — | Pending |
| EC-006 | allowlist 为空时拒绝开桥并返回 `ALLOWLIST_EMPTY`，UI 提示添加主机 | — | Pending |
| EC-007 | Cookie 过期触发 `SESSION_EXPIRED`：停桥 → 清代理 → 停捕获 → 弹窗重登（TC-D03） | — | Pending |
| EC-008 | 系统代理已被占用时拒绝启动并提示 `PROXY_CONFLICT`（TC-C01） | — | Pending |

## 兼容性

| 维度 | 结论 | 依据 |
| ---- | ---- | ---- |
| 接口兼容 | 不适用（首次实现，无既有接口消费方） | 三个接口均为本 Spec 首次定义：[electron-ipc.md](../../docs/api/electron-ipc.md)、[bridge-control-protocol.md](../../docs/api/bridge-control-protocol.md)、[wrd-codec-library.md](../../docs/api/wrd-codec-library.md) |
| 数据兼容 | 不适用（首次引入 `AllowlistConfig` / `SessionState` / `AppSettings`，无历史数据） | 无迁移需求：[design.md](design.md) §Data Model Changes、§Migration |
| 行为兼容 | 不适用（首次交付，无历史版本行为需要保持） | Phase 1 是首个交付版本；Linux/TUN/链式代理为 NG（[spec.md](spec.md)） |

## 安全

| 检查项 | 结论 | 依据 |
| ------ | ---- | ---- |
| 输入校验 | 设计已定义，待实现验证 | allowlist 主机名小写化与合法性校验、`webvpn.swufe.edu.cn`/`authserver.swufe.edu.cn` 硬编码排除（[design.md](design.md) §Security Considerations、[docs/security/README.md](../../docs/security/README.md)）；对应用例 TC-B04、TC-D04 |
| 权限 | 设计已定义，待实现验证 | CA 安装/卸载需管理员权限（TC-E01/TC-E02）；macOS 进程捕获可能需辅助功能/网络扩展授权（TC-G04）；会话文件与 CA 私钥权限收紧（[design.md](design.md) §Security Considerations） |
| 敏感数据 | 设计已定义，待实现验证 | 不存密码（TC-D01）；Cookie 存用户目录且不进日志/控制口响应（TC-F04）；CA 私钥仅本机、不上传（TC-E01/TC-E02）；对应用例 TC-F04、TC-D01 |

## 文档同步

| 文档 | 是否需要更新 | 状态 |
| ---- | ------------ | ---- |
| [docs/requirements/](../../docs/requirements/README.md) | 是 | 已同步：REQ-001..REQ-011 / NFR-001..NFR-007 的规范定义在 requirements，本 Spec 只引用 ID |
| [docs/architecture/](../../docs/architecture/README.md) | 是 | 已同步：组件、数据流、接口、数据模型为首次实现内容，由 architecture 文档定义（[overview.md](../../docs/architecture/overview.md)、[components.md](../../docs/architecture/components.md)、[data-flow.md](../../docs/architecture/data-flow.md)、[interfaces.md](../../docs/architecture/interfaces.md)、[data-model.md](../../docs/architecture/data-model.md)） |
| [docs/api/](../../docs/api/README.md) | 是 | 已同步：[electron-ipc.md](../../docs/api/electron-ipc.md)、[bridge-control-protocol.md](../../docs/api/bridge-control-protocol.md)、[wrd-codec-library.md](../../docs/api/wrd-codec-library.md) |
| ADR | 是 | [ADR-0001](../../docs/architecture/adr/ADR-0001-wrd-rewrite-in-mitm-layer.md)..[ADR-0005](../../docs/architecture/adr/ADR-0005-builtin-wrd-key-with-override.md) 均已 Accepted（2026-09-20），本 Spec 不新增 ADR |
| `.en.md` 配对 | 否 | 不适用：Spec 属实现记录，默认中文单语；本目录五个文件不在双语强制范围内（`specs/README.md` 已配对） |

## 未验证 / 无法验证项

| 项 | 原因 | 已尝试 | 需要谁决策 |
| -- | ---- | ------ | ---------- |
| L3 教务浏览器验收（TC-G01..G03） | 需要真实西财账号与授权设备完成 CAS/MFA，且设备需信任本机 CA | 未开始（实现未落地） | cherrchen（测试者本人提供账号与设备） |
| CA 安装/卸载（TC-E01、TC-E02） | 需要测试机管理员权限写入系统信任库 | 未开始（实现未落地） | cherrchen（在自有测试机提权执行） |
| 进程捕获（TC-G04） | 需要平台级授权（macOS 辅助功能/网络扩展类授权） | 未开始（实现未落地） | cherrchen（在测试机授权并验证） |
| 会话 Cookie 名称与失效信号（Q-001 / DQ-001） | 需实机抓取 WebVPN 会话确认具体 Cookie 名与失效信号组合 | 未开始 | cherrchen（以实机验证结论回写实现与文档） |

## 结论

- [ ] 映射表无 `Pending`
- [ ] 执行的命令与结果已记录
- [ ] 文档影响已处理
- [ ] Spec 状态可推进到 `Verified`
