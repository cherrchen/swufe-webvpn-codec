# 开发版运行说明（development run）

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-23
>
> English counterpart: [development-run.en.md](development-run.en.md)

**用途**：让开发者或验收者在一台干净机器上启动**真实**的开发版应用（Electron 应用 + 本机 mitmproxy sidecar），并知道如何自检、排障与完整重置。
**范围**：macOS 与 Windows 的开发/验收运行；第一期无安装包，本文件描述的是从仓库运行的路径。配置项含义与落点见 [README.md](README.md)，接口见 [bridge-control-protocol.md](../api/bridge-control-protocol.md)。

---

## 1. 前置条件

| 项 | 要求 | 说明 |
| -- | ---- | ---- |
| Node.js | ≥ 22（本机实测 v24.18.0） | 应用（Electron）与仓库脚本（`scripts/`）都要求 |
| `uv` | 任意近期版本 | 用于创建仓库根的 Python 环境并运行 sidecar/CA 入口 |
| Python 环境 | 仓库根执行过 `uv sync --directory bridges/python`（生成 `bridges/python/.venv/`） | 应用默认用 `<repo>/bridges/python/.venv/bin/python -m swufe_bridge.sidecar` 拉起桥 |
| 平台 | macOS 或 Windows | Linux 不在第一期范围 |
| 网络 | 能访问 `https://webvpn.swufe.edu.cn` | 教务 `jwxt.swufe.edu.cn` 在校园网外不可直连，必须经 WebVPN |
| 代理工具 | **必须先关闭其它代理工具的 TUN / 虚拟网卡模式**（Clash、mihomo、sing-box、Stash 等） | 实测：TUN 的 fake-ip DNS（`198.18.0.0/15`）会让经桥的上游连接挂起。开桥前会解析网关主机，命中 fake-ip 段即以 `PROXY_CONFLICT` 拒绝（[ADR-0011](../architecture/adr/ADR-0011-refuse-start-on-fake-ip-dns.md)）；该预检只覆盖 fake-ip 形态，`redir-host` 模式的 TUN 仍需按本前置条件手动关闭（见 `KI-013`） |
| 账号 | 测试者自有的西财统一身份认证账号（含 MFA） | 不写入仓库 |

## 2. 首次准备

```bash
uv sync --directory bridges/python   # 创建 bridges/python/.venv/（sidecar、WRD codec、CA 生成入口）
pnpm install                         # 安装全部 workspace 项目（仓库根 + apps/desktop/：Electron / TypeScript / esbuild / tsx）
```

- `pnpm install` 不下载 Electron 二进制：若 `apps/desktop/node_modules/electron/dist` 缺失，手动补一次
  `node apps/desktop/node_modules/electron/install.js`。
- 之后日常只需 `pnpm start`（它会先 build 再启动）。

## 3. 启动

```bash
pnpm start                                        # 使用默认 userData
pnpm start --user-data-dir=/tmp/swufe-dev         # 使用隔离 profile
```

- `pnpm start` = `pnpm run build && electron .`（仓库根脚本转发到 `apps/desktop`）；其后的参数原样传给 Electron。
  **不要写成 `pnpm run start -- --user-data-dir=…`**：pnpm 会插入自己的 `--` 分隔符，Electron 收到字面 `--` 后不再解析 Chromium 开关（例如 `--remote-debugging-port` 会静默失效）。
- 隔离 profile（`--user-data-dir`）不污染日常配置，验收与复验都推荐使用；它同时隔离 `config.json`、`bridge-config.json`、`mitmproxy/` CA 与登录分区。
- 环境变量（等价覆盖，见 [apps/desktop/README.md](../../apps/desktop/README.md)）：

| 变量 | 作用 |
| ---- | ---- |
| `SWUFE_USER_DATA_DIR` | 等价于 `--user-data-dir <dir>` |
| `SWUFE_REPO_ROOT` | 覆盖仓库根路径（默认取应用目录上两级，即仓库根） |
| `SWUFE_PYTHON` | 指定运行 sidecar / CA 生成入口的解释器（默认 `<repo>/bridges/python/.venv/bin/python`，缺失时回退 `uv run --project <repo>/bridges/python python`） |
| `SWUFE_PROBE_INTERVAL_MS` | 已停用。会话是否仍有效由票据过期时间决定，不再定时探测门户 |
| `SWUFE_RENDERER_URL` | 渲染层加载来源：设置后 Main 改为 `loadURL('<url>/<entry>.html')` 并使用开发期 CSP（默认加载静态产物 `apps/desktop/dist/renderer/*.html`）。只影响渲染层加载路径，不影响桥、sidecar 与系统代理 |

