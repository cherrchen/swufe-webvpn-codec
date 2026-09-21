# 功能需求

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-20

**用途**：项目功能需求的完整清单与 Source of Truth。每条需求必须可验证。
**不写**：实现方式、组件设计、接口字段定义（→ [architecture/](../architecture/README.md)、[api/](../api/README.md)）。

---

## 需求模板

复制以下块新增一条需求；ID 递增且永不复用。

```markdown
### REQ-001 <需求名称>

- Status: Proposed
- Priority: Must
- Related: G-xxx / ADR-xxxx
- Source: <来源：需求方、访谈或文档路径>

**描述**
系统应当……

**理由**
……

**验收标准**
1. 当……时，系统应……
2. 当……时，系统应……

**边界与例外**
- ……

**关联 Spec**
- specs/<id>-<name>/
```

## 需求清单

| ID | 名称 | Priority | Status | 关联 Spec |
| -- | ---- | -------- | ------ | --------- |
| REQ-001 | Electron 应用外壳 | Must | Accepted | [001-phase1-local-bridge](../../specs/001-phase1-local-bridge/) |
| REQ-002 | 登录与会话（Session Broker） | Must | Accepted | [001-phase1-local-bridge](../../specs/001-phase1-local-bridge/) |
| REQ-003 | 流量接管（TUN 之前） | Must | Accepted | [001-phase1-local-bridge](../../specs/001-phase1-local-bridge/) |
| REQ-004 | 与其它代理共存（拒绝启动） | Must | Accepted | [001-phase1-local-bridge](../../specs/001-phase1-local-bridge/) |
| REQ-005 | Allowlist 路由 | Must | Accepted | [001-phase1-local-bridge](../../specs/001-phase1-local-bridge/) |
| REQ-006 | WRD 请求改写 | Must | Accepted | [001-phase1-local-bridge](../../specs/001-phase1-local-bridge/) |
| REQ-007 | 响应反向改写 | Must | Accepted | [001-phase1-local-bridge](../../specs/001-phase1-local-bridge/) |
| REQ-008 | 防环（登录 WebView 不经本桥） | Must | Accepted | [001-phase1-local-bridge](../../specs/001-phase1-local-bridge/) |
| REQ-009 | 可观测性（状态与调试日志） | Should | Accepted | [001-phase1-local-bridge](../../specs/001-phase1-local-bridge/) |
| REQ-010 | 证书生命周期 | Must | Accepted | [001-phase1-local-bridge](../../specs/001-phase1-local-bridge/) |
| REQ-011 | 平台支持 | Must | Accepted | [001-phase1-local-bridge](../../specs/001-phase1-local-bridge/) |

（完整条目按上方模板在本文档内展开。）

### REQ-001 Electron 应用外壳

- Status: Accepted
- Priority: Must
- Related: G-002 / G-003 / [ADR-0003](../architecture/adr/ADR-0003-electron-gui-for-phase-1.md)
- Source: 归档原包 / [requirements-onepager-v1.0.md](../archive/2026-09-20-swufe-webvpn-bridge-docs-v1.0/99-appendix/requirements-onepager-v1.0.md) FR-1

**描述**
系统应当提供 macOS / Windows 桌面窗口（托盘非必须），并具备以下界面能力：登录（内嵌 BrowserWindow/WebView 打开官方 WebVPN/CAS，用户自行完成认证，含 MFA）、一键连接开关、一级「捕获方式」选择（系统代理 / 指定应用）、allowlist 管理（查看/增删主机，默认含 `jwxt.swufe.edu.cn`，可选一键启用 `*.swufe.edu.cn`）、状态区（已连接 / 已断开 / 错误原因，以及当前 allowlist 摘要）、证书（一键安装、一键卸载本机 MITM 根证书）、调试日志开关与日志面板。

**理由**
CAS/MFA 与证书信任引导需要 GUI（见 ADR-0003）；同时「状态可见、危险操作可逆」是产品级目标 G-003。

