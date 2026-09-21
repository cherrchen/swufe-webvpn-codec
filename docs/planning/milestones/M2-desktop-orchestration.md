# M2: 桌面编排（Desktop Orchestration）

> Status: Done（实现完成；TC-E01/TC-E02 的信任库写入与 Windows 真机验证需人工执行，见「遗留问题」）
> Owner: cherrchen
> Target: TBD（原包未定义日期）｜完成于 2026-09-21

## 目标

把桥装进 Electron 应用，使「登录 → 开桥 → 校园资源可用」的编排由 App 完成：

- 登录 WebView + Session Broker：不存学号/密码，只保存会话所需 Cookie 及最小附属状态（REQ-001、REQ-002）；
- Proxy Orchestrator：开桥前读系统代理，已被占用则拒绝启动并提示先关闭 Clash / mihomo / sing-box 等（REQ-004）；开桥时把系统 HTTP/HTTPS 代理指向本地桥；关闭、会话过期或退出时仅在「由本 App 设置」的标记存在时清除（NFR-004）；
- Cert Manager：一键安装/卸载本机 MITM CA，安装时展示风险提示（REQ-010、NFR-005）；
- 会话失效处理：探测到失效则停桥 → 清系统代理 → 停进程捕获 → 弹窗重登。

## 包含的 Specs

| Spec | 状态 | 依赖 |
| ---- | ---- | ---- |
| [001-phase1-local-bridge](../../../specs/001-phase1-local-bridge/spec.md) | Draft | M1 |

## 退出条件

- [x] Electron 可登录：WebView 完成 CAS/MFA 后取得可用 WebVPN 会话，且无密码文件（TC-D01，P0）——登录窗走 `persist:swufe-login` 分区 + `setProxy({mode:'direct'})`；桩上游验证「打开门户 → Cookie 采集 → 状态变已登录」，真实 CAS 部分见「遗留问题」
- [x] 未登录时不能开桥（TC-D02，P0）——开桥开关在未登录时禁用，且 `startBridge` 以 `NOT_LOGGED_IN` 拒绝（单测覆盖校验收敛顺序）
- [x] 已有系统代理时拒绝启动并给出提示（TC-C01，P0；见 [ADR-0004](../../architecture/adr/ADR-0004-refuse-start-when-system-proxy-in-use.md)）——真实 `networksetup` 读到 `Enabled: Yes / 127.0.0.1:7890` 后拒绝启动，OS 设置未被改动
- [x] 开桥把系统 HTTP/HTTPS 代理指向本桥端口（TC-C02，P0）——6 个启用服务全部变为 `Enabled: Yes / Server: 127.0.0.1 / Port: 8080`
- [x] 关桥 / 退出 App 清除由本 App 设置的代理（TC-C03、TC-C04，P0；NFR-004）——关桥与退出后 `Enabled: No`；异常退出残留由 `recoverOnLaunch()` 在下次启动清除
- [ ] CA 一键安装到系统信任库（TC-E01，P0）、一键卸载（TC-E02，P0）；未安装 CA 时给出明确失败提示（TC-E03，P1）——**部分完成**：实现完整、安装前风险提示已实测（UI 模态先于任何安装动作），未装 CA 时开桥返回 `CA_MISSING`（TC-E03）已实测；写入/移除系统信任库需管理员密码，本机无法提权，故 TC-E01/TC-E02 保持未勾选（见「遗留问题」）
- [x] 会话过期触发停桥 + 清代理 + 停进程捕获 + 弹窗重登（TC-D03，P0）——探测到 302 → `/login` 后 8 秒内：系统代理清空、sidecar 退出、模态出现、状态条「过期处理中」、开关强制关
- [x] 相关文档已同步（含双语配对）；无阻塞类缺陷

## 风险

| 风险 | 影响 | 应对 |
| ---- | ---- | ---- |
| R3 mitm 嵌入体积 / 签名（中/中） | 打包体积增大、签名与分发受阻 | 先开发者模式外置 mitm；退回独立安装 mitm 亦可接受 |
| R4 macOS 权限弹窗劝退（中/中） | 辅助功能/网络扩展授权被拒会阻断进程捕获路径 | UX 引导文案；必要时仅保留系统代理路径 |
| R2 Cookie 字段变更（中/高） | 会话探测误判，出现「假过期」或漏判过期 | 探测信号集中（探测 URL 标记、Set-Cookie 清空、302 到 CAS），并保留手动重登入口 |

## 完成记录

**完成时间**：2026-09-21（macOS 15.8 arm64 / Node v24.18.0 / Electron 44.4.3 / Python 3.13）。

