# SWUFE WebVPN Bridge 桌面应用（`app/`）

> 开发版运行说明见 [docs/operations/development-run.md](../docs/operations/development-run.md)（前置条件、启动、管理员权限操作、自检与重置）。
> M2 交付：Electron 外壳（登录 WebView / Session Broker / Proxy Orchestrator / Cert Manager / Allowlist Store / IPC）。
> 桥本体仍在仓库根的 `swufe_bridge/`（Python sidecar）；本目录只负责编排与界面。

## 前置条件

| 项 | 要求 |
| -- | ---- |
| Node.js | ≥ 22（本机实测 v24.18.0） |
| 仓库内 Python 环境 | 根目录执行过 `uv sync`（生成 `.venv/`），sidecar 与 CA 生成入口都由它运行 |
| 平台 | macOS 或 Windows（Linux 不在第一期范围） |

## 常用命令

```bash
npm install --prefix app        # 安装 Electron / TypeScript / esbuild / tsx
npm --prefix app run build      # 编译 Main(CommonJS) + Renderer(ESM) + 打包 preload
npm --prefix app start          # build + 启动应用
npm --prefix app run typecheck  # 三个 tsconfig 的类型检查（含 preload）
npm --prefix app run test:unit  # app/test/**/*.test.ts（Node 内置 test runner + tsx）
```

> 若 `npm install` 后 `app/node_modules/electron/dist` 不存在（部分 npm 镜像不执行包的
> install 脚本），手动补齐一次：`node app/node_modules/electron/install.js`。

## 生成物与运行期文件

| 路径 | 说明 |
| ---- | ---- |
| `app/dist/main/` | Main 进程编译输出（CommonJS） |
| `app/dist/renderer/renderer.js` | 渲染层编译输出（ESM，由 `app/static/index.html` 以 `<script type="module">` 加载） |
| `app/dist/preload/index.js` | preload 单文件包（esbuild，`sandbox: true` 下不能 `require` 相对路径，因此必须打包） |
| `<userData>/config.json` | allowlist（顶层 `hosts`/`includeSwufeWildcard`/`updatedAt`）+ `settings` 兄弟键；Python 侧读同一文件 |
| `<userData>/bridge-config.json` | 下发给 sidecar 的运行时配置，权限 `0600`（含会话 Cookie） |
| `<userData>/mitmproxy/` | mitmproxy CA 私钥与证书（`mitmproxy-ca-cert.pem` 用于安装到系统信任库） |
| `<userData>/Partitions/swufe-login/` | 登录会话（Electron 持久分区，不写 `session.bin`） |

`userData` 默认是 Electron 的应用数据目录（macOS：`~/Library/Application Support/swufe-webvpn-bridge`）。

## 环境变量

| 变量 | 作用 |
| ---- | ---- |
| `SWUFE_REPO_ROOT` | 覆盖仓库根路径（默认取 Electron 应用目录的上一级） |
| `SWUFE_PYTHON` | 指定运行 sidecar / CA 生成入口的解释器（默认 `<repo>/.venv/bin/python`，缺失则 `uv run --project <repo> python`） |
| `SWUFE_PROBE_INTERVAL_MS` | 会话过期探测间隔（默认 30000ms；手工验证时可调小） |
| `SWUFE_USER_DATA_DIR` | 覆盖 `userData`（等价于 `--user-data-dir=<dir>`），用于隔离测试环境 |

## 验证用 fixture（`app/test/fixtures/`）

| 文件 | 用途 |
| ---- | ---- |
| `portal-stub.mjs` | 假的 WebVPN 上游：`GET /` 返回 200 + `wrdvpn_session` Cookie（`expired` 模式返回 302 → `/login`）；`GET /__mode?expired=0\|1` 运行期切换；其它路径返回 JSON 并回显收到的 Cookie |
| `stub-ca-app.js` | M2 验证用主进程入口：除 CA 信任检查外全部使用真实实现（真实 `networksetup`、真实 sidecar、真实 IPC/preload/renderer），用于在无管理员权限时验证开桥链路 |

`stub-ca-app.js` 不是产品代码，也不参与打包；它存在的原因与用法见
[M2 完成记录](../docs/planning/milestones/M2-desktop-orchestration.md)。