### 3.1 渲染层开发（HMR，M6 起）

```bash
pnpm --filter swufe-webvpn-bridge run dev:renderer        # vite dev server，固定 127.0.0.1:5173（strictPort）
SWUFE_RENDERER_URL=http://127.0.0.1:5173 pnpm start       # 另开一个终端；改渲染层代码即时热更新
```

- 渲染层现在是 React + Ant Design 的四窗口（`src/renderer/{main,capture,logs,allowlist}.html`），构建产物在 `apps/desktop/dist/renderer/`（四个 HTML + `assets/*`，含 antd 共享 chunk）。
- **生产/日常运行不变**：仍是 `pnpm start`（先 `pnpm run build` —— `tsc -p tsconfig.json && vite build && pnpm run build:preload` —— 再 `electron .`，加载静态产物）；`dev:renderer` + `SWUFE_RENDERER_URL` 只是为了在改渲染层代码时免于整包重建与重启。

## 4. 需要管理员权限的操作

| 操作 | 平台行为 |
| ---- | -------- |
| 安装本机 CA | 先在界面弹出风险提示模态；确认后分两步（[ADR-0008](../architecture/adr/ADR-0008-ca-trust-authorization-in-app-session.md)）：① osascript 的 `do shell script … with administrator privileges` 提权执行 `security add-certificates -k /Library/Keychains/System.keychain <caCert>` 把证书写入系统钥匙串（**会弹出系统管理员授权窗口**，取消即中止、不产生任何写入）；② 由**应用进程自己**执行 `security add-trusted-cert -d -r trustRoot <caCert>` 写入管理域信任设置（不带 `-k`，不改动钥匙串；授权由 macOS 面向本 App 的会话处理） |
| 卸载本机 CA | 同样提权执行 `security delete-certificate -Z <sha1>`（只删钥匙串；管理域信任项无法经 CLI 清除，残留观察见 `KI-010`） |
| 进程捕获（「指定应用」） | macOS 首次启用时 mitmproxy 会安装并激活网络扩展，需在授权提示内**在 5 秒内确认**；超时即失败，界面给出引导与「重试」。Windows 侧需要 UAC 提权（见 [ADR-0006](../architecture/adr/ADR-0006-local-capture-mode-and-mutual-exclusion.md)） |

> Windows 的 CA 安装写入**当前用户**根存储（`certutil -user -addstore Root <caCert>`），不弹管理员密码框，但会弹系统「安全警告」对话框（需点「是(Y)」）；卸载为 `certutil -user -delstore Root <指纹>`，同样会弹「根证书存储」确认框。两处都是等人点击的步骤，应用侧按 120s 的超时等待（`KI-021`）。

## 5. 验证与自检

```bash
pnpm run acceptance:check --out <dir> --user-data-dir <profile>
```