### 交付物

| 类别 | 内容 |
| ---- | ---- |
| 工程 | `app/package.json` + `app/package-lock.json`（dev：electron 44.4.3、typescript 5.7、tsx、esbuild、@types/node）；`app/tsconfig.json`（Main，CommonJS）/ `tsconfig.renderer.json`（Renderer，ESM）/ `tsconfig.preload.json`（preload 类型检查）；`app/scripts/run-unit-tests.mjs`（跨平台测试入口）；`app/README.md` |
| Main 进程 | `app/src/main/`：`index.ts`（组合根 + 单实例锁 + `--user-data-dir`）、`windows.ts`、`ipc.ts`（15 个契约方法 + 事件广播）、`orchestrator.ts`（Proxy Orchestrator）、`state-machine.ts`、`session-broker.ts`、`session-probe.ts`、`session-types.ts`、`sidecar.ts`、`cert-manager` 装配（`platform/index.ts`）、`store.ts`、`constants.ts`、`exec.ts`、`python.ts`、`paths.ts`、`shutdown.ts` |
| 平台适配 | `app/src/main/platform/`：`parse.ts`（纯解析函数）、`ca-files.ts`、`darwin/system-proxy.ts`（`networksetup`）、`darwin/cert.ts`（`security` + osascript 提权）、`win32/system-proxy.ts`（WinINET 注册表）、`win32/cert.ts`（`certutil -user`）、`index.ts`（平台分支 + 进程枚举） |
| 渲染层 | `app/src/preload/index.ts`（contextBridge）、`app/src/renderer/renderer.ts`、`app/static/index.html`、`app/static/styles.css`、`app/src/shared/{types,global.d.ts}` |
| Python 侧新增 | `swufe_bridge/ca.py`（`python -m swufe_bridge.ca --confdir <dir>`：不启动桥也能生成 mitmproxy CA，复用 CertStore，不自研 PKI） |
| 测试 | `app/test/`（8 个单测文件 + `helpers/fakes.ts`，全部 electron-free）、`app/test/fixtures/portal-stub.mjs`（假上游）、`app/test/fixtures/stub-ca-app.js`（CA 前置被替换的验证入口）；Python 侧新增 `tests/l1/test_ca.py` 与 `tests/l0/test_config.py` 的跨语言配置键用例 |
| CI | [.github/workflows/app-tests.yml](../../../.github/workflows/app-tests.yml)：每个 PR / main 推送跑 `npm ci --prefix app` + `typecheck` + `test:unit`（不需要 Electron 二进制、不需要显示器） |

### 验证命令与结果（2026-09-21）

| 命令 | 结果 | 备注 |
| ---- | ---- | ---- |
| `uv run pytest tests/l0 -q` | `75 passed` | M1 74 + 跨语言配置键兼容 1 |
| `uv run pytest tests/l1 -q` | `79 passed` | M1 74 + `tests/l1/test_ca.py` 5 |
| `uv run pytest tests/l2 -q` | `6 passed` | 与 M1 相同（未改动） |
| `uv run pytest -q` | `160 passed` | L0+L1+L2 |
| `npm --prefix app run typecheck` | 无 error | 三个 tsconfig（Main / Renderer / preload） |
| `npm --prefix app run test:unit` | `55 passed` | 状态机、代理/证书/进程解析、sidecar 控制行、会话探测分类、AppStore、debug 转发、Orchestrator |
| `npm --prefix app run build` | 通过 | `dist/main`（CommonJS）+ `dist/renderer`（ESM）+ `dist/preload/index.js`（esbuild 单文件包） |
| `npm run docs:check` | `0 error(s), 0 warning(s)` | 链接 + 双语配对 + spec 结构 |
| `npm run typecheck` | 无 error | 仓库根文档检查脚本 |

### 端到端验证（macOS 实机）

**A. 真实应用（`npm --prefix app start`，`--user-data-dir=/tmp/m2-e2e`，CDP 驱动）**

