# API 文档

> Status: Draft ｜ Owner: <OWNER> ｜ Last Reviewed: <DATE>

**用途**：本目录是**接口契约**的 Source of Truth：字段、错误、版本、兼容性承诺。
边界与稳定性策略见 [architecture/interfaces.md](../architecture/interfaces.md)；数据实体见 [architecture/data-model.md](../architecture/data-model.md)。

## 何时创建文件

| 场景 | 文件 |
| ---- | ---- |
| 存在对外/对内网络接口 | `docs/api/<surface>.md`（例如按服务或按资源命名） |
| 仅存在库级公共 API | `docs/api/library-api.md` |
| 无接口 | 保留本 README，不创建其它文件 |

> 当前模板未定义任何接口；不要为了「看起来完整」而创建空接口文档。

## 接口文档模板

```markdown
# <接口面名称>

> Status: Draft ｜ Owner: <OWNER> ｜ Last Reviewed: <DATE>

## 范围

- 提供方：……
- 消费方：……
- 稳定性：Stable / Evolving / Internal
- 关联 Spec：`specs/<id>-<name>/`

## 认证与授权

TBD

## 通用约定

- 编码：……
- 时间格式：……
- 分页：……
- 幂等：……
- 限流：……

## 端点 / 方法

### <METHOD> <path 或签名>

- 用途：……
- 输入：……

  | 字段 | 类型 | 必填 | 约束 | 说明 |
  | ---- | ---- | ---- | ---- | ---- |

- 输出：……
- 错误：……

  | 错误码 | 含义 | 触发条件 | 处理建议 |
  | ------ | ---- | -------- | -------- |

- 示例：……

## 版本与兼容性

- 版本策略：……
- 破坏性变更流程：……
- 弃用流程：……

## 变更记录

| 日期 | 变更 | 兼容性 | 关联 Spec / ADR |
| ---- | ---- | ------ | --------------- |
```

## 维护规则

1. 接口变更必须同步：本目录 + [interfaces.md](../architecture/interfaces.md) + 相关 Spec + 测试。
2. 破坏性变更必须评估 ADR，并在 PR 的 Breaking Changes 中说明。
3. 只写已确认的契约；未定字段标 `TBD`。
