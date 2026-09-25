# 参考资料与事实来源

> Last Checked: 2026-09-25

本文记录本 Feature 使用的仓库既有事实、Loon/Stash 官方能力与需要实机验证的边界。实现时若宿主 App 版本发生变化，应重新核对对应官方文档。

2026-09-25 检查的 Stash 官方文档确认：Override MitM 项支持 `*.domain` wildcard；HTTP Engine 文档明确 HTTP/3 不进入 HTTP Engine；Rule Types 文档列出 `DOMAIN-SUFFIX`、`PROTOCOL,QUIC`、`AND`；HTTP Rewrite Script 文档定义 `$done({response:{status,headers,body}})` 可直接替换响应，并说明 `require-body`、request body 上限与 `webkit` engine 可使用 `crypto`/`TextEncoder` 等 Web API；Tile 文档允许 `$done({url})` 更新点击 URL；Script Interface 文档定义 `$persistentStore.read/write`。这些是官方公开能力描述，不代表本项目配置或 Settings flow 已真机验证。

## 1. 仓库现有事实

- `bridges/python/swufe_bridge/wrd_codec.py`：现有 WRD URL codec；AES-128-CFB128；只加密 hostname；支持 scheme/port/path/query。
- `bridges/python/swufe_bridge/rewrite.py`：响应反向改写顺序为 `Location` → `Set-Cookie` → HTML/JS/JSON 中 WRD URL。
- `bridges/python/swufe_bridge/addon.py`：allowlist 请求改写、WebVPN Cookie 注入、gateway-owned namespace、防二次包装与 bootstrap promotion。
- `bridges/python/swufe_bridge/config.py`：运行时配置、Cookie 与 allowlist 数据形态。
- `docs/architecture/data-flow.md`：desktop 主数据流与一致性要求。
- `docs/security/README.md`：不存密码、Session/Cookie 日志红线、allowlist 默认拒绝与信任边界。
- `docs/architecture/adr/ADR-0005-builtin-wrd-key-with-override.md`：默认 WRD key/iv 与覆盖策略。

仓库：`https://github.com/cherrchen/swufe-webvpn-codec`

**插件分发（产品决策，2026-09-24）**：`.stoverride`、`.plugin` 与 bundled 脚本仅通过上述 GitHub 仓库提供（GitHub Releases 与/或 `raw.githubusercontent.com` 固定路径）。见 [prd.md §7 IOS-REQ-001/012](prd.md)。

## 2. Loon 官方资料

### Plugin

`https://nsloon.app/docs/Plugin/`

用于确认：

- Plugin 可组合 Rule / Rewrite / Script / Host / Mitm；
- `[Argument]` 支持输入、select、switch；
- Plugin Script 可读取参数。

### Script API

`https://nsloon.app/docs/Script/script_api/`

用于确认：

- `$persistentStore`；
- `$notification.post`，包含 `openUrl` 能力；
- `$httpClient`；
- request/response script runtime；
- AES API（公开文档列出的模式为 ECB/CBC/CTR/GCM，不直接提供 CFB）。

### Script v2

`https://nsloon.app/docs/Script/script_v2/`

用于确认新版 Script 配置语法。

### General / Rules

- `https://nsloon.app/docs/General/`
- `https://nsloon.app/docs/Rule/logic_rule/`
- `https://nsloon.app/docs/Rule/port_rule/`

用于确认 UDP/QUIC 和规则表达能力。`disable-udp-ports` 属于通用配置能力，本 Feature 不应未经实机验证就全局关闭 UDP/443。

## 3. Stash 官方资料

### Override

`https://stash.wiki/en/configuration/override`

用于确认：

- `.stoverride`；
- `openUrl`；
- `http.mitm`；
- `http.script`；
- `script-providers`。

### Tile

`https://stash.wiki/en/script/tile`

用于确认：

- 首页 Tile；
- Tile `url`；
- 脚本可通过 `$done` 更新 title/content/icon/backgroundColor/url。

### Script Interface

`https://stash.wiki/en/script/syntax-and-interface`

用于确认 `$persistentStore`、`$httpClient`、`$notification`、`$environment` 等脚本能力。

### HTTP Rewrite

`https://stash.wiki/en/script/rewrite-requests`

用于确认 request/response 可修改 URL/header/body，以及 WebKit engine 可使用部分浏览器 Web API。注意：WebKit JavaScript runtime 不等于第三方插件获得一个可显示的 `WKWebView`。

### HTTP Engine

`https://stash.wiki/en/http-engine/intro`

用于确认 HTTPS MitM/HTTP Engine，以及 HTTP/3 当前不进入 HTTP Engine、而作为 UDP 流量处理这一兼容边界。

### Stash rule syntax

- `https://stash.wiki/en/rules/rule-types` — `DOMAIN-SUFFIX`、`PROTOCOL,QUIC`、`AND` 规则类型。
- `https://stash.wiki/en/http-engine/mitm` — MitM host pattern 支持 `*.example.com` 和端口表达方式。

### Stash Synthetic Response / runtime

- `https://stash.wiki/en/script/rewrite-requests` — request `$done` 可返回 response 来替换响应、不实际发起请求；并定义 request body/max-size/script engine。
- `https://stash.wiki/en/script/syntax-and-interface` — `$persistentStore` API；WebKit engine 可以使用包括 `crypto` 在内的部分 Web API。
- `https://stash.wiki/en/script/tile` — Tile `$done` 可更新 URL；目标 Stash 版本的动态 URL 行为仍需真机确认。

Settings token 的候选实现为 request script `engine: webkit` + `crypto.getRandomValues`。官方页面确认 `crypto` Web API 可用性范围，但具体随机方法及运行环境仍需设备验证；无法安全生成 nonce 时 fail closed。

### URL Schema

`https://stash.wiki/en/faq/url-schema`

用于确认远程 Override 的一键安装能力。

## 4. AES 依赖候选

### CryptoJS

`https://github.com/brix/crypto-js`

其项目已声明 active development discontinued，因此本 Feature 不建议把它作为新增长期依赖。

### aes-js

- `https://www.npmjs.com/package/aes-js`
- `https://github.com/ricmoo/aes-js`

支持 CFB、无运行时依赖、MIT，可作为候选；但发布历史较老，最终选择前必须做维护状态、许可、包体积与安全审查。本文档不提前冻结具体依赖。

## 5. 公开文档未保证、必须实机验证的事项

以下不能从公开 API 文档推断为已成立：

1. Loon `openUrl` 是否始终以应用内网页呈现；
2. Stash Tile/Override `openUrl` 是否始终以应用内网页呈现；
3. 该网页容器中的 WebVPN 请求是否进入宿主同一个 MitM/HTTP Script 链路；
4. 网页容器的 Cookie/session 是否能被 request script 观察到；
5. Loon 对本项目目标域名 QUIC 的最佳局部禁用/回退配置；
6. 两个宿主对大响应 Body Script 的实际内存、超时与大小上限。

1–4 已由 2026-09-24 真机关闭，结论见 [verification.md](verification.md)。5 与 6 仍待 M2/M4。
