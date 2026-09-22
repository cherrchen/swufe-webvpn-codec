# Verification: 桌面界面重构（React + Ant Design 多窗口）

> Spec ID: 002
> Status: Implemented
> Owner: cherrchen
> Last Updated: 2026-09-23

> 本文件建立 **Requirement → Verification** 映射，是「Feature 是否完成」的判定依据。
> 规则见 [verification-strategy.md](../../docs/verification/verification-strategy.md)。
> 状态：实现与可机器执行的验收已全部执行（2026-09-23）；需要人的动作的部分（真实 CAS/MFA 会话、进程捕获的系统扩展授权、Windows 真机）见「未验证 / 无法验证项」，因此未推进到 `Verified`。
> 用例编号：本次新增 `TC-J01..TC-J13`；界面相关的既有用例（TC-H01 / TC-H02 / TC-B05 / TC-F04 / TC-C03 / TC-C04 / TC-D03 / TC-E01..TC-E03 / TC-G04）在迁移后**重跑**，沿用原编号与口径。

## 映射表

| Requirement | Verification | Status |
| ----------- | ------------ | ------ |
| REQ-001 | TC-J03（L3 手工/CDP：主窗口内容清单与信息层级）、TC-J12（IPC 兼容）；重跑 TC-H01（状态条与状态机一致，含捕获态） | Passed（TC-J03：主窗口实时文本仅含状态条/主操作/捕获方式/allowlist 摘要/证书/诊断/消息行，`input[type=checkbox]`=0、`table`=0；TC-J12：preload 暴露 21 个方法，16 既有 + 5 新增，3 事件签名不变；TC-H01 重跑：`已登录`/`桥接中`/`错误`+原因与状态机一致，捕获态行由 `captureError`/`localCaptureEnabled` 驱动） |
| REQ-003 | TC-J04（L3 手工：捕获窗口内容、勾选即下发与落盘）、TC-J08（代理冲突模态仍在主窗口）；重跑 TC-G04（捕获范围与停止，需真实授权与会话） | Passed（TC-J04：捕获窗口显示四态状态行 + 方式行 + 常驻说明 + 筛选 + [刷新列表] + 310 个候选行 + `已选 N / 32`；勾选 Google Chrome → `getSettings().captureProcesses=["/Applications/Google Chrome.app/"]`、`config.json` 同步、窗口计数 `已选 1 / 32`；`bridge-config.json` 在 system-proxy 方式下 `capture.processes=[]` 与既有互斥语义一致；TC-J08 见下）。TC-G04 的真实捕获范围仍为未验证项（需系统扩展授权） |
| REQ-005 | TC-J07（L3 手工：allowlist 窗口增删/通配/持久化 + 主窗口摘要）；重跑 TC-B05、TC-H02 | Passed（TC-J07：`portal.swufe.edu.cn` 添加成功并提示 `已添加 portal.swufe.edu.cn。`、主窗口摘要实时变 `2 个主机`，通配勾选后变 `2 个主机（含 *.swufe.edu.cn）`，`config.json` 同步 `{hosts:[jwxt,portal], includeSwufeWildcard:true}`；非法输入内联报错且不写入；TC-B05/TC-H02 重跑：增删/通配/持久化（重启后 `1 个主机` 保留）语义不变） |
| REQ-009 | TC-J05（日志开关联动：开→窗口出现、关→窗口关闭且清空）、TC-J06（重开恢复 Main 缓冲）、TC-J10（日志内容仍只有时间/域名/结果）；重跑 TC-F04 的自动化部分 | Passed（TC-J05：开关打开→`logs.html` 出现；关闭→窗口消失、`debugLogging=false`、缓冲 0；TC-J06：关闭窗口（开关仍开）后重开→7 条历史完整恢复；TC-J10：真实记录键集合为 `ts/host/rewritten/direction/detail`，结果列 `已改写`/`响应改写（body）`/`直连（not-allowlisted）`；EC2-007：两次流量突发后缓冲与窗口恒为 200 条、最新在前；[清空] → 缓冲 0 且列表空态） |
| REQ-012 | TC-J01（主窗口零滚动）、TC-J02（二级窗口单实例复用与聚焦）、TC-J03（主窗口内容边界）、TC-J11（窗口打开时延与日志推流下的可交互性） | Passed（TC-J01：zoom 1.0/1.25/1.5/2.0 四档 `scrollHeight==clientHeight` 且无可滚动溢出元素；TC-J02：三类入口重复触达后窗口数恒为 1 且均获得焦点；TC-J03 见上；TC-J11：二级窗口从 IPC 调用到页面 target 出现 27–32ms（三次），日志推流期间主窗口点击 [管理…] 27ms 内打开 allowlist 窗口） |
| NFR-003 | TC-J10（记录键集合固定为 `ts/host/rewritten/direction/detail`、无正文与 Cookie、缓冲不落盘）；复用既有 TC-D01 的「无密码文件」检查 | Passed（真实桥记录键集合如左；`bridge-config.json` 仍含会话 Cookie（既有设计，权限 0600），日志缓冲只在 Main 内存——`getDebugLogs()` 返回的字段与落盘文件均无正文与 Cookie；无密码文件检查沿用 001 的 TC-D01 结论） |
| NFR-005 | TC-J08（CA 风险提示在主窗口模态、取消后无 OS 动作） | Passed（真实 CA 管理路径：点 [安装本机 CA] → 主窗口模态 `安装本机 CA` + 正文 `本证书用于在本机解密并改写 HTTPS，仅限个人设备；可随时卸载。` + [取消]/[确认安装]；点 [取消] 后模态关闭、消息行不变、`getCaStatus()` 仍 `{installed:false,trusted:false}`、未出现管理员授权提示） |
| NFR-007 | TC-J09（四窗口文案全为中文，含 AntD `zh_CN` 内置文案） | Passed（四窗口可见文本中仅出现专有名词/技术标识：`SWUFE`/`WebVPN`/`Allowlist`/`*.swufe.edu.cn`/`App`，其余为中文；捕获窗口的英文条目是系统进程名（数据非文案）；antd 组件内置文案走 `zh_CN`） |
| SNFR-001 | TC-J01（CDP 断言：`scrollHeight ≤ clientHeight`、无可滚动溢出元素、窗口外框 ≈ 基线 × zoomFactor；zoom 1.0 / 1.25 / 1.5 三档） | Passed（见 TC-J01 记录：532/532、537/537、541/541、453/453；窗口外框由 Main 日志给出 720×560 → 900×700 → 1080×840 → 1440×935） |
| SNFR-002 | TC-J02（重复触达入口后窗口数量恒为 1） | Passed（capture/allowlist 各连点两次 + logs 通过 `openLogWindow()` 连调两次：`BrowserWindow` 计数各类恒为 1，且每次均 `focus()`（`document.hasFocus()`=true）） |
| SNFR-003 | TC-J09（键盘可遍历全部交互控件；状态与错误有文字表达） | Passed（主窗口 Tab 依次聚焦 [登录 WebVPN] → 捕获方式单选组 → [选择应用…] → [管理…] → [安装本机 CA] → 调试日志开关；未登录/忙碌时桥接开关 `disabled`，故按预期不进入 Tab 序列；错误态显示 `错误` + 原因文字） |
| SNFR-004 | TC-J10（四窗口 `sandbox: true` + `contextIsolation: true`；渲染层无 `require(` / `process.` / `electron` 直接引用；`script-src 'self'` 未放宽） | Passed（Main 侧读取四个窗口 `webPreferences`：`contextIsolation:true`、`nodeIntegration:false`、`sandbox:true`，均无 `parent`；`grep -rn "require(\|process\.\|from 'electron'" apps/desktop/src/renderer` 无命中；四份产物 HTML 的 CSP = `default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:`；实机样式生效） |
| SNFR-005 | TC-J11（二级窗口打开 ≤ 500ms；满 200 行且持续推流时主窗口仍可交互） | Passed（打开时延 27–32ms；推流 127 条 + 200 条上限场景下主窗口仍可交互——[管理…] 27ms 打开窗口，日志窗口按合并批次渲染并显示与缓冲一致的条数） |

