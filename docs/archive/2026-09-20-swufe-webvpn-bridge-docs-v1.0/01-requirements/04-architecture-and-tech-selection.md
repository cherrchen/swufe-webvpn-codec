# 技术方案选型与架构设计

## 1. 架构总览

```text
┌──────────────────────────────────────────┐
│ Electron App                             │
│  UI / Login WebView / Session / Orchestr.│
└───────────────┬──────────────────────────┘
                │ spawn / cookies / allowlist
                ▼
┌──────────────────────────────────────────┐
│ mitmproxy (sidecar)                      │
│  Regular proxy + local capture           │
│  + WRD addon (薄)                        │
└───────────────┬──────────────────────────┘
                │ HTTPS + Cookie
                ▼
        webvpn.swufe.edu.cn
                │
                ▼
         校内 Web 服务 (jwxt 等)
```

后续可选：

```text
sing-box TUN → 127.0.0.1:mitm
```

第一期不上 TUN。

## 2. 关键决策记录（ADR 摘要）

### ADR-1：不在 sing-box/mihomo 内实现 WRD

- **问题**：内核看到的是 CONNECT 目标主机，无法把 HTTP 语义改成 WebVPN 路径。
- **决定**：WRD 改写放在 mitm 层；sing-box 仅作未来 TUN/分流壳。
- **后果**：第一期依赖 MITM CA。

### ADR-2：mitmproxy 而非自研 TLS 栈

- **问题**：自研 MITM（如早期 rwppa 类）PKI/安全成本高。
- **决定**：复用 mitmproxy 处理 TLS/HTTP2/证书。
- **后果**：Python 运行时需随 App 分发或系统安装。

### ADR-3：Electron 而非纯 CLI

- **问题**：CAS/MFA 与证书引导需要 GUI。
- **决定**：Phase 1 即 Electron。
- **后果**：包体积增大；换取登录与状态体验。

### ADR-4：系统代理冲突时拒绝启动

- **问题**：与 Clash 叠加难测。
- **决定**：拒绝启动并提示关闭。
- **后果**：实现简单；用户需切换工具。

### ADR-5：默认密钥可写死，保留覆盖点

- **依据**：实机 URL 证明 `wrdvpnisthebest!`。
- **决定**：默认内置；配置可覆盖。

## 3. 技术选型对比

| 能力 | 候选 | 选择 | 理由 |
|---|---|---|---|
| 桌面壳 | Electron / Tauri / Qt | **Electron** | WebView 登录、跨 mac/win 成熟 |
| HTTPS 中间人 | mitmproxy / 自研 / Proxifier | **mitmproxy** | HTTP2/证书/插件生态 |
| WRD 实现 | Python addon / Node | **与 mitm 同进程 Python** | 部署简单；逻辑已有 Python 原型 |
| 分流内核 | sing-box / mihomo / 无 | **Phase1 无；后期偏好 sing-box** | 边界清晰；非 Clash 订阅场景 |
| 配置存储 | JSON / SQLite | **JSON** | 结构简单 |
| 编解码语言 | Python / TypeScript 双份 | **Python 权威；TS 可后补** | 先保证与 mitm 一致 |

## 4. 部署形态

- 开发：本机 Node + Python venv + mitmdump
- 发布：Electron 打包；sidecar 带嵌入式 Python 或 `mitmproxy` 可执行文件（实现阶段再定体积方案）

## 5. 质量属性

| 属性 | 策略 |
|---|---|
| 正确性 | codec 向量测试 + 教务手工/半自动验收 |
| 安全性 | 无密码；CA 可卸载；日志最小化 |
| 可维护性 | addon 保持「薄」；OS 差异集中在 Cert/Proxy Orchestrator |
| 可移植性 | macOS/Windows 优先；抽象 OS 适配层 |
