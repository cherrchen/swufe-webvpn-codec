# SWUFE WebVPN Bridge

<p align="center"><a href="README.md">简体中文</a> • <a href="README.en.md">English</a></p>

SWUFE WebVPN Bridge 是面向 macOS 和 Windows 的桌面工具：用户在应用内通过学校官方网瑞达 WebVPN（CAS/MFA）登录后，本机桥可将 allowlist 中的 HTTP/HTTPS 请求转发到 WebVPN，让本机浏览器访问获准的校内网站，例如教务系统 `jwxt.swufe.edu.cn`。

**它不是 VPN**，不提供任意 TCP/UDP 转发，也不替代学校的 SSLVPN。项目由个人维护，与西南财经大学及网瑞达厂商无隶属关系；学校 WebVPN 和校内网站均为第三方系统。

## 项目状态

- macOS 和 Windows 的第一期真机验收及教务浏览器操作均已通过；实现与未解决事项见 [验收记录](specs/001-phase1-local-bridge/verification.md) 和 [已知问题](specs/001-phase1-local-bridge/known-issues.md)。
- `KI-019` 仍为 `Open`：经桥访问教务偶发无响应，现场记录已定位到桥的上游请求/响应阶段，但尚无报文级根因证据。遇到时可重载页面；这不等于问题已修复。
- 当前仓库提供源码和开发运行方式，**没有面向普通用户的安装包、签名/公证产物或正式发行渠道**。开源准备不代表已经发布可直接安装的版本。
- 许可：[MIT](LICENSE)。

## 使用前请了解

应用使用本机 MITM CA 解密并改写 HTTPS。只有用户明确安装 CA 后才具备该能力；CA 私钥留在本机，用户可从应用卸载 CA。安装 CA 会让本机受信任的 HTTPS 流量具备被解密的可能，请只在自己管理且理解风险的设备上使用。范围、信任边界和限制见[安全说明](docs/security/README.md)。

使用者必须有权登录学校 WebVPN 并访问相应资源。应用不保存学校密码、不绕过 CAS/MFA，也不提供未授权访问。运行时需能连接学校 WebVPN；校园外的教务主机通常不能直接解析或访问，教务请使用应用默认的“系统代理”模式。若浏览器把教务入口自动升级到 HTTPS，学校网关可能无法处理该入口；相关操作限制见[运行说明](docs/operations/development-run.md)。

目前支持目标是 macOS 与 Windows。Linux、应用商店分发、批量部署、与其它系统代理/TUN 工具同时工作、证书钉扎客户端及任意 TCP/UDP 均不在当前范围内。

## 普通使用者

目前没有可下载的正式安装包。若要从源码试运行，请按下方开发者步骤准备环境，再查看[完整运行说明](docs/operations/development-run.md)完成登录、CA 安装和桥接操作。首次运行时应用会构建 Electron 开发版；启用 HTTPS 解密前必须在应用中查看风险提示并主动安装本机 CA。

## 开发者：从源码运行

前置条件：Node.js 22 或更新版本、pnpm（版本见 `package.json`）、uv，以及 macOS 或 Windows。

```bash
uv sync --directory bridges/python
pnpm install
pnpm start
```

启动后在应用的登录窗口完成官方 WebVPN 登录；按需安装本机 CA 并启动桥。完整前置条件、权限操作、故障排查和运行限制见[开发运行说明](docs/operations/development-run.md)；Electron 命令与目录细节见[桌面应用说明](apps/desktop/README.md)。

常用开发检查：

```bash
pnpm run docs:check
pnpm --filter swufe-webvpn-bridge run typecheck
pnpm --filter swufe-webvpn-bridge run test:unit
pnpm --filter swufe-webvpn-bridge run test:ui
```

贡献流程见 [CONTRIBUTING.md](CONTRIBUTING.md)。开始修改前请阅读 [AGENTS.md](AGENTS.md)，并按任务查阅相应的 [项目文档](docs/README.md) 或 [Feature Spec](specs/README.md)。

## 项目导航

| 你想了解 | 从这里开始 |
| --- | --- |
| 用户可见行为、边界与术语 | [项目概览](docs/overview/project-overview.md)、[目标与非目标](docs/overview/goals-and-non-goals.md)、[术语表](docs/overview/glossary.md) |
| 安装 CA 的风险、数据与安全边界 | [安全说明](docs/security/README.md) |
| 本地运行、系统权限和常见问题 | [开发运行说明](docs/operations/development-run.md) |
| 功能实现与验收情况 | [Spec 001](specs/001-phase1-local-bridge/spec.md)、[Spec 002](specs/002-desktop-ui-multiwindow/spec.md)、[验收记录](specs/001-phase1-local-bridge/verification.md) |
| 架构和接口 | [架构索引](docs/architecture/README.md)、[API 索引](docs/api/README.md) |
| 开发流程与文档规范 | [贡献指南](CONTRIBUTING.md)、[文档索引](docs/README.md) |

## License

[MIT](LICENSE) © 2026 cherrchen。