Status 取值：`Pending` / `Passed` / `Failed` / `N/A`（`N/A` 必须写明理由）。

## 验收标准覆盖

| Acceptance Criteria | 对应验证项 | Status |
| ------------------- | ---------- | ------ |
| AC2-001 | TC-J01（zoom 1.0/1.25/1.5 下零滚动 + 窗口不可拖拽缩放 + 尺寸随缩放按比例变化） | Passed（四档缩放下 `scrollHeight==clientHeight` 且无溢出；窗口 `resizable:false`（Main 侧 `isResizable()=false`）；外框 720×560 / 900×700 / 1080×840 / 1440×935（zoom 1.75 起高度受工作区 clamp：workArea.height−120=935）） |
| AC2-002 | TC-J03（主窗口内容清单与各区职责） | Passed（清单逐字匹配 AC2-002；无应用列表、无日志表格、无 allowlist 编辑控件） |
| AC2-003 | TC-J04（捕获窗口内容、回显勾选、授权引导） | Passed（状态行 + 方式行 + 说明行 + 筛选 + [刷新列表] + 一行一个应用的复选框列表；失败态引导与 [重试] 由组件测试覆盖（`capture-error` 用例）；回显：`已选 1 / 32` 与选中行置顶） |
| AC2-004 | TC-J04（勾选后 `getSettings().captureProcesses`、`config.json`、主窗口状态行一致性） | Passed（勾选/取消均即时落盘并回读；主窗口状态行按 `localCaptureEnabled`/`captureError`/方式四态显示——真实 `已启用（N 个应用）` 需进程捕获授权，见未验证项） |
| AC2-005 | TC-J05（开关联动：窗口出现/自动关闭 + 清空） | Passed（开→窗口出现且三列显示；关→窗口自动关闭、缓冲清空） |
| AC2-006 | TC-J06（关闭后重开仍显示 Main 缓冲的最近记录） | Passed（关闭窗口不关开关 → 重开恢复 7 条） |
| AC2-007 | TC-J07（增删/通配/重启保留 + 主窗口摘要刷新） | Passed（增删/通配即时生效、主窗口摘要即时刷新、重启后 `1 个主机` 保留，见 TC-J07 记录） |
| AC2-008 | TC-J02（单实例复用） | Passed（见 SNFR-002） |
| AC2-009 | TC-J08（三条模态在主窗口、级联动作不变）；重跑 TC-D03、TC-C01 | Passed（代理冲突：`Ethernet` 服务预置外来代理（不影响 Wi‑Fi 流量）→ 开桥被拒 `{state:error, code:PROXY_CONFLICT}`、主窗口模态显示标题/正文/[知道了]，`systemProxyEnabled:false` 说明未动 OS 设置；点 [知道了] 后清除外来代理并重试 → `running`；会话过期模态由组件测试 + 事件路径覆盖（`onSessionExpired` → 主窗口模态 + [去登录]→`login()`）；CA 风险提示见 NFR-005） |
| AC2-010 | TC-J12（既有 16 命令 + 3 事件签名不变；新增 5 方法可用） | Passed（preload 暴露的键 = 21 个方法 + 3 事件订阅；既有 16 个方法签名与语义未改（`grep` 对照 + `typecheck`）；实机调用 `openCaptureWindow`/`openLogWindow`/`openAllowlistWindow`/`getDebugLogs`/`clearDebugLogs` 均生效） |
| AC2-011 | TC-J13（全量回归命令 + macOS 实机冒烟） | Passed（命令表全绿：`test:unit` 85、`test:ui` 36、`typecheck`/`build`/`docs:check`/`spec:check` 通过、`pytest` 198；实机冒烟：假上游会话登录 → 开桥（系统代理指向 127.0.0.1:8080）→ **真实浏览器**（Chrome headless，走系统代理）访问 `http://jwxt.swufe.edu.cn/` 收到改写后的上游响应与注入 Cookie → 关桥 → 退出，6 个网络服务 `Enabled: No`、无 sidecar 残留。真实校内会话下的教务页面操作仍由 cherrchen 复核，见未验证项） |
| AC2-012 | TC-J10（隔离设置、CSP、源码检查） | Passed（见 SNFR-004 记录） |
| AC2-013 | TC-J09（中文文案、非颜色表达、键盘可达） | Passed（见 NFR-007 / SNFR-003 记录） |

