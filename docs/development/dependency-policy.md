# 依赖策略

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-23

**用途**：规定引入外部依赖前的评估要求。目标是**降低长期风险**，不是禁止依赖。

---

## 1. 引入依赖前必须回答

| 维度 | 问题 | 判定 |
| ---- | ---- | ---- |
| Necessity | 标准库 / 现有依赖能否解决？ | 能 ⇒ 不加 |
| Maintenance | 最近是否有版本发布？Issue 是否被响应？ | 停滞 ⇒ 谨慎 |
| License | 许可证是否与项目兼容？ | 不兼容 ⇒ 禁止 |
| Security | 是否有未修复的已知漏洞？ | 有 ⇒ 禁止或有条件使用 |
| Size | 体积与运行时开销是否可接受？ | 量级不符 ⇒ 评估替代 |
| Transitive deps | 引入多少间接依赖？ | 树过大 ⇒ 谨慎 |
| Native build | 是否需要编译工具链 / 平台特定二进制？ | 影响可移植性 ⇒ 需 ADR |
| Fit | 与既有技术栈是否一致？ | 引入第二套等价方案 ⇒ 需 ADR |

**禁止**引入第二套功能等价的依赖（例如两个功能重叠的工具库），除非有 ADR 说明理由。

## 2. 记录要求

| 情况 | 记录位置 |
| ---- | -------- |
| 普通依赖（满足上表全部要求） | PR 描述中的依赖说明（含版本与理由） |
| 引入基础设施级依赖 / 难以替换的依赖 | ADR（见 [adr/README.md](../architecture/adr/README.md)） |
| 依赖变更影响用户可见行为或性能 | 相关 Spec + [non-functional-requirements.md](../requirements/non-functional-requirements.md) |

模板：

```text
Dependency:   <name>
Version:      <version>
Purpose:      <why we need it>
Alternatives: <considered and rejected>
License:      <license>
Risk:         <maintenance / security / size / transitive>
```

## 3. 版本与锁定

```text
Version policy: Node 侧：pnpm 11 workspaces（仓库根 package.json 的 `packageManager` 固定版本；workspace 成员由 `pnpm-workspace.yaml` 的 `packages` 定义）+ 仓库根 `pnpm-lock.yaml`（已提交）；Python 侧：uv + bridges/python/uv.lock（已提交；`uv sync --directory bridges/python` 安装，`uv sync --frozen --directory bridges/python` 校验锁定一致）
Lockfile:       Node 侧仓库根 `pnpm-lock.yaml` 已提交（单一锁文件，覆盖仓库根与 apps/desktop/）；安装用 `pnpm install`，校验锁定一致用 `pnpm install --frozen-lockfile`；Python 侧 bridges/python/uv.lock 已提交；解释器版本由 bridges/python/.python-version 固定（3.13）
Update cadence: TBD（更新节奏待决策）
```

### 3.1 安装脚本审批（pnpm `allowBuilds`）

`pnpm-workspace.yaml` 的 `allowBuilds` 逐个列出**允许执行安装脚本**的依赖（当前为 `electron`、`esbuild`）；未列入的依赖若带安装脚本，`pnpm install` 会以 `ERR_PNPM_IGNORED_BUILDS` 失败——先在 `allowBuilds` 中评审并显式列入，是继续安装的必需步骤。

M6 新增的渲染层依赖（见第 5 节「依赖记录（M6 新增）」）安装时未触发该错误，故 `allowBuilds` 未增补。

## 4. 安全与合规

- 依赖漏洞扫描工具：`TBD`（本期未引入；Node 侧 devDependencies 与 Python 侧 `bridges/python/uv.lock` 均已被版本锁定）；
- 扫描频率与阻断阈值：`TBD`（同上）；
- 许可证白名单 / 黑名单：`TBD`（本期未引入；已按第 2 节逐项记录新增依赖的许可证，可参考 [security/](../security/README.md)）。

项目许可为 MIT（见 [LICENSE](../../LICENSE)）。

## 5. 本项目既有与计划依赖

