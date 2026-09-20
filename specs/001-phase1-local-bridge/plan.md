# Implementation Plan: Phase 1 本机桥（001-phase1-local-bridge）

> Spec ID: 001
> Status: Draft
> Owner: cherrchen
> Last Updated: 2026-09-20

## Strategy

总体策略：**先打通「curl 经本地桥访问 allowlist 主机」的最小闭环，再上桌面编排与体验，最后做双平台真机验收**。排序依据来自 M0 已完成的 codec 验证结论——URL 改写是主路径上唯一已被证实可行的环节，因此先把它固化并测通，其余环节都建立在它的正确性上。

原则：

1. **每一步可独立验证**：codec 向量（L0）→ addon 对录制流量（L1）→ mitmdump + curl 经代理（L2）→ 真机教务（L3），上一层不通过不进入下一层。
2. **每一步可回滚**：见「Rollback」三层（停 Addon 进程 / 恢复系统代理 / 卸载 CA），任意阶段都能回到「无残留系统代理 + 无信任 CA」的状态。
3. **薄 Addon**：mitmproxy 与 Python 提供 TLS/HTTP2/证书，Addon 只做 WRD 改写与直连判定（[ADR-0002](../../docs/architecture/adr/ADR-0002-reuse-mitmproxy-for-tls.md)）；OS 差异集中在 Proxy Orchestrator 与 Cert Manager。
4. **正确性与可逆性优先于功能数量**：响应反向改写、CA 卸载、关闭后清系统代理属于主路径，先于 UI 打磨。

## Phases

阶段编号沿用 WBS 里程碑 MS0..MS4（与 [docs/planning/roadmap.md](../../docs/planning/roadmap.md) 的 M0..M4、归档 WBS §2 的 MS0..MS4 对应）。

### MS0 预研（已完成，2026-09-20）

- 目标：验证 WRD URL 编解码可行性，锁定需求规格与文档包。
- 交付物：`wrd_codec.py` 原型（实机 URL 验证）、需求规格一页纸 v1.0、需求/设计/测试/项目管理文档包（归档于 `docs/archive/2026-09-20-swufe-webvpn-bridge-docs-v1.0/`）、本 Spec 五个文件。
- 退出条件：codec 自检通过；需求规格与接口/数据模型已评审；文档包发布（归档 WBS MS0 =「文档包发布；codec OK」）。

### MS1 桥核心

- 目标：mitm WRD addon + Cookie 注入可用，curl 经本地桥 + 真实/模拟 WebVPN 访问 allowlist 主机成功。
- 交付物：固化后的 WRD codec 库与向量测试、allowlist 匹配库、mitm 工程骨架、请求改写 addon、响应反向改写（Location → Set-Cookie → HTML/JS/JSON）、Cookie/配置热更新、（可选）控制/健康检查口。
- 退出条件：L0/L1/L2 通过（TC-A01..A05、TC-B01..B04、TC-F01..F03）；curl 经本地桥访问 allowlist 主机时上游看到 WebVPN 形态或教务可达（归档 WBS MS1 完成定义）。

### MS2 桌面编排

- 目标：Electron 可登录、开桥、设置系统代理、安装 CA；代理冲突与过期路径可用。
- 交付物：Electron 脚手架与 preload 契约、登录 WebView + Session Broker + 防环、Proxy Orchestrator（冲突检测 / 系统代理 / sidecar 生命周期）、Cert Manager（生成/安装/卸载）、macOS 与 Windows 系统适配。
- 退出条件：TC-C01..C04、TC-D01..D04、TC-E01..E03 通过；关闭、会话过期或退出后无残留系统代理（NFR-004）；系统代理被占用时拒绝启动（TC-C01）。

### MS3 体验打磨

- 目标：Allowlist/开关/状态 UI、进程捕获 UI、调试日志面板与文案完成，浏览器教务验收通过（至少一侧平台）。
- 交付物：主窗口各分区、进程捕获进程选择、调试日志面板（域名 + 结果，默认关）、状态与错误文案。
- 退出条件：TC-H01、TC-H02、TC-F04、TC-G04 通过；TC-G01、TC-G02 在至少一侧桌面 OS 通过。

### MS4 验收

