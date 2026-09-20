# 依赖策略

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-21

**用途**：规定引入外部依赖前的评估要求。目标是**降低长期风险**，不是禁止依赖。

---

## 1. 引入依赖前必须回答

| 维度 | 问题 | 判定 |
| ---- | ---- | ---- |
| Necessity | 标准库 / 现有依赖能否解决？ | 能 ⇒ 不加 |
| Maintenance | 最近是否有版本发布？Issue 是否被响应？ | 停滞 ⇒ 谨慎 |
| License | 许可证是否与项目兼容？ | 不兼容 ⇒ 禁止 |
| Security | 是否有未修复的已知漏洞？ | 有 ⇒ 禁止或有条件使用 |
| Size | 体积与运行时开销是否可接受？ | 量级不符 ⇒ 评估替代 |
| Transitive deps | 引入多少间接依赖？ | 树过大 ⇒ 谨慎 |
| Native build | 是否需要编译工具链 / 平台特定二进制？ | 影响可移植性 ⇒ 需 ADR |
| Fit | 与既有技术栈是否一致？ | 引入第二套等价方案 ⇒ 需 ADR |

**禁止**引入第二套功能等价的依赖（例如两个功能重叠的工具库），除非有 ADR 说明理由。

## 2. 记录要求

| 情况 | 记录位置 |
| ---- | -------- |
| 普通依赖（满足上表全部要求） | PR 描述中的依赖说明（含版本与理由） |
| 引入基础设施级依赖 / 难以替换的依赖 | ADR（见 [adr/README.md](../architecture/adr/README.md)） |
| 依赖变更影响用户可见行为或性能 | 相关 Spec + [non-functional-requirements.md](../requirements/non-functional-requirements.md) |

模板：

```text
Dependency:   <name>
Version:      <version>
Purpose:      <why we need it>
Alternatives: <considered and rejected>
License:      <license>
Risk:         <maintenance / security / size / transitive>
```

## 3. 版本与锁定

```text
Version policy: Node 侧：npm + package-lock.json（已提交）；Python 侧：uv + uv.lock（已提交；`uv sync` 安装，`uv sync --frozen` 校验锁定一致）
Lockfile:       Node 侧 package-lock.json 已提交；Python 侧 uv.lock 已提交；解释器版本由 .python-version 固定（3.13）
Update cadence: TBD（更新节奏待决策）
```

## 4. 安全与合规

- 依赖漏洞扫描工具：`TBD`（本期未引入；Node 侧 devDependencies 与 Python 侧 `uv.lock` 均已被版本锁定）；
- 扫描频率与阻断阈值：`TBD`（同上）；
- 许可证白名单 / 黑名单：`TBD`（本期未引入；已按第 2 节逐项记录新增依赖的许可证，可参考 [security/](../security/README.md)）。

项目许可为 MIT（见 [LICENSE](../../LICENSE)）。

## 5. 本项目既有与计划依赖

| 依赖 | 用途 | 说明 |
| ---- | ---- | ---- |
| Electron | 桌面壳 | 理由与代价见 [ADR-0003](../architecture/adr/ADR-0003-electron-gui-for-phase-1.md) |
| mitmproxy | TLS / HTTP2 / MITM 基础设施级依赖 | 见 [ADR-0002](../architecture/adr/ADR-0002-reuse-mitmproxy-for-tls.md)；按本策略第 2 节须记 ADR。M1 起是**运行期依赖**：sidecar 经 `mitmproxy.tools.main.mitmdump` 驱动，是桥与控制面的宿主（`swufe_bridge/sidecar.py`），其专用 confdir 同时承载 MITM CA |
| cryptography | AES-128-CFB128 编解码（WRD hostname token） | M1 新增为直接依赖；本来就随 mitmproxy 传递引入，直接声明是为固定 codec 所用 API（`swufe_bridge/wrd_codec.py`） |
| pytest | Python 侧测试框架（L0/L1/L2） | M1 新增，dev 依赖组（`[dependency-groups] dev`） |
| hatchling | Python 包构建后端 | M1 新增，构建期依赖，不进入运行期 |
| pycryptodome | 仅归档原型 [wrd_codec.py](../archive/2026-09-20-swufe-webvpn-bridge-docs-v1.0/99-appendix/wrd_codec.py) 使用 | 不作为当前实现依赖；M1 的 codec 改用 `cryptography` 的 AES-CFB128（与原型 `segment_size=128` 等价，由 TC-A02 门禁向量保证） |
| sing-box | 后续 TUN 阶段 | 第一期不引入 |
| typescript、tsx、`@types/node` | 仅用于本仓库文档检查脚本 | Node 侧，不引入 Markdown parser 或框架 |

### 依赖记录（M1 新增）

```text
Dependency:   cryptography
Version:      >=42（uv.lock 锁定 48.0.1）
Purpose:      WRD codec 的 AES-128-CFB128（token 加解密）
Alternatives: pycryptodome（归档原型所用；按本策略不引入第二套等价方案，且为额外运行期依赖）
License:      Apache-2.0 / BSD-3-Clause（双许可）
Risk:         无新增平台二进制（随 mitmproxy 传递引入，已在本项目依赖树内）
```

```text
Dependency:   pytest
Version:      >=8（uv.lock 锁定 9.1.1）
Purpose:      L0/L1/L2 测试运行器
Alternatives: unittest（标准库；但参数化与 fixture 组织成本高，且 pytest 已是 mitmproxy 依赖树内的测试栈）
License:      MIT
Risk:         仅 dev 依赖，不影响发布产物
```

```text
Dependency:   hatchling
Version:      构建后端（由 uv 解析，见 uv.lock）
Purpose:      构建 swufe_bridge 包（editable 安装与未来分发）
Alternatives: setuptools / flit（hatchling 为 uv 默认路径，配置最少）
License:      MIT
Risk:         仅构建期依赖，不进入运行期
```
