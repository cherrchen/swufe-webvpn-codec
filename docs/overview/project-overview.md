# 项目总览

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-21

**用途**：本文件回答「这个项目是什么、为谁解决什么问题、边界在哪里」。
它是所有 Agent 与新人进入项目后第一份应读的文档，也是 [AGENTS.md](../../AGENTS.md) 中 Project Identity 的展开版本。

---

## 一句话描述

`SWUFE WebVPN Bridge`：macOS / Windows 上的 Electron 桌面应用——用户在 App 内完成官方网瑞达 WebVPN（CAS/MFA）登录后，本机 HTTP/HTTPS 流量中命中 allowlist 的请求由本地桥（[本机桥](glossary.md)）改写为 WebVPN URL 并携带会话，使本机浏览器能打开并操作教务 `jwxt.swufe.edu.cn`。不是真 VPN。

## 背景

- 学校校外访问校内 Web 资源依赖网瑞达（Wengine）WebVPN `webvpn.swufe.edu.cn`；统一身份认证经 `authserver.swufe.edu.cn`（CAS，可含 MFA）。
- WebVPN 是**应用层反向代理**，不是 SSLVPN/TUN；URL 编解码为 AES-128-CFB（`segment_size=128`），默认 `key = iv = wrdvpnisthebest!`，形态为
  `https://webvpn.swufe.edu.cn/{http|https}[-{port}]/{iv_hex}{host_cipher}{path}?{query}`。
- 因而用户无法让本机普通浏览器/应用以「真实内网主机名」透明访问校内 HTTP/HTTPS 服务，只能在 WebVPN 门户内使用其改写后的 URL。

## 目标用户 / 使用者

| 角色 | 描述 | 主要诉求 |
| ---- | ---- | -------- |
| 西财师生（开发者本人优先） | 主用户；校外网络环境 | 校外用本机浏览器访问教务等 allowlist 内站点 |
| 未来开源用户 | 可自建、可审计的第三方使用者 | 自建桥、审计实现与证书风险说明 |

## 要解决的问题

**现状**：校外访问校内 Web 资源必须走官方 WebVPN（`webvpn.swufe.edu.cn`），统一身份经 `authserver.swufe.edu.cn`（CAS，可含 MFA）。WebVPN 是应用层反向代理而非 SSLVPN/TUN，因此本机浏览器与应用无法以「真实内网主机名」透明访问校内 HTTP/HTTPS 服务。

**痛点**：只能在 WebVPN 形态的 URL 下使用资源；校内站点（尤其教务系统）页面中存在大量绝对 URL，离开 WebVPN 形态后点击会跳飞到不可达的公网直连，同时 Cookie 可能被写到错误域。

**当前阶段**：M1–M4 的桌面桥主路径已在 macOS 与 Windows 完成真机验收，M6 界面重构已实现；M5 开源前文档准备已完成。M5 不包含安装包或公开发行。验收状态与未解决问题以 [001 验证记录](../../specs/001-phase1-local-bridge/verification.md) 和 [roadmap](../planning/roadmap.md) 为准。

## 范围（Scope）

```text
In scope:     macOS / Windows 上，经官方 WebVPN 登录后，把本机 HTTP/HTTPS 中命中 allowlist
              的请求改写为 WebVPN 形态并携带会话，使本机浏览器可打开并操作教务等站点；
              系统 HTTP/HTTPS 代理接管 + 按进程捕获；WRD 请求改写与响应反向改写；
              MITM CA 安装/卸载；allowlist（含可选 *.swufe.edu.cn）管理；
              会话（Cookie）管理与过期处理；桥状态与调试日志。
Out of scope: NG-001..NG-008，详见 goals-and-non-goals.md
```

## 交付形态

```text
Repository type:  Documentation-first（docs/ + specs/）+ Python bridge（bridges/python/）+ Electron desktop app（apps/desktop/）
Primary language: Python 3（bridge sidecar / Addon、WRD codec 权威实现，见 bridges/python/swufe_bridge/）
                  + TypeScript / React（Electron 应用与渲染层）
                  文档为 Markdown + Node 文档检查脚本
License:          MIT
Owner:            cherrchen
```

## 关键链接

| 内容 | 链接 |
| ---- | ---- |
| 需求 | [requirements/](../requirements/README.md) |
| 架构 | [architecture/overview.md](../architecture/overview.md) |
| 术语表 | [glossary.md](glossary.md) |
| 路线图 | [planning/roadmap.md](../planning/roadmap.md) |
| 第一期 Spec | [specs/001-phase1-local-bridge/spec.md](../../specs/001-phase1-local-bridge/spec.md) |
| 外部资料 | [https://webvpn.swufe.edu.cn](https://webvpn.swufe.edu.cn) —— 网瑞达 WebVPN 门户入口；[https://authserver.swufe.edu.cn](https://authserver.swufe.edu.cn) —— 统一身份认证（CAS，可含 MFA）入口。二者均为学校官方系统，非本项目资产 |

## Open Questions

| ID  | 问题 | 影响 | 状态 |
| --- | ---- | ---- | ---- |
| Q-001 | WebVPN 会话 Cookie 名称与失效信号需以实机为准 | Session Broker 的会话提取与过期检测实现 | Open |
| Q-002 | mitm sidecar 分发形态未定：嵌入式 Python 还是外置 mitmproxy 可执行文件 | 打包体积、安装流程与跨平台分发 | Open |
| Q-003 | 产品名「SWUFE WebVPN Bridge」为原包标注的暂定名 | 文档、包名与发布物料 | Open |