```text
1. 启动：状态条「未登录」，开桥开关禁用，证书「未安装」，系统代理「未由本 App 设置」
2. 点「安装本机 CA」⇒ 风险模态先出现（文案：本证书用于在本机解密并改写 HTTPS，仅限个人设备；可随时卸载。）
   取消 ⇒ 未发生任何安装动作（security find-certificate … | wc -c 仍为 0，UI 仍「未安装」）
3. 点「登录 WebVPN」⇒ 终端 `swufe-session 登录窗口 resolveProxy(http://127.0.0.1:19080) = DIRECT`
   （登录窗绕开系统代理，INV-004/EC-005 的可观测证据）；状态条「已登录」，按钮变「重新登录」，开关启用
4. 点开桥开关 ⇒ 状态条「错误」+「需要安装本机证书才能处理 HTTPS：请先点击「安装本机 CA」。」（CA_MISSING，TC-E03）
   `networksetup -getwebproxy Wi-Fi` 仍为 `Enabled: No`（未做任何 OS 变更）
5. 重复启动第二个实例 ⇒ 立即退出（0s，退出码 0），首个实例保持存活（单实例锁）
```

**B. CA 前置被替换的验证入口（`app/test/fixtures/stub-ca-app.js`，其余全部真实：真实 `networksetup`、真实 sidecar、真实 IPC/preload/renderer）**

```text
$ node app/test/fixtures/portal-stub.mjs --port 19080 --mode ok &
$ SWUFE_VERIFY_USER_DATA=/tmp/m2-e2e SWUFE_VERIFY_CDP_PORT=9223 SWUFE_PROBE_INTERVAL_MS=2000 \
    app/node_modules/.bin/electron app/test/fixtures/stub-ca-app.js

登录 ⇒ 开桥：
  swufe-ready {...}                     # sidecar 就绪（stderr 单行 JSON）
  systems proxy (6 services)            # Ethernet / USB LAN / Thunderbolt Bridge / Wi-Fi / iPhone USB / Stash
  Enabled: Yes / Server: 127.0.0.1 / Port: 8080
  /tmp/m2-e2e/bridge-config.json        # 0600，allowlist + cookies(wrdvpn_session) + debug + webvpnBase

$ curl -sS -i -x http://127.0.0.1:8080 --cacert /tmp/m2-e2e/mitmproxy/mitmproxy-ca-cert.pem https://jwxt.swufe.edu.cn/
  HTTP/2 200；正文 {"stub":"rewritten","path":"https://jwxt.swufe.edu.cn/","cookie":"wrdvpn_session=STUB-SESSION"}
  （上游收到的是 WRD 形态路径与注入的 WebVPN Cookie；`/https/<token>/` 又被响应反向改写回真实主机 URL）
  swufe-debug {"host":"jwxt.swufe.edu.cn","rewritten":true,"direction":"request"}
  swufe-debug {"host":"jwxt.swufe.edu.cn","rewritten":true,"direction":"response","detail":"body"}
$ curl -x http://127.0.0.1:8080 … https://example.com/   # 非 allowlist
  swufe-debug {"host":"example.com","rewritten":false,"detail":"not-allowlisted"}；200，未改写
  （同一条 debug 事件也经 IPC 到达渲染层，终端可见 renderer 的 console 回声）

会话过期级联（curl 'http://127.0.0.1:19080/__mode?expired=1'）8 秒内：
  swufe-session 会话探测：status=302 location=http://127.0.0.1:19080/login → expired
  swufe-session WebVPN 会话已失效：停止桥接并清除系统代理
  系统代理回到 Enabled: No；pgrep -fl swufe_bridge.sidecar 无输出；模态「WebVPN 会话已失效。桥接已停止并已清除系统代理。」+ [去登录]
  状态条「过期处理中」，开桥开关强制关；点 [去登录] 重登后状态回到「已登录」且过期提示被清除

退出清理（关闭主窗口）：swufe-quit 开始退出清理（before-quit）→ 退出清理完成
  系统代理 Enabled: No；无 sidecar 进程；config.json 的 systemProxyManagedByApp=false
  （退出时若界面正处于 error 态——如 `CA_MISSING`——同样完成清理；此路径暴露过一次
   `error → idle → stopping` 的非法状态迁移，已修复并加回归用例 `app/test/orchestrator.test.ts`）

代理冲突（TC-C01）：先 `networksetup -setwebproxy Wi-Fi 127.0.0.1 7890 && -setwebproxystate Wi-Fi on`，再开桥
  模态「检测到系统代理已启用。请先关闭 Clash / mihomo / 其它 VPN 的系统代理后再试。」
  `networksetup -getwebproxy Wi-Fi` 仍为 7890/on（未被改动）；无 sidecar 进程；代理标记仍为 false

异常退出残留自愈：kill -TERM 掉进程（代理残留 Enabled: Yes + 标记 true）后重新启动
  swufe-proxy 检测到上次运行残留的代理标记：清除本桥代理设置 ⇒ 代理回到 Enabled: No、标记 false
```

> 账号与网络限制：真实 `webvpn.swufe.edu.cn` 的 CAS 登录与教务页面验收（TC-D01 的真实会话部分、TC-G01/G02）仍需测试者自有账号，属 L3/M4。

### 实现期决策与偏差（记录）

| 项 | 结论与依据 |
| ---- | ---- |
| Main 侧 `verbatimModuleSyntax` | 计划书要求 Main 用 `module: commonjs` + `verbatimModuleSyntax: true`，两者在 TS 5.7 下互斥（TS1287/TS1295）。Main 改为 `isolatedModules: true`；Renderer（`module: esnext`）保留 `verbatimModuleSyntax` |
| preload 的形态 | `sandbox: true` 的 preload 不能 `require` 相对路径（实测：`window.swufeBridge` 为 undefined），因此 preload 用 esbuild 打包成单文件（新增 esbuild devDependency + `tsconfig.preload.json` 只做类型检查，避免 tsc 产出与打包产物互相覆盖） |
| IPC 表面扩展 | 契约的 15 个方法全部注册；另加 3 项以满足 M2 界面：`getSettings`（调试日志开关的初值；WRD key/IV 永不跨 IPC）、`onStatus`（状态推送）、`onSessionExpired`（过期模态）。已同步写入 [electron-ipc.md](../../api/electron-ipc.md) 与本记录 |
| 会话 Cookie 下发 | 只把 `name/value/domain/path` 写入 `bridge-config.json`；Electron Cookie 的 `secure`/`httpOnly` 等字段不下发（sidecar 不使用），文件 0600 |
| 会话过期信号 | `net.request(redirect:'manual')` 下 Chromium 报告重定向目标后即取消请求（`Redirect was cancelled`，实测），因此**重定向事件本身就是 3xx 响应**：以 `status + location` 归类（302→`/login` 或 →CAS 主机判为过期；2xx 判为有效；其余/网络错误不改变状态）。其余两个信号（Set-Cookie 清空、连续改写后 302 到 CAS）留 M3/M4 |
| 退出清理 | 只依赖 `before-quit`，且**每次都 `preventDefault()`**：macOS 在最后一个窗口关闭时会再次触发退出请求，若不拦截会在异步清理完成前退出（实测过一次代理残留）。SIGTERM/SIGKILL 不触发 JS（实测），残留由 `recoverOnLaunch()` 自愈 |
| 端口占用 | `bridgePort` 固定取 `settings.bridgePort`，不自动选端口；被占用时以 `BRIDGE_CRASH` + 明确文案（含端口号与修改建议）失败——错误码集合固定为 6 个，文案可区分原因 |
| 进程捕获与 allowlist UI | 按 M2 边界：`listCaptureCandidates`/`setCapturePids` 真实枚举 + 持久化，实际接管属 M3，故 `localCaptureEnabled` 恒为 `false`；allowlist 只读展示，增删界面属 M3（T025） |
| `--user-data-dir` | 由应用自行解析并 `app.setPath('userData', …)`（而非依赖 Chromium 开关），保证 config.json、Cookie 分区与 CA confdir 一并隔离（验证步骤 A/B 均使用该开关） |
| 平台错误处理 | macOS 网络服务枚举为空或系统代理读写失败 ⇒ `BRIDGE_CRASH`（不静默跳过系统代理）；CA 文件缺失时 `getCaStatus` 直接返回未安装，不隐式生成 |

### 遗留问题（移交 M3–M4）

- TC-E01/TC-E02（写入/移除系统信任库）需在测试机输入管理员密码，本次会话无法提权：`security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain <caCert>` 与 `security delete-certificate -Z <sha1>` 的**手动执行**路径未验证；UI 风险提示与 `CA_MISSING` 已实测。相应地，「真实应用内点开桥进入 running」这条 UI 路径需先装 CA，本次以 CA 前置被替换的验证入口替代。
- Windows 分支（WinINET 注册表 + `certutil`）只做实现 + 单测；真机验证（TC-C02/C03/C04、TC-E01/E02 on Windows）延到 M4/T038。已知限制：不广播 `WM_SETTINGCHANGE`，已运行的浏览器可能需重启才感知代理。
- 真实 CAS/MFA 登录与教务页面验收（TC-D01 真实会话、TC-G01/G02）需测试者自有账号与授权设备。
- Q-001 剩余信号（`Set-Cookie` 清空会话、连续改写后 302 到 CAS）未实现；Q-002 分发形态仍未定（M4）。
- 调试日志面板、进程捕获 UI/接管、托盘图标属 M3。

