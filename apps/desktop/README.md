# SWUFE WebVPN Bridge 桌面应用（`apps/desktop/`）

> 开发版运行说明见 [docs/operations/development-run.md](../../docs/operations/development-run.md)（前置条件、启动、管理员权限操作、自检与重置）。
> M2 交付：Electron 外壳（登录 WebView / Session Broker / Proxy Orchestrator / Cert Manager / Allowlist Store / IPC）。
> 界面自 Spec 002 起是 **React 19 + Ant Design 6 的四窗口渲染层**（由 Vite 构建）：主窗口固定 720×560 且零滚动，进程捕获的应用选择、调试日志与 Allowlist 编辑各自进入非模态二级窗口；旧裸 DOM 渲染层（`static/`、`src/renderer/renderer.ts`）已删除。结构事实见 [docs/ui-ux/](../../docs/ui-ux/README.md)、[ADR-0012](../../docs/architecture/adr/ADR-0012-react-antd-multiwindow-renderer.md)、[Spec 002](../../specs/002-desktop-ui-multiwindow/spec.md)。
> 桥本体在 `bridges/python/swufe_bridge/`（Python sidecar）；本目录只负责编排与界面。

## 前置条件

| 项 | 要求 |
| -- | ---- |
| Node.js | ≥ 22（本机实测 v24.18.0） |
| 仓库内 Python 环境 | 已执行 `uv sync --directory bridges/python`（生成 `bridges/python/.venv/`），sidecar 与 CA 生成入口都由它运行 |
| 平台 | macOS 或 Windows（Linux 不在第一期范围） |

## 常用命令

以下命令在**仓库根目录**执行（依赖由根 `pnpm install` 一次装齐，单一锁文件 `pnpm-lock.yaml`）：

```bash
pnpm install                                     # 安装 workspace 全部依赖（根 + apps/desktop）
pnpm --filter swufe-webvpn-bridge run build      # tsc(Main) + vite build(渲染层四入口) + 打包 preload
pnpm start                                       # build + 启动应用（等价于 `pnpm --filter swufe-webvpn-bridge run start`）
pnpm --filter swufe-webvpn-bridge run typecheck  # 三个 tsconfig 的类型检查（Main / 渲染层含 .tsx / preload）
pnpm --filter swufe-webvpn-bridge run test:unit  # apps/desktop/test/**/*.test.ts（Node 内置 test runner + tsx，无 Electron 依赖的 Main 侧逻辑）
pnpm --filter swufe-webvpn-bridge run test:ui    # apps/desktop/test/ui/**/*.test.tsx（vitest + jsdom 的渲染层组件测试）
pnpm --filter swufe-webvpn-bridge run dev:renderer  # 仅开发期：Vite dev server（127.0.0.1:5173，渲染层 HMR）
```

> 若 `pnpm install` 后 `apps/desktop/node_modules/electron/dist` 不存在（Electron 包不自带 install 脚本，
> 不会自动下载二进制），手动补齐一次：`node apps/desktop/node_modules/electron/install.js`。

### 开发期渲染层 HMR（可选）

```bash
pnpm --filter swufe-webvpn-bridge run dev:renderer            # 终端 A：Vite dev server（127.0.0.1:5173）
SWUFE_RENDERER_URL=http://127.0.0.1:5173 pnpm start           # 终端 B：Main 加载 dev server 并放宽开发期 CSP
```

不设置 `SWUFE_RENDERER_URL` 时（以及所有生产运行）Main 加载 `apps/desktop/dist/renderer/<entry>.html` 静态产物；
该环境变量只影响渲染层加载路径与 CSP（`style-src` 之外额外允许 dev server 源与 HMR WebSocket），不影响桥、代理、CA 与会话。

## 生成物与运行期文件

