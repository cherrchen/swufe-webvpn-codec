# Verification: Phase 1 本机桥（001-phase1-local-bridge）

> Spec ID: 001
> Status: In Progress
> Owner: cherrchen
> Last Updated: 2026-09-21

> 本文件建立 **Requirement → Verification** 映射，是「Feature 是否完成」的判定依据。
> 规则见 [verification-strategy.md](../../docs/verification/verification-strategy.md)。
> Feature **不因为「代码写完了」被视为完成**；状态必须推进到 `Verified`。
> 当前进度：M1（桥核心）已实现并通过 L0/L1/L2（见下表 `Passed` 行与「执行的命令与结果」）；M2–M4 未开始，故 Feature 整体仍为 `In Progress`。

## 映射表

> 测试用例编号与分层沿用归档测试用例集（`docs/archive/2026-09-20-swufe-webvpn-bridge-docs-v1.0/02-testing/02-test-cases.md`）；层级定义见 [docs/development/testing-strategy.md](../../docs/development/testing-strategy.md)。M1 覆盖的自动化用例已 `Passed`，其余保持 `Pending` 并标注 M1 已通过的部分。

| Requirement | Verification | Status |
| ----------- | ------------ | ------ |
| REQ-001 | TC-H01（L3 手工：状态条与状态机一致）；应用启动 smoke（TC-G01/TC-G03 前置，L3 手工） | Pending（M2 起；M1 不含 Electron 壳） |
| REQ-002 | TC-D01、TC-D02、TC-D03（L1 组件 + L3 手工：登录成功、未登录拒绝开桥、过期停桥清代理弹窗） | Pending（M2 起）；M1 已通过：WebVPN Cookie 注入与去重、配置热更新（`tests/l1/test_addon_request.py`、`tests/l1/test_addon_reload.py`） |
| REQ-003 | TC-C02、TC-C03、TC-C04（L1 组件 / L2 集成：设代理、关桥清代理、退出清代理）；TC-G04（L3 手工：进程捕获） | Pending（M2/M3 起）；M1 已通过：sidecar 起桥、回环监听、结束进程即停止（`tests/l2/test_proxy_end_to_end.py`） |
| REQ-004 | TC-C01（L1 组件 / L2 集成：已有系统代理时拒绝启动，错误码 `PROXY_CONFLICT`） | Pending（M2） |
| REQ-005 | TC-B01..B05（L0 单元 + L1 组件：默认值、精确命中、非名单直连语义、通配、持久化）；TC-H02（L3 手工：通配勾选） | Pending（TC-H02 属 M3）；M1 已通过：TC-B01..B05（`tests/l0/test_allowlist.py`、`tests/l0/test_config.py`、`tests/l1/test_addon_request.py`） |
| REQ-006 | TC-A01..A05（L0 单元：codec 向量）；TC-F01（L2 集成：curl 经代理访问 allowlist 主机） | Passed（M1） |
| REQ-007 | TC-F03（L1 组件：`Location` 反向改写）；TC-G02（L3 手工：教务页面内导航不跳飞） | Pending（TC-G02 属 M4）；M1 已通过：`Location`、`Set-Cookie` Domain/Path、HTML/JS/JSON 反向改写与内容类型边界（`tests/l1/test_rewrite.py`、`tests/l1/test_addon_response.py`） |
| REQ-008 | TC-D04（L2 集成 / L3 手工：登录 WebView 无代理环）；TC-F02（L2 集成：非 allowlist 直连不改写） | Pending（TC-D04 属 M2）；M1 已通过：TC-F02 与「已是 WebVPN 形态的请求直通」（`tests/l1/test_addon_request.py`、`tests/l2/test_proxy_end_to_end.py`） |
| REQ-009 | TC-F04（L2 集成 + L3 手工：调试日志仅域名与改写结果）；TC-H01（L3 手工：状态可见） | Pending（TC-H01 属 M3）；M1 已通过：TC-F04 的 L2 部分（`swufe-debug` 键集固定、无 Cookie/正文，`tests/l1/test_addon_debuglog.py`、`tests/l2/test_proxy_end_to_end.py`） |
| REQ-010 | TC-E01、TC-E02、TC-E03（L3 手工，需管理员权限：安装 CA、卸载 CA、未装 CA 提示 `CA_MISSING`） | Pending（M2） |
| REQ-011 | TC-G01（L3 手工：macOS 教务验收）；TC-G03（L3 手工：Windows 教务验收） | Pending（M4） |
| NFR-001 | 代码审查（TLS/HTTP2/证书签发实现来自 mitmproxy，无自研 PKI）；TC-E01（L3 手工：CA 生成于 mitmproxy 专用 confdir） | Pending（TC-E01 属 M2）；M1 已通过：TLS/HTTP2/证书签发全部来自 mitmproxy（无自研 PKI），且 CA 生成于 `--confdir` 指定目录（L2 用该目录的 `mitmproxy-ca-cert.pem` 完成客户端 TLS 拦截） |
| NFR-002 | TC-A01..A05（L0 单元：与 `wrd_codec.py` 向量一致，含 authserver / jwxt 样本） | Passed（M1） |
| NFR-003 | TC-D01（L1/L3：登录后无密码文件）＋ TC-F04（L2/L3：日志不含正文/Cookie）＋ 人工检查（L3：CA 私钥与会话文件权限仅本机用户可读、不上传） | Pending（M2 起）；M1 已通过：TC-F04 的自动化部分（stderr 无 Cookie 值/正文）＋ 运行时配置文件 `bridge-config.json` 以 0600 写入（`tests/l0/test_config.py`） |
| NFR-004 | TC-C03、TC-C04（L1/L2：关桥与退出清代理）；TC-D03（L3 手工：过期清代理） | Pending（M2） |
| NFR-005 | TC-E01（L3 手工：安装 CA 前展示风险提示文案） | Pending（M2） |
| NFR-006 | TC-G01（macOS）、TC-G03（Windows）（L3 手工） | Pending（M4） |
| NFR-007 | TC-H01、TC-H02（L3 手工：界面文案为中文优先） | Pending（M3） |

