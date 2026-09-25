# SWUFE WebVPN iOS Proxy Client Plugins — 文档包

> Status: In Progress  
> Spec ID: `003-ios-proxy-client-plugins`  
> Owner: cherrchen  
> Last Reviewed: 2026-09-24  
> Scope: Loon / Stash 插件，不开发独立 iOS App

本目录是仓库 [Spec 003](../README.md) 的 Feature 文档包（路径 `specs/003-ios-proxy-client-plugins/`），描述如何在 iPhone/iPad 上复用 Loon / Stash 的代理、TUN 与 HTTPS MitM 能力，实现 SWUFE WebVPN 的 URL 编码、会话捕获、请求改写与响应反向改写。

## 已确认的产品决策

1. **不开发独立 iOS App**。移动端作为第三方代理客户端插件运行。
2. **Stash 为首发宿主，Loon 为第二适配器**；两者共享同一个 TypeScript/JavaScript 业务 Core。
3. 移动端不复刻 desktop 的 mitmproxy、CA Manager、System Proxy、进程捕获；这些基础网络能力由 Loon / Stash 提供。
4. CAS / SSO / MFA 始终使用学校官方网页，不存储学号、密码，不模拟登录协议。
5. 插件只保存 WebVPN 会话所需的最小 Cookie 状态，并禁止 Cookie/正文进入日志。
6. WRD URL 算法以现有 `bridges/python/swufe_bridge/wrd_codec.py` 为行为权威；移动端实现必须通过同一组测试向量。
7. 默认仍采用 allowlist，`webvpn.swufe.edu.cn` 与 `authserver.swufe.edu.cn` 必须排除二次包装。
8. Stash 首页 Tile 用作状态/登录入口；Loon 使用插件参数、通知/入口能力形成相近体验。
9. Stash 为动态管理 SWUFE 子域提供本地虚拟 Settings WebUI：页面资源随插件 bundle 发布，由 Stash HTTP Script synthetic response 提供；配置存入 Stash `$persistentStore`。不引入 BoxJS、远程配置服务、GitHub Pages、localhost server 或 CDN UI。
10. 为支持用户安装后添加新 SWUFE 子域，Stash `Interception Scope` 计划包含 `*.swufe.edu.cn`；这不代表所有子域都会送入 WebVPN。只有 Settings 中启用的精确 hostname 属于 `Routing Scope`。未选中域名必须原样 PASS，且不得改写或注入 Session。wildcard MitM 与子域 QUIC 回落的 Stash YAML/真机行为尚待验证。
11. 默认内置站点仅为有可靠依据的 `jwxt.swufe.edu.cn`；用户自定义项只接受合法 `.swufe.edu.cn` 子域，gateway/authserver 永久保留。
12. **P0 实机结论（2026-09-24）**：Loon 通知 `openUrl` 与 Stash Tile `url` 都打开系统 Safari，不在宿主内嵌网页。MitM 启用后，两个宿主的脚本都能看见 `webvpn.swufe.edu.cn` 与 `authserver.swufe.edu.cn`，登录后的 gateway 请求里能看到会话 Cookie 名。登录文案使用「打开网页登录」。细节见 [verification.md](verification.md)。
13. **安装与更新分发**：`.stoverride` / `.plugin` 及 bundled 脚本仅通过本仓库 **GitHub** 提供（Release 附件与/或 `raw.githubusercontent.com` 固定路径）；GitHub 仅分发插件制品，不承载 Settings 页面或配置后端。
14. **Spec 状态（2026-09-25）**：`In Progress`。本轮新增 Settings WebUI/API 与动态精确 allowlist 设计；实现和 Stash 真机能力验证未完成。见 [spec.md §Status](spec.md)。

## 文件导航