| 依赖 | 用途 | 说明 |
| ---- | ---- | ---- |
| Electron | 桌面壳 | 理由与代价见 [ADR-0003](../architecture/adr/ADR-0003-electron-gui-for-phase-1.md)；M2 起是 `apps/desktop/` 的开发期依赖（`devDependencies`，锁定 44.4.3），开发运行与后续打包都用它 |
| mitmproxy | TLS / HTTP2 / MITM 基础设施级依赖 | 见 [ADR-0002](../architecture/adr/ADR-0002-reuse-mitmproxy-for-tls.md)；按本策略第 2 节须记 ADR。M1 起是**运行期依赖**：sidecar 经 `mitmproxy.tools.main.mitmdump` 驱动，是桥与控制面的宿主（`bridges/python/swufe_bridge/sidecar.py`），其专用 confdir 同时承载 MITM CA |
| cryptography | AES-128-CFB128 编解码（WRD hostname token） | M1 新增为直接依赖；本来就随 mitmproxy 传递引入，直接声明是为固定 codec 所用 API（`bridges/python/swufe_bridge/wrd_codec.py`） |
| pytest | Python 侧测试框架（L0/L1/L2） | M1 新增，dev 依赖组（`[dependency-groups] dev`） |
| hatchling | Python 包构建后端 | M1 新增，构建期依赖，不进入运行期 |
| pycryptodome | 仅归档原型 [wrd_codec.py](../archive/2026-09-20-swufe-webvpn-bridge-docs-v1.0/99-appendix/wrd_codec.py) 使用 | 不作为当前实现依赖；M1 的 codec 改用 `cryptography` 的 AES-CFB128（与原型 `segment_size=128` 等价，由 TC-A02 门禁向量保证） |
| sing-box | 后续 TUN 阶段 | 第一期不引入 |
| esbuild | 打包沙箱 preload（`apps/desktop/src/preload/index.ts` → `apps/desktop/dist/preload/index.js`） | M2 新增（`apps/desktop/` devDependency，锁定 0.28.2）。Electron `sandbox: true` 的 preload 不能 `require` 相对路径，必须产出单文件；esbuild 已是 tsx 的传递依赖，直接声明以便固定打包行为 |
| tsx | 运行 `apps/desktop/test/**/*.test.ts`（Node 内置 test runner 的 TS 加载器） | M2 新增（`apps/desktop/` devDependency，锁定 4.23.15）。选它是因为仓库根文档检查脚本已用同一方案（不引入第二套 TS 运行方式） |
| typescript、@types/node | 仅用于本仓库文档检查脚本与 `apps/desktop/` 的类型检查 | Node 侧；`apps/desktop/` 与仓库根使用同一大版本（typescript 5.x、@types/node 22.x），不引入 Markdown parser 或框架 |
| react、react-dom | 渲染层组件化（四窗口共用组件树） | M6 新增（`apps/desktop/` devDependency，锁定 19.3.0）；理由与取舍见 [ADR-0012](../architecture/adr/ADR-0012-react-antd-multiwindow-renderer.md) |
| antd | 组件库（表单 / 开关 / 单选 / 表格 / 模态 / 布局） | M6 新增（锁定 6.6.5）；运行期样式经 `@ant-design/cssinjs` 注入，故 CSP 的 `style-src` 放宽到 `'self' 'unsafe-inline'`（`script-src` 不放宽） |
| @ant-design/icons | 界面图标 | M6 新增（锁定 6.3.4）；与 antd 同族版本 |
| vite | 渲染层构建（四个 HTML 入口 + 共享 chunk）与开发期 dev server | M6 新增（锁定 7.3.6）；产物落在 `apps/desktop/dist/renderer/` |
| @vitejs/plugin-react | 开发期 Fast Refresh | M6 新增（锁定 5.2.0）；仅 dev 生效 |
| vitest | 渲染层组件测试运行器（第二套测试运行器） | M6 新增（锁定 3.2.7）；按本策略第 1 节须有 ADR 说明理由，见 [ADR-0012](../architecture/adr/ADR-0012-react-antd-multiwindow-renderer.md) |
| jsdom | vitest 的 DOM 环境 | M6 新增（锁定 26.1.0） |
| @testing-library/react、@testing-library/dom | 组件测试（`@testing-library/dom` 是 RTL 16 的必需 peer） | M6 新增（锁定 16.3.3 / 10.4.2） |
| @types/react、@types/react-dom | React 类型 | M6 新增（锁定 19.3.0）；仅类型 |

### 依赖记录（M6 新增）

M6 把渲染层从裸 DOM 迁移到 React 19 + Ant Design 6（多窗口，见 [ADR-0012](../architecture/adr/ADR-0012-react-antd-multiwindow-renderer.md)，Accepted 2026-09-23）。以下 10 项全部为 `apps/desktop/package.json` 的 `devDependencies`（用 caret，锁在仓库根 `pnpm-lock.yaml`），许可证均为 **MIT**；`react`/`react-dom`/`antd`/`@ant-design/icons` 属运行期依赖树，但按当前仓库约定与 `electron`/`esbuild` 同级放在 `devDependencies`（渲染层由 Vite 打进 `dist/renderer`，本期无打包分发形态）——因此所有新增依赖均随包分发、无 CDN。