## 执行的命令与结果

| 命令 | 结果 | 时间 | 备注 |
| ---- | ---- | ---- | ---- |
| `pnpm install --frozen-lockfile` | `Already up to date`（0 error） | 2026-09-23 | 新依赖锁定一致；无 `ERR_PNPM_IGNORED_BUILDS`（`allowBuilds` 未增补） |
| `pnpm --filter swufe-webvpn-bridge run typecheck` | 无 error（三个 tsconfig：Main / 渲染层含 `.tsx` / preload） | 2026-09-23 | |
| `pnpm --filter swufe-webvpn-bridge run test:unit` | `tests 85 / pass 85 / fail 0` | 2026-09-23 | 迁移前基线 76 例 + 新增 `window-policy`(5) 与 `debug-log-buffer`(4) |
| `pnpm --filter swufe-webvpn-bridge run test:ui` | `Test Files 7 passed / Tests 36 passed` | 2026-09-23 | vitest + jsdom：`app-shell`/`hooks`/`log-batch`/`main-window`/`capture-window`/`log-window`/`allowlist-window` |
| `pnpm --filter swufe-webvpn-bridge run build` | 通过（`vite v7.3.6`，`✓ built in 1.83s`；real 3.1s） | 2026-09-23 | 产物见下 |
| `dist/renderer/` 体积 | 合计 956 KB；`hooks-*.js` 498,011 B（共享 chunk，含 React/antd/图标）、`logs-*.js` 336,701 B（antd Table）、`index-*.js` 42,283 / 21,166 / 11,699 B、`main-*.js` 25,109 B、`capture-*.js` 2,514 B、`allowlist-*.js` 2,060 B、`hooks-*.css` 168 B | 2026-09-23 | 四入口共享 chunk；gzip 最大 ≈165.6 kB |
| `uv run --directory bridges/python pytest -q` | `198 passed, 42 warnings in 2.76s` | 2026-09-23 | 与迁移前基线（198 例）一致 |
| `pnpm run docs:check` | `0 error(s), 0 warning(s)`（docs-links 190 / docs-i18n 122 / spec-check 2） | 2026-09-23 | |
| `pnpm run spec:check` | 无 error | 2026-09-23 | 001 取代注记 + 002 结构 |
| 实机（CDP）：`pnpm start --user-data-dir=/tmp/002-acc-a --remote-debugging-port=9222` | 见 TC-J01/J02/J03/J05/J07/J09/J10/J11/J12 | 2026-09-23 | 真实应用 + 隔离 userData |
| 实机（假上游 + 可替换 CA 前置）：`SWUFE_VERIFY_USER_DATA=/tmp/002-acc-b SWUFE_VERIFY_CDP_PORT=9223 electron test/fixtures/stub-ca-app.js` + `portal-stub.mjs --port 19080` | 见 TC-J04/J05(有记录)/J06/J08/J11/J13 | 2026-09-23 | `config.json` 的 `settings.webvpnBase=http://127.0.0.1:19080`、`debugLogging=true` |
| `networksetup -getwebproxy <service>`（关桥后与退出后各一次，6 个服务） | 全部 `Enabled: No` | 2026-09-23 | NFR-004 不变；测试期在 `Ethernet` 服务预置的外来代理已恢复为 `Enabled: No` |
| `pgrep -fl swufe_bridge.sidecar`（关桥后与退出后） | 无输出 | 2026-09-23 | 无残留 sidecar |
| 真实浏览器路径 | `Chrome --headless=new --dump-dom http://jwxt.swufe.edu.cn/` → `{"stub":"rewritten","path":"http://jwxt.swufe.edu.cn/","cookie":"wrdvpn_session=STUB-SESSION"}` | 2026-09-23 | 浏览器经系统代理 → 本桥 → 改写后的上游 |

