# 交付清单与文档索引

## 本包包含

### 需求类

1. [PRD](../01-requirements/01-PRD.md)
2. [交互与 UI/UX 设计](../01-requirements/02-UI-UX.md)
3. [技术设计文档](../01-requirements/03-technical-design.md)
4. [技术方案选型与架构设计](../01-requirements/04-architecture-and-tech-selection.md)
5. [接口定义文档](../01-requirements/05-api-interfaces.md)
6. [数据模型文档](../01-requirements/06-data-model.md)

### 测试类

7. [测试计划](../02-testing/01-test-plan.md)
8. [测试用例](../02-testing/02-test-cases.md)

### 项目管理类

9. [项目章程与计划](01-project-charter-and-plan.md)
10. [WBS、里程碑与风险](02-wbs-milestones-risks.md)
11. 本交付清单

## 关联已有产物（可另行附入仓库）

- `wrd_codec.py` — URL 编解码已验证脚本
- `swufe-webvpn-bridge-requirements.md` — 需求规格一页纸 v1.0（内容已吸收进本包 PRD/技术设计）

## 下一步研发建议顺序

1. mitm WRD addon（请求）+ Cookie
2. 响应 Location 改写 → HTML URL
3. Electron 登录与系统代理编排
4. 教务浏览器验收