```text
Dependency:   react / react-dom
Version:      ^19.3.0（pnpm-lock.yaml 锁定 19.3.0）
Purpose:      渲染层组件化：四个窗口共用组件树，状态与订阅集中在 hooks
Alternatives: 继续裸 DOM（多窗口与表单/表格状态手工维护，成本随窗口数增长）；Svelte / Vue（引入第二套框架，ADR-0012 已评估并否决）
License:      MIT
Risk:         渲染层产物随包分发（无 CDN）；按仓库约定放在 devDependencies，本期无打包分发形态
```

```text
Dependency:   antd
Version:      ^6.6.5（pnpm-lock.yaml 锁定 6.6.5）
Purpose:      组件库：表单 / 开关 / 单选 / 表格 / 模态 / 布局
Alternatives: 手写全部控件（需自行实现焦点管理、模态与表格的可访问性）；引入其它组件库（与 antd 功能重叠，按第 1 节禁止）
License:      MIT
Risk:         运行期经 @ant-design/cssinjs 注入 <style>，故 CSP 的 style-src 放宽到 'self' 'unsafe-inline'（script-src 不放宽，见 SC2-004）；产出 antd 共享 chunk，体积记入验收报告
```

```text
Dependency:   @ant-design/icons
Version:      ^6.3.4（pnpm-lock.yaml 锁定 6.3.4）
Purpose:      界面图标
Alternatives: 内联 SVG（重复维护、与主题不联动）；其它图标库（视觉与 antd 不共享）
License:      MIT
Risk:         与 antd 同族版本；仅被引用的图标进入产物
```

```text
Dependency:   vite
Version:      ^7.3.6（pnpm-lock.yaml 锁定 7.3.6）
Purpose:      渲染层构建（多入口 + 共享 chunk，产物 apps/desktop/dist/renderer/{main,capture,logs,allowlist}.html + assets/*）与开发期 dev server（HMR）
Alternatives: 继续用 esbuild 手写多入口（需自建 HTML / 资源管线与刷新机制）；webpack（配置与依赖树更重）
License:      MIT
Risk:         平台二进制随可选依赖分发；需 Node ^20.19 || >=22.12，仓库 engines.node >= 22 与 CI 的 node 22 满足（本机实测 Node v24.18.0）
```

```text
Dependency:   @vitejs/plugin-react
Version:      ^5.2.0（pnpm-lock.yaml 锁定 5.2.0）
Purpose:      开发期 Fast Refresh（仅 vite dev 生效）
Alternatives: 无（React 与 Vite 的标准组合）；不使用则开发期每次改动整页刷新
License:      MIT
Risk:         仅 dev 依赖；开发期 CSP 需 script-src 'unsafe-inline' 供其刷新 preamble，生产 CSP 不放宽
```

```text
Dependency:   vitest
Version:      ^3.2.7（pnpm-lock.yaml 锁定 3.2.7）
Purpose:      渲染层组件测试运行器（第二套测试运行器，跑 apps/desktop/test/ui/**/*.test.tsx）
Alternatives: node:test（无 DOM 环境与组件渲染约定，须自建 jsdom 胶水）；jest（配置与 ESM/TS 支持成本更高）
License:      MIT
Risk:         按第 1 节「禁止引入第二套功能等价的依赖」，此处属**例外**：既有 node:test + tsx 无法覆盖 DOM 组件行为，理由与取舍见 ADR-0012（Accepted 2026-09-23）；需 Node >= 22
```

```text
Dependency:   jsdom
Version:      ^26.1.0（pnpm-lock.yaml 锁定 26.1.0）
Purpose:      vitest 的 DOM 环境（vitest.config.ts 的 environment: 'jsdom'）
Alternatives: happy-dom（API 覆盖有差异，元件依赖未验证）；真实浏览器（CI 无显示器，且与第二层实机断言重复）
License:      MIT
Risk:         仅 dev 依赖；需 Node >= 18
```

```text
Dependency:   @testing-library/react / @testing-library/dom
Version:      ^16.3.3 / ^10.4.2（pnpm-lock.yaml 锁定 16.3.3 / 10.4.2）
Purpose:      组件测试以可观察行为为断言口径（文案、禁用规则、调用与参数、事件驱动的状态更新、空态/失败态）；@testing-library/dom 是 RTL 16 的必需 peer
Alternatives: enzyme（不适配 React 19）
License:      MIT
Risk:         仅 dev 依赖
```

```text
Dependency:   @types/react / @types/react-dom
Version:      ^19.3.0（pnpm-lock.yaml 锁定 19.3.0）
Purpose:      React 类型（tsconfig.renderer.json 的 JSX 类型检查）
Alternatives: 无（标准做法）
License:      MIT
Risk:         仅类型，不进入运行期
```

