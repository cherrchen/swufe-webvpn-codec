# Architecture Decision Records (ADR)

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-25

**用途**：记录**为什么**这样设计。需求说明「做什么」，架构说明「是什么」，ADR 说明「为什么选它、放弃了什么、代价是什么」。
本目录是技术决策的 Source of Truth。

## 何时必须写 ADR

满足任意一条即必须建立 ADR：

- 核心技术栈改变；
- 公共接口变化；
- 数据模型重大改变；
- 安全模型改变；
- 跨模块架构改变；
- 引入重要基础设施；
- 做出未来难以逆转的设计决策。

普通小型实现、局部重构、内部命名调整**不要**写 ADR。

## 命名与编号

```text
docs/architecture/adr/ADR-0001-<short-slug>.md
```

- 编号四位递增，分配后不复用；
- `ADR-XXXX` 是稳定标识，标题可以微调，编号不可改；
- 模板见 [template.md](template.md)（模板本身不是决策，不占用编号）。

## 状态

| 状态 | 含义 |
| ---- | ---- |
| Proposed | 提出，尚未决定 |
| Accepted | 已采纳，当前有效 |
| Superseded | 已被新 ADR 取代，必须指向新 ADR |
| Deprecated | 仍然存在但不再推荐 |
| Rejected | 讨论后未采纳，保留原因 |

## 索引

| ADR | 标题 | Status | Date | 取代关系 |
| --- | ---- | ------ | ---- | -------- |
| [ADR-0001](ADR-0001-wrd-rewrite-in-mitm-layer.md) | 不在 sing-box / mihomo 内核内实现 WRD 改写 | Accepted | 2026-09-20 | — |
| [ADR-0002](ADR-0002-reuse-mitmproxy-for-tls.md) | 复用 mitmproxy 而非自研 TLS / MITM 栈 | Accepted | 2026-09-20 | — |
| [ADR-0003](ADR-0003-electron-gui-for-phase-1.md) | Phase 1 采用 Electron 而非纯 CLI | Accepted | 2026-09-20 | — |
| [ADR-0004](ADR-0004-refuse-start-when-system-proxy-in-use.md) | 系统代理被占用时拒绝启动 | Accepted | 2026-09-20 | — |
| [ADR-0005](ADR-0005-builtin-wrd-key-with-override.md) | WRD 默认密钥内置并保留配置覆盖 | Accepted | 2026-09-20 | — |
| [ADR-0006](ADR-0006-local-capture-mode-and-mutual-exclusion.md) | mitmproxy local 模式做进程捕获，且与系统代理互斥 | Accepted | 2026-09-21 | — |
| [ADR-0007](ADR-0007-gateway-owned-namespaces-and-native-mode-promotion.md) | 网关自有命名空间直通，且 bootstrap 文档升级到网关原生 URL 空间 | Accepted | 2026-09-21 | — |
| [ADR-0008](ADR-0008-ca-trust-authorization-in-app-session.md) | CA 信任设置由应用进程写入（钥匙串写入保留提权） | Accepted | 2026-09-21 | — |
| [ADR-0009](ADR-0009-monorepo-layout.md) | 仓库改为路径式 monorepo：应用入 apps/<app>、桥入 bridges/<bridge> | Accepted | 2026-09-21 | — |
| [ADR-0010](ADR-0010-pnpm-workspaces.md) | Node 工具链切换到 pnpm 11 workspaces：单一锁文件与 workspace 脚本转发 | Accepted | 2026-09-21 | 取代 ADR-0009 备选表中「继续用 npm」一行的结论（ADR-0009 的布局决策本身仍有效） |
| [ADR-0011](ADR-0011-refuse-start-on-fake-ip-dns.md) | fake-ip（TUN / 虚拟网卡）环境同样以 `PROXY_CONFLICT` 拒绝开桥 | Accepted | 2026-09-21 | 不取代 ADR-0004：仅扩展其开桥前冲突判据（系统代理判据与清除语义不变） |
| [ADR-0012](ADR-0012-react-antd-multiwindow-renderer.md) | 渲染层迁移到 React + Ant Design 6，桌面界面改为四窗口结构 | Proposed | 2026-09-23 | 不取代任何既有 ADR：只约束渲染层框架、构建方式与窗口结构（ADR-0003 的 Electron 选择仍有效） |
| [ADR-0013](ADR-0013-js-core-aes-cfb128.md) | iOS 插件用共享 JS Core，AES-CFB128 以 aes-js 为块加密 | Accepted | 2026-09-24 | 不取代 ADR-0005：desktop 仍用 Python codec；本决策只约束移动端 JS backend |
| [ADR-0014](ADR-0014-stash-local-settings-and-routing-scope.md) | Stash 使用本地 pseudo WebUI 管理精确 WebVPN 站点 | Accepted | 2026-09-25 | 不取代既有 ADR；定义 Spec 003 Stash Settings 与 Interception/Routing Scope 边界 |

## 规则

1. ADR 一旦 `Accepted` 就不可改写内容；语义变化必须新建 ADR 并 `Supersede` 旧条目。
2. 同一时刻只允许一个 ADR 对同一决策主题声称当前有效；被取代者必须标注指向新 ADR。
3. ADR 需要与 [overview.md](../overview.md)、[components.md](../components.md)、[interfaces.md](../interfaces.md) 保持一致；冲突时先更新 ADR 状态。
4. ADR 不写实现细节和任务拆解（→ [specs/](../../../specs/README.md)）。
5. 语言：模板与已采纳 ADR 使用中文主文档；英文版本可按需补充 `ADR-XXXX-<slug>.en.md`。

## 本目录不存放什么

- Feature 级技术设计 → `specs/<id>-<name>/design.md`
- 临时技术调研 → [.agents/notes/](../../../.agents/notes/README.md)