## 手工验证步骤与结果

```text
前置条件：
1. 仓库根执行 pnpm install；apps/desktop 已构建（pnpm --filter swufe-webvpn-bridge run build）
2. 以隔离目录启动：pnpm start --user-data-dir=/tmp/002-acc-a --remote-debugging-port=9222
3. 需要真实链路的用例另需：本机 CA 已安装并被信任、已通过 CAS/MFA 登录（由此人本人完成）

实际执行（2026-09-23，由 Coding Agent 以 CDP 执行；需要人的动作的部分见「未验证 / 无法验证项」）：
1. 主窗口 720×560、不可拖拽缩放；CDP 读取 scrollingElement：zoom 1.0 → 532/532，1.25 → 537/537，1.5 → 541/541，2.0 → 453/453，四档均无可滚动溢出元素；窗口外框由 Main 日志确认 720×560 / 900×700 / 1080×840 / 1440×935（TC-J01）
2. 连点两次「选择应用…」「管理…」以及连调两次 openLogWindow()：三类窗口各 1 个且均获得焦点（TC-J02）
3. 主窗口内容清单逐项核对：状态条 / 登录 / 桥接开关 / 捕获方式 + 进程捕获状态行 + [选择应用…] / allowlist 摘要 + [管理…] / CA 状态 + 安装/卸载 / 系统代理行 / 调试日志开关；无复选框、无表格（TC-J03）
4. 调试日志开关：开 → logs.html 出现并显示「时间｜域名｜结果」三列与计数；关 → 窗口消失、缓冲清空（TC-J05）
5. 重开开关并产生 7 条真实记录 → 关闭窗口（不关开关）→ 重开 → 7 条历史完整恢复（TC-J06）
6. allowlist：添加 portal.swufe.edu.cn → 主窗口摘要 `2 个主机`；勾选通配 → `2 个主机（含 *.swufe.edu.cn）`；config.json 同步；非法主机名内联报错且不写入（TC-J07）
7. 代理冲突：在未使用的 Ethernet 服务预置外来代理 → 开桥被拒 + 主窗口模态；清除后重试 → running。CA 风险提示：模态 → [取消] → 无 OS 动作（TC-J08）
8. 键盘：主窗口 Tab 依次聚焦登录、捕获方式单选组、[选择应用…]、[管理…]、[安装本机 CA]、调试日志开关；四窗口文案中文（TC-J09）
9. 四窗口 webPreferences（contextIsolation/sandbox/nodeIntegration）与产物 CSP；渲染层源码无 electron/require/process 引用；实机样式生效（TC-J10）
10. 二级窗口打开时延 27–32ms；日志推流（127 条与 200 条上限场景）下主窗口仍可交互（TC-J11）
11. preload 方法面 21 个（16 既有 + 5 新增）+ 3 事件；新方法实机可用（TC-J12）

预期结果：
- 全部符合 [ui-ux.md](ui-ux.md)、[docs/ui-ux/](../../docs/ui-ux/README.md) 与 [spec.md](spec.md) 的 AC2-001..AC2-013
实际结果：
- 可机器执行部分全部通过（见上面各条与「映射表」）；真实会话/系统扩展授权/Windows 真机部分见「未验证 / 无法验证项」
```

