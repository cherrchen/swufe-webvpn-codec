# SWUFE WRD WebVPN Codec

西财 `webvpn.swufe.edu.cn`（网瑞达）URL 加解密小工具。已用真实地址栏 URL 校验。

## 安装

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 用法

```bash
# 自检（应打印 OK）
python wrd_codec.py self-check

# 普通 URL → WebVPN
python wrd_codec.py encode 'https://jwxt.swufe.edu.cn/sso/jziotlogin'

# WebVPN → 普通 URL
python wrd_codec.py decode 'https://webvpn.swufe.edu.cn/https/....../...'
```

## 参数

默认 `key` / `iv` 均为 `wrdvpnisthebest!`。若学校日后轮换，可用 `--key` / `--iv` 覆盖（登录后可从 portal 页面变量读取）。