**验收标准**
1. 应用在 macOS 与 Windows 上均可构建并启动，显示主窗口。
2. 状态条与桥接状态机一致：未登录为灰色且开关禁用；已登录未开桥为蓝色「已登录」且可开；桥接中为绿色「桥接中」且可关（指定应用捕获生效时显示「桥接中（进程捕获）」）；错误为红色并显示原因；过期处理中为橙色且强制关（TC-H01）。
3. allowlist 列表可添加与删除主机，重启 App 后改动仍保留（TC-B05）。
4. `*.swufe.edu.cn` 通配勾选可保存（TC-H02）。
5. 证书区提供「安装本机 CA」与「卸载本机 CA」两个入口，按钮具备清晰标签。

**边界与例外**
- 托盘图标显示连接状态非第一期必做。
- 不强制暗色主题（可跟随系统，非必须）。
- 错误信息不得仅靠颜色表达。

**关联 Spec**
- [specs/001-phase1-local-bridge/](../../specs/001-phase1-local-bridge/)

### REQ-002 登录与会话（Session Broker）

- Status: Accepted
- Priority: Must
- Related: G-001 / G-003 / [ADR-0003](../architecture/adr/ADR-0003-electron-gui-for-phase-1.md)
- Source: 归档原包 / [requirements-onepager-v1.0.md](../archive/2026-09-20-swufe-webvpn-bridge-docs-v1.0/99-appendix/requirements-onepager-v1.0.md) FR-2

**描述**
系统应当不存储学号/密码，只读取并保存 WebVPN 会话所必需的 Cookie（及实现所需的最小附属状态）。登录成功的判定为「能稳定取得可用的 WebVPN 会话」（具体 Cookie 名以实机为准）。会话过期时应依次：停止桥接、清除本应用设置的系统代理、停止进程捕获、弹窗提示用户重新登录。

**理由**
无密码落盘是安全基线（G-003）；过期时必须明确停桥并清除系统代理，避免留下「半开」代理。

**验收标准**
1. 用户在 WebView 内完成 CAS（可含 MFA）后 `loggedIn=true`，且用户目录中不存在保存密码的文件（TC-D01）。
2. 未登录时启动桥接返回 `NOT_LOGGED_IN`（TC-D02）。
3. 触发失效信号（探测 URL 返回登录页标记 / `Set-Cookie` 清空会话 / 连续改写后 302 到 CAS）后，系统自动停桥、清除系统代理、停止进程捕获，并弹出「去登录」提示（TC-D03）。
4. 会话 Cookie 的值不以明文出现在日志或控制口响应中。

**边界与例外**
- 若无法静默验证 Cookie 仍有效，则要求用户重新登录。
- Cookie 具体名称与失效信号以实机为准（见 [PQ-001](product-requirements.md)）。

**关联 Spec**
- [specs/001-phase1-local-bridge/](../../specs/001-phase1-local-bridge/)

### REQ-003 流量接管（TUN 之前）

- Status: Accepted
- Priority: Must
- Related: G-001 / [ADR-0001](../architecture/adr/ADR-0001-wrd-rewrite-in-mitm-layer.md) / [ADR-0002](../architecture/adr/ADR-0002-reuse-mitmproxy-for-tls.md)
- Source: 归档原包 / [requirements-onepager-v1.0.md](../archive/2026-09-20-swufe-webvpn-bridge-docs-v1.0/99-appendix/requirements-onepager-v1.0.md) FR-3

**描述**
系统应当提供两种**互斥**的流量接管方式，由界面上一级的「捕获方式」显式选择：`系统代理（全部流量）`——把系统 HTTP/HTTPS 代理指向本地桥端口；`指定应用`——用 mitmproxy local 模式只接管所选应用。两者不可同时生效：指定应用模式下本 App 不设置系统代理（若此前由本 App 设置过则撤销），系统代理模式下不启用进程捕获。关闭开关时必须停止代理服务、清除系统代理、停止进程捕获。

**理由**
第一期不做 TUN/透明网关，系统代理可覆盖普通浏览器；进程捕获用于把范围收窄到点选的应用，并把系统代理留给用户原有工具。两者互斥是必须的：被捕获应用的连接若再经系统代理，会以透明层身份进入代理内核并以硬失败告终。

