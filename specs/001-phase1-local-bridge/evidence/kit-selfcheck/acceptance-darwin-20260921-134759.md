# 验收证据（acceptance evidence）

- 报告：acceptance-darwin-20260921-134759.md
- 生成时间：20260921-134759
- 平台：darwin 24.6.0 (arm64)
- 应用数据目录：/tmp/m4-acceptance
- 桥端口：18099；目标主机：jwxt.swufe.edu.cn
- 脱敏：Cookie 值、`wrdKey` / `wrdIv` 值与四个敏感请求头的值不会出现在本报告中（NFR-003 / INV-001）。
- 本报告可入库；`--save-body` 生成的正文文件与浏览器截图不入库。
## env

- verdict: **INFO**
- 摘要：darwin 24.6.0
- 命令：`os.platform() / os.release() / node -v / uv --version / git rev-parse`

```text
date:              2026-09-21T05:47:59.446Z
platform:          darwin
release:           24.6.0
arch:              arm64
node:              v24.18.0
uv:                uv 0.11.3 (45da18ac3 2026-04-01 aarch64-apple-darwin)
repo:              /Volumes/西数2T/Chen/swufe-webvpn-codec
commit:            38dda16
userDataDir:       /tmp/m4-acceptance
bridgePort:        18099
targetHost:        jwxt.swufe.edu.cn
```

## config

- verdict: **PASS**
- 摘要：hosts=1 wildcard=false
- 命令：`cat /tmp/m4-acceptance/config.json`

```text
文件：/tmp/m4-acceptance/config.json（mode 0o600）
白名单字段（wrdKey/wrdIv 不写入报告）：
{
  "hosts": [
    "jwxt.swufe.edu.cn"
  ],
  "includeSwufeWildcard": false,
  "settings": {
    "bridgePort": 8080,
    "debugLogging": true,
    "captureMode": "system-proxy",
    "captureProcesses": [],
    "webvpnBase": "https://webvpn.swufe.edu.cn"
  }
}
```

## runtime-config

- verdict: **PASS**
- 摘要：mode 0o600 cookieCount=1
- 命令：`cat /tmp/m4-acceptance/bridge-config.json`

```text
文件：/tmp/m4-acceptance/bridge-config.json（mode 0o600）
白名单字段（cookie 值 / wrdKey / wrdIv 不写入报告）：
{
  "allowlist": {
    "hosts": [
      "jwxt.swufe.edu.cn"
    ]
  },
  "debug": true,
  "webvpnBase": "https://webvpn.swufe.edu.cn",
  "capture": {
    "processes": []
  },
  "cookieCount": 1
}
```

## ca-files

- verdict: **INFO**
- 摘要：cert=yes private=yes
- 命令：`stat /tmp/m4-acceptance/mitmproxy/mitmproxy-ca*.pem`

```text
confdir:  /tmp/m4-acceptance/mitmproxy
cert:     /tmp/m4-acceptance/mitmproxy/mitmproxy-ca-cert.pem exists=true mode=0o644
private:  /tmp/m4-acceptance/mitmproxy/mitmproxy-ca.pem exists=true mode=0o600
```

## trust-store

- verdict: **INFO**
- 摘要：installed: no
- 命令：`security find-certificate -a -c mitmproxy /Library/Keychains/System.keychain`

```text
$ security find-certificate -a -c mitmproxy /Library/Keychains/System.keychain
exit: 0
stdout:
(空)
stderr:
(空)
stdout bytes: 0
contains SHA-1: no
installed: no
$ security verify-cert -c /tmp/m4-acceptance/mitmproxy/mitmproxy-ca-cert.pem -p ssl
exit: 1
stdout:
---
No extended validation result found
Certificate Transparency (CT) status: [31mnot verified[0m
Unable to find at least 2 signed certificate timestamps (SCTs) from approved logs
stderr:
Cert Verify Result: CSSMERR_TP_NOT_TRUSTED
verify-cert exit: 1
```

## system-proxy

- verdict: **INFO**
- 摘要：6 个网络服务
- 命令：`networksetup -getwebproxy / scutil --proxy`

