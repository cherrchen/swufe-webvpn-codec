# Session Handoff — 2026-09-21 — M4 验收（macOS 交互式 + Windows 延期）

## Current Goal

按已批准的执行计划完成 M4（`docs/planning/milestones/M4-acceptance.md` 的退出条件），关联 Spec：
[specs/001-phase1-local-bridge/](../../specs/001-phase1-local-bridge/spec.md)。计划副本：`local://m4-acceptance-plan.md`。

## Completed

- [x] 步骤 0：开工基线（`git status --short` 为空、HEAD = `38dda16`；`uv run pytest -q` = 190 passed、app typecheck/app 单测 70 passed、`npm run docs:check` = 0 error/0 warning）
- [x] 步骤 1.1/1.6（T044）：`scripts/acceptance-collect.ts` + `npm run acceptance:check`——跨平台脱敏证据采集（`env`/`config`/`runtime-config`/`ca-files`/`trust-store`/`system-proxy`/`bridge-port`/`bridge-smoke`/`bypass-control`/`residue`/`redaction-self-check`）；自检：桥关闭无 `FAIL`、桥运行 `bridge-port: open` + `bridge-smoke: 200 OK`、哨兵值 0 命中，且人为泄漏时该检查变 `FAIL` + 退出码 1（机制性验证失败路径，含哨兵的报告未入库）
- [x] 步骤 1.2（T040）：`docs/operations/development-run.md`（+en）+ `docs/operations/README.md`（+en）§3 与 `app/README.md` 交叉引用；含 TUN 模式前置条件（`KI-013`）与 Windows 差异
- [x] 步骤 1.3：`specs/001-phase1-local-bridge/known-issues.md`（`KI-001`..`KI-013`，含本轮修复与未决项）
- [x] 步骤 1.4/1.5（T043）：`verification.md` 的「M4 双平台验收执行手册（交互式）」+ 结果表；`tasks.md` 登记 T043/T044
- [x] 步骤 2：macOS 交互式验收实机执行——通过 TC-D01/D02/D03/D04、TC-C01..C04、TC-E01（经应用自带手动命令）/E02/E03、TC-F01/F04、TC-G04、TC-H01/H02、TC-B05；**失败 TC-G01/G02**（`KI-011`）
- [x] 步骤 2.15：证据入库 `specs/001-phase1-local-bridge/evidence/{acceptance-macos,kit-selfcheck}/`（入库前 leak scan 通过）
- [x] 步骤 3：Windows 延期成文（`KI-001` + 里程碑/验证文档显式标注，未静默改里程碑定义）
- [x] 步骤 4（4.1/4.2）：缺陷收敛与文档同步（verification/tasks/spec、M4 里程碑(+en)、milestones/README(+en)、roadmap(+en)、testing-strategy(+en)、operations）
- [x] 验收期修复的三个缺陷：`KI-008`（`probe()` 补 `useSessionCookies: true`）、`KI-009`（`openLogin()` 把 ERR_ABORTED 视为非致命）、`KI-010`（darwin 证书选择器补 `-Z`），均带单测/复验证据

## In Progress

无：本轮计划内可自主完成与需要 cherrchen 配合的步骤均已执行。

## Remaining

- [ ] **`KI-011`（P0，阻断 TC-G01/G02）**：网关客户端 shim 与透明桥不兼容。需 cherrchen 在三条候选路径中决策并补 ADR：(a) 网关自有路径（`/wengine-vpn/...`）不经 token、直接取自网关根；(b) 在改写后的 HTML 中剥离 shim；(c) 接受教务以 WebVPN 门户 URL 空间使用
- [ ] `KI-007`：CA **自动**安装的提权方式改造（由应用进程直接调用 `security`，让 SecurityAgent 在本 App 的 GUI 会话内弹授权），属安全模型变更 → ADR
- [ ] T037/T038：教务验收（macOS 未通过、Windows 延期）与 T023/T030（CA 自动安装）保持未勾选，解除条件已写入各任务行
- [ ] `KI-013`：把「关闭 TUN/虚拟网卡模式」做成开桥前预检或错误文案（当前只写入文档）
- [ ] `KI-006`：Q-001 的另两个失效信号（`Set-Cookie` 清空、连续改写后 302 到 CAS）是否补实现

## Important Decisions

已迁移（长期结论）：

- 验收结论与逐需求/逐用例状态 → [verification.md](../../specs/001-phase1-local-bridge/verification.md)（映射表、AC 表、M4 结果表、教务浏览器验收记录、未验证项、结论）
- 缺陷台账与候选解除路径 → [known-issues.md](../../specs/001-phase1-local-bridge/known-issues.md)
- 里程碑状态与完成记录（含「至少一侧 OS 通过」下限未达成的口径） → [M4-acceptance.md](../../docs/planning/milestones/M4-acceptance.md)（+en）
- 开发/验收运行前置条件（含 TUN）与自检方式 → [development-run.md](../../docs/operations/development-run.md)
- L3 的执行方式与基线 → [testing-strategy.md](../../docs/development/testing-strategy.md)（+en）

临时项（未定，Open）：

