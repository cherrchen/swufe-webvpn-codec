# 安全文档

> Status: TBD ｜ Owner: <OWNER> ｜ Last Reviewed: <DATE>

**用途**：记录安全相关的长期事实与约束。
**当前状态**：仅为框架，**不包含任何具体安全架构**；使用本模板的项目必须自行填写，未知内容保持 `TBD`。

> 警告：不要为了让本节看起来完整而编造安全设计。安全假设写错比不写更危险。

---

## 1. 信任边界（Trust Boundaries）

| ID | 边界 | 内部 | 外部 | 跨越方式 | 校验要求 |
| -- | ---- | ---- | ---- | -------- | -------- |
| TB-001 | TBD | TBD | TBD | TBD | TBD |

```mermaid
flowchart LR
    U["不受信任输入"] --> B{"信任边界"}
    B --> S["受信任区域"]
```

> 未确认系统结构前不要画图。

## 2. 认证（Authentication）

```text
机制:        TBD
凭据类型:    TBD
会话/令牌:   TBD
失效策略:    TBD
```

## 3. 授权（Authorization）

```text
模型:        TBD   （RBAC / ABAC / ACL / 其他）
权限粒度:    TBD
默认策略:    TBD   （默认拒绝 / 默认允许）
越权检查点:  TBD
```

## 4. 密钥与配置（Secrets）

| 项 | 约定 |
| -- | ---- |
| 存储位置 | TBD（禁止写入仓库） |
| 注入方式 | TBD |
| 轮换策略 | TBD |
| 泄露应急 | TBD |

## 5. 不可信输入

| 输入来源 | 风险 | 处理要求 |
| -------- | ---- | -------- |
| TBD | 注入 / 越界 / 反序列化 / XSS / SSRF | TBD |

## 6. 依赖风险

见 [dependency-policy.md](../development/dependency-policy.md)：漏洞扫描、许可证、供应链风险。

## 7. 数据隐私

| 数据类别 | 敏感性 | 存储 | 保留 | 访问控制 |
| -------- | ------ | ---- | ---- | -------- |
| TBD | TBD | TBD | TBD | TBD |

## 8. 安全敏感操作

| 操作 | 风险 | 约束（谁可执行、是否需要审计） |
| ---- | ---- | ------------------------------ |
| TBD | TBD | TBD |

## 9. 相关

- 安全相关架构决策 ⇒ ADR（[adr/README.md](../architecture/adr/README.md)）
- 安全验证项 ⇒ [verification-strategy.md](../verification/verification-strategy.md)
- 每个 Spec 必须填写 Security Considerations（见 [specs/_template/design.md](../../specs/_template/design.md)）