> 需要真实链路的剩余部分（真实 CAS/MFA 登录下的教务页面操作、进程捕获授权后的「只对所选应用生效」、Windows 真机）由 cherrchen 在后续实机会话执行，前置条件与 001 的 M4 手册一致（关闭其它代理工具的 TUN/虚拟网卡模式）。

## 边界与异常场景

| 场景 | 期望行为 | 实际结果 | Status |
| ---- | -------- | -------- | ------ |
| EC2-001 重复触达二级窗口入口 | 聚焦已有窗口，不新开 | capture（连点两次）/allowlist（连点两次）/log（连调两次）窗口数恒为 1，且 `document.hasFocus()`=true | Passed |
| EC2-002 关闭日志开关时窗口正开着 | 窗口自动关闭、缓冲清空 | 开关关闭 → `logs.html` 消失、`debugLogging=false`、缓冲 0（关前 2 条） | Passed |
| EC2-003 二级窗口在前台时会话过期/代理冲突 | 模态在主窗口并聚焦；二级窗口不关闭、状态刷新 | 代理冲突时 capture/allowlist 窗口均处于打开状态：模态出现在主窗口，二级窗口未被关闭；会话过期走 `onSessionExpired` 订阅（组件测试覆盖 [去登录] 路径） | Passed |
| EC2-004 关闭主窗口 | 应用退出、二级窗口随之关闭、退出清系统代理仍执行 | 退出后 6 个服务 `Enabled: No`（此前由本桥指向 127.0.0.1:8080）、无 sidecar 进程、无应用进程 | Passed |
| EC2-005 捕获方式切回系统代理而捕获窗口开着 | 窗口保留并显示「进程捕获未启用」 | 捕获窗口在 system-proxy 方式下显示 `当前捕获方式为系统代理，进程捕获未启用。`，窗口保留，勾选仍可查看与修改（落盘、不生效） | Passed |
| EC2-006 候选应用枚举失败/为空 | 捕获窗口显示空态与原因，不阻塞主窗口 | 空态与筛选无结果文案由组件测试覆盖（`暂无候选应用：请点「刷新列表」重试。` / `没有匹配的应用。`）；实机候选枚举返回 310 条 | Passed |
| EC2-007 日志超过 200 条 | 丢最旧、始终最新 200 条 | 两次流量突发后 `getDebugLogs().length=200`，窗口 `当前 200 条` 且最新在前 | Passed |
| EC2-008 窗口组件抛错 | 显示中文错误面板与 [重新加载窗口]，不白屏 | 组件测试：抛错子组件 → `界面加载失败：演示用异常。可点「重新加载窗口」重试。` + [重新加载窗口] | Passed |
| EC2-009 内容缩放（zoom 1.25/1.5/2.0） | 窗口尺寸随缩放按比例增大（clamp 到工作区）且仍零滚动 | zoom 1.25 → 900×700、1.5 → 1080×840、1.75 → 1260×935、2.0 → 1440×935（高度被工作区 clamp）；四档 `scrollHeight==clientHeight` 且无溢出元素，无需外移内容 | Passed |
| EC2-010 未登录时打开捕获窗口 | 允许打开，勾选可保存但不生效 | 捕获窗口在未登录时正常打开并显示候选；勾选后 `captureProcesses` 落盘（`config.json`），`localCaptureEnabled` 不变 | Passed |

