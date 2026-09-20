# 编码规范

> Status: Draft ｜ Owner: <OWNER> ｜ Last Reviewed: <DATE>

**用途**：统一代码组织、命名与可读性要求，使不同作者（含 Coding Agent）产出的代码风格一致。
**不写**：格式化工具配置（属于仓库配置文件）、架构分层（→ [architecture/](../architecture/README.md)）。

> 本模板不假设任何编程语言。以下条目必须由使用该模板的项目按实际语言替换；
> 未替换前保持 `TBD`，**不要**据此编造语言相关规则。

---

## 1. 语言与版本

```text
Primary language:  TBD
Language version:  TBD
Package manager:   TBD
Formatter:         TBD
Linter:            TBD
```

## 2. 目录与模块组织

| 规则 | 说明 |
| ---- | ---- |
| TBD | 例如：一个模块一个目录；对外接口集中在入口文件 |

## 3. 命名

| 对象 | 约定 |
| ---- | ---- |
| 文件 | TBD |
| 类型 | TBD |
| 函数 | TBD |
| 变量 | TBD |
| 常量 | TBD |

## 4. 代码风格要点

- 优先遵循仓库既有模式；**不允许**在同一项目中并存两种等价风格的约定（见 [README.md](README.md) 的冲突优先级）。
- 避免不可读的缩写；避免为单次使用引入抽象。
- 注释解释「为什么」，不复述「做了什么」。
- 公开 API 必须有文档注释（格式：TBD）。

## 5. 错误处理

| 场景 | 要求 |
| ---- | ---- |
| 输入校验 | TBD |
| 可恢复错误 | TBD |
| 不可恢复错误 | TBD |
| 不得吞掉错误 | 禁止无声的 `catch`/忽略返回码，除非有注释说明理由 |

## 6. 依赖与导入

- 依赖方向必须符合 [architecture/components.md](../architecture/components.md) 的依赖规则；
- 不引入循环依赖；
- 新增依赖前阅读 [dependency-policy.md](dependency-policy.md)。

## 7. 变更纪律

- 不进行与任务无关的重构；
- 不删除用途未知的代码；
- 修改公共行为必须同步测试与文档；
- 「顺手」优化属于 Scope Creep，需另开任务。

## 8. 本地检查命令

```text
Format:  TBD
Lint:    TBD
Type:    TBD
Test:    TBD
```

> 本模板自身的文档检查命令为 `npm run docs:check`；目标项目应替换为自身命令。
