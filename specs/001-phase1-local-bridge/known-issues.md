# Known Issues: Phase 1 本机桥（001-phase1-local-bridge）

> Spec ID: 001
> Status: In Progress
> Owner: cherrchen
> Last Updated: 2026-09-21

> 本文件是 T039 要求的**已知问题登记表**：每个已知问题一行，按 `KI-1xx` 编号单调递增、不复用。
> 规则：`severity` ∈ `P0` / `P1` / `P2`；`status` ∈ `Open` / `Fixed` / `Accepted` / `Deferred`。
> 「已记录」不等于「已修复」：`Deferred` 与 `Accepted` 必须在 `note` 里写清原因与解除条件，且同步到
> [verification.md](verification.md) 的「未验证 / 无法验证项」。`Fixed` 条目必须写明修复点与复验方式。

## 登记表

| id | title | severity | status | linked_case | owner | note |
| -- | ----- | -------- | ------ | ----------- | ----- | ---- |
| KI-001 | Windows 真机项未验证（TC-G03 及 Windows 侧 C02..C04/E01/E02/G04） | P0 | Deferred | TC-G03、TC-C02..C04、TC-E01/E02、TC-G04 | cherrchen | 机器不在本轮可访问环境。已尝试：实现与单测完成（`app/test/system-proxy-parse.test.ts`、`cert-parse.test.ts`）、Windows 步骤已写入 [development-run.md](../../docs/operations/development-run.md) 与 [verification.md](verification.md) 的 M4 手册。解除条件：Windows 机可访问 + 按 development-run.md 备好 Node ≥ 22 与 `uv sync` + 跑 `npm run acceptance:check` + 手册的教务浏览器段。M4 出口口径 = 「至少一侧桌面 OS 通过」，Windows 未完成必须在里程碑完成记录中显式标注 |
| KI-002 | 进程捕获真实范围未验证（只有所选应用经桥） | P1 | Fixed | TC-G04 | cherrchen | M4 实机通过（2026-09-21，CDP 驱动 + 手工）：切到「指定应用」后系统代理为 `Enabled: No`（互斥），`localCaptureEnabled=true`；被选中的 Google Chrome 请求出现在桥日志（`jwxt.swufe.edu.cn rewritten=true` + `response body`），未选中的 `curl` 直连 `jwxt.swufe.edu.cn` 失败且桥日志无对应行。本机未出现扩展授权提示（扩展此前已授权），授权引导文案的复验见 NFR-005 的 M3 记录 |
| KI-003 | 日志面板与真实桥的端到端联动未验证 | P1 | Fixed | TC-F04 | cherrchen | M4 实机通过：真实桥流量下 `#log-rows` 累计到 200 条上限且最新在前，行内容只有「时间 / 域名 / 结果」（例：`jwxt.swufe.edu.cn` `响应改写（body）`），关闭开关后面板隐藏且行数归 0，再打开可见且为 0 行 |
| KI-004 | `kill -TERM` / `SIGKILL` 不触发 JS 清理，系统代理残留到下次启动 | P2 | Accepted | NFR-004 | cherrchen | 已由 `recoverOnLaunch()` 自愈并实测；第一期接受该行为（进程被强杀时没有可执行的清理时机）。M4 另实测：`SIGTERM`（hub restart/stop）会走 `before-quit` 清理并清空代理 |
| KI-005 | Windows 不广播 `WM_SETTINGCHANGE`，已运行浏览器可能需重启才感知代理 | P2 | Accepted | TC-C02（Windows） | cherrchen | 实现已知限制（`app/src/main/platform/win32/system-proxy.ts` 头注释）；随 KI-001 在真机复验 |
| KI-006 | 会话 Cookie 名与另外两个失效信号未在实机确认（Q-001） | P2 | Open | TC-D01/TC-D03 | cherrchen | M4 已采集（只记名不记值）：`wengine_vpn_ticketwebvpn_swufe_edu_cn`、`route`、`show_vpn`、`heartbeat`、`show_faq`（域 `.webvpn.swufe.edu.cn` / `webvpn.swufe.edu.cn`，共 5 条）；已确认的失效信号 = 探测 `GET https://webvpn.swufe.edu.cn/` 得 `302 → /login`（日志原文：`会话探测：status=302 location=https://webvpn.swufe.edu.cn/login → expired`）。另两个信号（Set-Cookie 清空、连续改写后 302 到 CAS）本轮未观测到；Q-001 收敛前保持 `Open` |
| KI-007 | 自动安装 CA 失败：提权子进程无法弹出信任设置授权（须手动执行应用给出的命令） | P1 | Open | TC-E01 | cherrchen | 实测（macOS 15.6）：osascript `with administrator privileges` 能写入钥匙串，但随后 `SecTrustSettingsSetTrustSettings: The authorization was denied since no user interaction was possible. (1)`，界面显示「已安装，但系统尚未信任」并给出 `sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain <caCert>`。TC-E01 以该手动命令通过（`verify-cert` 成功、`getCaStatus() = {installed:true,trusted:true}`）。建议修复方向：改为由应用进程直接调用 `security`（让 SecurityAgent 在本 App 的 GUI 会话内弹授权，而不是在 osascript 子进程内），属安全模型变更，需 ADR。解除条件：按上述方向实现并在真机复验 |
| KI-008 | 会话探测未携带登录分区 Cookie，真实会话被误判过期（桥启动后数十秒即被停） | P0 | Fixed | TC-D02/TC-D03、AC-008 | cherrchen | 根因：Electron `net.request` 默认 `useSessionCookies: false`，探测请求不带 `persist:swufe-login` 的 Cookie → 门户一律返回 `302 → /login` → `SESSION_EXPIRED` 级联（停桥、清代理、清会话、弹窗）。修复：`app/src/main/session-broker.ts` 的 `probe()` 显式 `useSessionCookies: true`。复验：同一 Cookie 修前 302、修后 200（隔离实验见 verification.md 的 M4 记录）；真机上桥连续跨越 ≥5 个探测周期（8s）保持 `running`。影响面：修复前每次登录后 ≤30s（默认探测间隔）就会自毁，属首用即失败级别 |
| KI-009 | 登录窗初始加载被跨站重定向中断（ERR_ABORTED）被判致命：误导性报错 + 页面停在只有扫码入口的初始渲染 | P1 | Fixed | TC-D01 | cherrchen | 现象：点「登录 WebVPN」后界面显示「打开登录窗口失败：ERR_ABORTED (-3) loading 'authserver…'」，而 CAS 页停在服务端初始 HTML（`tabHead` 仍为 `display:none`，只有微信扫码，无账号/密码入口）→ 用户无法用账号登录。修复：`openLogin()` 只把「窗口已关闭」与 `ERR_ABORTED` 视为非致命（`isAbortError`），真实错误照旧抛出。复验：修复后登录窗自动显示「账号登录/验证码登录 + 用户名/密码」（`#username` 可见、`tabHead` 为 `block`），`#message` 不再出现报错 |
| KI-010 | 卸载 CA 无法取得证书指纹（`security find-certificate` 缺 `-Z`） | P1 | Fixed | TC-E02 | cherrchen | 根因：macOS 15.6 下不带 `-Z` 时 `security find-certificate -a -c mitmproxy /Library/Keychains/System.keychain` 只打印属性 dump，没有 `SHA-1 hash:` 行 → `parseFindCertificate().sha1` 为 `null` → 界面报「卸载失败：未能取得系统信任库中的证书指纹。」且永远无法卸载。修复：`app/src/main/platform/darwin/cert.ts` 的选择器加 `-Z`（并补测：带 `-Z` 的输出形态与不带 `-Z` 的形态各一例，均为实测）。复验：卸载成功（钥匙串 `wc -c` = 0、UI 显示「未安装」、`getCaStatus() = {installed:false}`）。残留观察：卸载后 `security verify-cert` 仍返回成功（信任设置项残留），但钥匙串已无该证书，UI 判定以钥匙串为准 |
| KI-011 | 网关客户端 shim 与透明桥不兼容：教务首页白屏、页面不可交互（阻塞 TC-G01/G02） | P0 | Open | TC-G01、TC-G02、AC-007 | cherrchen | 实测：网关对每个 HTML 页面注入 `__vpn_*` 变量与 `<script src="/wengine-vpn/js/main.js?ver=…">`（`__vpn_protocol_host=https://webvpn.swufe.edu.cn`），该 shim 期望浏览器工作在 WebVPN URL 空间。透明桥把相对路径 `/wengine-vpn/js/main.js` 加上 token 前缀 → 经桥 **404**（网关根直取为 **200 / 376922B**）→ shim 永不启动。结果：`http://jwxt.swufe.edu.cn/` 白屏（925B shim 页）；`/xtgl/index_initMenu.html` 经桥返回 200/76854B 且体已被反向改写，但页面脚本依赖 shim → 渲染出来但不可交互（cherrchen 实测：未登录、用户状态不正确、任何控件点击无效、未出现 CAS 登录页）。候选解除路径：(a) 网关自有路径（`/wengine-vpn/...`）不经 token、直接取自网关根；(b) 在改写后的 HTML 中剥离 shim；(c) 接受教务在 WebVPN URL 空间（门户形态）使用。三者都改公共契约（REQ-007/INV-004），需 cherrchen 决策后再实现 |
| KI-012 | 个别直连主机经 mitmproxy 无响应（实测 `www.swufe.edu.cn`） | P2 | Open | — | cherrchen | 实测：`curl http://www.swufe.edu.cn/` 直连 200（0.22s），经桥 0 字节超时；同一台机器上**不带 addon** 的裸 mitmdump 同样复现（`server connect www.swufe.edu.cn:80 (125.69.85.81:80)` 后无响应），而 `example.com` / `baidu.com` / `google.com` 经桥正常。故与桥代码无关，疑为上游/WAF 行为；不在验收路径上（教务经网关、登录走 authserver） |
| KI-013 | 本机 Clash/mihomo TUN + fake-ip DNS 与桥共存会导致上游挂起，且冲突检测不覆盖 TUN | P1 | Open | 验收环境前置条件 | cherrchen | 实测：TUN 开启时上游域名被解析到 `198.18.0.0/15`（Clash fake-ip），经桥请求大面积挂起（含教务）；cherrchen 关闭 TUN/系统代理后 `webvpn.swufe.edu.cn` 等路径立即恢复。`PROXY_CONFLICT` 只检测系统代理，不检测 TUN/虚拟网卡 → 建议：开桥前的环境预检或错误文案补充「请关闭 VPN/代理工具的 TUN 模式」，并把该前置条件写入 [development-run.md](../../docs/operations/development-run.md) |

## 验收期新增

本轮 M4 验收（macOS 交互式 + Windows 延期）新发现的问题按 `KI-1xx` 追加到上表，并在 [verification.md](verification.md) 的映射表与「执行的命令与结果」中对齐。
