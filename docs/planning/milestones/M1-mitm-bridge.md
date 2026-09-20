# M1: 桥核心（Bridge Core）

> Status: Done
> Owner: cherrchen
> Target: TBD（原包未定义日期）｜完成于 2026-09-21

## 目标

让桥在没有桌面壳的情况下先跑通，保证改写逻辑正确且可回归：

- mitm 工程骨架 + 薄 WRD addon：对命中 allowlist 的请求生成 WebVPN URL、改上游为 `webvpn.swufe.edu.cn`、附加 WebVPN Cookie（REQ-006）；
- 响应反向改写必做：`Location`、`Set-Cookie` 的 Domain/Path、HTML/JS/JSON 中的校内绝对 URL（REQ-007）；
- 只改写 allowlist 主机，其余直连；登录相关主机不做二次包装（REQ-005、REQ-008）；
- L0/L1 自动化测试可稳定重跑。

## 包含的 Specs

| Spec | 状态 | 依赖 |
| ---- | ---- | ---- |
| [001-phase1-local-bridge](../../../specs/001-phase1-local-bridge/spec.md) | In Progress | M0（已完成） |

## 退出条件

- [x] `curl` 经本地桥 + 真实或模拟 WebVPN 访问 allowlist 主机成功（TC-F01，P0）——假上游：`tests/l2/test_proxy_end_to_end.py`；真实 `webvpn.swufe.edu.cn`：见「完成记录」的手工 smoke（返回门户登录 302，无真实会话）
- [x] 非 allowlist 主机不改写、按直连语义处理（TC-F02，P0）——L2 断言正文与上游 Cookie 均为空
- [x] L0 通过：codec 向量（TC-A01..TC-A05）与 allowlist 匹配函数（TC-B01..TC-B04）——74 passed
- [x] L1 通过：addon 对录制流量 / 假上游的请求改写与响应反向改写（含 `Location` 反向改写 TC-F03）——74 passed
- [x] 响应改写优先级落地：`Location` → `Set-Cookie` Domain/Path → HTML/JS/JSON 绝对 URL → 其它内容类型不改写（REQ-007）——`swufe_bridge/addon.py` 按序执行并以 `swufe-debug.detail` 报告
- [x] 防环成立：`webvpn.swufe.edu.cn` / `authserver.swufe.edu.cn` 与已是 WebVPN 形态的请求直通（REQ-008）——L1 `test_ec_004_*`
- [x] 相关文档已同步（含双语配对）；无阻塞类缺陷——`npm run docs:check` 0 error / 0 warning

## 风险

| 风险 | 影响 | 应对 |
| ---- | ---- | ---- |
| R1 教务前端大量动态绝对 URL（中/高） | 响应改写漏改时浏览器跳飞到不可达地址，G-001 不成立 | 响应改写分层（先保导航路径）；必要时降级为「书签式 WebVPN URL」辅助 |
| R2 Cookie 字段变更（中/高） | 会话注入失效，改写请求被判未登录 | 会话探测与 Cookie 读取集中在 Session Broker 一处，便于快速补丁与重登 |
| R6 默认密钥轮换（低/中） | 改写与解码失败 | `wrdKey`/`wrdIv` 配置可覆盖并支持热更新（见 [ADR-0005](../../architecture/adr/ADR-0005-builtin-wrd-key-with-override.md)） |

## 完成记录

**完成时间**：2026-09-21（macOS arm64 / Python 3.13 / uv 0.11.3）。

### 交付物

| 类别 | 内容 |
| ---- | ---- |
| 工程 | `pyproject.toml` + `uv.lock` + `.python-version`（运行期 `mitmproxy==12.2.3`、`cryptography==48.0.1`；dev `pytest==9.1.1`） |
| 实现 | `swufe_bridge/wrd_codec.py`（T003）、`swufe_bridge/allowlist.py`（T005）、`swufe_bridge/config.py`（T006/T012 数据层）、`swufe_bridge/rewrite.py`（T009–T011 逻辑层）、`swufe_bridge/addon.py`（T008–T012）、`swufe_bridge/sidecar.py`（T007） |
| 控制面 | 方案 A 定稿：配置文件热加载 + `swufe-ready` / `swufe-error` / `swufe-debug` stderr 行 + 退出码（[bridge-control-protocol.md](../../api/bridge-control-protocol.md)）；`--listen-host 127.0.0.1` 由 sidecar 硬编码（无开关） |
| 测试 | `tests/l0/`（codec/allowlist/config）、`tests/l1/`（请求改写、响应反向改写、日志最小化、配置热更新）、`tests/l2/`（真 mitmdump + curl + 假上游） |
| CI | [.github/workflows/python-tests.yml](../../../.github/workflows/python-tests.yml)：每次 PR / main 推送跑 `uv sync --frozen` + `uv run pytest tests/l0 -q`（T034） |

### 验证命令与结果（2026-09-21）