**验收标准**
1. 已登录、系统无代理、CA 就绪时以系统代理方式开桥，系统 HTTP/HTTPS 代理指向本桥端口（TC-C02）。
2. 关闭开关后，系统代理恢复为不再由本 App 占用（TC-C03）。
3. 可列出候选应用（一行一个应用，主进程与其 Helper 归并）并勾选需要捕获的应用（如 Chrome）；切到指定应用后只有所选应用的流量经本桥，且本 App 不设置系统代理；关闭开关时进程捕获一并停止。
4. CA 未安装时打开开关，返回 `CA_MISSING` 或给出明确失败提示（TC-E03）。

**边界与例外**
- macOS 下进程捕获可能触发辅助功能/网络扩展授权，UI 须给出引导；首次启用需在系统提示内确认，未确认则界面显示启用失败、引导文案与「重试」。
- 系统代理被其它软件占用时，启用「指定应用」同样以 `PROXY_CONFLICT` 拒绝（与 REQ-004 一致）。
- 进程捕获失败不改变桥状态（桥继续可用），只显示失败原因。
- WebSocket 尽力支持，不作为第一期验收阻断项；HTTP/3 建议禁用或回落 TCP。
- 本需求不包含 TUN / sing-box 透明网关（见 [非目标](../overview/goals-and-non-goals.md)）。

**关联 Spec**
- [specs/001-phase1-local-bridge/](../../specs/001-phase1-local-bridge/)

### REQ-004 与其它代理共存（拒绝启动）

- Status: Accepted
- Priority: Must
- Related: G-003 / [ADR-0004](../architecture/adr/ADR-0004-refuse-start-when-system-proxy-in-use.md)
- Source: 归档原包 / [requirements-onepager-v1.0.md](../archive/2026-09-20-swufe-webvpn-bridge-docs-v1.0/99-appendix/requirements-onepager-v1.0.md) FR-4

**描述**
系统应当在启动前检测系统代理是否已被其它软件占用；若已设置（且非本 App 设置），则拒绝启动并提示用户先关闭 Clash / mihomo / sing-box 等对系统代理的占用。

**理由**
与 Clash 等叠加难以测试且行为不可预期（ADR-0004）；第一期明确不做链式共存。

**验收标准**
1. 操作系统代理已启用时启动桥接，返回 `PROXY_CONFLICT` 且桥未启动（TC-C01）。
2. 提示文案明确要求用户关闭 Clash / mihomo / 其它 VPN 的系统代理后再试。
3. 用户释放系统代理后再次启动可成功。

**边界与例外**
- 仅检测系统代理占用，不做链式转发。
- 由本 App 自身设置并标记的代理（`systemProxyManagedByApp`）不视为冲突。

**关联 Spec**
- [specs/001-phase1-local-bridge/](../../specs/001-phase1-local-bridge/)

### REQ-005 Allowlist 路由

- Status: Accepted
- Priority: Must
- Related: G-001 / [ADR-0001](../architecture/adr/ADR-0001-wrd-rewrite-in-mitm-layer.md)
- Source: 归档原包 / [requirements-onepager-v1.0.md](../archive/2026-09-20-swufe-webvpn-bridge-docs-v1.0/99-appendix/requirements-onepager-v1.0.md) FR-5

**描述**
系统应当仅将 allowlist 中的主机（以及可选开启的 `*.swufe.edu.cn`）经 WebVPN 改写发送，其余流量直连（不改写、不强制进 WebVPN）。第一期必保主机为 `jwxt.swufe.edu.cn`，用户可自定义添加/删除主机名。匹配算法为 `host in hosts` 或（通配开启且 `host == "swufe.edu.cn"` 或 `host` 以 `.swufe.edu.cn` 结尾）；`webvpn.swufe.edu.cn`、`authserver.swufe.edu.cn` 硬编码排除。

**理由**
只有 allowlist 内的校内站点需要也允许走 WebVPN；其余流量直连可避免无谓改写并降低风险（G-001）。

**验收标准**
1. 新配置默认含 `jwxt.swufe.edu.cn`，且默认值为 `{"hosts":["jwxt.swufe.edu.cn"],"includeSwufeWildcard":false}`（TC-B01）。
2. `hosts=["jwxt.swufe.edu.cn"]` 时匹配 `jwxt.swufe.edu.cn` 为 true（TC-B02），匹配 `example.com` 为 false（TC-B03）。
3. 通配开启时，`xxx.swufe.edu.cn` 命中（TC-B04）。
4. 在 UI/接口中增删主机后重启 App，改动仍保留（TC-B05）。
5. 主机名按小写合法 hostname 精确匹配，匹配失败时请求直连。

