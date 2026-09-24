# PRD：iOS 代理客户端插件

> Status: Approved  
> Spec ID: 003  
> Owner: cherrchen  
> Last Reviewed: 2026-09-24  
> Related: REQ-002 / REQ-005 / REQ-006 / REQ-007 / NFR-002 / NFR-003

## 1. 背景

现有 SWUFE WebVPN Bridge 已在 desktop 端通过 Electron + mitmproxy 实现：用户完成官方 WebVPN/CAS/MFA 登录后，浏览器仍以真实校内主机名访问，由桥将 allowlist 请求改写为网瑞达 WebVPN URL、注入会话 Cookie，再对返回的 `Location`、`Set-Cookie`、HTML/JS/JSON URL 做反向改写。

iOS 已有 Stash、Loon 这类 App Store 代理应用，可以承担 Network Extension、TUN/HTTP Proxy、MitM CA、HTTP(S) 拦截与 JavaScript request/response script。为避免维护独立 iOS App，本 Feature 将移动端实现为这些客户端的插件/覆写。

## 2. 问题

如果直接让用户在 Safari 手工使用 WebVPN：

- 用户必须以网关 URL 访问资源，地址语义不稳定；
- 普通 `http://jwxt.swufe.edu.cn/...` 请求在校外无法直接访问；教务实际入口为 HTTP（桌面端 M5 真机验收与 2026-09-25 移动端反馈）。
- WebVPN URL 需要 WRD AES-CFB128 hostname 编码；
- 页面中的跳转、Cookie Domain/Path 和绝对 URL 可能需要反向改写；
- 会话过期后用户需要重新认证；
- 独立开发 iOS App 会重复建设代理/TUN/MitM/证书基础设施。

目标是把 desktop 已验证的“WebVPN bridge 语义”迁移到 Loon/Stash 脚本层，而不是重新造一个 VPN App。

## 3. 目标用户

- 已合法拥有 SWUFE WebVPN 访问权限的 iPhone/iPad 用户；
- 已安装并愿意使用 Loon 或 Stash；
- 能按代理客户端指引安装并信任其 MitM CA；
- 主要希望以真实校内域名访问教务等被 allowlist 的 HTTP/HTTPS 服务。

## 4. Goals

| ID | 目标 | 成功判据 |
| --- | --- | --- |
| G-IOS-001 | 不开发独立 iOS App 即实现 WebVPN bridge 主路径 | Loon 或 Stash 至少一个客户端完成真实设备端到端验收 |
| G-IOS-002 | 复用 desktop 的协议语义 | Python 与 JS WRD codec 对同一测试向量结果一致 |
| G-IOS-003 | 登录使用官方网页，并如实描述打开位置 | 2026-09-24 真机：Loon 通知与 Stash Tile 都打开系统 Safari。文案写「打开网页登录」，不称应用内登录 |
| G-IOS-004 | 不收集学校密码 | 插件代码、存储和日志均不存在用户名/密码保存路径 |
| G-IOS-005 | 两客户端共享业务逻辑 | Loon/Stash 仅包含薄 Adapter，核心 codec/routing/rewrite/session 由共享包提供 |
| G-IOS-006 | 安全范围最小化 | 仅对 gateway + allowlist 所需域名启用 MitM/改写，不默认解密普通互联网流量 |

## 5. Non-goals

| ID | 非目标 | 原因 |
| --- | --- | --- |
| NG-IOS-001 | 开发/上架独立 iOS App | 本 Feature 的核心目的就是避免重复建设 |
| NG-IOS-002 | 替代学校 SSLVPN、提供任意 TCP/UDP 内网访问 | WebVPN bridge 仍只处理被支持的 HTTP/HTTPS |
| NG-IOS-003 | 绕过 CAS/MFA、自动填写密码 | 登录必须由官方页面和用户自行完成 |
| NG-IOS-004 | 兼容所有证书 pinning App | MitM 架构天然不保证 pinning 客户端 |
| NG-IOS-005 | 默认代理/解密全部 `*.swufe.edu.cn` | 遵循最小范围；通配必须显式打开 |
| NG-IOS-006 | 在插件内实现完整浏览器 UI | 第三方脚本没有稳定的原生 WebView API；只使用客户端已有 URL 入口 |
| NG-IOS-007 | 首期支持 Surge/Quantumult X/Shadowrocket | 先完成 Stash 与 Loon，之后再评估 Adapter 扩展 |

## 6. 核心用户旅程

### 6.1 首次安装

1. 用户从本仓库 GitHub README 点击 Stash 或 Loon 的安装入口（远程 `.stoverride` / `.plugin` URL 指向 GitHub）。
2. 客户端导入插件/Override。
3. 用户按客户端原生流程安装并信任 MitM CA。
4. 插件显示“未登录”状态，并提供“登录 SWUFE WebVPN”入口。
5. 用户点击入口，打开 `https://webvpn.swufe.edu.cn`。
6. 用户在官方页面完成 CAS/SSO/MFA。
7. 插件从 WebVPN HTTP 请求中捕获必要 Cookie，持久化为 Session。
8. 状态变为“已登录”。