- 目标：双平台 P0 用例通过，可私用。
- 交付物：macOS 与 Windows 教务浏览器验收记录（TC-G01..G03）、缺陷收敛与已知问题列表、开发版运行说明与打包方案。
- 退出条件：出口准则全部满足——所有 P0 用例通过、P1 无未决阻断缺陷、教务浏览器验收至少一侧桌面 OS 通过（目标两侧）、已知问题列表已记录。

## Dependencies

| 依赖项 | 类型 | 阻塞内容 | 解除条件 |
| ------ | ---- | -------- | -------- |
| 已验证 codec（`wrd_codec.py`、MS0） | 内部 | T003、T004 的实现基准 | M0 已完成（2026-09-20） |
| codec 固化（T003）→ 请求改写 addon（T008）→ 响应反向改写（T009..T011）→ L3 教务验收（T037/T038） | 内部 | 主路径串行链 | 上游任务验证通过；对应 TC 通过 |
| mitm 工程骨架（T007）、登录会话（T016/T017）、Proxy Orchestrator（T020）、Cert Manager（T022） | 内部 | Allowlist/开关/状态 UI（T025）与 MS3 | 上述任务完成且桥可开、系统代理可设、CA 可装 |
| macOS 系统适配（T029..T031）与 Windows 系统适配（T032、T033） | 内部 | 双平台验收（T037/T038） | 与 Proxy Orchestrator / Cert Manager 并行完成后各自 TC 通过 |
| macOS、Windows 各一台测试机 + Chrome/Edge + mitmproxy/curl | 外部 | L1/L2/L3 执行（T035..T039） | 环境就绪（测试计划 §7） |
| 测试者自有西财账号（不写入仓库）与授权设备 | 外部 | L3 真实 WebVPN 与教务验收（T019、T037、T038） | 账号与授权设备就绪 |
| 管理员权限（CA 信任安装） | 外部 | TC-E01/TC-E02 | 测试机可提权执行信任库操作 |
| Q-001 会话 Cookie 名称与失效信号实机确认 | 决策 | T017、T019 的最终信号组合 | 实机验证给出可用信号（不阻塞先行实现探测框架） |
| Q-002 mitm sidecar 分发形态 | 决策 | T042 打包方案 | 实现阶段定体积方案（不阻塞开发版） |

## Migration

不适用：首次实现，无既有数据、配置或接口需要迁移；`userData/config.json` 与 `userData/session.bin` 不存在时按默认值/空会话初始化。

## Rollback

| 场景 | 回滚动作 | 影响范围 | 验证回滚成功的方式 |
| ---- | -------- | -------- | ------------------ |
| 桥的核心改写异常/崩溃（Addon 或 sidecar 故障） | 停 Addon 进程：终止 mitmdump sidecar，UI 状态回到 `idle`/`error`（`BRIDGE_CRASH`） | 仅本机桥进程；浏览器回到直连（此时校外无法访问校内站点） | 确认无遗留 mitmdump 进程；浏览器可正常直连公网 |
| 系统代理设置异常或残留（开桥失败、非正常退出） | 恢复系统代理：仅在「由本 App 设置」标记存在时清除本 App 写入的代理，不触碰用户其它设置 | 本机系统 HTTP/HTTPS 代理设置 | 读 OS 代理为空（或回到开桥前值）；TC-C03/TC-C04 通过 |
| 不再需要 HTTPS 解密（用户卸载、排障） | 卸载 CA：从系统信任库移除本机 MITM CA | 系统信任库 | 信任库中不再出现本机 CA；UI `getCaStatus` 为未安装（TC-E02） |

三层顺序（降级时）：先停 Addon 进程 → 再恢复系统代理 → 最后卸载 CA；任一层可单独执行且可重入。

## Documentation Updates

