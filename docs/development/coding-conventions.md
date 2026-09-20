# 编码规范

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-20

**用途**：统一代码组织、命名与可读性要求，使不同作者（含 Coding Agent）产出的代码风格一致。
**不写**：格式化工具配置（属于仓库配置文件）、架构分层（→ [architecture/](../architecture/README.md)）。

> 本项目的实现语言来自技术选型（见 [architecture/overview.md](../architecture/overview.md)）；
> 未确定的细节保持 `TBD`，**不要**据此编造语言相关规则。

---

## 1. 语言与版本

```text
Primary language:  Python 3（bridge sidecar / WRD codec 权威实现；Electron 应用为 TypeScript）
Language version:  TBD（实现未开始）
Package manager:   Node 侧 npm（package-lock.json 已提交）；Python 侧 TBD（实现未开始）
Formatter:         TBD（实现未开始）
Linter:            TBD（实现未开始）
```

## 2. 目录与模块组织

| 规则 | 说明 |
| ---- | ---- |
| TBD | 本仓库当前为文档仓库（`docs/` + `specs/`）；实现目录结构在 `specs/001-phase1-local-bridge/` 的首个实现任务中确定 |

## 3. 命名

| 对象 | 约定 |
| ---- | ---- |
| 文件 | TBD（实现未开始） |
| 类型 | TBD（实现未开始） |
| 函数 | TBD（实现未开始） |
| 变量 | TBD（实现未开始） |
| 常量 | TBD（实现未开始） |

表中各项均为 `TBD`：实现未开始，首个实现任务确定后补齐。已确定的跨模块约束：

- IPC / 接口类型与字段命名以 [api/electron-ipc.md](../api/electron-ipc.md) 为唯一来源；
- 错误码必须使用既定的 6 个：`PROXY_CONFLICT`、`CA_MISSING`、`NOT_LOGGED_IN`、`SESSION_EXPIRED`、`BRIDGE_CRASH`、`ALLOWLIST_EMPTY`，不得自定义同义码。

## 4. 代码风格要点

- 优先遵循仓库既有模式；**不允许**在同一项目中并存两种等价风格的约定（见 [README.md](README.md) 的冲突优先级）。
- 避免不可读的缩写；避免为单次使用引入抽象。
- 注释解释「为什么」，不复述「做了什么」。
- 公开 API 必须有文档注释（格式：`TBD`，实现未开始；公开接口契约以 [docs/api/](../api/README.md) 下的文档为准，代码注释需指向对应接口面）。

## 5. 错误处理

| 场景 | 要求 |
| ---- | ---- |
| 输入校验 | allowlist 主机名需为合法 hostname 并小写化（见 [architecture/data-model.md](../architecture/data-model.md) 的匹配算法） |
| 可恢复错误 | 以错误码返回 UI，不中断桥进程 |
| 不可恢复错误 | `BRIDGE_CRASH`：记录日志并允许用户重启桥 |
| 不得吞掉错误 | 禁止无声的 `catch`/忽略返回码，除非有注释说明理由 |

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
Format:  TBD（实现未开始）
Lint:    TBD（实现未开始）
Type:    TBD（实现未开始）
Test:    TBD（实现未开始）
Docs:    npm run docs:check
```

> `Docs` 为文档检查命令；CI 目前只跑文档检查（见 [.github/workflows/docs-check.yml](../../.github/workflows/docs-check.yml)）。
