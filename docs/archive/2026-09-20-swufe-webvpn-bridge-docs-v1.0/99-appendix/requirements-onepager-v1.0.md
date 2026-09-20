# 西南财经大学 WebVPN 本地桥 — 第一期需求规格

| 项 | 内容 |
|---|---|
| 文档类型 | 需求规格（Requirements） |
| 版本 | 1.0 |
| 日期 | 2026-09-20 |
| 状态 | 已与产品方对齐（访谈锁定） |
| 相关原型 | `wrd_codec.py`（URL 编解码已验证） |

---

## 1. 一句话目标

在 **macOS / Windows** 上提供一个 **Electron 桌面应用**：用户通过官方 WebVPN/CAS 登录后，本机 **HTTP/HTTPS** 流量中命中 allowlist 的请求，经本地桥改写为网瑞达 WebVPN URL 并携带会话，使 **本机浏览器能打开并操作教务（`jwxt.swufe.edu.cn`）**。不做真 VPN，不追求 SSH/任意 TCP。

---

## 2. 背景与约束

- 学校仅提供 WebVPN（网瑞达 Wengine）：`webvpn.swufe.edu.cn`，统一身份经 `authserver.swufe.edu.cn`（CAS，可含 MFA）。
- WebVPN 是 **应用层反向代理**，不是 SSLVPN/TUN；本地桥只能覆盖 HTTP/HTTPS。
- URL 编解码已确认：AES-128-CFB（`segment_size=128`），默认 `key = iv = wrdvpnisthebest!`，路径形如  
  `https://webvpn.swufe.edu.cn/{http|https}[-port]/{iv_hex}{host_cipher}{path}?{query}`。
- 第一期以私用为主，日后可能开源；不按「班级批量分发」设计安装与签名流程。

---

## 3. 用户与场景

| 角色 | 说明 |
|---|---|
| 主用户 | 西财师生（开发者本人优先） |
| 主场景 | 校外用本机浏览器访问教务等 allowlist 站点 |
| 非场景 | SSH、数据库直连、SMB、任意 TCP/UDP、证书钉扎 App |

**第一期验收（DoD）**

> 在已登录 WebVPN、桥已开启、CA 已信任的前提下，本机浏览器访问教务站点，能打开页面并完成常规操作（浏览/点击业务功能）。

---

## 4. 功能需求

### FR-1 Electron 应用外壳

- 提供桌面窗口（可另含托盘，非必须）。
- 必备界面能力：
  - **登录**：内嵌 BrowserWindow/WebView 打开官方 WebVPN/CAS，用户自行完成认证（含 MFA）。
  - **连接开关**：一键开启/关闭桥。
  - **Allowlist 管理**：查看/增删主机；默认包含 `jwxt.swufe.edu.cn`；提供可选一键启用 `*.swufe.edu.cn`。
  - **状态区**：已连接 / 已断开 / 错误原因；当前 allowlist 摘要。
  - **证书**：一键安装本机 MITM 根证书、一键卸载。
  - **调试日志开关**：见 FR-7。

### FR-2 登录与会话（Session Broker）

- **不得**存储学号/密码；只读取并保存 WebVPN 会话所必需的 Cookie（及实现所需的最小附属状态）。
- 登录成功判定：能稳定取得可用 WebVPN 会话（具体 Cookie 名以实机为准）。
- **会话过期时**：
  1. 停止桥接；
  2. 清除本应用设置的系统代理；
  3. 停止进程捕获；
  4. 弹窗提示用户重新登录。
- 登录窗口访问 `webvpn.swufe.edu.cn` / `authserver.swufe.edu.cn` 时 **不得**再进入本桥（防环）。

### FR-3 流量接管（TUN 之前）

同时支持：

1. **系统 HTTP/HTTPS 代理** → 指向本地桥端口；
2. **mitmproxy local（或等价）按进程捕获**，便于点选浏览器等进程。

关闭开关时必须：停代理服务、恢复/清除系统代理、停止进程捕获。

### FR-4 与其它代理共存

- 启动前检测系统代理是否已被其它软件占用。
- 若已设置 → **拒绝启动**，提示用户先关闭 Clash / mihomo / sing-box 等对系统代理的占用。
- 第一期不做与 Clash 的链式共存。

### FR-5 路由（Allowlist）

- 仅 allowlist 中的主机（及可选的 `*.swufe.edu.cn`）经 WebVPN 改写发送。
- 其余流量：**直连**（不改写、不强制进 WebVPN）。
- 第一期必保主机：`jwxt.swufe.edu.cn`。
- 用户可自定义添加/删除主机名。