- 该脚本采集一份脱敏的验收证据报告（`<dir>/acceptance-<platform>-<时间戳>.md`）：OS/版本、`config.json` 与 `bridge-config.json` 的关键字段、CA 文件与系统信任库、每个网络服务的系统代理状态、桥端口是否在监听、经桥与直连的 curl 对照、sidecar 残留进程。
- 报告**不含** Cookie 值、`wrdKey` / `wrdIv` 值或任何 `Set-Cookie` / `Cookie` / `Authorization` 头的值（NFR-003 / INV-001）；脚本末尾的 `redaction-self-check` 项若发现泄漏会以 `FAIL` 结束（退出码 1）。
- 开关：`--port`（默认 8080）、`--host`（默认 `jwxt.swufe.edu.cn`）、`--scheme`（默认 `https`；**教务 `jwxt.swufe.edu.cn` 经本网关只能以 `http` 形态代理，验收该主机须加 `--scheme http`**）、`--user-data-dir`（默认 macOS `~/Library/Application Support/swufe-webvpn-bridge`、Windows `%APPDATA%\swufe-webvpn-bridge`）、`--save-body`（默认关闭；保存的正文可能含个人信息，**不要入库**）。
- 平台差异：脚本在 Windows 上给 curl 自动追加 `--ssl-no-revoke`（Windows 自带 curl 使用 Schannel，校验刚生成的本机 CA 时会以「未知吊销状态」失败，退出码 60）；Windows 的 `runtime-config` / `ca-files` 段以 `INFO` 报告权限位（POSIX 模式位在 Windows 由系统合成、不代表 ACL，等价保护来自 `%APPDATA%` 的每用户 profile ACL）。
- 验收的完整步骤（含教务浏览器验收与结果表）见 [specs/001-phase1-local-bridge/verification.md](../../specs/001-phase1-local-bridge/verification.md) 的「M4 双平台验收执行手册」；Windows 侧实测记录见同文件的「M4 Windows 验收执行记录（2026-09-23）」。若报告出现 `FAIL bridge-smoke 上游 502（KI-019 有界失败）`，说明上游建连在有界时间内失败（上限 4s × 2 次尝试，超时对客户端表现为 `502 Bad Gateway`），**不是** `curl` 空等；按下一段的阶段复测判因，不要直接判定桥故障。

### 经桥挂起的阶段复测（`KI-019`）

应用在运行、桥为「桥接中」、系统代理已启用且会话有效时：

```bash
pnpm run diagnose:upstream --user-data-dir <profile> --rounds 40 --scheme http
```

- 每轮固定节奏：DNS → TCP → TLS → 经桥请求 → 再测 DNS/TCP/TLS → 同路径直连对照；输出逐轮判定 `no-stall` / `bridge-side` / `network-or-resolver`，异常轮次额外打印 `<userData>/bridge-upstream.log` 中该轮的阶段记录与 `Get-NetRoute` 实测。证据写到 `--out`（默认系统临时目录；**不得**指向仓库内）的 `diagnose-upstream-<platform>-<时间戳>.jsonl`。
- 直连对照**不带 Cookie**：网关对无 Cookie 的 WRD 请求一律回 `302 → https://<网关>/login`（并下发新 ticket），因此该对照只用于度量**路径健康度**（DNS/TCP/TLS/首字节），本身不代表会话失效。会话是否过期由**经桥响应**判定（经桥拿到 `302 → 网关登录页` 才判定过期并终止）；经桥无响应头（`(无状态行)`）属于挂起样本，不触发终止。
- 桥未运行（端口连续 3 轮不可连）、会话已过期（经桥响应 `302 → 网关登录页`）或 `--user-data-dir` 内缺 `bridge-config.json` / CA 时，脚本明确报错并终止，不产生结论。
- 复测环境必须与历史失败轮同形：默认路由直连、无 TUN 路由（`Get-NetRoute -AddressFamily IPv4` 的 `0.0.0.0/0` 行）。
- 判据：`bridge-side` = 该轮桥请求异常而同轮直连对照（DNS/TCP/TLS）健康；`network-or-resolver` = 同轮直连对照也不健康或 DNS ≥ 2s。据此区分本地与外部原因，再更新 `KI-019`。

## 6. 常见故障