Status 取值：`Pending` / `Passed` / `Failed` / `N/A`（`N/A` 必须写明理由）。

## 验收标准覆盖

| Acceptance Criteria | 对应验证项 | Status |
| ------------------- | ---------- | ------ |
| AC-001 | TC-G01 / TC-G03（L3 手工：双平台启动 Electron 应用） | Pending（M2/M4） |
| AC-002 | TC-D01（L1/L3：登录后 `loggedIn=true`）+ TC-F04（日志检查无 Cookie/密码） | Pending（M2 起）；M1 已通过：日志检查部分（`tests/l1/test_addon_debuglog.py`） |
| AC-003 | TC-C01（L1/L2：系统代理已占用时拒绝启动并提示） | Pending（M2） |
| AC-004 | TC-C02 / TC-C03 / TC-C04（L1/L2：开桥设代理、关桥清代理、退出清代理） | Pending（M2） |
| AC-005 | TC-E01 / TC-E02（L3 手工：CA 安装与卸载在系统信任库生效） | Pending（M2） |
| AC-006 | TC-B01 / TC-B02 / TC-B05（L0/L1）+ TC-H02（L3 手工：默认含 jwxt、可增删、可勾选通配） | Pending（TC-H02 属 M3）；M1 已通过：TC-B01/B02/B05（`tests/l0/test_allowlist.py`、`tests/l0/test_config.py`） |
| AC-007 | TC-G01 / TC-G02 / TC-G03（L3 手工：教务可打开并操作） | Pending（M4） |
| AC-008 | TC-D03（L3 手工：过期停桥、清代理、弹窗重登） | Pending（M2） |
| AC-009 | TC-F04（L2 + L3：调试日志仅域名与改写结果） | Pending（L3 部分属 M3）；M1 已通过：L2 部分（`tests/l2/test_proxy_end_to_end.py`） |
| AC-010 | TC-D04（L2/L3：登录 WebView 不经本桥） | Pending（M2） |

## 执行的命令与结果

