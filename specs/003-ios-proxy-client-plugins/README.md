# SWUFE WebVPN iOS Proxy Client Plugins — 文档包

> Status: Draft  
> Spec ID: `003-ios-proxy-client-plugins`  
> Owner: cherrchen  
> Last Reviewed: 2026-09-24  
> Scope: Loon / Stash 插件，不开发独立 iOS App

本目录是仓库 [Spec 003](../README.md) 的 Feature 文档包（路径 `specs/003-ios-proxy-client-plugins/`），描述如何在 iPhone/iPad 上复用 Loon / Stash 的代理、TUN 与 HTTPS MitM 能力，实现 SWUFE WebVPN 的 URL 编码、会话捕获、请求改写与响应反向改写。

## 已确认的产品决策

1. **不开发独立 iOS App**。移动端作为第三方代理客户端插件运行。
2. **Loon 为第一实现，Stash 为第二适配器**；两者共享同一个 TypeScript/JavaScript 业务 Core。
3. 移动端不复刻 desktop 的 mitmproxy、CA Manager、System Proxy、进程捕获；这些基础网络能力由 Loon / Stash 提供。
4. CAS / SSO / MFA 始终使用学校官方网页，不存储学号、密码，不模拟登录协议。
5. 插件只保存 WebVPN 会话所需的最小 Cookie 状态，并禁止 Cookie/正文进入日志。
6. WRD URL 算法以现有 `bridges/python/swufe_bridge/wrd_codec.py` 为行为权威；移动端实现必须通过同一组测试向量。
7. 默认仍采用 allowlist，`webvpn.swufe.edu.cn` 与 `authserver.swufe.edu.cn` 必须排除二次包装。
8. Stash 首页 Tile 用作状态/登录入口；Loon 使用插件参数、通知/入口能力形成相近体验。
9. HTTPS 解密仅作用于明确的 WebVPN/目标域名范围，不默认 MITM 整个互联网。
10. **P0 实机门槛**：必须验证 Loon/Stash 的 URL 入口是否能以应用内网页呈现，以及该页面的 WebVPN 请求能否进入同一 HTTP Script/MitM 链路。公开文档没有把这一点作为插件 API 契约保证，因此不得在未实测前写成已确认事实。

## 文件导航

| 类型 | 文件 | 用途 |
| --- | --- | --- |
| 需求 | [prd.md](prd.md) | 产品目标、范围、用户故事、需求与验收标准 |
| 需求 | [ui-ux.md](ui-ux.md) | 安装、登录、状态、错误与 Stash/Loon 交互 |
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
| OQ-001 | `openUrl`/Tile URL 在当前 Loon/Stash iOS 版本中是否稳定以应用内网页呈现 | P0 真机 PoC | 阻塞目标 UX，不阻塞 Core 开发 |
| OQ-002 | 上述网页中的 WebVPN 请求是否进入同一 MitM/HTTP Script 链路 | P0 真机抓取 | 阻塞自动 Session Capture |
| OQ-003 | 实机 WebVPN 会话所需 Cookie 的最小集合与失效信号 | 不硬编码 Cookie 名；P0/集成测试确认 | 阻塞 Session 最小化收敛 |
| OQ-004 | Loon 对目标域名 QUIC/HTTP3 的最佳局部禁用方式 | 真机网络测试；不得为了本插件全局关闭 UDP/443 | 不阻塞 Core |
| OQ-005 | Stash/Loon 对大 HTML/JS 响应脚本的内存/超时上限 | 压测后设置 body size guard | 不阻塞首个 PoC |

如 OQ-001 失败，产品降级为“点击后打开系统 Safari”；如 OQ-002 失败，则“纯插件自动捕获登录态”不可成立，需要重新评估是否接受手工 Session 导入或开发极小原生 Companion App。该降级不应被静默隐藏。