| 现象 | 原因 | 处置 |
| ---- | ---- | ---- |
| 开桥后状态条「错误」+ `CA_MISSING` | 未安装本机 CA | 点「安装本机 CA」并输入管理员密码；未安装前桥不会改动任何系统设置 |
| 开桥被拒 + `PROXY_CONFLICT` | 系统代理已被其它软件占用，或网关主机解析到 fake-ip 段（`198.18.0.0/15`，TUN 模式） | 先关闭该软件的系统代理**与 TUN 模式**；界面弹出的冲突模态会说明这一点，且本 App 不会改动已被占用的设置 |
| 开桥被拒 + `NOT_LOGGED_IN` | 未完成 WebVPN（CAS/MFA）登录 | 点「登录 WebVPN」完成登录 |
| 开桥被拒 + `ALLOWLIST_EMPTY` | allowlist 为空 | 添加至少一个主机，或勾选 `*.swufe.edu.cn` |
| 登录窗样式错乱 / 弹层文字重叠 | CAS 主题静态资源在应用与桥之外的传输路径间歇截断（`ERR_INCOMPLETE_CHUNKED_ENCODING`，`KI-014`） | 关闭登录窗后重新点「登录 WebVPN」重载一次；外部传输路径稳定前保留该规避 |
| 状态条「错误」+ `BRIDGE_CRASH` | sidecar 异常退出，或 `bridgePort` 被占用 | 打开「调试日志」查看桥输出；若是端口占用，修改 `<userData>/config.json` 的 `settings.bridgePort` 后重试 |
| `swufe-error CONFIG_INVALID` | 运行时配置非法（如 `capture.processes` 含逗号） | 修正 `<userData>/config.json` 的对应设置后重新开桥 |
| sidecar 起不来 / 提示找不到 python | `bridges/python` 未执行过 `uv sync`，或 `SWUFE_PYTHON` 指向不存在的解释器 | 在仓库根执行 `uv sync --directory bridges/python`，或修正 `SWUFE_PYTHON` |
| 关闭应用后系统代理仍指向本桥 | 上次以 `kill -TERM` / `kill -9` 结束，未触发 JS 清理（已记入已知问题） | 下次启动时 `recoverOnLaunch()` 会依据「由本 App 设置」标记自动清除；也可手动 `networksetup -setwebproxystate <服务> off`（Windows：把 `HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings` 的 `ProxyEnable` 置 0） |
| 点「安装/卸载本机 CA」后界面报「命令超时（120000ms）：certutil」（Windows） | 该系统对话框本身在等人点击：安装前是「安全警告」（列出证书指纹，点「是(Y)」/「否(N)」），删除前是「根证书存储」确认框；`certutil` 在此期间阻塞，应用按 120s 超时等待（`KI-021`，2026-09-23 修复：此前该处用默认 10s，人手还没点完进程就被杀） | 出现对话框时点「是(Y)」即可（2 分钟内都有效）；若确已超时，手动执行同一命令：安装 `certutil -user -addstore Root <userData>\mitmproxy\mitmproxy-ca-cert.cer`、卸载 `certutil -user -delstore Root <指纹>`（同样弹对话框；不需要管理员权限），随后界面刷新 |
| 浏览器首次打开教务页长时间无响应（数十秒无内容） | 经桥请求偶发挂起（`KI-019`）：桥已把上游各阶段的耗时与对端地址写入 `<userData>/bridge-upstream.log`（`swufe-upstream` 记录），可用于区分「桥内建连」「网关已连但不响应」与「本机网络/解析」 | 先重载页面（历史上重载即恢复）。再按日志判因：出现 `connect_timeout` / `connect_retry` / `connect_failed` ⇒ 建连有界化已生效（客户端在 8s 内拿到 `502`，不再空等）；只有连接阶段记录而缺 `response`、`error` 为 `client disconnected` ⇒ 网关已连不响应（该阶段无法被中断，见 `docs/api/bridge-control-protocol.md`），重载/重开即可；仍复现则跑 `pnpm run diagnose:upstream` 取得同轮直连对照后再下结论 |
| 「指定应用」捕获下浏览器打不开教务（`ERR_NAME_NOT_RESOLVED`） | 进程捕获不做 DNS 拦截：浏览器必须先自行解析主机名，而 `jwxt.swufe.edu.cn` 无公网解析记录 | 教务走默认的「系统代理（全部流量）」模式（浏览器把主机名交给桥，桥再映射到网关）；捕获模式适合能本地解析的主机 |
| 界面显示「进程捕获：启用失败」 | 系统扩展未授权 / 授权超时（macOS） | 按界面引导在「系统设置 → 通用 → 登录项与扩展」中允许，然后点「重试」。捕获失败不影响系统代理路径（桥仍为「桥接中」） |

## 7. Windows 差异

