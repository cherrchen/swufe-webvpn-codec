# 验收证据（acceptance evidence）

- 报告：acceptance-darwin-20260921-140511.md
- 生成时间：20260921-140511
- 平台：darwin 24.6.0 (arm64)
- 应用数据目录：/tmp/m4-acceptance
- 桥端口：8080；目标主机：jwxt.swufe.edu.cn
- 脱敏：Cookie 值、`wrdKey` / `wrdIv` 值与四个敏感请求头的值不会出现在本报告中（NFR-003 / INV-001）。
- 本报告可入库；`--save-body` 生成的正文文件与浏览器截图不入库。
## env

- verdict: **INFO**
- 摘要：darwin 24.6.0
- 命令：`os.platform() / os.release() / node -v / uv --version / git rev-parse`

```text
date:              2026-09-21T06:05:11.189Z
platform:          darwin
release:           24.6.0
arch:              arm64
node:              v24.18.0
uv:                uv 0.11.3 (45da18ac3 2026-04-01 aarch64-apple-darwin)
repo:              /Volumes/西数2T/Chen/swufe-webvpn-codec
commit:            38dda16
userDataDir:       /tmp/m4-acceptance
bridgePort:        8080
targetHost:        jwxt.swufe.edu.cn
```

## config

- verdict: **PASS**
- 摘要：hosts=1 wildcard=false
- 命令：`cat /tmp/m4-acceptance/config.json`

```text
文件：/tmp/m4-acceptance/config.json（mode 0o644）
白名单字段（wrdKey/wrdIv 不写入报告）：
{
  "hosts": [
    "jwxt.swufe.edu.cn"
  ],
  "includeSwufeWildcard": false,
  "updatedAt": "2026-09-21T05:52:21.646Z",
  "settings": {
    "bridgePort": 8080,
    "debugLogging": false,
    "captureMode": "system-proxy",
    "captureProcesses": [],
    "webvpnBase": "https://webvpn.swufe.edu.cn"
  }
}
```

## runtime-config

- verdict: **INFO**
- 摘要：尚未创建（桥未运行过）
- 命令：`cat /tmp/m4-acceptance/bridge-config.json`

```text
文件不存在：/tmp/m4-acceptance/bridge-config.json
```

## ca-files

- verdict: **INFO**
- 摘要：cert=no private=no
- 命令：`stat /tmp/m4-acceptance/mitmproxy/mitmproxy-ca*.pem`

```text
confdir:  /tmp/m4-acceptance/mitmproxy
cert:     /tmp/m4-acceptance/mitmproxy/mitmproxy-ca-cert.pem exists=false mode=null
private:  /tmp/m4-acceptance/mitmproxy/mitmproxy-ca.pem exists=false mode=null
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
verify-cert exit: (skipped，CA 证书不存在：/tmp/m4-acceptance/mitmproxy/mitmproxy-ca-cert.pem)
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
- 摘要：closed
- 命令：`net.connect(127.0.0.1:8080)`

```text
127.0.0.1:8080 → closed
```

## bridge-smoke

- verdict: **INFO**
- 摘要：skipped（桥未监听）
- 命令：`(none)`

```text
桥端口 open=false；CA 证书 /tmp/m4-acceptance/mitmproxy/mitmproxy-ca-cert.pem exists=false
```

## bypass-control

- verdict: **INFO**
- 摘要：skipped（桥未监听或 CA 缺失）
- 命令：`(none)`

```text
桥端口 open=false；CA 证书 exists=false
```

## residue

- verdict: **INFO**
- 摘要：0 个 sidecar 进程
- 命令：`pgrep -fl swufe_bridge.sidecar`

```text
无匹配进程（pgrep 退出码 1）
```

## redaction-self-check

- verdict: **PASS**
- 摘要：报告中无 Cookie / 密钥值
- 命令：`(none)`

```text
已收集敏感串：1 个（cookie 值 / wrdKey / wrdIv / 四个敏感头的值）
命中：0
```
