# 测试计划：iOS Proxy Client Plugins

> Status: Approved  
> Spec ID: 003  
> Owner: cherrchen  
> Last Reviewed: 2026-09-24

## 1. 目标

证明：JS Core 与 desktop Python 协议一致；Loon/Stash Adapter 正确映射宿主 API；真实 iOS 能完成 CAS/MFA → Session Capture → 教务访问；安全边界成立。

## 2. 测试层级

### L0 Pure Unit

Node 环境执行：codec、allowlist、session parser、request decision、response rewrite、schema validation、redact。

### L1 Cross-language Contract

同一 `vectors.json` 同时由 Python `WrdCodec` 与 JS `WrdCodec` 运行。Python 是现有行为基线，向量文件成为跨语言共享事实。

### L2 Adapter Unit

mock Loon/Stash globals，测试 `$request/$response/$persistentStore/$notification/$done`、Tile output、version guard。

### L3 Bundle Smoke

release bundle：单文件可解析、无 Node built-in、无 unresolved imports、记录大小、许可清单、版本 banner、fixtures 不进 release。

### L4 Host Import Smoke

真机：Loon plugin / Stash override 可导入、enable/disable、script provider、MitM、debug log。

### L5 P0 Login PoC

真实 iPhone/iPad：验证 openUrl/Tile URL 呈现位置、WebVPN → CAS → MFA → WebVPN、gateway request 是否进入 script、Cookie 能否捕获、页面关闭后 Session 是否保留。

### L6 End-to-end

校外网络：Safari 访问教务、至少完成一项真实只读/低风险操作、redirect/Cookie/body rewrite、失效后重登、Wi-Fi/Cellular 冒烟。

## 3. 测试环境

自动化使用仓库当前 Node/pnpm/Python 版本。真机至少 1 台 iPhone + 另一个 iOS/iPadOS 组合；最新受支持 Loon/Stash；测试者自有合法 SWUFE 账号；校外 Wi-Fi；蜂窝网络冒烟。

实际版本号在执行 verification 时记录，设计阶段不虚构。

## 4. 测试数据

可提交：虚构 hostname、deterministic codec vectors、虚构 Cookie、合成 HTML/JS/JSON、合成 Header。

禁止提交：真实 WebVPN Cookie、学号、密码、MFA、个人页面正文、含个人数据的 HAR。

## 5. Codec 向量

至少覆盖 jwxt、path/query、http、非默认端口、fragment、非法 host、malformed token、wrong key、IV/token 错误、roundtrip，并导入现有 Python 已验证向量。

## 6. 安全测试

- 非 allowlist 绝无 WebVPN Cookie；
- authserver 不保存认证 Cookie/body；
- log redact；
- notification 无 Session；
- corrupt storage 不 dump；
- remote URL 为 HTTPS；
- clear 后不再注入；
- wildcard 默认关闭。

## 7. P0 Login 记录模板

```text
Host app:
Version/build:
iOS/iPadOS:
Device:
Network:
Date:

1. Tap login URL
2. Record whether view stays in host app
3. Complete CAS
4. Complete MFA
5. Return to WebVPN
6. Inspect script log for session-captured event

Do NOT record password/MFA/cookie value.

Result:
- inAppWeb: yes/no
- redirectChainCompleted: yes/no
- requestScriptObservedGateway: yes/no
- sessionCaptured: yes/no
- notes:
```

## 8. 性能

首版不设无依据毫秒 SLA，但记录 request script elapsed、response header-only elapsed、body rewrite 100KB/500KB/1MB、bundle size、内存/termination。根据实测冻结 body max 与 timeout。

## 9. 回归

每次移动端改动都跑：existing pnpm tests、Python bridge tests、JS core tests、cross vectors、bundle smoke、docs check。不得破坏 desktop。

## 10. Entry Criteria

进入真机 E2E 前：Core 单测全绿、cross vectors 全绿、bundle 可解析、Session 日志红线通过、至少一个宿主配置可导入。

## 11. Exit Criteria

- PRD Must 有证据；
- Loon/Stash 安装冒烟通过；
- 至少一个宿主完整 E2E；
- 另一宿主若无法 E2E，明确记录限制而不是标 Passed；
- P0 登录结论冻结；
- 无 Session 泄露；
- 文档同步完成。