### 6.2 日常访问

1. 用户访问 `http://jwxt.swufe.edu.cn/...`。
2. 请求脚本做 allowlist 判定。
3. 命中后生成 WRD URL、注入 WebVPN Cookie、最小化改写请求 Header。
4. 请求发往 `webvpn.swufe.edu.cn`。
5. 响应脚本反向改写网关 URL/Cookie。
6. 普通页面保持真实主机名语义；教务页面可按 gateway bootstrap 规则进入 WebVPN 原生 URL 空间。

### 6.3 会话过期

1. 脚本观察到明确的过期信号，例如网关响应跳转回 CAS 或 Session Probe 失败。
2. 清除本地 Session。
3. Tile/通知状态变为“登录已失效”。
4. 用户点击“重新登录”，重复官方登录流程。

## 7. 功能需求

### IOS-REQ-001 插件安装与启用

- Stash 应提供可远程安装的 `.stoverride`，并支持标准一键导入 URL（**首发宿主**）。
- Loon 应提供可远程安装的 `.plugin`。
- 远程安装 URL 与 bundled 脚本仅托管在本仓库 **GitHub**（GitHub Releases 附件与/或 `raw.githubusercontent.com` 上固定路径）；不使用第三方 CDN 或项目自建下载服务。
- 安装制品中不得包含用户凭据。
- 插件更新不得覆盖用户的 Session 数据，除非发生显式不兼容的数据迁移。

### IOS-REQ-002 登录入口与状态

- 未登录时必须有明确入口打开 WebVPN 官方首页。
- 2026-09-24 真机中，Loon 与 Stash 的登录 URL 都打开系统 Safari。入口文案必须写「打开网页登录」。
- WebVPN → CAS → MFA → WebVPN 的跳转由官方页面完成。P0 中这些请求在 MitM 开启后进入对应宿主脚本。
- 不得在自建 HTML 中伪造学校登录表单。

### IOS-REQ-003 WebVPN Session Capture

- 只在 `webvpn.swufe.edu.cn` 请求上下文中捕获 WebVPN Cookie。
- `authserver.swufe.edu.cn` 的认证 Cookie、表单字段、密码不得写入插件持久存储。
- Cookie 名不得在第一版代码中假设为单一固定值；应先按 gateway scope 捕获必要集合，再经真机验证收敛。
- Session 必须带版本号、更新时间和 gateway host。

### IOS-REQ-004 Allowlist

- 默认至少包含 `jwxt.swufe.edu.cn`。
- 支持精确 hostname。
- 可选启用 `*.swufe.edu.cn`，但必须是用户显式配置。
- `webvpn.swufe.edu.cn`、`authserver.swufe.edu.cn` 永远排除普通 WRD 二次包装。
- 非 allowlist 流量不得注入 WebVPN Cookie。

### IOS-REQ-005 WRD 请求改写

- 与现有 Python `WrdCodec` 保持语义一致。
- 支持 `http`/`https`、非默认端口、path/query/fragment。
- hostname 使用 AES-128-CFB128，默认 key/iv 与现有 ADR-0005 保持一致，并保留覆盖点。
- 编码失败时采取 fail-closed：不注入 Session，不把半成品发往 gateway，并给出可观测错误。

### IOS-REQ-006 Request Header 改写

- 只做与 WebVPN 正常转发相关的最小改写。
- `Cookie` 注入只发往 gateway。
- `Origin` / `Referer` 改写策略与 desktop 行为保持一致并通过契约测试固定。
- 不记录 Authorization、Cookie、请求 Body。

### IOS-REQ-007 Response 反向改写

处理优先级：

1. `Location`
2. `Set-Cookie` Domain/Path
3. 可安全处理的 `text/html` / JavaScript / JSON 中 WRD 绝对 URL
4. 其它类型默认原样返回

必须保留 desktop 已有的“gateway-owned namespace”和 bootstrap promotion 语义，除非真机证据证明移动端需要差异；差异需显式 ADR/设计记录。

### IOS-REQ-008 状态展示

最少状态：

- 未配置 MitM
- 未登录
- 已登录
- 正常
- 会话失效
- Codec/Rewrite 错误
- 插件版本不兼容

Stash 优先通过 Tile 展示；Loon 使用插件 UI 可提供的信息、通知与日志组合展示。

### IOS-REQ-009 安全与隐私