| 命令 | 结果 | 时间 | 备注 |
| ---- | ---- | ---- | ---- |
| `uv sync --frozen` | 通过（48 packages checked） | 2026-09-21 | lock 与 `pyproject.toml` 一致 |
| `uv run pytest tests/l0 -q` | `74 passed` | 2026-09-21 | TC-A01..A05、TC-B01..B05、运行时配置解析与热更新缓存 |
| `uv run pytest tests/l1 -q` | `74 passed` | 2026-09-21 | 请求改写、响应反向改写、日志最小化（INV-001）、配置热更新（T012） |
| `uv run pytest tests/l2 -q` | `6 passed` | 2026-09-21 | TC-F01/F02/F04、EC-006、回环约束（真 mitmdump + curl + 假上游） |
| `uv run pytest -q` | `154 passed` | 2026-09-21 | 全量（L0+L1+L2） |
| `uv run python -m swufe_bridge.wrd_codec decode '<authserver 样本 URL>'` | `https://authserver.swufe.edu.cn/authserver/login?service=http%3A%2F%2Fjwxt.swufe.edu.cn%2Fsso%2Fjziotlogin`（退出码 0） | 2026-09-21 | TC-A01 的命令行复核 |
| `uv run python -m swufe_bridge.sidecar --config <cfg> --port 18082 --confdir <dir>` + `curl -x http://127.0.0.1:18082 --cacert <dir>/mitmproxy-ca-cert.pem https://jwxt.swufe.edu.cn/sso/jziotlogin?x=9` | `swufe-ready`；`swufe-debug` 请求/响应各一条（`rewritten=true`）；假上游观测 `path=/https/<token>/sso/jziotlogin?x=9` 且 `cookie=wrdvpn_session=SMOKE-SESSION-VALUE`；curl 得到 `location: https://jwxt.swufe.edu.cn/next` | 2026-09-21 | 手工 dev smoke（假上游），见 [M1 完成记录](../../docs/planning/milestones/M1-mitm-bridge.md) |
| 同上，`webvpnBase=https://webvpn.swufe.edu.cn`（无真实会话） | 上游连接为 `webvpn.swufe.edu.cn:443`，请求行 `GET https://webvpn.swufe.edu.cn/https/<token>/sso/jziotlogin`；响应 `HTTP/2 302`，`location: https://webvpn.swufe.edu.cn/login`（按设计不改写），`detail=set-cookie` 表示真实 Set-Cookie 已触发反向改写 | 2026-09-21 | 真实上游可达但无会话；页面级可达性由 L3/M4 验证 |
| `npm run docs:check` | `0 error(s), 0 warning(s)`（links + 双语配对 + spec 结构） | 2026-09-21 | 含 M1 同步的文档与 Spec 状态 |
| `npm run typecheck` | 无 error | 2026-09-21 | 文档检查脚本类型检查 |

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
实际结果：待执行（M4；M1 已完成其中可自动化的部分：改写链路、反向改写与日志最小化）
```

> 无手工验证时写 `不适用` 并说明理由。

## 边界与异常场景

| 场景 | 期望行为 | 实际结果 | Status |
| ---- | -------- | -------- | ------ |
| EC-001 | 通配开启时 apex `swufe.edu.cn` 命中并按 WebVPN 改写（TC-B04） | L0：`match("swufe.edu.cn", wildcard=True) is True`，`notswufe.edu.cn` / `evilswufe.edu.cn` 为 False（`tests/l0/test_allowlist.py`） | Passed |
| EC-002 | `http://host:8080/x` 生成 `http-8080` scheme token 且可 decode 回主机（TC-A04） | L0：`encode_url("http://host:8080/x")` 含 `/http-8080/<token>/x`，`decode_url` 回 `http://host:8080/x`；`https://host:443/x` 不带端口段、`https://host:8000/x` 带 `-8000`；L1：addon 改写后 `path == /http-8080/<token>/x` | Passed |
| EC-003 | 非 allowlist 主机直连不改写，日志 `rewritten=false`（TC-B03、TC-F02） | L0：`example.com` 等不命中；L1：URL/Cookie/metadata 均不变且 `detail=not-allowlisted`；L2：`http://127.0.0.1:<direct>/plain` 正文原样返回、上游未收到注入 Cookie | Passed |
| EC-004 | 已是 WebVPN 形态的请求直通，不二次包装（TC-D04 相关检查） | L1：`https://webvpn.swufe.edu.cn/https/<token>/x`、`https://authserver.swufe.edu.cn/...`、配置的 `webvpnBase` 主机同名请求均原样透传（`tests/l1/test_addon_request.py::test_ec_004_*`）；客户端直连 webvpn 的响应（无改写元数据）也完全不改写 | Passed |
| EC-005 | 登录 WebView 访问 webvpn/authserver 主机不经本桥（TC-D04） | 未执行：需要 Electron 壳与登录 WebView（M2） | Pending |
| EC-006 | allowlist 为空时拒绝开桥并返回 `ALLOWLIST_EMPTY`，UI 提示添加主机 | L2：sidecar 以退出码 `2` 结束并输出 `swufe-error ALLOWLIST_EMPTY allowlist 为空：请添加主机或启用 *.swufe.edu.cn`（`tests/l2/test_proxy_end_to_end.py`）；UI 提示属 M2/M3 | Passed（M1 部分） |
| EC-007 | Cookie 过期触发 `SESSION_EXPIRED`：停桥 → 清代理 → 停捕获 → 弹窗重登（TC-D03） | 未执行：需要会话采集与系统代理（M2）；M1 仅确认 WebVPN 门户登录 302 不会被反向改写（保留为 M2 的失效信号） | Pending |
| EC-008 | 系统代理已被占用时拒绝启动并提示 `PROXY_CONFLICT`（TC-C01） | 未执行：需要系统代理读写（M2） | Pending |

