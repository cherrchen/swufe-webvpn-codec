# 开发版运行说明（development run）

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-21
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
| Python 环境 | 仓库根执行过 `uv sync`（生成 `.venv/`） | 应用默认用 `<repo>/.venv/bin/python -m swufe_bridge.sidecar` 拉起桥 |
| 平台 | macOS 或 Windows | Linux 不在第一期范围 |
| 网络 | 能访问 `https://webvpn.swufe.edu.cn` | 教务 `jwxt.swufe.edu.cn` 在校园网外不可直连，必须经 WebVPN |
| 代理工具 | **必须先关闭其它代理工具的 TUN / 虚拟网卡模式**（Clash、mihomo、sing-box、Stash 等） | 实测：TUN 的 fake-ip DNS（`198.18.0.0/15`）会让经桥的上游连接挂起；`PROXY_CONFLICT` 只检测系统代理，检测不到 TUN（见 `KI-013`） |
| 账号 | 测试者自有的西财统一身份认证账号（含 MFA） | 不写入仓库 |

## 2. 首次准备

```bash
uv sync                        # 仓库根：创建 .venv/（sidecar、WRD codec、CA 生成入口）
npm install --prefix app       # app/：Electron / TypeScript / esbuild / tsx
```

- 若镜像不执行包的 install 脚本、`app/node_modules/electron/dist` 缺失，手动补一次：
  `node app/node_modules/electron/install.js`。
- 之后日常只需 `npm --prefix app start`（它会先 build 再启动）。

## 3. 启动

```bash
npm --prefix app start                                        # 使用默认 userData
npm --prefix app start -- --user-data-dir=/tmp/swufe-dev      # 使用隔离 profile
```

- `npm start` = `npm run build && electron .`；`--` 之后的参数原样传给 Electron。
- 隔离 profile（`--user-data-dir`）不污染日常配置，验收与复验都推荐使用；它同时隔离 `config.json`、`bridge-config.json`、`mitmproxy/` CA 与登录分区。
- 环境变量（等价覆盖，见 [app/README.md](../../app/README.md)）：

| 变量 | 作用 |
| ---- | ---- |
| `SWUFE_USER_DATA_DIR` | 等价于 `--user-data-dir <dir>` |
| `SWUFE_REPO_ROOT` | 覆盖仓库根路径（默认取应用目录的上一级） |
| `SWUFE_PYTHON` | 指定运行 sidecar / CA 生成入口的解释器（默认 `<repo>/.venv/bin/python`，缺失时回退 `uv run --project <repo> python`） |
| `SWUFE_PROBE_INTERVAL_MS` | 会话过期探测间隔（默认 30000ms；验收时可调小，如 8000） |

## 4. 需要管理员权限的操作

| 操作 | 平台行为 |
| ---- | -------- |
| 安装本机 CA | 先在界面弹出风险提示模态；确认后由 osascript 的 `do shell script … with administrator privileges` 提权执行 `security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain <caCert>`。**会弹出系统管理员密码框**，取消即中止（不产生任何写入） |
| 卸载本机 CA | 同样提权执行 `security delete-certificate -Z <sha1>` |
| 进程捕获（「指定应用」） | macOS 首次启用时 mitmproxy 会安装并激活网络扩展，需在授权提示内**在 5 秒内确认**；超时即失败，界面给出引导与「重试」。Windows 侧需要 UAC 提权（见 [ADR-0006](../architecture/adr/ADR-0006-local-capture-mode-and-mutual-exclusion.md)） |

> Windows 的 CA 安装写入**当前用户**根存储（`certutil -user -addstore Root <caCert>`），不弹管理员密码框；卸载为 `certutil -user -delstore Root mitmproxy`。

## 5. 验证与自检

```bash
npm run acceptance:check -- --out <dir> --user-data-dir <profile>
```

- 该脚本采集一份脱敏的验收证据报告（`<dir>/acceptance-<platform>-<时间戳>.md`）：OS/版本、`config.json` 与 `bridge-config.json` 的关键字段、CA 文件与系统信任库、每个网络服务的系统代理状态、桥端口是否在监听、经桥与直连的 curl 对照、sidecar 残留进程。
- 报告**不含** Cookie 值、`wrdKey` / `wrdIv` 值或任何 `Set-Cookie` / `Cookie` / `Authorization` 头的值（NFR-003 / INV-001）；脚本末尾的 `redaction-self-check` 项若发现泄漏会以 `FAIL` 结束（退出码 1）。
- 开关：`--port`（默认 8080）、`--host`（默认 `jwxt.swufe.edu.cn`）、`--user-data-dir`（默认 macOS `~/Library/Application Support/swufe-webvpn-bridge`、Windows `%APPDATA%\swufe-webvpn-bridge`）、`--save-body`（默认关闭；保存的正文可能含个人信息，**不要入库**）。
- 验收的完整步骤（含教务浏览器验收与结果表）见 [specs/001-phase1-local-bridge/verification.md](../../specs/001-phase1-local-bridge/verification.md) 的「M4 双平台验收执行手册」。