| 文档 | 需要的更新 | 何时更新 | 负责人 |
| ---- | ---------- | -------- | ------ |
| [docs/requirements/](../../docs/requirements/README.md) | 无影响：REQ-001..REQ-011 / NFR-001..NFR-007 的规范定义在 requirements，本 Spec 只引用；若实现中产生新需求，先在 requirements 登记再回写 [spec.md](spec.md) | 出现需求变更时 | cherrchen |
| [docs/architecture/](../../docs/architecture/README.md) | 无影响：组件、数据流、接口、数据模型均为首次实现，内容由 architecture 文档定义；实现若偏离（组件边界或数据流变化）需先更新 architecture 或新建 ADR | 实现偏离设计时 | cherrchen |
| [docs/api/](../../docs/api/README.md) | 已同步：本批次建立 [electron-ipc.md](../../docs/api/electron-ipc.md)、[bridge-control-protocol.md](../../docs/api/bridge-control-protocol.md)、[wrd-codec-library.md](../../docs/api/wrd-codec-library.md)；实现若变更签名需同步 | 接口签名变更时 | cherrchen |
| ADR（如需） | 无新增：[ADR-0001](../../docs/architecture/adr/ADR-0001-wrd-rewrite-in-mitm-layer.md)..[ADR-0005](../../docs/architecture/adr/ADR-0005-builtin-wrd-key-with-override.md) 已 Accepted；决策语义变化须新建 ADR 并 Supersede | 决策变化时 | cherrchen |
| [docs/planning/roadmap.md](../../docs/planning/roadmap.md) | 状态更新（Spec 001 状态随 Spec 推进；M1..M4 行状态） | 里程碑达成/Spec 状态变化时 | cherrchen |
| [docs/ui-ux/main-window.md](../../docs/ui-ux/main-window.md) | 已同步：主窗口信息架构与状态集合；实现若调整交互需同步 | 交互变化时 | cherrchen |
| [docs/planning/milestones/](../../docs/planning/milestones/README.md) | 状态更新：M0 Done；M1..M4 由 Planned 推进，完成记录写在各里程碑文件 | 里程碑达成时 | cherrchen |

> 对照 [Documentation Update Matrix](../../docs/development/documentation-rules.md) 逐项判断；无影响的行已写明「无影响」及理由。

## Verification Plan

| 验收标准 | 验证方式 | 何时执行 | 证据形式 |
| -------- | -------- | -------- | -------- |
| AC-001 | TC-G01 / TC-G03（L3 手工：双平台启动应用）+ 开发版启动 smoke | MS2 起（macOS）、MS4（Windows） | 启动记录/截图 + 应用可交互 |
| AC-002 | TC-D01（L1/L3：完成 CAS 后 `loggedIn=true`）+ TC-F04（日志检查无 Cookie/密码） | MS2 | UI 状态截图 + 日志文件节选（无 Cookie 与密码） |
| AC-003 | TC-C01（L1/L2：OS 代理已开时 `startBridge`） | MS2 | 错误码 `PROXY_CONFLICT` + OS 代理前后未变 |
| AC-004 | TC-C02 / TC-C03 / TC-C04（L1/L2：开桥设代理、关桥清代理、退出清代理） | MS2 | OS 代理读取命令输出（开桥前/中/后三态） |
| AC-005 | TC-E01 / TC-E02（L3 手工，需管理员权限） | MS2 | 系统信任库中 CA 的存在/移除 + UI `getCaStatus` |
| AC-006 | TC-B01 / TC-B02 / TC-B05（L0/L1：默认值、精确命中、重启持久化）+ TC-H02（L3 手工：通配勾选） | MS1（匹配与默认值）、MS3（UI） | L0 测试输出 + 重启后配置文件内容 |
| AC-007 | TC-G01 / TC-G02 / TC-G03（L3 手工：教务首页与页面内导航） | MS3（至少一侧）、MS4（双平台） | 验收记录（含已知问题），不绑定 DOM |
| AC-008 | TC-D03（L1/L3：模拟失效信号） | MS2 | 状态机日志（停桥→清代理→停捕获）+ UI 弹窗截图 |
| AC-009 | TC-F04（L2 + L3：调试日志内容检查） | MS3 | 日志节选（仅 `host`/`rewritten`/`ts`，无正文） |
| AC-010 | TC-D04（L2 抓包/日志：登录期间访问 webvpn/authserver 主机） | MS2 | 抓包或日志显示登录流量无 WRD 二次包装 |

结果登记到 [verification.md](verification.md)。

## Open Questions

| ID | 问题 | 影响 | 状态 |
| -- | ---- | ---- | ---- |
| PQ-001 | 会话 Cookie 名称与失效信号以实机为准（= [spec.md](spec.md) Q-001 / [design.md](design.md) DQ-001） | T017、T019 的实现细节；不阻塞先行实现探测框架 | Open |
| PQ-002 | mitm sidecar 分发形态未定（= [spec.md](spec.md) Q-002 / [design.md](design.md) DQ-002） | T042 打包方案；不阻塞开发版（本机 Python venv + mitmdump） | Open |
| PQ-003 | 产品名为暂定名（= [spec.md](spec.md) Q-003） | 文档与发布物料；不影响实现 | Open |