## 兼容性

| 维度 | 结论 | 依据 |
| ---- | ---- | ---- |
| 接口兼容 | 不适用（首次实现，无既有接口消费方） | 三个接口均为本 Spec 首次定义：[electron-ipc.md](../../docs/api/electron-ipc.md)、[bridge-control-protocol.md](../../docs/api/bridge-control-protocol.md)、[wrd-codec-library.md](../../docs/api/wrd-codec-library.md)；M1 已将 IF-002 从「候选方案」推进为方案 A（首版未定稿，无既有消费方） |
| 数据兼容 | 不适用（首次引入 `AllowlistConfig` / `SessionState` / `AppSettings`，无历史数据） | 无迁移需求：[design.md](design.md) §Data Model Changes、§Migration |
| 行为兼容 | 不适用（首次交付，无历史版本行为需要保持） | Phase 1 是首个交付版本；Linux/TUN/链式代理为 NG（[spec.md](spec.md)） |

## 安全

| 检查项 | 结论 | 依据 |
| ------ | ---- | ---- |
| 输入校验 | M1 已实现并验证 | `swufe_bridge/allowlist.normalize_host`（非法主机名抛 `InvalidHostError`）、`webvpn.swufe.edu.cn`/`authserver.swufe.edu.cn` 硬编码排除（INV-004）；`tests/l0/test_allowlist.py`、`tests/l1/test_addon_request.py` |
| 权限 | 设计已定义；M1 部分验证 | 运行时配置文件以 0600 写入（`write_runtime_config`，`tests/l0/test_config.py`）；CA 安装/卸载需管理员权限（TC-E01/TC-E02，M2）；macOS 进程捕获可能需授权（TC-G04，M3） |
| 敏感数据 | M1 部分验证 | 不存密码（M2 的会话设计）；Cookie 不进日志与诊断行（INV-001，`tests/l1/test_addon_debuglog.py`、`tests/l2/test_proxy_end_to_end.py`）；运行时配置文件 0600；CA 私钥仅本机（mitmproxy confdir，M2 安装/卸载） |
| 回环约束 | M1 已实现并验证 | sidecar 硬编码 `--listen-host 127.0.0.1`（无开关）＋ addon 越界复查（`LISTEN_NOT_LOOPBACK`）；L2 断言代理端口在非回环地址上不可达 |

