# Verification: 桌面界面重构（React + Ant Design 多窗口）

> Spec ID: 002
> Status: Draft
> Owner: cherrchen
> Last Updated: 2026-09-23

> 本文件建立 **Requirement → Verification** 映射，是「Feature 是否完成」的判定依据。
> 规则见 [verification-strategy.md](../../docs/verification/verification-strategy.md)。
> 当前进度：**尚未开始实施**（[tasks.md](tasks.md) 无已完成任务），下表全部为 `Pending`；实施期每完成一项即回填证据（命令输出、实机观察）。
> 用例编号：本次新增 `TC-J01..TC-J13`；界面相关的既有用例（TC-H01 / TC-H02 / TC-B05 / TC-F04 / TC-C03 / TC-C04 / TC-D03 / TC-E01..TC-E03 / TC-G04）在迁移后**重跑**，沿用原编号与口径。

## 映射表

| Requirement | Verification | Status |
| ----------- | ------------ | ------ |
| REQ-001 | TC-J03（L3 手工/CDP：主窗口内容清单与信息层级）、TC-J12（IPC 兼容）；重跑 TC-H01（状态条与状态机一致，含捕获态） | Pending |
| REQ-003 | TC-J04（L3 手工：捕获窗口内容、勾选即下发与落盘）、TC-J08（代理冲突模态仍在主窗口）；重跑 TC-G04（捕获范围与停止，需真实授权与会话） | Pending |
| REQ-005 | TC-J07（L3 手工：allowlist 窗口增删/通配/持久化 + 主窗口摘要）；重跑 TC-B05、TC-H02 | Pending |
| REQ-009 | TC-J05（日志开关联动：开→窗口出现、关→窗口关闭且清空）、TC-J06（重开恢复 Main 缓冲）、TC-J10（日志内容仍只有时间/域名/结果）；重跑 TC-F04 的自动化部分 | Pending |
| REQ-012 | TC-J01（主窗口零滚动）、TC-J02（二级窗口单实例复用与聚焦）、TC-J03（主窗口内容边界）、TC-J11（窗口打开时延与日志推流下的可交互性） | Pending |
| NFR-003 | TC-J10（记录键集合固定为 `ts/host/rewritten/direction/detail`、无正文与 Cookie、缓冲不落盘）；复用既有 TC-D01 的「无密码文件」检查 | Pending |
| NFR-005 | TC-J08（CA 风险提示在主窗口模态、取消后无 OS 动作） | Pending |
| NFR-007 | TC-J09（四窗口文案全为中文，含 AntD `zh_CN` 内置文案） | Pending |
| SNFR-001 | TC-J01（CDP 断言：`scrollHeight ≤ clientHeight`、无可滚动溢出元素、窗口外框 ≈ 基线 × zoomFactor；zoom 1.0 / 1.25 / 1.5 三档） | Pending |
| SNFR-002 | TC-J02（重复触达入口后窗口数量恒为 1） | Pending |
| SNFR-003 | TC-J09（键盘可遍历全部交互控件；状态与错误有文字表达） | Pending |
| SNFR-004 | TC-J10（四窗口 `sandbox: true` + `contextIsolation: true`；渲染层无 `require(` / `process.` / `electron` 直接引用；`script-src 'self'` 未放宽） | Pending |
| SNFR-005 | TC-J11（二级窗口打开 ≤ 500ms；满 200 行且持续推流时主窗口仍可交互） | Pending |

Status 取值：`Pending` / `Passed` / `Failed` / `N/A`（`N/A` 必须写明理由）。

## 验收标准覆盖

