# 测试用例 — Phase 1

说明：`预置` = 前置条件；`步骤`；`期望`。优先级 P0/P1/P2。

## A. Codec（L0）

| ID | 优先级 | 标题 | 预置 | 步骤 | 期望 |
|---|---|---|---|---|---|
| TC-A01 | P0 | 样本 URL 解密 | 无 | decode 用户提供的 authserver WebVPN URL | 主机为 `authserver.swufe.edu.cn` |
| TC-A02 | P0 | authserver 重加密一致 | 无 | encrypt_host(authserver…) | token 与样本一致 |
| TC-A03 | P0 | jwxt 编码稳定 | 无 | encode https://jwxt.swufe.edu.cn/sso/jziotlogin | 固定 token 前缀+密文，可 decode 回主机 |
| TC-A04 | P1 | 带端口 http-8080 | 无 | encode http://host:8080/x | scheme_token 为 `http-8080` |
| TC-A05 | P1 | 自定义 key 不匹配则乱码/失败 | 错误 key | decode 样本 | 非正确主机或显式失败 |

## B. Allowlist

| ID | 优先级 | 标题 | 预置 | 步骤 | 期望 |
|---|---|---|---|---|---|
| TC-B01 | P0 | 默认含 jwxt | 新配置 | 读 allowlist | 含 jwxt.swufe.edu.cn |
| TC-B02 | P0 | 精确命中 | hosts=[jwxt…] | match(jwxt) | true |
| TC-B03 | P0 | 非名单直连语义 | hosts=[jwxt] | match(example.com) | false |
| TC-B04 | P1 | 通配开启 | wildcard=true | match(xxx.swufe.edu.cn) | true |
| TC-B05 | P1 | 增删主机持久化 | UI/API | 添加再重启 App | 仍在 |

## C. 代理冲突与系统代理

| ID | 优先级 | 标题 | 预置 | 步骤 | 期望 |
|---|---|---|---|---|---|
| TC-C01 | P0 | 已有系统代理拒绝启动 | OS 代理已开 | startBridge | PROXY_CONFLICT，桥未开 |
| TC-C02 | P0 | 开桥设置代理 | 已登录、无代理、CA 就绪 | startBridge | 系统 HTTP/HTTPS 指向本桥 |
| TC-C03 | P0 | 关桥清除代理 | 桥运行中 | stopBridge | 系统代理恢复为未由 App 占用 |
| TC-C04 | P0 | 退出 App 清代理 | 桥运行中 | 退出 | 同 TC-C03 |

## D. 会话与登录

| ID | 优先级 | 标题 | 预置 | 步骤 | 期望 |
|---|---|---|---|---|---|
| TC-D01 | P0 | 登录成功 | 网络可达 | WebView 完成 CAS | loggedIn=true，无密码文件 |
| TC-D02 | P0 | 未登录不能开桥 | 未登录 | startBridge | NOT_LOGGED_IN |
| TC-D03 | P0 | 过期停桥 | 桥运行，模拟过期 | 触发失效检测 | 停桥、清代理、弹窗重登 |
| TC-D04 | P0 | 登录 WebView 防环 | 抓包/日志 | 登录过程 | 登录流量不经 WRD 再包装 |

## E. CA

| ID | 优先级 | 标题 | 预置 | 步骤 | 期望 |
|---|---|---|---|---|---|
| TC-E01 | P0 | 安装 CA | 管理员权限 | installCa | 信任库可见；UI 显示已安装 |
| TC-E02 | P0 | 卸载 CA | 已安装 | uninstallCa | 信任移除 |
| TC-E03 | P1 | 无 CA 开桥提示 | 未安装 | startBridge 或访问 HTTPS | CA_MISSING 或明确失败提示 |

## F. 桥接改写（集成）

| ID | 优先级 | 标题 | 预置 | 步骤 | 期望 |
|---|---|---|---|---|---|
| TC-F01 | P0 | curl 经代理访问 allowlist 主机 | 桥开、Cookie 注入、假或真上游 | curl -x 本地代理 https://jwxt…/ | 上游看到 WebVPN 形态或教务可达 |
| TC-F02 | P0 | 非 allowlist 不改写 | 同上 | curl https://example.com | 直连，debug 显示 rewritten=false |
| TC-F03 | P1 | Location 反向改写 | 上游返回 WebVPN Location | 客户端跟随 | 落到普通主机名语义 |
| TC-F04 | P1 | 调试日志无正文 | debug 开 | 产生流量 | 日志仅 host/结果 |

## G. 浏览器验收（L3 手工）

| ID | 优先级 | 标题 | 预置 | 步骤 | 期望 |
|---|---|---|---|---|---|
| TC-G01 | P0 | 打开教务首页 | macOS 全链路就绪 | 浏览器打开 jwxt | 页面可加载 |
| TC-G02 | P0 | 教务内导航 | TC-G01 | 点击主要菜单/链接 | 不因绝对 URL 跳飞到不可达公网直连 |
| TC-G03 | P0 | Windows 重复 G01 | Windows | 同 G01 | 通过 |
| TC-G04 | P1 | 进程捕获浏览器 | local 捕获开启 | 仅捕获指定浏览器 | 该浏览器可访问；策略符合设置 |

## H. UI

| ID | 优先级 | 标题 | 预置 | 步骤 | 期望 |
|---|---|---|---|---|---|
| TC-H01 | P1 | 状态展示 | 各状态 | 观察状态条 | 与状态机一致 |
| TC-H02 | P2 | 通配勾选文案 | UI | 勾选 *.swufe.edu.cn | 保存成功 |

## 执行记录（模板）

| 用例 ID | 执行人 | 日期 | 环境 | 结果 | 缺陷号 | 备注 |
|---|---|---|---|---|---|---|
|  |  |  |  | Pass/Fail/Block |  |  |