## 兼容性

| 维度 | 结论 | 依据 |
| ---- | ---- | ---- |
| 接口兼容 | 只增不改：既有 16 个命令方法与 3 个事件签名不变，新增 5 个命令 | TC-J12；[docs/api/electron-ipc.md](../../docs/api/electron-ipc.md) §兼容性策略 |
| 数据兼容 | 无变化（`config.json` / 会话存储格式不变，无迁移）：`/tmp/002-acc-a` 的配置在重启后仍被读取，`/tmp/002-acc-b` 的手写配置被正常解析 | [design.md](design.md) §Data Model Changes |
| 行为兼容 | 界面之外行为不变：桥、代理、CA、会话、改写、配置持久化语义保持（`capture.processes` 在 system-proxy 方式下仍为空、退出仍清代理） | TC-J13；Python 198 例与 App 单测 85 例 |
| 用户可见变化 | 主窗口 720×640 → 720×560 且不可缩放；allowlist/捕获/日志改到二级窗口 | [docs/ui-ux/](../../docs/ui-ux/README.md) 更新 + 001 取代注记 |
| 运行环境 | vite 7 需 `^20.19 \|\| >=22.12`、vitest 3 需 `>=22`、jsdom 26 需 `>=18`：仓库 `engines.node >= 22` 与 CI node 22 满足（本机 Node v24.18.0） | [plan.md](plan.md) §Dependencies |

## 安全

| 检查项 | 结论 | 依据 |
| ------ | ---- | ---- |
| 输入校验 | 主机名与捕获 pattern 的校验仍在 Main（渲染层只做结构提示；非法主机名内联报错且不写入，Main 仍会拒绝） | TC-J07 的非法输入路径；`store.ts` / `ipc.ts` 校验未变 |
| 权限 | 渲染层保持 `sandbox: true` + `contextIsolation: true`、无 Node 集成；仅经 preload 访问 Main | TC-J10（四个窗口 `getLastWebPreferences()` 读值 + 源码 `grep`） |
| 敏感数据 | 日志缓冲进 Main 内存（≤200 条、不落盘）、记录键集合不变、不含 Cookie/正文；WRD key/IV 仍不跨 IPC | TC-J10、TC-J06、NFR-003 |
| CSP | 仅 `style-src` 放宽（AntD 运行期注入样式），`script-src 'self'`、`default-src 'none'` 不放宽；无远程资源（产物中无外链） | TC-J10；[ADR-0012](../../docs/architecture/adr/ADR-0012-react-antd-multiwindow-renderer.md) |
| 依赖 | 新增依赖全部为 MIT、随包分发、离线可用；第二套测试运行器（vitest）理由记入 ADR-0012 与 dependency-policy；`pnpm install` 未触发安装脚本审批 | [dependency-policy.md](../../docs/development/dependency-policy.md)「依赖记录（M6 新增）」 |

## 文档同步

