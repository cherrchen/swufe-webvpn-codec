# ADR-0008: CA 信任设置由应用进程写入（钥匙串写入保留提权）

## Status

`Accepted`

## Date

`2026-09-21`

## Decision Owners

`cherrchen`

## Context

安装本机 CA（[REQ-010](../../../docs/requirements/README.md)、AC-005、TC-E01）需要**两次独立写入**，两者的授权要求不同：

1. **把证书写进系统钥匙串**（`/Library/Keychains/System.keychain`）。该文件 root 所有，非 root 进程调用 `SecCertificateAddToKeychain`（`security add-trusted-cert -k <keychain>` / `security add-certificates -k <keychain>` 的底层）只得到 `errSecWritePerm`，**不会**弹出任何授权窗口（实测：`SecCertificateAddToKeychain: Write permissions error.`，退出码 1）。
2. **把信任设置写进管理域**（`-d`，`kSecTrustSettingsDomainAdmin`）。`SecTrustSettingsSetTrustSettings` 受 `com.apple.trust-settings.admin` 约束，本机规则为 `entitled | authenticate-admin`；Apple 明确「you can only modify trust settings when running in a GUI environment; for example, a launch daemon can't modify the settings」（<https://developer.apple.com/documentation/security/sectrustsettingssettrustsettings(_:_:_:)>）。

`KI-007`（2026-09-21 前保持 `Open`）正是第 2 步的失败：应用用 `runPrivilegedDarwin()`（`osascript -e 'do shell script "…" with administrator privileges'`）提权执行整条 `security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain <caCert>`——第 1 步（root 写钥匙串）成功，第 2 步失败：

```text
SecTrustSettingsSetTrustSettings: The authorization was denied since no user interaction was possible. (1)
```

根因是 osascript 的提权子进程由 `securityd` 在用户 GUI/审计会话之外派生，无法承载该授权（同一现象在「Electron + sudo-prompt」上被公开复现并给出手动 `sudo` 的绕行法：<https://stackoverflow.com/questions/65699160/electron-import-x509-cert-to-local-keychain-macos-the-authorization-was-deni>、<https://github.com/jorangreef/sudo-prompt/issues/137>）。本轮复验该根因：同样是 osascript 子进程，`security trust-settings-import -d <plist>` 报 `SecTrustSettingsImportExternalRepresentation: The authorization was denied since no user interaction was possible. (1)`。

本轮（macOS 15.6，arm64，控制台用户属 `admin` 组）实测的可用/不可用路径：

| 命令（调用者） | 结果 |
| -------------- | ---- |
| `security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain <ca>`（普通用户） | 退出码 1，`SecCertificateAddToKeychain: Write permissions error.`，无弹窗 |
| `security add-certificates -k /Library/Keychains/System.keychain <ca>`（osascript 提权 = root） | 成功；重复导入为 `already in <keychain>`（退出码 1） |
| `security add-trusted-cert -d -r trustRoot <ca>`（普通用户，**不带** `-k`） | 退出码 0，**不带 `-k` 时不写钥匙串**（`trusted_cert_add` 仅在给了 `-k` 时调用 `SecCertificateAddToKeychain`），只在管理域写入该证书的信任设置；`security trust-settings-export -d` 可见该 CA 的 SHA-1 与新的 `modDate` |
| 同上写入的效果（端到端） | 以该 CA 签发的叶证书经 `/usr/bin/curl`（SecureTransport，走系统信任评估）访问本地 TLS 服务返回 200；`security verify-cert -c <caCert> -p ssl` 退出码 0 |
| `security remove-trusted-cert -d <ca>` / `security trust-settings-import -d <plist>`（普通用户） | 阻塞（无输出、无效果，15s/70s 后仍挂起）→ 不可用于清除信任设置 |
| `security trust-settings-import -d <plist>`（osascript 提权 = root） | 失败：`SecTrustSettingsImportExternalRepresentation: The authorization was denied since no user interaction was possible. (1)` |