**边界与例外**
- 通配默认关闭，需用户显式勾选。
- 主机名不合法（非小写合法 hostname）时不写入 allowlist。
- UI 增删主机 / 勾选通配后立即生效（无需重启），并在重启 App 后保持（TC-B05 / TC-H02）。
- allowlist 为空时启动桥接返回 `ALLOWLIST_EMPTY`。

**关联 Spec**
- [specs/001-phase1-local-bridge/](../../specs/001-phase1-local-bridge/)

### REQ-006 WRD 请求改写

- Status: Accepted
- Priority: Must
- Related: G-001 / [ADR-0001](../architecture/adr/ADR-0001-wrd-rewrite-in-mitm-layer.md) / [ADR-0005](../architecture/adr/ADR-0005-builtin-wrd-key-with-override.md)
- Source: 归档原包 / [requirements-onepager-v1.0.md](../archive/2026-09-20-swufe-webvpn-bridge-docs-v1.0/99-appendix/requirements-onepager-v1.0.md) FR-6（请求路径）

**描述**
对命中 allowlist 的请求，系统应当：识别目标 `scheme/host/port/path/query`；用 WrdCodec 生成 WebVPN URL（AES-128-CFB，`segment_size=128`，默认 `key = iv = wrdvpnisthebest!`，仅加密 hostname，path/query 明文，URL 形态为 `https://webvpn.swufe.edu.cn/{http|https}[-{port}]/{iv_hex}{ct_hex}{path}?{query}`）；将实际上游改为 `webvpn.swufe.edu.cn`，附加 WebVPN Cookie；并按需最小必要地调整 `Host`/`Origin`/`Referer`。

**理由**
代理内核只能看到 CONNECT 目标主机，无法把 HTTP 语义改写成 WebVPN 路径，因此改写必须发生在 mitm 层（ADR-0001）。

**验收标准**
1. `encode` 教务样本（如 `https://jwxt.swufe.edu.cn/sso/jziotlogin`）得到固定 token 前缀 + 密文，并可 `decode` 回原主机（TC-A03）。
2. 对 authserver 样本 URL 重加密，token 与样本一致（TC-A02）；样本 URL 解密得到主机 `authserver.swufe.edu.cn`（TC-A01）。
3. `http://host:8080/x` 的 scheme token 为 `http-8080`（TC-A04）。
4. 使用错误 key 解密样本，得到非正确主机或显式失败（TC-A05）。
5. `curl -x 本地代理 https://jwxt.swufe.edu.cn/...` 时，上游看到 WebVPN 形态或教务可达（TC-F01）。
6. 非 allowlist 主机（如 `example.com`）不改写（TC-F02）。

**边界与例外**
- WRD 默认密钥内置并保留配置覆盖能力（ADR-0005）；自定义 key/iv 不匹配时结果乱码或显式失败。
- `Host`/`Origin`/`Referer` 仅做实现正确性所需的最小必要修改。

**关联 Spec**
- [specs/001-phase1-local-bridge/](../../specs/001-phase1-local-bridge/)

### REQ-007 响应反向改写

- Status: Accepted
- Priority: Must
- Related: G-001 / [ADR-0001](../architecture/adr/ADR-0001-wrd-rewrite-in-mitm-layer.md)
- Source: 归档原包 / [requirements-onepager-v1.0.md](../archive/2026-09-20-swufe-webvpn-bridge-docs-v1.0/99-appendix/requirements-onepager-v1.0.md) FR-6（响应路径）

**描述**
系统应当（第一期必做，浏览器验收的硬依赖）反向改写响应中与 WebVPN 形态相关的部分：`Location`；`Set-Cookie` 的 `Domain`/`Path` 等与主机名相关的字段；`text/html`、`application/javascript`、`application/json` 中指向校内站点的绝对 URL。策略约定：客户端侧始终使用真实主机名，仅上行改走 WebVPN。

