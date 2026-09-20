# 技术设计文档 — Phase 1

## 1. 范围

描述第一期实现的模块划分、关键算法、生命周期与错误处理。不替代架构选型文档中的技术比选。

## 2. 模块划分

| 模块 | 职责 | 建议技术落点 |
|---|---|---|
| App Shell | 窗口、托盘（可选）、配置持久化 | Electron Main |
| Login WebView | 官方登录；防环 | Electron BrowserWindow |
| Session Broker | Cookie 提取/存储/失效检测 | Main 进程 |
| Proxy Orchestrator | 启停 mitm、系统代理、local 捕获 | Main |
| WRD Codec | 主机加解密与 URL 互转 | 共享库（Python/TS 同逻辑） |
| Bridge Addon | 请求/响应改写 | mitmproxy addon |
| Cert Manager | CA 安装/卸载 | 调 mitmproxy CA + OS API |
| Allowlist Store | 主机列表与通配选项 | 本地 JSON/SQLite |
| Telemetry UI | 状态与调试日志 | Renderer |

## 3. WRD Codec（已验证）

- 算法：AES-128-CFB，`segment_size=128`
- 默认 `key = iv = b"wrdvpnisthebest!"`
- 仅加密 hostname；path/query 明文
- 编码：`https://webvpn.swufe.edu.cn/{scheme}[-{port}]/{iv_hex}{ct_hex}{path}?{query}`
- 实现需与 `wrd_codec.py` 向量一致（含 authserver / jwxt 样本）

保留：若日后 portal 下发不同 key/IV，允许配置覆盖（第一期可用默认值）。

## 4. 请求改写流程

```text
inbound request (客户端以为访问 jwxt.swufe.edu.cn)
  → host in allowlist?
       no  → upstream direct
       yes → build webvpn URL
            set upstream host = webvpn.swufe.edu.cn
            attach WebVPN cookies
            adjust Host / Absolute-form URL as required by mitm
            forward
```

## 5. 响应反向改写流程

目标：浏览器地址栏与页面链接仍呈现「普通主机」语义，从而再次命中 allowlist。

处理优先级：

1. `Location` 头
2. `Set-Cookie` Domain/Path
3. `text/html` / `application/javascript` / `application/json` 中的绝对 URL（WebVPN 形态 ↔ 普通形态）
4. 其它内容类型：默认不改写正文

策略需在实现中固定一种「浏览器可见主机名」约定并写进测试：推荐 **客户端侧始终使用真实主机名（jwxt…），仅线上游走 WebVPN**。

## 6. 会话与防环

- Cookie 来源：登录 WebView 的 `session` Partition 与桥使用同一可导出策略，或显式拷贝白名单 Cookie 名。
- 防环：WebView `session` 设置 `proxy` 为 direct；或 bypass 列表含 `webvpn.swufe.edu.cn`、`authserver.swufe.edu.cn`。
- 失效检测（示例信号，实现可组合）：
  - 对探测 URL 返回登录页标记
  - Set-Cookie 清空会话
  - 连续改写后 302 到 CAS

触发后执行产品规定的停桥流程。

## 7. 系统代理与冲突

启动开桥前：

1. 读取 OS 系统 HTTP/HTTPS 代理
2. 若已启用且指向非本桥 → 拒绝，UI 提示
3. 否则设置代理到 `127.0.0.1:<bridge_port>`，保存「由本 App 设置」标记
4. 关闭/过期/退出：仅当标记存在时清除，避免误清用户其它设置（与「拒绝已有代理」策略一致时，通常启动前为空）

## 8. 进程 local 捕获

- 使用 mitmproxy local mode（或平台等价能力）选择用户指定进程（如 Chrome）
- 与系统代理可同时启用；关闭时一并停止
- 权限：macOS 可能需辅助功能/网络扩展类授权——UI 需引导

## 9. 错误模型（对 UI）

| code | 含义 | 用户动作 |
|---|---|---|
| PROXY_CONFLICT | 系统代理已占用 | 关闭其它代理 |
| CA_MISSING | 未安装/未信任 CA | 去安装 |
| NOT_LOGGED_IN | 无会话 | 去登录 |
| SESSION_EXPIRED | 会话失效 | 重登 |
| BRIDGE_CRASH | mitm 进程退出 | 查看日志/重启桥 |
| ALLOWLIST_EMPTY | 无主机 | 添加主机 |

## 10. 安全设计要点

- 不写密码
- Cookie 存用户目录，权限收紧（用户可读）
- 调试日志默认关；开启不写 body
- CA 私钥仅本机
- 开源文档强调威胁模型（本机恶意软件可得明文）
