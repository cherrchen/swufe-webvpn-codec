# WrdCodec 库 API

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-20

## 范围

- 提供方：WrdCodec 库（逻辑等价于归档原型 `99-appendix/wrd_codec.py`）。
- 消费方：桥 addon（请求改写 / 响应反向改写）与 App 侧工具/测试。
- 形态：库级 API；**Python 为权威实现，TypeScript 可后补**（同一逻辑）。
- 稳定性：Evolving —— 算法与默认参数已用实机地址栏 URL 验证，接口仍可随第一期实现调整。
- 关联 Spec：[specs/001-phase1-local-bridge/spec.md](../../specs/001-phase1-local-bridge/spec.md)

## 认证与授权

不适用：纯函数式编解码库，不接触网络、登录态或文件；key/iv 由调用方传入或取默认值。

## 通用约定

- 编码：主机名按 UTF-8 编码；token 为十六进制字符串（小写）。
- 时间格式：不适用。
- 分页 / 限流：不适用。
- 幂等：全部方法为纯函数，相同输入产生相同输出。

## 方法

```ts
// 逻辑等价于 wrd_codec.py
encryptHost(host: string, key?: string, iv?: string): string
decryptHost(token: string, key?: string, iv?: string): string
encodeUrl(ordinaryUrl: string, webvpnHost?: string): string
decodeUrl(webvpnUrl: string): string
```

默认 `webvpnHost = webvpn.swufe.edu.cn`，`key = iv = wrdvpnisthebest!`。

### `encryptHost(host, key?, iv?): string`

- 用途：把主机名加密为 token（`iv_hex` + 密文 `hex`），token 不含端口。
- 输入：

  | 字段 | 类型 | 必填 | 约束 | 说明 |
  | ---- | ---- | ---- | ---- | ---- |
  | `host` | `string` | 是 | 合法主机名 | 不带端口、不含 scheme |
  | `key` | `string` | 否 | 16 字节 | 默认 `wrdvpnisthebest!` |
  | `iv` | `string` | 否 | 16 字节 | 默认 `wrdvpnisthebest!` |

- 输出：`{iv_hex}{ciphertext_hex}`。
- 错误：key 或 iv 非 16 字节时报错。

### `decryptHost(token, key?, iv?): string`

- 用途：把 token 解回主机名。
- 输入：

  | 字段 | 类型 | 必填 | 约束 | 说明 |
  | ---- | ---- | ---- | ---- | ---- |
  | `token` | `string` | 是 | 十六进制；长度 ≥ 34 且为偶数 | 前 32 个字符为 IV |
  | `key` | `string` | 否 | 16 字节 | 默认 `wrdvpnisthebest!` |
  | `iv` | `string` | 否 | 16 字节 | 仅当 token 携带的 IV 不可用（长度 ≠ 16 字节）时回退使用 |

- 输出：主机名字符串（已去除尾部 `\x00`）。
- 错误：token 过短、长度为奇数或含非十六进制字符时报错。

### `encodeUrl(ordinaryUrl, webvpnHost?): string`

- 用途：普通 URL → WebVPN URL。
- 输入：

  | 字段 | 类型 | 必填 | 约束 | 说明 |
  | ---- | ---- | ---- | ---- | ---- |
  | `ordinaryUrl` | `string` | 是 | scheme 为 `http` / `https`，且含 hostname | 例 `https://jwxt.swufe.edu.cn/sso/jziotlogin` |
  | `webvpnHost` | `string` | 否 | — | 默认 `webvpn.swufe.edu.cn` |

- 输出：`https://{webvpnHost}/{http|https}[-{port}]/{iv_hex}{ct_hex}{path}?{query}`。
- 错误：缺失 hostname 或 scheme 非 `http`/`https` 时报错。

### `decodeUrl(webvpnUrl): string`

- 用途：WebVPN URL → 普通 URL（响应反向改写与调试用）。
- 输入：

  | 字段 | 类型 | 必填 | 约束 | 说明 |
  | ---- | ---- | ---- | ---- | ---- |
  | `webvpnUrl` | `string` | 是 | 路径形如 `/{scheme_token}/{token}{path}` | — |

