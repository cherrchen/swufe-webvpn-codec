# 测试策略

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-21

**用途**：定义测试分层、覆盖要求与运行方式，是「什么算已验证」的判断依据之一。
**唯一来源**：测试策略在本文件定义；单个 Feature 的验证项登记在 `specs/<id>/verification.md`，不要在本文件复制具体用例。层次划分沿用原包测试计划的 L0–L3 口径。

---

## 1. 测试分层

| 层 | 目标 | 范围 | 运行成本 | 何时必须写 | 运行位置 |
| -- | ---- | ---- | -------- | ---------- | -------- |
| L0 单元 | WRD codec 向量与 allowlist 匹配函数的行为与边界 | 无外部依赖 | 低 | 每次 PR（回归基线） | CI |
| L1 组件 | Bridge addon 对录制流量或假上游的请求/响应改写行为 | addon + 假上游 | 中 | 改写逻辑、Cookie 注入、路由判定变更时 | 本地 |
| L2 集成 | `mitmdump` + curl 经本地代理访问假 WebVPN 的端到端改写链路 | sidecar + 假上游 + 真实代理流程 | 中 | 代理设置/清除、配置下发、改写链路变更时 | 本地 |
| L3 系统 | 真机 + 真实 WebVPN + 浏览器教务验收的完整用户路径 | 完整应用（Electron + sidecar） | 高 | 发版前；需测试者自有账号 | 手工（macOS / Windows 测试机） |
| 手工验证 | 无法自动化的场景（CA 安装/卸载、系统代理、权限弹窗、UI 状态） | — | — | UI、环境或外部系统相关 | 手工 |

**回归策略**：L0 每次 PR 必跑；L1/L2 在对应模块变更时本地跑；L3 发版前跑。用例集（TC-A01..TC-H02）与优先级见 Phase 1 Spec 的 `verification.md`，发版门槛见 [docs/verification/verification-strategy.md](../verification/verification-strategy.md) 第 6 节。

## 2. 覆盖要求

```text
Coverage target: TBD（M1 未设定数值目标；当前基线为 L0/L1/L2 的 154 个用例全绿）
Coverage tool:   TBD（M1 未引入；层与用例即当前的可回归证据）
Exceptions:      L3 与手工验证层不计入覆盖率，以手工步骤代替
```

原则：覆盖率是参考指标，不是目标本身。**必须覆盖**：

- WRD codec 向量（TC-A01..TC-A05，含 authserver 与 jwxt 样本、带端口与错误 key）；
- allowlist 精确命中 / 通配 / apex 边界（TC-B01..TC-B05）；
- 代理冲突与系统代理清除（TC-C01..TC-C04）；
- 会话过期时的停桥、清代理、停捕获（TC-D03）；
- 防环：登录流量不经 WRD 二次包装（TC-D04）；
- 响应反向改写的关键跳转（`Location` 与教务内导航，TC-F03 / TC-G02）。

此外必须覆盖需求验收标准、已修复 Bug 的复现路径、边界与错误路径。

## 3. 测试命名与组织

```text
Location:  tests/l0（单元：codec、allowlist、config）、tests/l1（组件：addon 请求/响应改写、日志、热更新）、tests/l2（集成：真 mitmdump + curl + 假上游）；
           共享 fixture：tests/conftest.py（配置工厂，不含 mitmproxy 依赖）与 tests/l1/conftest.py（flow / addon 工厂）
Naming:    文件 test_<主题>.py；函数 test_<行为>（用例编号写进函数名，如 test_tc_f01_allowlisted_request_is_rewritten_end_to_end）；
           参数化用 @pytest.mark.parametrize("输入, 期望", [...])
Structure: Arrange / Act / Assert（必要时以注释分段）
```

## 4. 何时必须补测试

| 变更类型 | 要求 |
| -------- | ---- |
| 新增行为 | 必须有可复现的验证（自动化或明确的手工步骤） |
| 修复 Bug | 先有复现（失败测试或最小步骤），修复后可验证不再触发 |
| 重构 | 不改变行为的重构依赖既有测试保护；若缺失，先补关键路径 |
| 仅文档 | 不需要测试 |

## 5. 运行方式

```text
Run all:        uv sync && uv run pytest（L0+L1+L2；不需要外网）
Run one file:   uv run pytest tests/l1/test_addon_request.py
Run with watch: uv run pytest -f（需 pytest-xdist 插件；本期未引入，未安装时手动重跑 uv run pytest）
CI test job:    L0：.github/workflows/python-tests.yml（pull_request 与 main 推送时执行 uv sync --frozen + uv run pytest tests/l0 -q）；
                L1/L2 需 mitmdump、curl 与本地端口，只在本地跑；
                文档检查另由 .github/workflows/docs-check.yml 负责
```

文档检查工作流：[docs-check.yml](../../.github/workflows/docs-check.yml)（`pull_request` 与 `main` 推送时运行 `npm run docs:check` 与 `npm run typecheck`）。

## 6. 测试数据与环境

| 项 | 约定 |
| -- | ---- |
| 测试数据 | 真实数据仅限于「测试者自有的西财账号」，**禁止写入仓库**；其余输入用构造的样本 URL 与配置 |
| 外部依赖 | L0 无外部依赖；L1/L2 使用假上游 WebVPN（录制流量或桩）；L3 使用真实 `webvpn.swufe.edu.cn`（仅在授权设备） |
| 环境隔离 | L3 需要独占系统代理（App 在系统代理被占用时拒绝启动），同一测试机不得同时运行 Clash / mihomo / sing-box 等代理工具 |
| 敏感性 | 日志与测试输出不得含会话 Cookie 或响应正文；不得提交真实 Cookie、账号或个人信息 |

## 7. 与验证的关系

测试通过 ≠ Feature 完成。完成标准见 [docs/verification/verification-strategy.md](../verification/verification-strategy.md)，
逐需求映射见 `specs/<id>/verification.md`。
