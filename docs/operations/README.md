# 运维文档

> Status: TBD ｜ Owner: <OWNER> ｜ Last Reviewed: <DATE>

**用途**：记录运行、环境、配置、部署、可观测性、备份与恢复等长期事实。
**当前状态**：仅框架，保持 `TBD`；使用本模板的项目按实际情况填写。

> 不要编造部署方案或环境拓扑。

---

## 1. 环境

| 环境 | 用途 | 说明 | 访问方式 |
| ---- | ---- | ---- | -------- |
| TBD | 开发 / 测试 / 预发 / 生产 | TBD | TBD |

## 2. 配置

| 配置项 | 作用 | 取值范围 | 默认值 | 敏感性 | 变更影响 |
| ------ | ---- | -------- | ------ | ------ | -------- |
| TBD | TBD | TBD | TBD | TBD | TBD |

配置来源与优先级：`TBD`
密钥处理：见 [security/](../security/README.md)

## 3. 部署

```text
交付物:      TBD
部署方式:    TBD
发布流程:    TBD
回滚方式:    TBD
```

> 本模板不包含部署、发布、上线相关自动化；如项目需要，另行建立文档与流程。

## 4. 可观测性

| 维度 | 工具 | 关键信号 | 保留期 |
| ---- | ---- | -------- | ------ |
| 日志 | TBD | TBD | TBD |
| 指标 | TBD | TBD | TBD |
| 追踪 | TBD | TBD | TBD |
| 告警 | TBD | 阈值 | TBD |

## 5. 备份与恢复

```text
备份对象:    TBD
频率:        TBD
保留:        TBD
恢复演练:    TBD
RPO / RTO:   TBD
```

## 6. 事故响应

| 阶段 | 动作 | 负责人 |
| ---- | ---- | ------ |
| 发现 | TBD | TBD |
| 止损 | TBD | TBD |
| 定位 | TBD | TBD |
| 复盘 | TBD | TBD |

## 7. 相关

- 配置变更的文档影响 ⇒ [documentation-rules.md](../development/documentation-rules.md) 中的 Documentation Update Matrix
- 安全相关运行约束 ⇒ [security/](../security/README.md)