| 命令 | 结果 |
| ---- | ---- |
| `uv sync --frozen` | 通过（lock 与 pyproject 一致；48 packages checked） |
| `uv run pytest tests/l0 -q` | **74 passed** |
| `uv run pytest tests/l1 -q` | **74 passed** |
| `uv run pytest tests/l2 -q` | **6 passed** |
| `uv run pytest -q` | **154 passed** |
| `uv run python -m swufe_bridge.wrd_codec decode '<authserver 样本 URL>'` | `https://authserver.swufe.edu.cn/authserver/login?service=http%3A%2F%2Fjwxt.swufe.edu.cn%2Fsso%2Fjziotlogin`（退出码 0） |
| `npm run docs:check` | 0 error / 0 warning（links + 双语配对 + spec 结构） |
| `npm run typecheck` | 无 error |

### 手工 dev smoke（真实与假上游）

假上游（`http://127.0.0.1:18090` 模拟 WebVPN，`webvpnBase` 指向它）：

```text
swufe-ready {"listen_host": "127.0.0.1", "listen_port": 18082, "config": "...", "allowlist": ["jwxt.swufe.edu.cn"], "cookies": 1, "debug": true}
swufe-debug {"host": "jwxt.swufe.edu.cn", "rewritten": true, "direction": "request", "detail": null}
swufe-debug {"host": "jwxt.swufe.edu.cn", "rewritten": true, "direction": "response", "detail": "location"}
# 假上游观测：path=/https/7772...7752/sso/jziotlogin?x=9  cookie=wrdvpn_session=SMOKE-SESSION-VALUE
# curl 响应：HTTP/2 302，location: https://jwxt.swufe.edu.cn/next（Location 反向改写生效）
```

配置热更新（不重启，写入新配置文件后下一个请求即生效）：cookie 由「带 domain 的配置项」改为「无 domain 的配置项」后，同一进程的下一个请求上游即收到 `wrdvpn_session=SMOKE-SESSION-VALUE`。

真实 `webvpnBase`（`https://webvpn.swufe.edu.cn`，无真实 WebVPN 会话）：

```text
swufe-debug {"host": "jwxt.swufe.edu.cn", "rewritten": true, "direction": "request", "detail": null}
[warn] server connect webvpn.swufe.edu.cn:443
swufe-debug {"host": "jwxt.swufe.edu.cn", "rewritten": true, "direction": "response", "detail": "set-cookie"}
GET https://webvpn.swufe.edu.cn/https/7772...7752/sso/jziotlogin  →  HTTP/2.0 302 Found
# curl：location: https://webvpn.swufe.edu.cn/login（WebVPN 门户登录页；按设计不改写，即 M2 的会话过期信号）
```

即：改写后的请求确实落在真实 `webvpn.swufe.edu.cn` 上（上游见 WRD 形态），未登录时上游返回门户登录 302，且该响应的 `Set-Cookie` 已按真实上游行为触发反向改写。真实会话下的页面级可达性仍由 L3（M4）验证。

### 实现期决策与偏差（记录）

| 项 | 结论与依据 |
| ---- | ---- |
| 上游连接策略 | sidecar 固定 `--set connection_strategy=lazy`。mitmproxy 默认 eager，会在请求改写前先连**原始**主机：既向 allowlist 主机发起直连泄漏，又会在该路由被阻断时让首次导航挂起（M1 手工 smoke 实测 60s 无响应）。lazy 后唯一的上游连接是改写后的 WebVPN 主机 |
| Cookie 注入域判定 | 判定为「cookie domain 是上游 WebVPN 主机的同级或上级域」（`.swufe.edu.cn` 覆盖 `webvpn.swufe.edu.cn`；`jwxt.swufe.edu.cn` 不覆盖），与浏览器发送语义一致 |
| 回环约束验证方式 | L2 无法用「连本机非回环地址应失败」直接断言：测试机存在 TUN 型代理工具（`198.18.0.1`）会接受任意地址的连接。改为断言「至少一个真实网卡地址拒绝连接」（TUN 地址被接受不影响判定）；无外网/TUN 环境下可退回简单探测 |
| 未收录 | `ctx.master.shutdown()` 兜底保留（`LISTEN_NOT_LOOPBACK`），L2 未触发；按方案 A，回环的权威强制在 sidecar 硬编码 |

### 遗留问题（移交 M2–M4）

- Q-001 会话 Cookie 名称与失效信号仍需实机确认（M2 的 Session Broker + L3）。
- Q-002 sidecar 分发形态（嵌入式 Python / 外置 mitmproxy）仍待决（M4）。
- 真实教务页面在真实会话下的可达性与导航不跳飞属 L3（M4，TC-G01/TC-G02/TC-G03）。
- CA 安装/卸载（TC-E01/TC-E02）与进程捕获（TC-G04）需要管理员权限与 Electron 壳，属 M2–M4。