**理由**
教务前端存在大量绝对 URL 与跳转，若不反向改写，点击会跳飞到不可达的公网直连地址，浏览器验收无法通过。处理优先级：① `Location` ② `Set-Cookie` Domain/Path ③ HTML/JS/JSON 绝对 URL ④ 其它内容类型默认不改写。

**验收标准**
1. 上游返回 WebVPN 形态 `Location` 时，客户端跟随落到普通主机名语义（TC-F03）。
2. 在教务页面内点击主要菜单/链接，不因绝对 URL 跳飞到不可达的公网直连（TC-G02）。
3. `Set-Cookie` 的 `Domain`/`Path` 与真实主机名语义一致，Cookie 不写到错误域。
4. `text/html` / `application/javascript` / `application/json` 之外的内容类型默认不改写。

**边界与例外**
- WebSocket 尽力支持，不作为第一期验收阻断项。
- 「Location 是反向改写为普通 URL 还是保持可跟随的一致性策略」在实现说明中固定一种，并以测通教务为准。

**关联 Spec**
- [specs/001-phase1-local-bridge/](../../specs/001-phase1-local-bridge/)

### REQ-008 防环（登录 WebView 不经本桥）

- Status: Accepted
- Priority: Must
- Related: G-001 / [ADR-0001](../architecture/adr/ADR-0001-wrd-rewrite-in-mitm-layer.md)
- Source: 归档原包 / [requirements-onepager-v1.0.md](../archive/2026-09-20-swufe-webvpn-bridge-docs-v1.0/99-appendix/requirements-onepager-v1.0.md) FR-2 / FR-7 相关

**描述**
系统应当保证访问 `webvpn.swufe.edu.cn` / `authserver.swufe.edu.cn` 的请求不进入本桥、不被 WRD 二次包装；已经是 WebVPN 形态的请求直通。两个主机名硬编码排除，不被 allowlist 编辑影响。

**理由**
登录 WebView 本身就访问 WebVPN 门户；若这些请求再被改写会产生代理环并破坏登录流程。

**验收标准**
1. 登录 WebView 全程（含 CAS/MFA）的流量，经抓包或日志确认不经 WRD 再包装（TC-D04）。
2. 已是 WebVPN 形态的请求直通，不被二次改写。
3. 即使开启 `*.swufe.edu.cn` 通配，`webvpn.swufe.edu.cn` 与 `authserver.swufe.edu.cn` 仍被排除。

**边界与例外**
- 排除为硬编码，不受用户 allowlist 增删影响。

**关联 Spec**
- [specs/001-phase1-local-bridge/](../../specs/001-phase1-local-bridge/)

### REQ-009 可观测性（状态与调试日志）

- Status: Accepted
- Priority: Should
- Related: G-002 / G-003
- Source: 归档原包 / [requirements-onepager-v1.0.md](../archive/2026-09-20-swufe-webvpn-bridge-docs-v1.0/99-appendix/requirements-onepager-v1.0.md) FR-7

**描述**
系统应当默认可见连接状态、allowlist 与错误原因；提供可开关的调试日志，日志内容仅为「域名 + 是否改写成功」，默认关闭，且不记录响应正文、请求体与 Cookie。界面以状态条与日志面板呈现：日志面板列出「时间 | 域名 | 结果」三列，随开关显示 / 隐藏，最多保留最近 200 条。

**理由**
状态可见是体验目标 G-002 的一部分，也是排障前提；日志最小化是安全基线 G-003 的一部分（Cookie 敏感）。

**验收标准**
1. 状态条展示与桥接状态机一致（TC-H01）。
2. 开启调试日志并产生流量后，日志记录仅包含 host 与改写结果（TC-F04）。
3. 非 allowlist 请求在调试日志中显示 `rewritten=false`（TC-F02）。
4. 日志记录字段为 `ts/host/rewritten/direction/detail`，任何记录均不含 Cookie 与正文。
5. 界面日志面板显示「时间 | 域名 | 结果」三列，最多保留最近 200 条，关闭开关后隐藏并清空（TC-F04 / AC-009）。

**边界与例外**
- 调试日志默认关闭，由用户显式开启。
- 调试日志用于诊断，不作为审计或流量留存手段。