| Acceptance Criteria | 对应验证项 | Status |
| ------------------- | ---------- | ------ |
| AC2-001 | TC-J01（zoom 1.0/1.25/1.5 下零滚动 + 窗口不可拖拽缩放 + 尺寸随缩放按比例变化） | Pending |
| AC2-002 | TC-J03（主窗口内容清单与各区职责） | Pending |
| AC2-003 | TC-J04（捕获窗口内容、回显勾选、授权引导） | Pending |
| AC2-004 | TC-J04（勾选后 `getSettings().captureProcesses`、`config.json`、主窗口状态行一致性） | Pending |
| AC2-005 | TC-J05（开关联动：窗口出现/自动关闭 + 清空） | Pending |
| AC2-006 | TC-J06（关闭后重开仍显示 Main 缓冲的最近记录） | Pending |
| AC2-007 | TC-J07（增删/通配/重启保留 + 主窗口摘要刷新） | Pending |
| AC2-008 | TC-J02（单实例复用） | Pending |
| AC2-009 | TC-J08（三条模态在主窗口、级联动作不变）；重跑 TC-D03、TC-C01 | Pending |
| AC2-010 | TC-J12（既有 16 命令 + 3 事件签名不变；新增 4 方法可用） | Pending |
| AC2-011 | TC-J13（全量回归命令 + macOS 实机冒烟） | Pending |
| AC2-012 | TC-J10（隔离设置、CSP、源码检查） | Pending |
| AC2-013 | TC-J09（中文文案、非颜色表达、键盘可达） | Pending |

## 执行的命令与结果

> 只记录**实际执行过**的命令。本 Spec 尚处 `Draft`，下表为**实施后必须执行**的命令清单，结果列在实施期回填。

| 命令 | 结果 | 时间 | 备注 |
| ---- | ---- | ---- | ---- |
| `pnpm install --frozen-lockfile` | 未执行（待 T201/T202） | — | 校验新依赖锁定一致、无 `ERR_PNPM_IGNORED_BUILDS` |
| `pnpm --filter swufe-webvpn-bridge run typecheck` | 未执行（待 T205） | — | Main / Renderer（含 `.tsx`）/ preload 三个 tsconfig |
| `pnpm --filter swufe-webvpn-bridge run test:unit` | 未执行（待 T209/T211） | — | 新增窗口策略与日志缓冲用例；其余为既有基线（迁移前 76 例） |
| `pnpm --filter swufe-webvpn-bridge run test:ui` | 未执行（待 T215/T227..T229） | — | 渲染层组件测试（vitest + jsdom） |
| `pnpm --filter swufe-webvpn-bridge run build` | 未执行（待 T205） | — | 记录 `dist/renderer/` 产物与共享 chunk 体积 |
| `uv run --directory bridges/python pytest -q` | 未执行（待 T240） | — | 非界面回归基线（迁移前 198 例） |
| `pnpm run docs:check` | 未执行（待 T233..T238） | — | 链接 + 双语配对 + spec 结构 |
| `pnpm run spec:check` | 未执行（待 T236） | — | 001 注记与 002 结构 |
| 实机（CDP）：`pnpm start --user-data-dir=/tmp/002-ui --remote-debugging-port=9222` | 未执行（待 T241） | — | 零滚动断言、窗口枚举、日志联动、模态 |
| 实机（真实链路）：登录 → 开桥 → 浏览器访问 allowlist 主机 → 关桥/退出 | 未执行（待 T242） | — | 需要 CA 已安装、真实会话与管理员密码/系统扩展授权（cherrchen 本人执行） |
| `networksetup -getwebproxy Wi-Fi`（退出后对照） | 未执行（待 T242） | — | 复用 001 的 NFR-004 口径：退出后 `Enabled: No` |

## 手工验证步骤