- **安装脚本审批结论**：本轮 `pnpm install` **未**报 `ERR_PNPM_IGNORED_BUILDS`，故 `pnpm-workspace.yaml` 的 `allowBuilds` **未增补**（仍为 `electron: true`、`esbuild: true`）——新增的 10 项依赖均无需要批准的安装脚本。
- **Node engines 结论**：vite 7 需 `^20.19 || >=22.12`、vitest 3 需 `>=22`、jsdom 26 需 `>=18`；仓库 `engines.node >= 22` 与 CI 的 node 22 均满足（本机实测 Node v24.18.0），无需调整 `engines`。
- **测试运行器分工**：`test:unit`（`node:test` + tsx，Main 侧无 Electron 依赖的逻辑）与 `test:ui`（vitest + jsdom，渲染层组件）并存；分层、组织与运行方式见 [testing-strategy.md](testing-strategy.md)。

### 依赖记录（M2 新增）

```text
Dependency:   electron
Version:      ^44.4.3（pnpm-lock.yaml 锁定 44.4.3）
Purpose:      桌面壳：登录 WebView、系统代理编排宿主、CA 安装入口、IPC/preload 边界
Alternatives: Tauri（需 Rust 工具链且 WebView 行为差异大，ADR-0003 已评估并选定 Electron）
License:      MIT
Risk:         体积大（macOS 约 200MB 级）、需随包分发；该包不带 install 脚本，平台二进制须一次性手动获取：`node apps/desktop/node_modules/electron/install.js`（离线环境须预先缓存）
```

```text
Dependency:   esbuild
Version:      ^0.28.2（pnpm-lock.yaml 锁定 0.28.2）
Purpose:      把 sandbox preload 打成单文件（相对 require 在沙箱 preload 中不可用）
Alternatives: 手写单文件 preload（重复常量、可维护性差）；改用 sandbox:false（降低隔离强度，不接受）
License:      MIT
Risk:         平台特定二进制（随可选依赖分发）；安装脚本已由 `pnpm-workspace.yaml` 的 `allowBuilds` 显式批准执行
```

```text
Dependency:   tsx
Version:      ^4.23.15（pnpm-lock.yaml 锁定 4.23.15）
Purpose:      以 Node 内置 test runner 运行 apps/desktop/test 下的 TypeScript 单测（与仓库根文档脚本同一方案）
Alternatives: 编译后再测（多一步构建，且单测已刻意 electron-free）；jest/vitest（引入第二套测试栈）
License:      MIT
Risk:         仅 dev 依赖；随 esbuild 传递引入编译能力
```

```text
Dependency:   @types/node（22.x）
Version:      ^22.10.2（锁定 22.20.4）
Purpose:      Main/preload 与单测的 Node 类型
Alternatives: 无（标准做法）
License:      MIT
Risk:         仅类型，不进入运行期
```

```text
Dependency:   typescript
Version:      ^5.7.2（apps/desktop 实际解析 5.9.3；仓库根同为 5.x）
Purpose:      三个 tsconfig 的类型检查与编译（Main/Renderer 编译，preload 仅类型检查）
Alternatives: 无（与既有文档脚本一致）
License:      Apache-2.0
Risk:         仅 dev 依赖
```

### 依赖记录（M1 新增）

```text
Dependency:   cryptography
Version:      >=42（bridges/python/uv.lock 锁定 48.0.1）
Purpose:      WRD codec 的 AES-128-CFB128（token 加解密）
Alternatives: pycryptodome（归档原型所用；按本策略不引入第二套等价方案，且为额外运行期依赖）
License:      Apache-2.0 / BSD-3-Clause（双许可）
Risk:         无新增平台二进制（随 mitmproxy 传递引入，已在本项目依赖树内）
```

```text
Dependency:   pytest
Version:      >=8（bridges/python/uv.lock 锁定 9.1.1）
Purpose:      L0/L1/L2 测试运行器
Alternatives: unittest（标准库；但参数化与 fixture 组织成本高，且 pytest 已是 mitmproxy 依赖树内的测试栈）
License:      MIT
Risk:         仅 dev 依赖，不影响发布产物
```

```text
Dependency:   hatchling
Version:      构建后端（由 uv 解析，见 bridges/python/uv.lock）
Purpose:      构建 swufe_bridge 包（editable 安装与未来分发）
Alternatives: setuptools / flit（hatchling 为 uv 默认路径，配置最少）
License:      MIT
Risk:         仅构建期依赖，不进入运行期
```