- 输出：普通 URL（`scheme://host[:port]/path?query#fragment`）。
- 错误：路径不以 `/` 开头、缺少 scheme 段或 host token 段、scheme 段不匹配时报错。

## 算法事实

- 算法：AES-128-CFB，`segment_size=128`。
- 默认 `key = iv = wrdvpnisthebest!`（实机 URL 验证；若学校日后轮换，可配置覆盖，见 ADR-0005）。
- **仅加密 hostname**；path/query 明文。
- URL 形态：`https://webvpn.swufe.edu.cn/{http|https}[-{port}]/{iv_hex}{ct_hex}{path}?{query}`。
- token = IV（16 字节）hex + 密文 hex，即 32 + 2 × host 字节数 个十六进制字符。
- 解密优先使用 token 携带的 IV（前 32 个字符），不可用时回退到配置的 IV；解密结果去除尾部 `\x00`。
- 端口：仅当端口存在且不等于该 scheme 的默认端口（`http` 80 / `https` 443）时才写入 `-{port}`。
- path 为空时按 `/` 处理；输入 URL 若带 fragment，输出在 query 之后保留 `#fragment`。

## 错误与边界

| 条件 | 行为 |
| ---- | ---- |
| key 长度 ≠ 16 字节 | 报错 `WRD AES-128 key must be 16 bytes` |
| iv 长度 ≠ 16 字节 | 报错 `WRD AES-128 IV must be 16 bytes` |
| `encodeUrl` 输入缺失 hostname | 报错 `missing hostname` |
| `encodeUrl` 输入 scheme 非 `http`/`https` | 报错（`unsupported scheme`） |
| `decryptHost` token 长度 < 34 或长度为奇数 | 报错（host token too short or not hex） |
| token 含非十六进制字符 | 十六进制解码失败并报错 |
| `decryptHost` token 携带的 IV 长度 ≠ 16 字节 | 回退到配置的 IV，不报错 |
| 解密结果含尾部 `\x00` | 去除尾部 `\x00` 后返回 |
| `decodeUrl` 路径不以 `/` 开头 | 报错（invalid WebVPN path） |
| `decodeUrl` 路径缺少 scheme 段或 host token 段 | 报错（WebVPN path missing scheme or host token） |
| `decodeUrl` scheme 段不匹配 `^(?P<scheme>https?\|http\|https)(?:-(?P<port>\d+))?$` | 报错（bad scheme token） |

## 测试向量

- 归属 Spec 001 的 TC-A01..TC-A05，见 [../../specs/001-phase1-local-bridge/verification.md](../../specs/001-phase1-local-bridge/verification.md)。
- 原型 `self-check` 固定样本（含 `authserver`）：

  ```text
  https://webvpn.swufe.edu.cn/https/77726476706e69737468656265737421f1e2559434357a467b1ac7bf8f40253097e41b52087752/authserver/login?service=http%3A%2F%2Fjwxt.swufe.edu.cn%2Fsso%2Fjziotlogin
  ```

  解出主机名应为 `authserver.swufe.edu.cn`；同一主机名重新加密得到的 token 应与样本一致。

## 兼容性承诺

- 实现必须与已验证原型 `wrd_codec.py` 的向量一致（含 `authserver` / `jwxt` 样本）（NFR-002）。
- 默认 key/iv 与 `webvpnHost` 为配置项，可覆盖；覆盖不改变算法与 URL 形态（ADR-0005）。

## 变更记录

| 日期 | 变更 | 兼容性 | 关联 Spec / ADR |
| ---- | ---- | ------ | --------------- |
| 2026-09-20 | 首版：4 个方法、算法事实、错误与边界、测试向量归属 | — | [spec 001](../../specs/001-phase1-local-bridge/spec.md) / [ADR-0005](../architecture/adr/ADR-0005-builtin-wrd-key-with-override.md) |