```text
$ networksetup -listallnetworkservices
exit: 0
stdout:
An asterisk (*) denotes that a network service is disabled.
Ethernet
USB 10/100/1000 LAN
Thunderbolt Bridge
Wi-Fi
iPhone USB
Stash
stderr:
(空)
service: Ethernet (-getwebproxy) Enabled No Server 127.0.0.1 Port 8080
service: Ethernet (-getsecurewebproxy) Enabled No Server 127.0.0.1 Port 8080
service: USB 10/100/1000 LAN (-getwebproxy) Enabled No Server 127.0.0.1 Port 8080
service: USB 10/100/1000 LAN (-getsecurewebproxy) Enabled No Server 127.0.0.1 Port 8080
service: Thunderbolt Bridge (-getwebproxy) Enabled No Server 127.0.0.1 Port 8080
service: Thunderbolt Bridge (-getsecurewebproxy) Enabled No Server 127.0.0.1 Port 8080
service: Wi-Fi (-getwebproxy) Enabled No Server 127.0.0.1 Port 8080
service: Wi-Fi (-getsecurewebproxy) Enabled No Server 127.0.0.1 Port 8080
service: iPhone USB (-getwebproxy) Enabled No Server 127.0.0.1 Port 8080
service: iPhone USB (-getsecurewebproxy) Enabled No Server 127.0.0.1 Port 8080
service: Stash (-getwebproxy) Enabled No Server 127.0.0.1 Port 8080
service: Stash (-getsecurewebproxy) Enabled No Server 127.0.0.1 Port 8080
$ scutil --proxy
exit: 0
stdout:
<dictionary> {
  ExceptionsList : <array> {
    0 : 127.0.0.1/8
    1 : 192.168.0.0/16
    2 : 10.0.0.0/8
    3 : 172.16.0.0/12
    4 : localhost
    5 : *.local
    6 : *.crashlytics.com
    7 : <local>
  }
  HTTPEnable : 0
  HTTPSEnable : 0
  ProxyAutoConfigEnable : 0
  ProxyAutoDiscoveryEnable : 0
  SOCKSEnable : 0
}
stderr:
(空)
```

## bridge-port

- verdict: **INFO**
- 摘要：open
- 命令：`net.connect(127.0.0.1:18099)`

```text
127.0.0.1:18099 → open
```

## bridge-smoke

- verdict: **PASS**
- 摘要：302
- 命令：`curl -x http://127.0.0.1:18099 https://jwxt.swufe.edu.cn/`

```text
$ curl -sS -x http://127.0.0.1:18099 --cacert <caCert> -m 20 -o /dev/null -D - https://jwxt.swufe.edu.cn/
exit: 0
stdout:
(空)
stderr:
(空)
status:       302
location:     https://webvpn.swufe.edu.cn/login
content-type: text/html; charset=utf-8
body:         (未保存，--save-body 关闭)
响应头（已脱敏）：
HTTP/1.1 200 Connection established

HTTP/2 302 
server: Tengine
date: Mon, 21 Sep 2026 05:48:00 GMT
content-type: text/html; charset=utf-8
content-length: 56
location: https://webvpn.swufe.edu.cn/login
SET-COOKIE: <REDACTED>
SET-COOKIE: <REDACTED>
```

## bridge-smoke-direct-control

- verdict: **INFO**
- 摘要：direct http_code=000 curl exit=35
- 命令：`curl https://jwxt.swufe.edu.cn/（直连对照）`

```text
$ curl -sS -m 20 -o /dev/null -w '%{http_code}' https://jwxt.swufe.edu.cn/
exit: 35
stdout:
000
stderr:
curl: (35) LibreSSL SSL_connect: SSL_ERROR_SYSCALL in connection to jwxt.swufe.edu.cn:443
```

## bypass-control

- verdict: **INFO**
- 摘要：302
- 命令：`curl -x http://127.0.0.1:18099 https://webvpn.swufe.edu.cn/`

```text
$ curl -x http://127.0.0.1:18099 -D - https://webvpn.swufe.edu.cn/
exit: 0
stdout:
(空)
stderr:
(空)
status: 302
响应头（已脱敏）：
HTTP/1.1 200 Connection established

HTTP/2 302 
server: Tengine
date: Mon, 21 Sep 2026 05:48:00 GMT
content-type: text/html; charset=utf-8
content-length: 56
location: https://webvpn.swufe.edu.cn/login
SET-COOKIE: <REDACTED>
SET-COOKIE: <REDACTED>
（防环对照：桥运行期间该主机的请求不应被二次包装，与 addon 的硬编码排除一致）
```

## residue

- verdict: **INFO**
- 摘要：2 个 sidecar 进程
- 命令：`pgrep -fl swufe_bridge.sidecar`

```text
$ pgrep -fl swufe_bridge.sidecar
exit: 0
stdout:
12255 /Users/m2/.local/bin/uv run python -m swufe_bridge.sidecar --config /tmp/m4-acceptance/bridge-config.json --port 18099 --confdir /tmp/m4-acceptance/mitmproxy
12261 /Volumes/西数2T/Chen/swufe-webvpn-codec/.venv/bin/python3 -m swufe_bridge.sidecar --config /tmp/m4-acceptance/bridge-config.json --port 18099 --confdir /tmp/m4-acceptance/mitmproxy
stderr:
(空)
```

## redaction-self-check

- verdict: **PASS**
- 摘要：报告中无 Cookie / 密钥值
- 命令：`(none)`

```text
已收集敏感串：7 个（cookie 值 / wrdKey / wrdIv / 四个敏感头的值）
命中：0
```