| 路径 | 说明 |
| ---- | ---- |
| `apps/desktop/dist/main/` | Main 进程编译输出（CommonJS） |
| `apps/desktop/dist/renderer/{main,capture,logs,allowlist}.html` | 四个窗口的入口 HTML（Vite 多入口，`base: './'`；CSP meta 由 `vite.config.ts` 的插件注入） |
| `apps/desktop/dist/renderer/assets/*` | 渲染层产物（入口 chunk + 共享 chunk，含 React / Ant Design / 图标；无外部 CDN） |
| `apps/desktop/dist/preload/index.js` | preload 单文件包（esbuild，`sandbox: true` 下不能 `require` 相对路径，因此必须打包） |
| `<userData>/config.json` | allowlist（顶层 `hosts`/`includeSwufeWildcard`/`updatedAt`）+ `settings` 兄弟键；Python 侧读同一文件 |
| `<userData>/bridge-config.json` | 下发给 sidecar 的运行时配置，权限 `0600`（含会话 Cookie） |
| `<userData>/mitmproxy/` | mitmproxy CA 私钥与证书（`mitmproxy-ca-cert.pem` 用于安装到系统信任库） |
| `<userData>/Partitions/swufe-login/` | 登录会话（Electron 持久分区，不写 `session.bin`） |

`userData` 默认是 Electron 的应用数据目录（macOS：`~/Library/Application Support/swufe-webvpn-bridge`）。

## 环境变量

| 变量 | 作用 |
| ---- | ---- |
| `SWUFE_REPO_ROOT` | 覆盖仓库根路径（默认取 Electron 应用目录的上两级） |
| `SWUFE_PYTHON` | 指定运行 sidecar / CA 生成入口的解释器（默认 `<repo>/bridges/python/.venv/bin/python`，缺失则 `uv run --project <repo>/bridges/python python`） |
| `SWUFE_PROBE_INTERVAL_MS` | 已停用。登录态到期看票据 cookie 的过期时间 |
| `SWUFE_USER_DATA_DIR` | 覆盖 `userData`（等价于 `--user-data-dir=<dir>`），用于隔离测试环境 |
| `SWUFE_RENDERER_URL` | 仅开发期：渲染层改从该 Vite dev server 加载（如 `http://127.0.0.1:5173`）并使用开发期 CSP；未设置时加载 `dist/renderer/*.html` |

## 验证用 fixture（`apps/desktop/test/fixtures/`）

| 文件 | 用途 |
| ---- | ---- |
| `portal-stub.mjs` | 假的 WebVPN 上游：`GET /` 返回 200 + `wrdvpn_session` Cookie（`expired` 模式返回 302 → `/login`）；`GET /__mode?expired=0\|1` 运行期切换；其它路径返回 JSON 并回显收到的 Cookie |
| `stub-ca-app.js` | M2 验证用主进程入口：除 CA 信任检查外全部使用真实实现（真实 `networksetup`、真实 sidecar、真实 IPC/preload/窗口注册表），用于在无管理员权限时验证开桥链路 |

`stub-ca-app.js` 不是产品代码，也不参与打包；它存在的原因与用法见
[M2 完成记录](../../docs/planning/milestones/M2-desktop-orchestration.md)。

## 窗口结构（Spec 002）

| 窗口 | 入口 HTML | 尺寸（DIP） | 可缩放 | 内容 |
| ---- | --------- | ----------- | ------ | ---- |
| 主窗口 | `main.html` | 720×560（基线） | 否（`resizable: false`） | 状态条、登录/桥接、捕获方式与进程捕获状态、allowlist 摘要、证书、诊断（系统代理行 + 调试日志开关）、消息行；**严格零滚动** |
| 捕获窗口 | `capture.html` | 560×480 | 是（min = 默认） | 进程捕获状态与方式行、筛选 + [刷新列表]、应用复选框列表、`已选 N / 32` |
| 日志窗口 | `logs.html` | 720×420 | 是（min = 默认） | 计数 + [清空]、三列表格（时间｜域名｜结果，最新在前，≤200） |
| Allowlist 窗口 | `allowlist.html` | 480×400 | 是（min = 默认） | 主机增删、`*.swufe.edu.cn` 通配、内联校验提示 |

窗口参数集中在 `src/main/window-policy.ts`（`WINDOW_SPECS`）与 `src/main/window-registry.ts`（创建/复用/聚焦/广播）；每类窗口单实例、非模态；主窗口关闭即退出应用。主窗口的尺寸随内容缩放系数（`Cmd`/`Ctrl` + `+`/`-`/`0`，步长 0.25，范围 [0.5, 2.0]）按比例自适应并 clamp 到工作区。
