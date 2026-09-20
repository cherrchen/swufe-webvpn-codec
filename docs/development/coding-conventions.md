# 编码规范

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-21

**用途**：统一代码组织、命名与可读性要求，使不同作者（含 Coding Agent）产出的代码风格一致。
**不写**：格式化工具配置（属于仓库配置文件）、架构分层（→ [architecture/](../architecture/README.md)）。

> 本项目的实现语言来自技术选型（见 [architecture/overview.md](../architecture/overview.md)）；
> 未确定的细节保持 `TBD`，**不要**据此编造语言相关规则。

---

## 1. 语言与版本

```text
Primary language:  Python 3（bridge sidecar / WRD codec 权威实现；Electron 应用为 TypeScript）
Language version:  Python >=3.12（uv 固定 3.13，见 .python-version）
Package manager:   Node 侧 npm（package-lock.json 已提交）；Python 侧 uv + uv.lock（已提交，需 `uv sync`）
Formatter:         TBD（本期未引入）
Linter:            TBD（本期未引入）
```

## 2. 目录与模块组织

| 规则 | 说明 |
| ---- | ---- |
| Python 包 | `swufe_bridge/`：sidecar 包——`wrd_codec.py`（codec）、`allowlist.py`（匹配语义与主机名校验）、`config.py`（配置面 + `ConfigWatcher`）、`rewrite.py`（响应反向改写纯函数）、`addon.py`（mitmproxy addon）、`sidecar.py`（进程入口）。`__init__.py` 只放 docstring、不做 eager import，保证 L0 测试不依赖 mitmproxy |
| 测试分层 | `tests/l0`（无外部依赖：codec/allowlist/config）、`tests/l1`（addon 行为 + 假 flow）、`tests/l2`（真 sidecar + curl + 假上游）。共享 fixture：`tests/conftest.py`（配置工厂，不 import mitmproxy）与 `tests/l1/conftest.py`（flow / addon 工厂） |
| 依赖方向 | `addon → rewrite / config / allowlist / wrd_codec`；`config → allowlist`；`sidecar → addon + config`。不引入反向依赖（与 [architecture/components.md](../architecture/components.md) 的依赖规则一致） |

## 3. 命名

| 对象 | 约定 |
| ---- | ---- |
| 文件 | snake_case：模块 `wrd_codec.py`、`allowlist.py`；测试 `test_addon_request.py` |
| 类型 | PascalCase：`WrdCodec`、`AllowlistConfig`、`BridgeRuntimeConfig`、`BridgeAddon` |
| 函数 | snake_case：`normalize_host`、`encode_url`、`rewrite_body_text`；模块内部辅助以 `_` 前缀（`_build_re`、`_inject_cookies`） |
| 变量 | snake_case；跨面契约常量用 UPPER_SNAKE 集中在模块顶部（`DEFAULT_HOSTS`、`REWRITABLE_CONTENT_TYPES`、`METADATA_ORIGINAL_URL`） |
| 常量 | UPPER_SNAKE_CASE |
| 配置 / 接口字段 | JSON 字段用 camelCase（`includeSwufeWildcard`、`webvpnBase`、`wrdKey`），与 `docs/` 契约保持一致；Python 内部属性用 snake_case（`include_swufe_wildcard`、`webvpn_base`） |

上表为 M1 落地后的实际约定。跨模块约束（不随实现变化）：

- IPC / 接口类型与字段命名以 [api/electron-ipc.md](../api/electron-ipc.md) 为唯一来源；
- 错误码必须使用既定的 6 个：`PROXY_CONFLICT`、`CA_MISSING`、`NOT_LOGGED_IN`、`SESSION_EXPIRED`、`BRIDGE_CRASH`、`ALLOWLIST_EMPTY`，不得自定义同义码。

## 4. 代码风格要点

- 优先遵循仓库既有模式；**不允许**在同一项目中并存两种等价风格的约定（见 [README.md](README.md) 的冲突优先级）。
- 避免不可读的缩写；避免为单次使用引入抽象。
- 注释解释「为什么」，不复述「做了什么」。
- 公开 API 必须有文档注释（docstring 用英文；公开接口契约以 [docs/api/](../api/README.md) 下的文档为准，代码注释需指向对应接口面）。
- 用户可见文案（错误提示、CLI 帮助）用中文：如 `swufe-error ALLOWLIST_EMPTY allowlist 为空：请添加主机或启用 *.swufe.edu.cn`；机器可读的部分（stderr 行前缀、错误码、JSON 键）保持英文/固定字面量。
- 数据契约在代码中用类型与校验表达：配置与 allowlist 解析集中在 `swufe_bridge/config.py` / `swufe_bridge/allowlist.py`，其它模块只消费已校验的对象。

## 5. 错误处理

| 场景 | 要求 |
| ---- | ---- |
| 输入校验 | allowlist 主机名需为合法 hostname 并小写化（见 [architecture/data-model.md](../architecture/data-model.md) 的匹配算法）：实现为 `swufe_bridge.allowlist.normalize_host`（非法抛 `InvalidHostError`，它是 `ConfigError` 的子类） |
| 配置错误 | 运行时配置由 `swufe_bridge.config` 校验，非法即抛 `ConfigError`：启动期转成 `swufe-error CONFIG_INVALID <message>` + 退出码 `2`；运行期热加载失败保留上次可用配置并只上报一次 |
| 可恢复错误 | 以错误码返回 UI，不中断桥进程（addon 内改写失败一律放行不改写，并记录 `swufe-debug` 的短标记） |
| 不可恢复错误 | `BRIDGE_CRASH`：记录日志并允许用户重启桥 |
| 不得吞掉错误 | 禁止无声的 `catch`/忽略返回码，除非有注释说明理由（如 addon 中「保留原始 `Referer` 而非中断请求」需写明理由） |

## 6. 依赖与导入

- 依赖方向必须符合 [architecture/components.md](../architecture/components.md) 的依赖规则；
- 不引入循环依赖；
- 新增依赖前阅读 [dependency-policy.md](dependency-policy.md)；
- 禁止引入第二套等价方案（见 [dependency-policy.md](dependency-policy.md)）。

## 7. 变更纪律

- 不进行与任务无关的重构；
- 不删除用途未知的代码；
- 修改公共行为必须同步测试与文档；
- 「顺手」优化属于 Scope Creep，需另开任务。

## 8. 本地检查命令

```text
Format:  TBD（本期未引入格式化工具）
Lint:    TBD（本期未引入 linter）
Type:    TBD（Python 侧未引入类型检查器；Node 侧用 npm run typecheck）
Test:    uv run pytest（首次先 uv sync）
Docs:    npm run docs:check
```

> CI 现有两个工作流：文档检查 [.github/workflows/docs-check.yml](../../.github/workflows/docs-check.yml) 与 Python L0 [.github/workflows/python-tests.yml](../../.github/workflows/python-tests.yml)。