## 文档同步

| 文档 | 是否需要更新 | 状态 |
| ---- | ------------ | ---- |
| [docs/requirements/](../../docs/requirements/README.md) | 是 | 已同步：REQ-001..REQ-011 / NFR-001..NFR-007 的规范定义在 requirements，本 Spec 只引用 ID（M1 未新增需求） |
| [docs/architecture/](../../docs/architecture/README.md) | 是 | M1 已同步：[components.md](../../docs/architecture/components.md)（代码位置与状态）、[interfaces.md](../../docs/architecture/interfaces.md)（IF-002 方案 A 定稿） |
| [docs/api/](../../docs/api/README.md) | 是 | M1 已同步：[bridge-control-protocol.md](../../docs/api/bridge-control-protocol.md)（方案 A 定稿）、[wrd-codec-library.md](../../docs/api/wrd-codec-library.md)（Python 实现映射） |
| ADR | 是一部分 | M1 未新增 ADR（未改架构/公共接口/数据模型/安全模型）；IF-002 的实现方式选择属实现阶段决策，记录于 [bridge-control-protocol.md](../../docs/api/bridge-control-protocol.md) |
| [docs/development/](../../docs/development/README.md) | 是 | M1 已同步：testing-strategy（分层/命名/运行命令与 CI）、coding-conventions（语言/目录/命名/错误处理）、dependency-policy（uv 与依赖登记）、development-workflow（分支与提交、CI） |
| [docs/planning/](../../docs/planning/roadmap.md) | 是 | M1 已同步：[M1 里程碑](../../docs/planning/milestones/M1-mitm-bridge.md) 置 `Done` 并记录证据；[roadmap](../../docs/planning/roadmap.md)、[milestones/README](../../docs/planning/milestones/README.md) 状态行同步 |
| `.en.md` 配对 | 是 | 已同步：`docs/**` 改动均成对更新（`npm run docs:check` 的 i18n 检查通过）；Spec 目录不属双语强制范围 |

## 未验证 / 无法验证项

| 项 | 原因 | 已尝试 | 需要谁决策 |
| -- | ---- | ------ | ---------- |
| L3 教务浏览器验收（TC-G01..G03） | 需要真实西财账号与授权设备完成 CAS/MFA，且设备需信任本机 CA | M1 已就其可自动化部分取证（L0/L1/L2 共 154 用例通过；真实 `webvpn.swufe.edu.cn` 的可达性与门户登录 302 已在手工 smoke 中确认），页面级验收仍待 M4 | cherrchen（测试者本人提供账号与设备） |
| CA 安装/卸载（TC-E01、TC-E02） | 需要测试机管理员权限写入系统信任库 | M1 已确认 CA 由 mitmproxy 在专用 `--confdir` 生成（L2 用其完成 TLS 拦截）；写入系统信任库属 M2 | cherrchen（在自有测试机提权执行） |
| 进程捕获（TC-G04） | 需要平台级授权（macOS 辅助功能/网络扩展类授权） | 未开始（M3） | cherrchen（在测试机授权并验证） |
| 会话 Cookie 名称与失效信号（Q-001 / DQ-001） | 需实机抓取 WebVPN 会话确认具体 Cookie 名与失效信号组合 | M1 已确认「未登录时上游返回 `https://webvpn.swufe.edu.cn/login` 302 且不改写」，可作为信号候选；Cookie 名仍需实机确认 | cherrchen（以实机验证结论回写实现与文档） |
| 系统代理冲突与清除（TC-C01..C04） | 需要 OS 代理读写（M2）与独占系统代理的测试环境 | 未开始（M2） | cherrchen（测试机环境准备） |

## 结论

- [ ] 映射表无 `Pending`
- [x] 执行的命令与结果已记录
- [x] 文档影响已处理
- [ ] Spec 状态可推进到 `Verified`

> 当前：M1 已交付（REQ-006、NFR-002 全量 `Passed`；其余需求的部分自动化用例 `Passed` 并已标注）；M2–M4 未完成，因此 Spec 保持 `In Progress`，不推进到 `Verified`。