| 类型 | 文件 | 用途 |
| --- | --- | --- |
| 需求 | [prd.md](prd.md) | 产品目标、范围、用户故事、需求与验收标准 |
| 需求 | [ui-ux.md](ui-ux.md) | 安装、登录、状态、错误与 Stash/Loon 交互 |
| Stash Settings | [ui-ux.md §5](ui-ux.md) / [interfaces.md §16–19](interfaces.md) | 本地 WebUI、pseudo HTTP API、动态站点设置契约 |
| 需求 | [domain.md](domain.md) | 领域边界、实体、状态机、不变式与术语 |
| 技术 | [architecture.md](architecture.md) | 技术选型、组件边界、数据流、部署与安全 |
| 技术 | [interfaces.md](interfaces.md) | Core、Adapter、存储、请求/响应与插件制品接口 |
| 技术 | [data-model.md](data-model.md) | 持久状态、运行态、版本与迁移模型 |
| 测试 | [test-plan.md](test-plan.md) | 分层测试策略、环境、门槛与退出条件 |
| 测试 | [test-cases.md](test-cases.md) | 可执行测试用例清单 |
| 项目管理 | [project-management.md](project-management.md) | 阶段、任务、依赖、风险、DoD 与文档同步 |
| 兼容 Spec | [spec.md](spec.md) | 对现有 Spec 体系的 What/Why 入口 |
| 兼容 Spec | [design.md](design.md) | 对现有 Spec 体系的 How 入口 |
| 兼容 Spec | [plan.md](plan.md) | 对现有 Spec 体系的实施计划入口 |
| 兼容 Spec | [tasks.md](tasks.md) | Coding Agent 可执行任务 |
| 兼容 Spec | [verification.md](verification.md) | Requirement → Verification 映射 |
| 参考 | [references.md](references.md) | 官方文档与仓库事实来源 |

## 建议的代码落点

```text
swufe-webvpn-codec/
├─ apps/
│  └─ desktop/                       # 现有，不因本 Feature 重写
├─ bridges/
│  └─ python/                        # 现有 Python 权威行为/测试向量来源
├─ packages/
│  └─ webvpn-core-js/                # 新增：纯业务核心
│     ├─ src/
│     │  ├─ codec/
│     │  ├─ routing/
│     │  ├─ rewrite/
│     │  ├─ session/
│     │  └─ runtime/
│     └─ tests/
└─ plugins/
   ├─ loon/
   │  ├─ src/
   │  ├─ swufe-webvpn.plugin
   │  └─ dist/
   └─ stash/
      ├─ src/
      ├─ swufe-webvpn.stoverride
      └─ dist/
```

`packages/webvpn-core-js` 不直接访问 `$request`、`$response`、`$persistentStore` 等平台全局变量；平台差异必须经 Adapter 注入。这样 Python 与 JS 可以共享协议测试向量，Loon/Stash 也不会各自复制业务逻辑。

## 当前未决但不需要需求方补充的问题

| ID | 问题 | 处理方式 | 是否阻塞 |
| --- | --- | --- | --- |
| OQ-001 | `openUrl`/Tile URL 在当前 Loon/Stash iOS 版本中是否稳定以应用内网页呈现 | 已关闭：两边都打开系统 Safari。Loon 3.5.1(998)；Stash 版本未记录 | 不阻塞。文案改为打开网页登录 |
| OQ-002 | 上述网页中的 WebVPN 请求是否进入同一 MitM/HTTP Script 链路 | 已关闭：Safari 中的 gateway 与 authserver 请求都能被对应宿主脚本看见 | 不阻塞自动 Session Capture |
| OQ-003 | 实机 WebVPN 会话所需 Cookie 的最小集合与失效信号 | 不硬编码 Cookie 名；P0/集成测试确认 | 阻塞 Session 最小化收敛 |
| OQ-004 | Loon 对目标域名 QUIC/HTTP3 的最佳局部禁用方式 | 真机网络测试；不得为了本插件全局关闭 UDP/443 | 不阻塞 Core |
| OQ-005 | Stash/Loon 对大 HTML/JS 响应脚本的内存/超时上限 | 压测后设置 body size guard | 不阻塞首个 PoC |
| OQ-006–010 | Settings nonce/header 能力、wildcard MitM/HTTP/QUIC、Tile URL 与 oversized POST short-circuit | Gate D 真机验证；失败按 spec 规定 fail-closed/静态范围退化 | Settings POST、动态拦截为阻塞项 |

OQ-001 的结果是系统 Safari，产品文案不得再称「应用内登录」。OQ-002 通过，Gate A 不改走 Companion App，也不把手工复制 Cookie 当默认流程。
