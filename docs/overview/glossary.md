# 术语表（Glossary）

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-20

**用途**：统一项目内术语，避免人与 Agent 对同一名词产生不同理解。
**唯一来源**：本文件是术语定义（One Fact, One Source of Truth）的 Source of Truth；其它文档应引用术语，而不是各自重新定义。

---

## 术语

| 术语 | English | 定义 | 别名 / 不混淆 | 来源 |
| ---- | ------- | ---- | ------------- | ---- |
| WebVPN | WebVPN (Wengine) | 学校部署的网瑞达应用层反向代理，入口 `webvpn.swufe.edu.cn`：登录后以门户改写后的 URL 访问校内 Web 资源 | 别名：网瑞达 WebVPN；不混淆：SSLVPN / TUN 级真 VPN | 原包 `01-requirements/01-PRD.md` §2；`99-appendix/requirements-onepager-v1.0.md` §2 |
| WRD | WRD | 网瑞达 WebVPN 使用的 URL 改写方案：把普通校内 URL 的主机名加密后拼入 WebVPN 路径 | 不混淆：WrdCodec（该方案在本仓库的实现） | 原包 `99-appendix/wrd_codec-README.md`；`wrd_codec.py` 文件头 |
| WrdCodec | WrdCodec | WRD 的 URL 编解码实现，对外 API `encryptHost` / `decryptHost` / `encodeUrl` / `decodeUrl`；Python 为权威实现，TS 可后补 | 别名：WRD codec；不混淆：WRD（方案本身） | 原包 `01-requirements/03-technical-design.md` §3；`05-api-interfaces.md` §3 |
| WRD URL 形态 | WRD URL form | `https://webvpn.swufe.edu.cn/{http\|https}[-{port}]/{iv_hex}{host_cipher}{path}?{query}`；AES-128-CFB（`segment_size=128`），默认 `key = iv = wrdvpnisthebest!`；仅加密 hostname，path/query 明文 | 别名：WebVPN 形态 URL；不混淆：普通 URL（真实主机名） | 原包 `01-requirements/03-technical-design.md` §3；`wrd_codec.py` |
| 本机桥 | local bridge | 运行在本机的 mitmproxy sidecar + 薄 WRD addon：把命中 allowlist 的本机 HTTP/HTTPS 请求改写为 WRD URL 并携带会话 | 别名：桥（bridge）、bridge sidecar；不混淆：真 VPN / TUN | 原包 `01-requirements/04-architecture-and-tech-selection.md` §1 |
| allowlist | allowlist | 经 WebVPN 改写（而非直连）的主机清单；默认必保 `jwxt.swufe.edu.cn`，用户可增删 | 别名：AllowlistConfig（数据模型名）；不混淆：系统代理 bypass 列表 | 原包 `01-requirements/06-data-model.md` §2.1；`99-appendix/requirements-onepager-v1.0.md` FR-5 |
| 通配 `*.swufe.edu.cn` | SWUFE wildcard | allowlist 的可选开关 `includeSwufeWildcard`（默认 `false`）：匹配 apex `swufe.edu.cn` 与 `.swufe.edu.cn` 后缀 | 不混淆：精确匹配的主机列表 | 原包 `01-requirements/06-data-model.md` §2.1；`99-appendix/requirements-onepager-v1.0.md` FR-5 |
| Session Broker | Session Broker | Electron Main 进程内负责从登录 WebView 提取、保存 WebVPN 会话 Cookie 并检测失效的模块 | 不混淆：allowlist 匹配、WrdCodec | 原包 `01-requirements/03-technical-design.md` §2、§6 |
| 响应反向改写 | response reverse rewrite | 把上游 WebVPN 响应改回「普通主机名」语义，优先级：1) `Location` 2) `Set-Cookie` 的 Domain/Path 3) `text/html` / `application/javascript` / `application/json` 中的绝对 URL 4) 其它类型默认不改 | 别名：反向改写；不混淆：请求改写（上行方向） | 原包 `01-requirements/03-technical-design.md` §5 |
| 系统代理接管 | system proxy takeover | 开桥前读 OS 代理；已启用且非本桥则拒绝启动；否则设为 `127.0.0.1:<bridge_port>` 并保存「由本 App 设置」标记，关闭/过期/退出时仅在标记存在时清除 | 不混淆：进程捕获（另一条接管路径） | 原包 `01-requirements/03-technical-design.md` §7 |
| 进程捕获 | per-process capture | 用 mitmproxy local mode 选择指定进程（如 Chrome）接管其流量；与系统代理可同时启用，关闭时一并停止 | 别名：local capture；不混淆：系统代理 | 原包 `01-requirements/03-technical-design.md` §8 |
| MITM CA | MITM CA | 本机生成的根证书，用于在本机解密并改写 HTTPS；建议复用 mitmproxy CA 机制、不自研 PKI，私钥仅本机且可一键卸载 | 别名：本机 CA；不混淆：学校官方证书 | 原包 `99-appendix/requirements-onepager-v1.0.md` FR-8；`01-requirements/03-technical-design.md` §10 |
| 防环 | loop prevention | 访问 `webvpn.swufe.edu.cn` / `authserver.swufe.edu.cn` 不得进入本桥；已是 WebVPN 形态的请求直通 | 不混淆：allowlist 通配开关 | 原包 `01-requirements/03-technical-design.md` §6；`99-appendix/requirements-onepager-v1.0.md` FR-2 |
| CAS / MFA | CAS / MFA | 统一身份认证：`authserver.swufe.edu.cn`（CAS，可含多因素认证）；由用户在官方 WebView 内自行完成，App 不代填、不存储 | 不混淆：WebVPN 会话 Cookie（登录的产物） | 原包 `99-appendix/requirements-onepager-v1.0.md` §2、FR-2 |
| TUN（第一期不做） | TUN | 后续阶段的透明网关方案 `sing-box TUN → 127.0.0.1:mitm`；第一期不实现，也不阻塞第一期验收 | 不混淆：系统代理 / 进程捕获（第一期的接管方式） | 原包 `01-requirements/04-architecture-and-tech-selection.md` §1；[NFR-006](../requirements/non-functional-requirements.md) |
| 桥状态机 | bridge state machine | 桥的生命周期：`idle → (start) → starting → running`；`running → (stop\|expire\|error) → stopping → idle`；`starting → (fail) → error → idle` | 不混淆：UI 状态条颜色 | 原包 `01-requirements/06-data-model.md` §5；`05-api-interfaces.md` §1.2 |
| 错误码 | error code | 对 UI 暴露的固定错误集合：`PROXY_CONFLICT`（系统代理已占用）/ `CA_MISSING`（未安装或未信任 CA）/ `NOT_LOGGED_IN`（无会话）/ `SESSION_EXPIRED`（会话失效）/ `BRIDGE_CRASH`（mitm 进程退出）/ `ALLOWLIST_EMPTY`（无主机） | 不混淆：`BridgeStatus.state`（状态机取值） | 原包 `01-requirements/03-technical-design.md` §9 |

## 状态值约定

以下状态值在本仓库的文档与 Spec 中使用，含义固定：

| 状态 | 适用对象 | 含义 |
| ---- | -------- | ---- |
| Draft | Spec / 文档 | 尚未评审 |
| Approved | Spec | 已确认可以实现 |
| In Progress | Spec | 实现中 |
| Implemented | Spec | 代码完成，未验证 |
| Verified | Spec | 验证矩阵通过 |
| Archived | Spec / 文档 | 历史资料，不再作为当前事实 |
| Proposed / Accepted / Superseded / Deprecated / Rejected | ADR | 决策记录状态 |

## 新增术语流程

1. 在本表新增一行；
2. 在首次使用该术语的文档中添加指向本表的链接；
3. 若术语变更导致语义变化，检查 [requirements/](../requirements/README.md) 与 [architecture/](../architecture/README.md) 是否需要同步。