- 不保存学号、密码、MFA 内容。
- Session Cookie 只存代理客户端的本地持久化存储。
- 不同步到本项目自建服务器；本 Feature 不引入云后端。
- 日志默认关闭；即使调试开启，也不得输出完整 URL token、Cookie、Body 或认证参数。
- 文档明确说明启用 MitM 意味着目标域名 HTTPS 会在设备本地被代理客户端解密。

### IOS-REQ-010 QUIC/HTTP3 处理

- 必须保证目标 HTTPS 流量能进入 HTTP Script/MitM 引擎。
- Stash 已公开说明 HTTP/3 不进入其 HTTP Engine，因此目标域需要避免走 QUIC。
- 不允许为了本插件粗暴全局禁用设备所有 UDP/443，除非客户端能力无法局部表达且用户显式同意。
- Loon 的具体局部策略以 P0 真机验证为准。

### IOS-REQ-011 版本与兼容性

- 插件必须声明最低 Loon/Stash 版本要求。
- 依赖 Loon `$crypto.aes` 时最低 Build 必须满足官方 API 要求；如果最终采用完全自包含的纯 JS codec，可降低该项硬依赖。
- 构建产物必须是自包含脚本，不依赖 Node.js 内置模块、动态 npm require 或运行时安装依赖。

### IOS-REQ-012 更新与回滚

- 远程脚本应带版本标识；发布物通过 GitHub Release（推荐）或带标签的 raw 路径提供，便于用户与客户端回滚到上一版本。
- Core 数据模型必须支持 schema version。
- 更新失败时用户可退回上一 GitHub 发布版本，不应破坏 desktop。
- Loon 与 Stash 发布可独立回滚。

## 8. 非功能需求

| ID | 类别 | 要求 | 判据 |
| --- | --- | --- | --- |
| IOS-NFR-001 | reliability | Python/JS codec 一致 | 全部共享向量通过 |
| IOS-NFR-002 | security | 密码与认证表单零持久化 | 存储审计 + 真机验证 |
| IOS-NFR-003 | security | Session 不出 gateway scope | 负向用例验证普通站点无 Cookie 泄露 |
| IOS-NFR-004 | maintainability | Loon/Stash Core 不复制 | 代码结构审查，平台逻辑仅 Adapter |
| IOS-NFR-005 | performance | 普通 header-only request 不读取 body | 配置审查与运行时日志 |
| IOS-NFR-006 | usability | 失效后可执行的重登入口 | 过期用例中 ≤1 个明确入口到登录 |
| IOS-NFR-007 | observability | 错误可定位但不泄密 | 日志 schema 审查 |
| IOS-NFR-008 | portability | iOS/iPadOS 为首期平台 | 至少两类设备/系统组合真机验收 |
| IOS-NFR-009 | compatibility | 不影响 desktop | desktop 既有测试全绿 |

## 9. 边界场景

- Session 捕获时没有 `Cookie`：保持未登录，不写空 Session。
- Session 中包含多个 Cookie：按 gateway scope 保存，后续由最小化测试决定是否可裁剪。
- 用户取消 CAS/MFA：不改变旧 Session；若旧 Session 已失效，状态仍为失效。
- Gateway key/iv 轮换：Codec 明确失败，提示更新配置/插件，不伪装为普通网络错误。
- 页面正文超出客户端脚本大小上限：跳过 body rewrite 并记录非敏感诊断；Header rewrite 仍应工作。
- 用户未信任 MitM CA：不伪装成功，显示“HTTPS 解密未就绪”。
- 已登录但客户端代理未启动：插件无法执行，属于宿主状态；文档提示开启客户端。
- 用户同时启用与本插件冲突的 Rewrite：需要诊断指引，不尝试修改其它插件配置。

## 10. 验收标准

- [ ] AC-IOS-001：真实 iPhone/iPad 上至少一个宿主客户端可以安装插件、完成官方 CAS/MFA、捕获 WebVPN Session。
- [ ] AC-IOS-002：用户访问 `http://jwxt.swufe.edu.cn` 时可经 WebVPN 打开并完成至少一条真实业务操作。
- [ ] AC-IOS-003：Python 与 JS codec 共享向量全部一致。
- [ ] AC-IOS-004：非 allowlist 请求不注入 WebVPN Cookie。
- [ ] AC-IOS-005：`webvpn.swufe.edu.cn` 与 `authserver.swufe.edu.cn` 不被二次 WRD 包装。
- [ ] AC-IOS-006：会话过期后状态变更并提供明确重登入口。
- [ ] AC-IOS-007：日志、持久化存储中不存在用户名、密码、MFA、完整 Cookie 明文输出到调试界面/日志。
- [ ] AC-IOS-008：Stash 与 Loon 各自至少通过安装/启用/禁用/更新/卸载冒烟测试。
- [ ] AC-IOS-009：desktop 原有测试不受影响。
- [x] AC-IOS-010：OQ-001/OQ-002 的 P0 实机结论已记录；Safari 降级已写入 PRD 与 UI/UX。