```text
前置条件：
1. 仓库根执行 pnpm install；apps/desktop 已构建（pnpm --filter swufe-webvpn-bridge run build）
2. 以隔离目录启动：pnpm start --user-data-dir=/tmp/002-ui --remote-debugging-port=9222
3. 需要真实链路的用例另需：本机 CA 已安装并被信任、已通过 CAS/MFA 登录（由此人本人完成）

步骤（不需要真实会话的部分，TC-J01/J02/J03/J05/J06/J07/J08/J09/J10/J11）：
1. 观察主窗口尺寸为 720×560 且无法拖动改变大小（TC-J01）
2. 用 CDP 读取 document.scrollingElement 的 scrollHeight/clientHeight，并枚举可滚动溢出元素（三档缩放各执行一次）
3. 连点两次「选择应用…」，读取窗口数量与标题，确认仍为一个捕获窗口且已前置（TC-J02）
4. 逐项核对主窗口内容清单，确认不含应用列表与日志表格（TC-J03）
5. 打开「调试日志」开关：日志窗口出现；再点一次开关：窗口自动关闭（TC-J05）
6. 重新打开开关，再关闭日志窗口（不关开关），检查历史是否保留（TC-J06）
7. 生成 allowlist 改动（增删主机、切换通配），核对主窗口摘要与 config.json（TC-J07）
8. 触发代理冲突（预先用其它工具占用系统代理）与 CA 风险提示，确认模态出现在主窗口（TC-J08）
9. 键盘遍历全部交互控件；核对文案与状态文字（TC-J09）
10. 检查四窗口 webPreferences、CSP meta 与渲染层源码（TC-J10）
11. 记录二级窗口从点击到可见的时延；持续推流日志时在主窗口点击开桥开关（TC-J11）

预期结果：
- 10 项全部符合 [ui-ux.md](ui-ux.md) 与 [spec.md](spec.md) 的 AC2-001..AC2-008、AC2-012、AC2-013
实际结果：
- 未执行（待 T241）
```

> 需要真实链路的手工项（TC-J04 / TC-J12 / TC-J13 与既有 TC-C03/C04、TC-D03、TC-E01..E03、TC-G04 的重跑）在 T242 执行，前置条件与 001 的 M4 手册一致（关闭其它代理工具的 TUN/虚拟网卡模式）。

## 边界与异常场景

| 场景 | 期望行为 | 实际结果 | Status |
| ---- | -------- | -------- | ------ |
| EC2-001 重复触达二级窗口入口 | 聚焦已有窗口，不新开 | 未执行（待 T241） | Pending |
| EC2-002 关闭日志开关时窗口正开着 | 窗口自动关闭、缓冲清空 | 未执行（待 T241） | Pending |
| EC2-003 二级窗口在前台时会话过期/代理冲突 | 模态在主窗口并聚焦；二级窗口不关闭、状态刷新 | 未执行（待 T241） | Pending |
| EC2-004 关闭主窗口 | 应用退出、二级窗口随之关闭、退出清系统代理仍执行 | 未执行（待 T242） | Pending |
| EC2-005 捕获方式切回系统代理而捕获窗口开着 | 窗口保留并显示「进程捕获未启用」 | 未执行（待 T241/T242） | Pending |
| EC2-006 候选应用枚举失败/为空 | 捕获窗口显示空态与原因，不阻塞主窗口 | 未执行（待 T241） | Pending |
| EC2-007 日志超过 200 条 | 丢最旧、始终最新 200 条 | 未执行（待 T229 组件测试 + T241 实机） | Pending |
| EC2-008 窗口组件抛错 | 显示中文错误面板与 [重新加载窗口]，不白屏 | 未执行（待 T208 组件测试） | Pending |
| EC2-009 内容缩放（zoom 1.25/1.5） | 窗口尺寸随缩放按比例增大（clamp 到工作区）且仍零滚动；clamp 后仍装不下则依次外移内容 | 未执行（待 T226/T241） | Pending |
| EC2-010 未登录时打开捕获窗口 | 允许打开，勾选可保存但不生效 | 未执行（待 T241） | Pending |

## 兼容性

| 维度 | 结论 | 依据 |
| ---- | ---- | ---- |
| 接口兼容 | 只增不改：既有 16 个命令方法与 3 个事件签名不变，新增 4 个命令 | TC-J12；[docs/api/electron-ipc.md](../../docs/api/electron-ipc.md) §兼容性策略 |
| 数据兼容 | 无变化（`config.json` / 会话存储格式不变，无迁移） | [design.md](design.md) §Data Model Changes |
| 行为兼容 | 界面之外行为不变：桥、代理、CA、会话、改写、配置持久化语义保持 | TC-J13；Python L0/L1/L2 与 App 单测回归 |
| 用户可见变化 | 主窗口 720×640 → 720×560 且不可缩放；allowlist/捕获/日志改到二级窗口 | [docs/ui-ux/](../../docs/ui-ux/README.md) 更新 + 001 取代注记 |
| 运行环境 | 新增前端工具链的 Node engines 要求（vite 7 需 ≥22.12），仓库与 CI 满足 | [plan.md](plan.md) §Dependencies |

