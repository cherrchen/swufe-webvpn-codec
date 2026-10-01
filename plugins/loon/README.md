# SWUFE WebVPN · Loon

Spec 003 M3 的本地实现；真机验收尚未完成。Stash 后续开发暂停，现有风险记录保留在 [verification](../../specs/003-ios-proxy-client-plugins/verification.md)。

使用 Loon **3.5.1 (983) 或以上**的新 Script 语法。实现参考 [官方 Plugin 文档](https://nsloon.app/docs/Plugin/)、[新版 Script](https://nsloon.app/docs/Script/script_v2/) 与 [Script API](https://nsloon.app/docs/Script/script_api/)。

## 安装与使用

1. 将 [swufe-webvpn.plugin](swufe-webvpn.plugin) 导入 Loon，启用插件、脚本、MitM，并安装/信任自己的 Loon CA。
2. 在 Safari 打开 `https://webvpn.swufe.edu.cn/__swufe_bridge__/`，或运行 Generic「SWUFE 网站设置」后点击通知。
3. 在本地设置页开关教务、添加/删除精确 SWUFE 子域，为每个站点选择 HTTP/HTTPS 并保存。教务默认使用 HTTP。保存后下一请求读取新配置。
4. 点击「打开网页登录」，在官方 WebVPN/CAS/MFA 页面自行登录。插件从 Gateway 流量捕获会话；不保存密码或 CAS Cookie。
5. 打开 `http://jwxt.swufe.edu.cn/` 验收。Generic「SWUFE 打开网页登录」也可通过通知打开官方页面。

插件 Argument 提供「启用转发」与「调试日志」。关闭转发时设置页仍可使用；彻底停用可关闭整个插件。站点数据与会话保存在 Loon 本机，不从 Stash 导入。

MitM 范围包含 `*.swufe.edu.cn`，会在本机解密 SWUFE 子域 HTTPS；只有设置页选中的精确 host 被 WRD 转发。局部 QUIC 拒绝规则尝试让 SWUFE 流量回落 TCP。请勿与 P0 logger/其它相同 URL 的 Script 重叠，新语法只执行第一条命中 HTTP Script。

## 制品与开发

当前本地制品为 `0.1.1-m3`：Loon 的 URL rewrite 同步设置网关 `Host`（含非默认端口），避免保留原教务 Host。原始教务 URL 的设备失败与修复后复验状态见 [verification](../../specs/003-ios-proxy-client-plugins/verification.md)。真机复验尚未通过。

`dist/request.js`、`dist/response.js`、`dist/generic.js` 是无 Node runtime 的单文件 bundle。插件引用本仓库 main 分支的 GitHub raw 文件；**本地实现未推送前，远程链接不能提供本轮制品**。可先把三个 bundle 导入 Loon，并将插件 Script 路径改为对应本地文件。发布时需把 `.plugin` 与三个 bundle 一起分发，回滚时固定同一版本的完整制品。

```bash
pnpm --filter swufe-webvpn-loon run typecheck
pnpm --filter swufe-webvpn-loon run test
pnpm --filter swufe-webvpn-loon run build
```

Loon/Stash 共用 [plugin runtime](../../packages/webvpn-plugin-runtime/src/runtime.ts) 与 [Core](../../packages/webvpn-core-js/src/index.ts)；Loon 原生 API 位于 `src/runtime.ts`，宿主配置/nonce 适配位于 `src/adapter.ts`。不依赖第三方 BoxJS。

## 真机验证门槛

当前 Node VM 测试不能证明 Loon 配置解析、网络接管或 upstream Cookie 实际发送。需按 [Spec 003 测试计划](../../specs/003-ios-proxy-client-plugins/test-plan.md) 完成 G01–G18、N01–N10 以及 Settings K/M 系列的 Loon 等价验证，重点检查：HTTP/80、两阶段 `$request.url`、原生 bootstrap 无自跳转、CAS/MFA、跨 App ticket 复用、logout、QUIC/TCP 回落、Settings Referer 和超过 16 KiB 的本地拒绝。

Settings nonce 在 Safari Web Crypto 生成，GET bootstrap 要求 Settings 页 Referer；缺失该来源时 API 返回 503，保持关闭。token 仅用一次、两分钟有效。敏感值不会出现在设置响应和 Trace；设计见 [ADR-0016](../../docs/architecture/adr/ADR-0016-loon-local-settings-runtime.md)。body 改写已有 Core 大小 guard，宿主读取 body 时的内存/超时仍须 M4 真机压测。