### FR-6 WRD 桥接（请求 / 响应）

**请求路径**

1. 识别目标 `scheme/host/port/path/query`；
2. 若 host 命中 allowlist：用 WrdCodec 生成 WebVPN URL；
3. 将实际上游改为 `webvpn.swufe.edu.cn`，附加 WebVPN Cookie；
4. 按需调整 `Host` / `Origin` / `Referer` 等（以实现正确性为准，最小必要修改）。

**响应路径（浏览器验收硬依赖，第一期必做）**

至少处理：

- `Location` 反向改写（WebVPN URL → 普通 URL，或保持浏览器可跟随的一致性策略，需在实现说明中固定一种并测通教务）；
- HTML/JS 中指向校内绝对 URL 的改写（使点击仍走本机「普通主机名」语义，从而再次命中桥）；
- `Set-Cookie` 的 `Domain` 等与主机名相关的字段（避免 Cookie 写到错误域）。

WebSocket：尽力支持；不作为第一期验收阻断项。HTTP/3：建议禁用或回落 TCP。

### FR-7 可观测性

- 默认可看到：连接状态、allowlist、错误原因。
- 可选调试日志：**域名 + 是否改写成功**；默认 **不记录** 响应正文/请求体。
- 调试日志可开关。

### FR-8 证书生命周期

- 使用本机生成的 MITM CA（建议复用 mitmproxy CA 机制，不自研 PKI）。
- 提供一键安装到系统信任、一键卸载。
- 私钥不得上传；开源版需在文档中明确信任风险。

### FR-9 平台

- 第一期：**macOS、Windows**。
- Linux 不在第一期范围。

---

## 5. 非功能需求

| ID | 要求 |
|---|---|
| NFR-1 | 不实现完整代理内核；TLS/HTTP2/证书签发优先交给 mitmproxy（或同等成熟栈） |
| NFR-2 | TUN / sing-box 透明网关为后续阶段，不阻塞第一期验收 |
| NFR-3 | 代码与文档默认中文用户可读；开源时补充英文 README 可后置 |
| NFR-4 | 关闭或过期后不得留下「半开」系统代理 |
| NFR-5 | 遵守「用户已知晓本机 HTTPS 会被解密」的产品提示（安装 CA 时展示） |

---

## 6. 非目标（Out of Scope）第一期

- SSH / 数据库 / SMB / 任意 TCP/UDP
- PAC、真 SSLVPN 替代
- 与 Clash 等系统代理链式共存
- 多用户集中分发、自动更新商店上架（可后置）
- 存储用户密码或自动化填密码绕过 MFA
- 保证所有证书钉扎应用可用

---

## 7. 架构要点（规范性描述）

```text
Electron GUI
  ├─ Login WebView (CAS/MFA) → Session Broker (Cookies)
  ├─ Allowlist + Switch + CA install/uninstall
  └─ Spawn/Stop local bridge

Local Bridge (mitmproxy + WRD addon)
  ├─ System HTTP(S) proxy inbound
  ├─ Optional per-process local capture
  ├─ Allowlist match?
  │    ├─ yes → WrdCodec rewrite + Cookie → webvpn.swufe.edu.cn
  │    └─ no  → direct
  └─ Response reverse rewrite (Location / body URLs / cookies)

Later (非第一期): sing-box TUN → same bridge
```

---

## 8. 验收清单

- [ ] macOS、Windows 均可启动 Electron 应用
- [ ] 用户完成官方登录后显示已连接；Cookie 未明文落盘到日志
- [ ] 系统已有代理时拒绝启动并提示
- [ ] 开启后系统代理指向本桥；关闭后清除
- [ ] CA 可一键安装/卸载
- [ ] allowlist 默认含 `jwxt.swufe.edu.cn`；可增删；可选 `*.swufe.edu.cn`
- [ ] 浏览器经桥可打开并操作教务页面
- [ ] 会话过期：停桥、清代理、弹窗重登
- [ ] 调试日志仅域名与改写结果（默认不记正文）
- [ ] 登录 WebView 不经过本桥（无代理环）

---

## 9. 后续阶段（不在本期承诺）

- sing-box TUN 增强「无系统代理也能接管」
- 更完整的 HTML/JS 改写覆盖面与自动化回归
- Linux、开源发布流程、签名公证
- WebSocket 作为正式验收项

---

## 10. 修订记录

| 版本 | 日期 | 说明 |
|---|---|---|
| 1.0 | 2026-09-20 | 据需求访谈与 codec 验证结果首版定稿 |