- `KI-011` 的三条候选路径未决策（本轮按计划只记缺陷、不改公共契约）。
- 教务真机入口形态为 `http://jwxt.swufe.edu.cn/...`（`https` 形态网关返回 `/wengine-vpn/failed`）；是否在应用内提示用户改写 scheme 未决策。
- 本机采用的自动化浏览器导航会反复卡死（同一实例内 `fetch` 正常），浏览器验收最终由 cherrchen 手工完成；若下一轮要自动化，需要先定位该环境的导航挂起原因。

## Changed Files

| 文件 | 变更 | 关联任务 |
| ---- | ---- | -------- |
| `scripts/acceptance-collect.ts` | 新增：跨平台脱敏证据采集（含 `--scheme`、`-Z` 选择器、redaction self-check） | T044 |
| `package.json` | 新增 `acceptance:check` 脚本 | T044 |
| `app/src/main/session-broker.ts` | 修复 `KI-008`（`useSessionCookies`）与 `KI-009`（ERR_ABORTED 非致命） | T019/T028 |
| `app/src/main/platform/darwin/cert.ts` | 修复 `KI-010`：`find-certificate` 选择器补 `-Z` | T023/T024/T030 |
| `app/test/cert-parse.test.ts` | 更新为实测输出形态（带 `-Z` / 不带 `-Z` 各一例） | T024 |
| `docs/operations/development-run.md`（+en） | 新增：开发版运行说明（T040） | T040 |
| `docs/operations/README.md`（+en） | §3 指向 development-run.md + TUN 前置条件 | — |
| `app/README.md` | 顶部指向 development-run.md | — |
| `docs/planning/milestones/M4-acceptance.md`（+en）、`milestones/README.md`（+en）、`roadmap.md`（+en） | M4 状态 `Planned → In Progress` + 退出条件勾选 + 完成记录 | — |
| `docs/development/testing-strategy.md`（+en） | L3 执行方式（M4 手册 + `acceptance:check`）、基线 71、TUN 前置 | — |
| `specs/001-phase1-local-bridge/{verification,tasks,spec}.md` | M4 结果、任务勾选、状态说明 | T037..T044 |
| `specs/001-phase1-local-bridge/known-issues.md` | 新增：`KI-001`..`KI-013` 台账 | T039 |
| `specs/001-phase1-local-bridge/evidence/**` | 新增：12 份脱敏证据报告 | T044 |

## Commands / Tests Run

| 命令 | 结果 | 备注 |
| ---- | ---- | ---- |
| `npm run acceptance:check -- --out <dir> --user-data-dir /tmp/m4-acceptance` | 桥关闭：无 `FAIL`/退出码 0；桥运行（`--scheme http`）：`bridge-smoke: 200 OK` | 证据入库 |
| `uv run pytest -q` | `190 passed` | Python 层无回归 |
| `npm --prefix app run typecheck` / `npm --prefix app run test:unit` | 无 error / `71 passed` | 含 `KI-010` 新增用例 |
| `npm --prefix app run build` / `npm run typecheck` | 通过 / 无 error | — |
| `npm run docs:check` | `0 error(s), 0 warning(s)` | 双语配对与链接 |
| 真实应用 M4 验收（CDP 驱动 + cherrchen 手工动作） | 见 M4 结果表 | 18 项通过、2 项失败、1 项延期 |
| `security find-certificate … -Z` / `verify-cert` / `networksetup` / `scutil` | 见证据报告 | 安装/卸载/代理三态 |

## Known Problems

- `KI-011`（P0）：教务浏览器验收失败——根因是网关客户端 shim（`__vpn_*` + `/wengine-vpn/js/main.js`，经桥 404 / 网关根 200）与透明桥的普通 URL 空间模型冲突；三条候选修复路径都改公共契约，未决策。
- `KI-007`：CA 自动安装失败（osascript 提权子进程无法为信任设置弹 GUI 授权）；本次以应用自带的手动 `sudo security add-trusted-cert …` 通过。卸载路径自动可用。
- `KI-013`：TUN + fake-ip 会让经桥上游挂起，`PROXY_CONFLICT` 检测不到 TUN；已写入文档，未做预检。
- `KI-012`：`http://www.swufe.edu.cn/` 经 mitmproxy（无 addon 的裸实例也复现）无响应；与桥代码无关，未定位。
- `KI-004`/`KI-005`/`KI-006`：既有已接受/未决项，见台账。

## Recommended Next Step

1. 决策 `KI-011` 的修复路径（建议优先 (a)：网关自有路径不经 token 直接取自网关根——改动最小且保留普通 URL 模型），补 ADR 后实现并复跑 TC-G01/G02。
2. 决策 `KI-007` 的提权改造（应用进程直接调用 `security`），补 ADR 后在真机复验 TC-E01 的自动路径。
3. 有条件时补 Windows 真机项（`KI-001`）：按 `docs/operations/development-run.md` 备环境 → `npm run acceptance:check` → M4 手册的教务浏览器段。
4. 收敛 Q-001（`KI-006`）与 `KI-013` 的环境预检。
