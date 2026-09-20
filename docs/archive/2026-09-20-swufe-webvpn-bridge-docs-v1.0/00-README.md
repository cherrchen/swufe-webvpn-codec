# 西南财经大学 WebVPN 本地桥 — 文档包

| 项 | 内容 |
|---|---|
| 产品暂定名 | SWUFE WebVPN Bridge（可改） |
| 文档版本 | 1.0 |
| 日期 | 2026-09-20 |
| 范围 | 第一期（Phase 1） |

## 目录结构

```text
01-requirements/     需求类
  01-PRD.md
  02-UI-UX.md
  03-technical-design.md
  04-architecture-and-tech-selection.md
  05-api-interfaces.md
  06-data-model.md
02-testing/          测试类
  01-test-plan.md
  02-test-cases.md
03-project-management/ 项目管理类
  01-project-charter-and-plan.md
  02-wbs-milestones-risks.md
```

## 已锁定的关键结论（摘要）

- Electron GUI；macOS + Windows；私用优先，日后可开源
- 系统 HTTP(S) 代理 + mitm local 进程捕获；TUN 后续
- Allowlist（默认 `jwxt.swufe.edu.cn`，可自定义，可选 `*.swufe.edu.cn`）
- 本机 MITM CA 一键安装/卸载；已有系统代理则拒绝启动
- 会话过期：停桥、清代理、弹窗重登；不存密码
- 验收：本机浏览器能打开并操作教务页（含响应 URL 反向改写）
- WRD codec：AES-128-CFB，`wrdvpnisthebest!`

配套已验证脚本：`wrd_codec.py`（URL 编解码，不在本 zip 内时可单独索取）。