**关联 Spec**
- [specs/001-phase1-local-bridge/](../../specs/001-phase1-local-bridge/)

### REQ-010 证书生命周期

- Status: Accepted
- Priority: Must
- Related: G-003 / [ADR-0002](../architecture/adr/ADR-0002-reuse-mitmproxy-for-tls.md) / [NFR-003](non-functional-requirements.md)
- Source: 归档原包 / [requirements-onepager-v1.0.md](../archive/2026-09-20-swufe-webvpn-bridge-docs-v1.0/99-appendix/requirements-onepager-v1.0.md) FR-8

**描述**
系统应当使用本机生成的 MITM CA（复用 mitmproxy CA 机制，不自研 PKI），提供一键安装到系统信任库与一键卸载；CA 私钥不得上传；安装前必须展示信任风险提示。

**理由**
要解密并改写 HTTPS，必须在本机信任一个 MITM 根证书；危险操作必须可逆（G-003）。自研 PKI/TLS 栈成本与风险高，故复用成熟栈（ADR-0002）。

**验收标准**
1. 执行安装后信任库中可见该 CA，且 UI 显示「已安装」（TC-E01）。
2. 执行卸载后信任库中该 CA 被移除（TC-E02）。
3. 未安装 CA 时启动桥接或访问 HTTPS，返回 `CA_MISSING` 或明确失败提示（TC-E03）。
4. 安装前展示风险提示文案（见 [NFR-005](non-functional-requirements.md)）。

**边界与例外**
- CA 使用 mitmproxy 专用 confdir；私钥仅存本机，不上传。
- 安装可能需管理员权限（CI 可降级该用例）。
- 开源版文档须明确信任风险。

**关联 Spec**
- [specs/001-phase1-local-bridge/](../../specs/001-phase1-local-bridge/)

### REQ-011 平台支持

- Status: Accepted
- Priority: Must
- Related: G-004 / [ADR-0003](../architecture/adr/ADR-0003-electron-gui-for-phase-1.md) / [NFR-006](non-functional-requirements.md)
- Source: 归档原包 / [requirements-onepager-v1.0.md](../archive/2026-09-20-swufe-webvpn-bridge-docs-v1.0/99-appendix/requirements-onepager-v1.0.md) FR-9

**描述**
第一期支持 macOS 与 Windows；Linux 不在第一期范围。

**理由**
产品面向西财师生的桌面浏览器使用场景，两个桌面平台足以覆盖私用优先的第一期目标（G-004）。

**验收标准**
1. macOS 与 Windows 上均可启动 Electron 应用并完成主路径（登录 → 开桥 → 浏览器访问教务）。
2. 教务浏览器验收在至少一侧桌面 OS 通过（目标为两侧都通过）。
3. Linux 不产生第一期交付物。

**边界与例外**
- 平台差异（系统代理 API、信任库、权限弹窗）由系统适配层处理。
- TUN/透明网关不阻塞第一期验收（见 NFR-006）。

**关联 Spec**
- [specs/001-phase1-local-bridge/](../../specs/001-phase1-local-bridge/)

## 需求 ⇒ 验证映射

每条需求的验证归属在对应 Feature Spec 的 [verification.md](../../specs/001-phase1-local-bridge/verification.md) 中维护，本文件只保留总览：

| REQ | 验证方式 | 状态 |
| --- | -------- | ---- |
| REQ-001 | TC-H01 / TC-H02 / TC-G01 / TC-G03 | Pending |
| REQ-002 | TC-D01 / TC-D02 | Pending |
| REQ-003 | TC-C02 / TC-C03 / TC-C04 | Pending |
| REQ-004 | TC-C01 | Pending |
| REQ-005 | TC-B01..TC-B05 | Pending |
| REQ-006 | TC-A01..TC-A05 / TC-F01 | Pending |
| REQ-007 | TC-F03 / TC-G02 | Pending |
| REQ-008 | TC-D04 | Pending |
| REQ-009 | TC-F04 / TC-H01 | Pending |
| REQ-010 | TC-E01 / TC-E02 / TC-E03 | Pending |
| REQ-011 | 手工平台验收（macOS / Windows 各一测试机） | Pending |