## 安全

| 检查项 | 结论 | 依据 |
| ------ | ---- | ---- |
| 输入校验 | 主机名与捕获 pattern 的校验仍在 Main（渲染层只做入口提示） | TC-J07/TC-J04 的非法输入路径；`store.ts` / `ipc.ts` 校验未变 |
| 权限 | 渲染层保持 `sandbox: true` + `contextIsolation: true`、无 Node 集成；仅经 preload 访问 Main | TC-J10（源码检查 + 窗口配置检查） |
| 敏感数据 | 日志缓冲进 Main 内存（≤200 条、不落盘）、记录键集合不变、不含 Cookie/正文；WRD key/IV 仍不跨 IPC | TC-J10、NFR-003 |
| CSP | 仅 `style-src` 放宽（AntD 运行期注入样式），`script-src 'self'`、`default-src 'none'` 不放宽；无远程资源 | TC-J10；[ADR-0012](../../docs/architecture/adr/ADR-0012-react-antd-multiwindow-renderer.md) |
| 依赖 | 新增 8 个依赖全部为 MIT，离线随包分发；引入第二套测试运行器的理由记入 ADR-0012 与 dependency-policy | [dependency-policy.md](../../docs/development/dependency-policy.md) 实施期记录 |

## 文档同步

| 文档 | 是否需要更新 | 状态 |
| ---- | ------------ | ---- |
| [docs/requirements/](../../docs/requirements/README.md) | 是（REQ-012 新增 + REQ-001/003/005/009 边界说明） | 已完成（2026-09-23） |
| [docs/architecture/](../../docs/architecture/README.md) | 是（components / interfaces / data-flow） | Pending（T234） |
| [docs/api/](../../docs/api/README.md) | 是（electron-ipc.md：4 个新方法 + 广播面） | Pending（T235） |
| ADR | 是（[ADR-0012](../../docs/architecture/adr/ADR-0012-react-antd-multiwindow-renderer.md)，`Proposed`） | 已完成（2026-09-23，待评审置 `Accepted`） |
| [docs/ui-ux/](../../docs/ui-ux/README.md) | 是（main-window 重写 + secondary-windows 新增） | Pending（T233） |
| [docs/development/](../../docs/development/README.md) | 是（dependency-policy / testing-strategy） | Pending（T237） |
| `.en.md` 配对 | 是（上述 docs/** 变更均需配对） | Pending（T233..T238） |
| [apps/desktop/README.md](../../apps/desktop/README.md) | 是（构建命令、生成物、`test:ui`、窗口结构） | Pending（T232） |

## 未验证 / 无法验证项

| 项 | 原因 | 已尝试 | 需要谁决策 |
| -- | ---- | ------ | ---------- |
| Windows 侧界面行为（二级窗口、CJK 字体下的零滚动、AntD 在 Windows 的对话框习惯） | 沿用 001 的延期结论（`KI-001`），本 Spec 的实机验证在 macOS 执行 | 无（未在 Windows 真机执行） | cherrchen（是否随 001 的 Windows 验收一并执行） |
| 内容缩放（zoom 1.25 / 1.5）下的零滚动与窗口 clamp 行为 | 需真实渲染实测（T241）；规则已定（窗口随 zoomFactor 放大并 clamp 到工作区，Q2-003） | 未执行 | cherrchen（若 clamp 后仍溢出，决定依次外移哪些内容） |
| 真实进程捕获的「只对所选应用生效」 | 需 CA + 真实会话 + 系统扩展授权（人本人确认），与 001 的 M3/M4 遗留相同 | 无 | cherrchen |

## 结论

- [ ] 映射表无 `Pending`
- [ ] 执行的命令与结果已记录
- [ ] 文档影响已处理
- [ ] Spec 状态可推进到 `Verified`

当前状态：本 Spec 为 `Draft`，尚未实施；上表四项均未满足。实施完成后按 T240..T242 回填证据，再评估是否推进到 `Implemented`（`Verified` 仍受 Windows 侧与进程捕获真实范围两项既有遗留约束）。