## 6. 常见故障

| 现象 | 原因 | 处置 |
| ---- | ---- | ---- |
| 开桥后状态条「错误」+ `CA_MISSING` | 未安装本机 CA | 点「安装本机 CA」并输入管理员密码；未安装前桥不会改动任何系统设置 |
| 开桥被拒 + `PROXY_CONFLICT` | 系统代理已被其它软件占用（Clash / mihomo / sing-box 等） | 先关闭该软件的系统代理；界面弹出的冲突模态会说明这一点，且本 App 不会改动已被占用的设置 |
| 开桥被拒 + `NOT_LOGGED_IN` | 未完成 WebVPN（CAS/MFA）登录 | 点「登录 WebVPN」完成登录 |
| 开桥被拒 + `ALLOWLIST_EMPTY` | allowlist 为空 | 添加至少一个主机，或勾选 `*.swufe.edu.cn` |
| 状态条「错误」+ `BRIDGE_CRASH` | sidecar 异常退出，或 `bridgePort` 被占用 | 打开「调试日志」查看桥输出；若是端口占用，修改 `<userData>/config.json` 的 `settings.bridgePort` 后重试 |
| `swufe-error CONFIG_INVALID` | 运行时配置非法（如 `capture.processes` 含逗号） | 修正 `<userData>/config.json` 的对应设置后重新开桥 |
| sidecar 起不来 / 提示找不到 python | 仓库根未 `uv sync`，或 `SWUFE_PYTHON` 指向不存在的解释器 | 在仓库根执行 `uv sync`，或修正 `SWUFE_PYTHON` |
| 关闭应用后系统代理仍指向本桥 | 上次以 `kill -TERM` / `kill -9` 结束，未触发 JS 清理（已记入已知问题） | 下次启动时 `recoverOnLaunch()` 会依据「由本 App 设置」标记自动清除；也可手动 `networksetup -setwebproxystate <服务> off`（Windows：把 `HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings` 的 `ProxyEnable` 置 0） |
| 界面显示「进程捕获：启用失败」 | 系统扩展未授权 / 授权超时（macOS） | 按界面引导在「系统设置 → 通用 → 登录项与扩展」中允许，然后点「重试」。捕获失败不影响系统代理路径（桥仍为「桥接中」） |

## 7. Windows 差异

| 维度 | Windows 行为 |
| ---- | ------------ |
| 系统代理 | 通过 WinINET 注册表（`HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings` 的 `ProxyEnable` / `ProxyServer`）读写，不动其它设置 |
| 生效时机 | **不广播 `WM_SETTINGCHANGE`**：已经在运行的浏览器可能继续使用旧代理，需要重启浏览器才感知 |
| CA | 写入当前用户根存储（`certutil -user`），不需要管理员；macOS 走系统钥匙串并需要提权 |
| 进程捕获 | 需要 UAC 提权；「指定应用」的真实范围验证随 Windows 真机项一并延期 |

> Windows 真机验证（TC-C02..C04、TC-E01/E02、TC-G03/G04）尚未执行，原因与解除条件见 [verification.md](../../specs/001-phase1-local-bridge/verification.md) 的「未验证 / 无法验证项」与 [known-issues.md](../../specs/001-phase1-local-bridge/known-issues.md) 的 `KI-001`。

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
- 应用侧命令与限制 ⇒ [app/README.md](../../app/README.md)
- 桥控制协议（`swufe-ready` / `swufe-error` / `swufe-debug` / `swufe-capture`）⇒ [bridge-control-protocol.md](../api/bridge-control-protocol.md)
- 安全约束（Cookie、CA 私钥、权限）⇒ [security/README.md](../security/README.md)
- 验收手册与结果表 ⇒ [specs/001-phase1-local-bridge/verification.md](../../specs/001-phase1-local-bridge/verification.md)
- 测试分层与命令 ⇒ [testing-strategy.md](../development/testing-strategy.md)