结论：**根因不是「提权方式不够强」，而是「写信任设置的进程必须处在用户的 GUI 会话内」**；钥匙串写入则相反，必须为 root。

## Decision

1. macOS 的 CA 安装由 `apps/desktop/src/main/platform/darwin/cert.ts` 的 `install()` 分两步顺序执行，且两步必须用不同的授权路径：
   - **步骤 1（钥匙串，需要 root）**：`runPrivilegedDarwin()` 执行 `security add-certificates -k /Library/Keychains/System.keychain "<caCert>"`。它只写钥匙串，**不碰信任设置**；stdout 报 `already in <keychain>` 时视为成功（幂等）。
   - **步骤 2（信任设置，管理域）**：**应用进程自己**调用 `security add-trusted-cert -d -r trustRoot "<caCert>"`（**不带 `-k`**），授权由 macOS 面向本 App 的会话处理。超时使用 `PRIVILEGE_PROMPT_TIMEOUT_MS`（120s），非 10s 的默认命令超时。
2. 适用范围与禁令：
   - `runPrivilegedDarwin()` **只允许**用于「仅写钥匙串」的操作（安装的步骤 1、卸载的 `security delete-certificate -Z <sha1>`）；**禁止**用它执行任何写信任设置的命令（`add-trusted-cert`、`remove-trusted-cert`、`trust-settings-import`）。
   - **禁止**用 `security authorizationdb write com.apple.trust-settings.admin allow` 之类放宽授权库的做法换取「免授权」。
   - 终端 `sudo …` 命令只允许出现在错误文案的最后兜底提示里，不得作为实现路径。
3. 卸载（`security delete-certificate -Z <sha1>`，osascript 提权）不触碰信任设置：CLI 无可用手段清除管理域信任项（见 Context 表）。UI 与 `getCaStatus()` 的「未安装」判定以系统钥匙串为准（该残留观察由 `KI-010` 记录）。
4. 安装结束后仍以 `security find-certificate … -Z` + `security verify-cert -c <caCert> -p ssl` 双重校验（`getStatus()`），两步的命令退出码与该校验共同决定 `installCa` 的返回值。

## Alternatives

| 备选方案 | 优点 | 缺点 | 未采纳原因 |
| -------- | ---- | ---- | ---------- |
| 什么都不做（保持手动 `sudo security add-trusted-cert …`） | 零改动、M4 实测可用 | 要求用户开终端，违背「应用内一次点击完成」的体验目标 | `KI-007` 存在的意义就是消除这一步；且错误文案把实现细节漏给用户 |
| 继续用 osascript 提权执行整条 `add-trusted-cert -d -k …` | 沿用既有代码 | 第 2 步必然失败（`KI-007` 实测） | 本 ADR Context 已证伪：提权子进程不在 GUI 会话内 |
| 用户信任域（写 `login.keychain-db`、去掉 `-d`） | 完全不需要管理员授权 | 信任范围变成「仅当前用户」，与 REQ-010「系统信任库」的验收口径不符 | 验收要求系统级信任；改口径属需求变更 |
| 配置描述文件 `.mobileconfig` | Apple 官方支持的部署方式，弹窗由系统负责 | 需要在「系统设置」里多步安装，面向受管设备；开发机不适用 | 交互成本高于现状，且不是「应用内一键」 |
| `SMJobBless` 特权 helper | 可长期复用 root 能力 | 引入原生代码与签名要求，且**仍**需要 GUI 授权——不解决第 2 步的会话问题 | 复杂度与收益不成比例 |
| 由应用单独调用 `security add-trusted-cert -d -r trustRoot -k <system keychain>`（本 ADR 步骤 1+2 合一） | 命令更少 | 第 1 步以 `errSecWritePerm` 中止（实测），根本到不了第 2 步 | 实测失败 |
| 取消安装、改为引导用户在「钥匙串访问」里手动导入并设为「始终信任」 | 纯 GUI、无终端 | 需要用户完成多步操作，且脚本无法驱动 | 只作为「授权窗口未能弹出」时的最后兜底思路保留，不作默认路径 |