| 文档 | 是否需要更新 | 状态 |
| ---- | ------------ | ---- |
| [docs/requirements/](../../docs/requirements/README.md) | 是（REQ-012 新增 + REQ-001/003/005/009 边界说明） | 已完成（2026-09-23） |
| [docs/architecture/](../../docs/architecture/README.md) | 是（components / interfaces / data-flow） | 已完成（T234） |
| [docs/api/](../../docs/api/README.md) | 是（electron-ipc.md：5 个新方法 + 广播面 + 副作用 + 变更记录） | 已完成（T235） |
| ADR | 是（[ADR-0012](../../docs/architecture/adr/ADR-0012-react-antd-multiwindow-renderer.md)：决策第 4 条方法数修正为 5，失效链接修正） | 已完成（2026-09-23） |
| [docs/ui-ux/](../../docs/ui-ux/README.md) | 是（main-window 重写 + secondary-windows 新增 + 索引） | 已完成（T233） |
| [docs/development/](../../docs/development/README.md) | 是（dependency-policy / testing-strategy） | 已完成（T237） |
| `.en.md` 配对 | 是（上述 docs/** 变更均需配对） | 已完成（T233..T238；`docs:check` 0 error） |
| [apps/desktop/README.md](../../apps/desktop/README.md) | 是（构建命令、生成物、`test:ui`、四窗口结构、`SWUFE_RENDERER_URL`） | 已完成（T232） |
| 根 [`README.md`](../../README.md) / [`CONTRIBUTING.md`](../../CONTRIBUTING.md) / [`AGENTS.md`](../../AGENTS.md) | 是（本地校验命令补 `test:ui`、Source of Truth 表补 Spec 002 行、项目状态段同步） | 已完成（T238） |
| [docs/planning/](../../docs/planning/roadmap.md) | 是（roadmap / milestones 索引 / M6 完成记录） | 已完成（T238） |
| [.github/workflows/app-tests.yml](../../.github/workflows/app-tests.yml) | 是（新增 UI component tests 步骤） | 已完成（T239） |
| [001 spec.md](../001-phase1-local-bridge/spec.md) / [001 verification.md](../001-phase1-local-bridge/verification.md) | 是（界面部分被 002 取代的注记；历史证据保留） | 已完成（2026-09-23，T236） |

## 未验证 / 无法验证项

| 项 | 原因 | 已尝试 | 需要谁决策 |
| -- | ---- | ------ | ---------- |
| Windows 侧界面行为（二级窗口、CJK 字体下的零滚动、AntD 在 Windows 的对话框习惯） | 沿用 001 的延期结论（`KI-001`），本 Spec 的实机验证在 macOS 执行 | 无（未在 Windows 真机执行） | cherrchen（是否随 001 的 Windows 验收一并执行） |
| 真实校内会话下的教务页面操作（TC-J13 的「教务首页可打开并可操作」） | 需要 CAS/MFA 凭据与已安装并被信任的本机 CA；本会话以假上游（`portal-stub.mjs`）+ 假会话验证了同一路径（登录 → 开桥 → 浏览器经系统代理访问 allowlist 主机 → 关桥 → 退出） | 已执行：假上游会话 + 真实浏览器（Chrome headless 经系统代理）访问 `http://jwxt.swufe.edu.cn/` 成功、退出后无残留代理 | cherrchen（用真实会话复跑 TC-G01 口径；001 已通过同类用例） |
| 进程捕获「只对所选应用生效」（TC-G04）与主窗口 `进程捕获：已启用（N 个应用）` 的真实呈现 | 需要 macOS 网络扩展授权（管理员密码 + 系统设置手动允许），且会接管所选进程流量 | 已执行：勾选/取消即时落盘与回读、四态状态行的组件测试、`bridge-config.json` 的互斥语义核对 | cherrchen（在真实授权下复跑 001 的 TC-G04） |

## 结论

- [x] 映射表无 `Pending`
- [x] 执行的命令与结果已记录
- [x] 文档影响已处理
- [ ] Spec 状态可推进到 `Verified`

当前状态：`Implemented`。实现、组件测试、全量回归与 macOS 上的可机器执行验收全部通过；推进到 `Verified` 仍受三项未验证项（Windows 真机、真实会话下的教务页面操作、进程捕获真实范围）约束，与 001 的既有遗留一致。
