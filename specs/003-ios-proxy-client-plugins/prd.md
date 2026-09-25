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
| G-IOS-006 | 分离拦截与路由范围 | Stash 可预先拦截 SWUFE 子域以支持动态选择；只有启用的精确 hostname 才改写并通过 WebVPN |

## 5. Non-goals

| ID | 非目标 | 原因 |
| --- | --- | --- |
| NG-IOS-001 | 开发/上架独立 iOS App | 本 Feature 的核心目的就是避免重复建设 |
| NG-IOS-002 | 替代学校 SSLVPN、提供任意 TCP/UDP 内网访问 | WebVPN bridge 仍只处理被支持的 HTTP/HTTPS |
| NG-IOS-003 | 绕过 CAS/MFA、自动填写密码 | 登录必须由官方页面和用户自行完成 |
| NG-IOS-004 | 兼容所有证书 pinning App | MitM 架构天然不保证 pinning 客户端 |
| NG-IOS-005 | 默认将所有 `*.swufe.edu.cn` 路由到 WebVPN | 只有用户启用的精确 hostname 进入 Routing Scope |
| NG-IOS-006 | 实现完整浏览器或独立服务 | Settings 只是轻量管理页，不承载 WebVPN 浏览 |
| NG-IOS-007 | 首期支持 Surge/Quantumult X/Shadowrocket | 先完成 Stash 与 Loon，之后再评估 Adapter 扩展 |
| NG-IOS-008 | BoxJS、外部设置后端、GitHub Pages、localhost server、CDN UI | Stash 插件自包含，设置由宿主 persistent store 保存 |

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

### 6.4 管理代理网站（Stash 首发）

1. 用户点击 Stash Tile 进入 `https://webvpn.swufe.edu.cn/__swufe_bridge__/`。
2. Stash request script 优先识别保留 Settings 命名空间，并从插件内 bundle 合成 HTML，不联系真实 gateway。
3. 页面通过同源 pseudo API 读取设置；用户启用/禁用内置站点，或输入 hostname 添加自定义站点。
4. Core 负责 hostname 规范化、限制 `.swufe.edu.cn` 和拒绝保留 host；UI 显示 inline 错误。
5. 保存时页面 POST JSON 与设备本地 token；Stash Adapter 验证、归一化并写入 `swufe.settings.v2`。
6. 后续每个业务请求读取最新 Settings 并生成精确 RoutingPolicy，无需重装 Override。`Intercepted != Routed through WebVPN`：未选 hostname 原样 PASS。

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

- Stash Settings 可启用/禁用已知内置站点、添加/删除自定义 hostname，并持久化设置。
- 默认仅预置已知的 `jwxt.swufe.edu.cn`。站点目录只能由可靠来源确认后扩展。
- 自定义项仅允许合法、精确的 `.swufe.edu.cn` 子域名；不提供 wildcard 路由开关。
- 保存后下一请求即时读取新 Routing Scope，无需重新下载/安装插件。
- `webvpn.swufe.edu.cn`、`authserver.swufe.edu.cn` 永远排除普通 WRD 二次包装。
- 未启用项以及其它被拦截的 SWUFE 子域必须 PASS：不改 URL/Header/body、不注入 Cookie、不执行 WRD rewrite。

### IOS-REQ-013 本地 Settings WebUI 与 pseudo API（Stash）

- Settings HTML/CSS/JS 在插件构建阶段打包进 Stash script bundle；Safari 访问合成的 `https://webvpn.swufe.edu.cn/__swufe_bridge__/` 页面。
- 保留前缀 `__swufe_bridge__` 在 request/response 正常业务链之前 short-circuit；不得触发 Session Capture、routing、WRD 或流向真实 gateway。
- 对已识别 Settings namespace 的解析、存储或处理异常必须本地返回合成错误响应；不能沿用普通业务 handler 的 pass-through catch。
- API 仅包含 `GET /__swufe_bridge__/api/settings` 和 `POST /__swufe_bridge__/api/settings`；读写使用 Stash `$persistentStore`，不需要 BoxJS/云端/socket server。
- 页面允许未登录时配置站点；网页登录是独立动作；Settings 不保存密码、CAS Cookie、MFA、Session 或 WRD secret。
- 保存通过本机 token、Origin/Referer、Content-Type、Host/path/method、schema 与 16 KiB UTF-8 body 上限验证。超限必须在本地返回 413，绝不能绕过 handler 到真实 gateway；错误返回稳定机器码，不返回存储内容或敏感字段。