## Consequences

### Positive

- 应用内一次点击即可完成 CA 安装：钥匙串写入由原提权路径负责，信任设置写入由持有 GUI 会话的应用进程负责，不再要求用户开终端（`KI-007` 解除）。
- 两步的职责边界清晰：`runPrivilegedDarwin()` 的适用范围收窄为「仅写钥匙串」，未来实现者不会再把信任设置塞回提权子进程。
- 失败分类可区分「授权窗口未能弹出」与「用户取消」，取消路径不产生任何写入。

### Negative

- 依赖 `security` CLI 的细节行为：**不带 `-k` 时不做钥匙串写入**（`trusted_cert_add` 的实现细节）——该行为若被 Apple 改变，必须先做步骤 1 再写入信任设置的做法要重新评估。
- 安装仍需要管理员账户（步骤 1 的 root 写入）。
- 管理域信任项在卸载后无法由 CLI 清除（`remove-trusted-cert` / `trust-settings-import` 在普通用户进程下挂起、在提权子进程下失败）：卸载后 `security verify-cert` 仍可能成功，`getCaStatus().trusted` 可能仍为 `true`，而 UI 与桥的门禁（`!installed || !trusted`）以钥匙串成员资格为准。该残留由 `KI-010` 记录，属实现已知限制。
- 「是否弹授权窗口」取决于 macOS 的授权凭据缓存：本轮实测中，安装过程会弹出系统管理员授权窗口（`SecurityAgent` 的 `SFAuthenticationWindow`，`authorizationhost` 记录 `Verify basic credentials`）；同一会话内在凭据缓存有效期内（`system.privilege.admin` 的 `timeout = 300`）重复操作会复用缓存凭据而不弹窗。因此「取消授权」这一分支的复验需要构造冷缓存时机。

### Risks

| 风险 | 可能性 | 影响 | 缓解措施 |
| ---- | ------ | ---- | -------- |
| Apple 改变 `security add-trusted-cert` 不带 `-k` 的行为（例如重新加上钥匙串写入） | 中 | 安装失败或行为漂移 | `install()` 结束后的 `find-certificate + verify-cert` 双重校验会把漂移暴露为失败；`KI-007` 的复验方式可重跑 |
| 授权窗口在不具备 GUI 会话的进程上下文中无法弹出 | 低 | 安装失败并给出误导性文案 | 错误文案按 `no user interaction was possible` / 用户取消分类；`PRIVILEGE_PROMPT_TIMEOUT_MS` 保证不会无限挂起 |
| 管理域信任项残留被误判为「已信任」 | 中 | 状态误读 | UI 以钥匙串成员资格判定「未安装」；`KI-010` 已记录残留观察与判定口径 |

## References

- 相关需求：REQ-010、REQ-011、NFR-005、AC-005
- 相关 Spec：`specs/001-phase1-local-bridge/`（TC-E01 / TC-E02 / TC-E03）
- 相关 ADR：[ADR-0003](ADR-0003-electron-gui-for-phase-1.md)（Phase 1 采用 Electron）
- 相关 Known Issue：`KI-007`（本 ADR 解除）、`KI-010`（卸载后的信任项残留）
- 实现位置：`apps/desktop/src/main/platform/darwin/cert.ts`、`apps/desktop/src/main/exec.ts`、`apps/desktop/src/main/constants.ts`
- 外部资料：
  - <https://developer.apple.com/documentation/security/sectrustsettingssettrustsettings(_:_:_:)>
  - <https://developer.apple.com/documentation/security/security-framework-result-codes>
  - <https://stackoverflow.com/questions/65699160/electron-import-x509-cert-to-local-keychain-macos-the-authorization-was-deni>
  - <https://github.com/jorangreef/sudo-prompt/issues/137>