| 维度 | Windows 行为 |
| ---- | ------------ |
| 系统代理 | 通过 WinINET 注册表（`HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings` 的 `ProxyEnable` / `ProxyServer`）读写，不动其它设置 |
| 生效时机 | **不广播 `WM_SETTINGCHANGE`**：已经在运行的浏览器可能继续使用旧代理，需要重启浏览器才感知 |
| CA | 写入当前用户根存储（`certutil -user`），不需要管理员；macOS 走系统钥匙串，安装时先提权写钥匙串、再由应用进程写入信任设置（见 [ADR-0008](../architecture/adr/ADR-0008-ca-trust-authorization-in-app-session.md)） |
| 进程捕获 | 需要以管理员身份启动应用（UAC；`local:` 模式在 Windows 用 pydivert 重定向所选进程）。已验证：互斥（捕获态下不动系统代理）、正向（所选 `chrome.exe` 的请求经桥）、反向（未选中的 `curl` 直连不经桥）——见 [verification.md](../../specs/001-phase1-local-bridge/verification.md) 的「M4 Windows 验收执行记录」 |
| 捕获模式的 DNS | 捕获不做 DNS 拦截，所选进程必须能自行解析主机名：`jwxt.swufe.edu.cn` 无公网解析（`ERR_NAME_NOT_RESOLVED`）→ 教务用默认的「系统代理」模式 |
| 浏览器 https 升级 | Chrome / Edge 会把 `http://jwxt.swufe.edu.cn/` 自动升级为 `https://`，而该网关不支持以 https 代理教务（返回 `/wengine-vpn/failed`）；验收时用 `--disable-features=HttpsUpgrades` 或关闭「始终使用安全连接」 |
| curl 校验本机 CA | Windows 自带 curl 使用 Schannel，`--cacert <本机 CA>` 会以「未知吊销状态」失败（退出码 60）：手动命令需加 `--ssl-no-revoke`（`pnpm run acceptance:check` 已自动附加） |
| 文件权限 | 无 POSIX 模式位语义（`stat` 由系统合成 `0o666`）；会话文件与 CA 私钥的「仅本机用户」由 `%APPDATA%` 每用户 profile ACL 提供（NFR-003 的 Windows 实现方式） |

> Windows 真机验证（TC-C02..C04、TC-D01..D04、TC-E01/E02/E03、TC-F01/F04、TC-G03/G04、TC-H01/H02、TC-B05）已于 **2026-09-23** 在 Windows 11 24H2 上执行并通过，期间修复 `KI-015`..`KI-018` 与 `KI-020`（见 [known-issues.md](../../specs/001-phase1-local-bridge/known-issues.md)）；执行记录与命令结果见 [verification.md](../../specs/001-phase1-local-bridge/verification.md) 的「M4 Windows 验收执行记录（2026-09-23）」。`KI-019` 暂列 `Accepted`，最新试验桥路与直连均未观察到不可达；根因仍未知，复现时重开。

## 8. 停止与重置

```text
1. 关闭桥开关（系统代理立即恢复为未设置）
2. 正常退出应用（等待 before-quit 清理完成，不要 kill -9）
3. 确认无残留：
   macOS   : networksetup -getwebproxy <服务> → Enabled: No；pgrep -fl swufe_bridge.sidecar 无输出
   Windows : reg query "HKCU\...\Internet Settings" /v ProxyEnable → 0x0
4. 卸载本机 CA（界面「卸载本机 CA」）
5. 若使用隔离 profile，可整体删除该目录（含 config.json、bridge-config.json、mitmproxy/、登录分区）
```

## 9. 相关

- 配置项与存储位置 ⇒ [README.md](README.md) 第 2 节
- 应用侧命令与限制 ⇒ [apps/desktop/README.md](../../apps/desktop/README.md)
- 桥控制协议（`swufe-ready` / `swufe-error` / `swufe-debug` / `swufe-capture`）⇒ [bridge-control-protocol.md](../api/bridge-control-protocol.md)
- 安全约束（Cookie、CA 私钥、权限）⇒ [security/README.md](../security/README.md)
- 验收手册与结果表 ⇒ [specs/001-phase1-local-bridge/verification.md](../../specs/001-phase1-local-bridge/verification.md)
- 测试分层与命令 ⇒ [testing-strategy.md](../development/testing-strategy.md)