### IOS-REQ-014 拦截与路由边界

- Stash 首发方案预定 `*.swufe.edu.cn` HTTPS MitM 和必要 HTTP Engine 范围，以便用户安装后动态启用新子域；这是相对旧设计“仅明确目标 MitM”的安全语义变化。
- 只有 Routing Scope 精确选中 hostname 可以执行 WebVPN rewrite。宽拦截只让 HTTP Engine 执行 PASS 决定，不构成转发授权。
- 用户说明、README、安全说明须披露：被 Stash 本地解密的未选子域仍原样 PASS；只有已选域经过 WebVPN；Cookie 不注入未选域。
- Wildcard MitM、HTTP `force-http-engine` 与子域 QUIC 规则须由目标 Stash 版本真机验证后才可宣称完成。
- 若 wildcard interception 实机不可用，静态 fallback 只能让 Settings 管理 Override 已声明 hostname；任意自定义域功能需暂缓，重新评审并显式调整 AC-SETTINGS-004/008 和用户预期。

### IOS-REQ-015 Settings API 安全

- Settings POST 仅接受同源 Settings UI 发出的 JSON、自定义设备 token 和限定大小的合法 V2 schema；检查 Origin/Referer（若 Stash 暴露）、Host、path、method 和 Content-Type，任何检查不能由 UI 自己替代。
- 页面 GET 生成短期 nonce 的能力及 Stash JS runtime 可用的安全随机源待实现前验证；没有可靠 token 时 POST 必须 fail-closed。不得用固定 bundle token 或 `Math.random()` 充当安全随机数。
- API 只读写站点设置；响应不得包含 Session/CAS Cookie、Authorization、MFA、WRD key/iv 或完整敏感请求。Debug 不打印 Settings POST 原文。

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
- 文档明确说明启用 MitM 意味着列入 Interception Scope 的 HTTPS 会在设备本地被代理客户端解密；未选目标仍 PASS，但不代表其未被本地解密。

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

### Settings 验收标准

- [ ] AC-SETTINGS-001：用户可从 Stash Tile 进入 SWUFE WebVPN Settings。
- [ ] AC-SETTINGS-002：页面由 Stash Script synthetic response 提供，不依赖远程 WebUI/backend。
- [ ] AC-SETTINGS-003：用户可启用/禁用内置站点。
- [ ] AC-SETTINGS-004：用户可添加合法 `.swufe.edu.cn` 自定义 hostname。
- [ ] AC-SETTINGS-005：非法 hostname 被拒绝并显示 inline error。
- [ ] AC-SETTINGS-006：gateway/authserver 不可作为普通 target。
- [ ] AC-SETTINGS-007：保存结果写入 `$persistentStore` 的 `swufe.settings.v2`。
- [ ] AC-SETTINGS-008：保存后最新配置即时参与 request routing。
- [ ] AC-SETTINGS-009：未选 host 不执行 WebVPN rewrite。
- [ ] AC-SETTINGS-010：未选 host 不注入 WebVPN Cookie。
- [ ] AC-SETTINGS-011：Settings namespace 永不发送到 gateway upstream。
- [ ] AC-SETTINGS-012：插件无 BoxJS 依赖。
- [ ] AC-SETTINGS-013：插件无远程 Settings Backend。
- [ ] AC-SETTINGS-014：V1 Settings 可迁移到 V2。
- [ ] AC-SETTINGS-015：Settings schema 升级不清除 `swufe.session.v1`。
- [ ] AC-SETTINGS-016：Interception Scope 与 Routing Scope 在文档和测试中分开验证。
- [ ] AC-SETTINGS-017：`*.swufe.edu.cn` 中未选流量保持 PASS。
