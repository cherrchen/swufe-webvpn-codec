#!/usr/bin/env python3
"""SWUFE / 网瑞达 (WRD) WebVPN URL codec.

Confirmed against a live webvpn.swufe.edu.cn address-bar URL (2026-09-20):

  AES-128-CFB, segment_size=128
  key = iv = b"wrdvpnisthebest!"
  form:
    https://WEBVPN_HOST/{scheme}[-{port}]/{iv_hex}{encrypted_host_hex}{path}?{query}

Only hostname is encrypted. Path and query stay plaintext.

Requires: pip install pycryptodome
"""

from __future__ import annotations

import argparse
import binascii
import re
import sys
from dataclasses import dataclass
from typing import Optional
from urllib.parse import urlparse, urlunparse

from Crypto.Cipher import AES

DEFAULT_KEY = b"wrdvpnisthebest!"
DEFAULT_IV = b"wrdvpnisthebest!"
DEFAULT_WEBVPN_HOST = "webvpn.swufe.edu.cn"

_SCHEME_RE = re.compile(r"^(?P<scheme>https?|http|https)(?:-(?P<port>\d+))?$")


@dataclass(frozen=True)
class OrdinaryUrl:
    scheme: str
    host: str
    port: Optional[int]
    path: str
    query: str
    fragment: str

    def to_url(self) -> str:
        netloc = self.host
        default_port = 443 if self.scheme == "https" else 80
        if self.port is not None and self.port != default_port:
            netloc = f"{self.host}:{self.port}"
        return urlunparse((self.scheme, netloc, self.path or "/", self.query and "" or "", self.query, self.fragment))


class WrdCodec:
    """Encrypt / decrypt WRD WebVPN host segments and full URLs."""

    def __init__(
        self,
        key: bytes = DEFAULT_KEY,
        iv: bytes = DEFAULT_IV,
        webvpn_host: str = DEFAULT_WEBVPN_HOST,
    ) -> None:
        if len(key) != 16:
            raise ValueError("WRD AES-128 key must be 16 bytes")
        if len(iv) != 16:
            raise ValueError("WRD AES-128 IV must be 16 bytes")
        self.key = key
        self.iv = iv
        self.webvpn_host = webvpn_host.rstrip("/")

    def encrypt_host(self, host: str) -> str:
        """Return iv_hex + ciphertext_hex for a hostname (no port)."""
        cipher = AES.new(self.key, AES.MODE_CFB, iv=self.iv, segment_size=128)
        ct = cipher.encrypt(host.encode("utf-8"))
        return binascii.hexlify(self.iv).decode("ascii") + binascii.hexlify(ct).decode("ascii")

    def decrypt_host(self, token: str) -> str:
        """Decrypt iv_hex+ciphertext_hex back to hostname."""
        if len(token) < 34 or len(token) % 2:
            raise ValueError("host token too short or not hex")
        iv_hex, ct_hex = token[:32], token[32:]
        iv = binascii.unhexlify(iv_hex)
        ct = binascii.unhexlify(ct_hex)
        # Prefer IV carried in the URL (matches portal.js); fall back to configured IV.
        use_iv = iv if len(iv) == 16 else self.iv
        cipher = AES.new(self.key, AES.MODE_CFB, iv=use_iv, segment_size=128)
        pt = cipher.decrypt(ct)
        return pt.decode("utf-8").rstrip("\x00")

    def encode(self, ordinary_url: str, webvpn_base: Optional[str] = None) -> str:
        """Ordinary https://host/path → WebVPN URL."""
        parsed = urlparse(ordinary_url)
        if parsed.scheme not in ("http", "https"):
            raise ValueError(f"unsupported scheme: {parsed.scheme!r}")
        if not parsed.hostname:
            raise ValueError("missing hostname")

        scheme = parsed.scheme
        port = parsed.port
        default_port = 443 if scheme == "https" else 80
        if port is None or port == default_port:
            scheme_token = scheme
        else:
            scheme_token = f"{scheme}-{port}"

        token = self.encrypt_host(parsed.hostname)
        path = parsed.path or "/"
        if not path.startswith("/"):
            path = "/" + path

        base = (webvpn_base or f"https://{self.webvpn_host}").rstrip("/")
        out = f"{base}/{scheme_token}/{token}{path}"
        if parsed.query:
            out += f"?{parsed.query}"
        if parsed.fragment:
            out += f"#{parsed.fragment}"
        return out

    def decode(self, webvpn_url: str) -> str:
        """WebVPN URL → ordinary URL."""
        parsed = urlparse(webvpn_url)
        # path: /{scheme_token}/{token}{rest_path}
        raw = parsed.path
        if not raw.startswith("/"):
            raise ValueError("invalid WebVPN path")
        pieces = raw.lstrip("/").split("/", 2)
        if len(pieces) < 2:
            raise ValueError("WebVPN path missing scheme or host token")
        scheme_token, token = pieces[0], pieces[1]
        rest = "/" + pieces[2] if len(pieces) > 2 else "/"

        m = _SCHEME_RE.match(scheme_token)
        if not m:
            raise ValueError(f"bad scheme token: {scheme_token!r}")
        scheme = m.group("scheme")
        if scheme == "http" or scheme == "https":
            pass
        port_s = m.group("port")
        port = int(port_s) if port_s else None

        host = self.decrypt_host(token)
        netloc = host if port is None else f"{host}:{port}"
        return urlunparse((scheme, netloc, rest, "", parsed.query, parsed.fragment))


SAMPLE = (
    "https://webvpn.swufe.edu.cn/https/"
    "77726476706e69737468656265737421f1e2559434357a467b1ac7bf8f40253097e41b52087752"
    "/authserver/login?service=http%3A%2F%2Fjwxt.swufe.edu.cn%2Fsso%2Fjziotlogin"
)


def _self_check() -> int:
    codec = WrdCodec()
    decoded = codec.decode(SAMPLE)
    print("sample decode →", decoded)
    expect_host = "authserver.swufe.edu.cn"
    if urlparse(decoded).hostname != expect_host:
        print("FAIL: unexpected host", file=sys.stderr)
        return 1
    # Round-trip host token only (path/query preserved from sample)
    reencoded = codec.encode("https://authserver.swufe.edu.cn/authserver/login")
    # Compare scheme+token prefix
    sample_prefix = SAMPLE.split("?")[0]
    # encode may omit identical query; compare path host token
    token_from_sample = SAMPLE.split("/")[4]
    token_round = codec.encrypt_host(expect_host)
    print("token match:", token_from_sample == token_round)
    print("encode authserver login →", reencoded)
    print("encode jwxt →", codec.encode("https://jwxt.swufe.edu.cn/sso/jziotlogin"))
    if token_from_sample != token_round:
        return 1
    print("OK")
    return 0


def main(argv: Optional[list[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="SWUFE WRD WebVPN URL codec")
    parser.add_argument("--key", default=DEFAULT_KEY.decode(), help="16-byte AES key string")
    parser.add_argument("--iv", default=DEFAULT_IV.decode(), help="16-byte AES IV string")
    parser.add_argument("--webvpn-host", default=DEFAULT_WEBVPN_HOST)
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_enc = sub.add_parser("encode", help="ordinary URL → WebVPN URL")
    p_enc.add_argument("url")

    p_dec = sub.add_parser("decode", help="WebVPN URL → ordinary URL")
    p_dec.add_argument("url")

    sub.add_parser("self-check", help="verify against known SWUFE sample")

    args = parser.parse_args(argv)
    codec = WrdCodec(
        key=args.key.encode("utf-8"),
        iv=args.iv.encode("utf-8"),
        webvpn_host=args.webvpn_host,
    )
    if args.cmd == "encode":
        print(codec.encode(args.url))
        return 0
    if args.cmd == "decode":
        print(codec.decode(args.url))
        return 0
    if args.cmd == "self-check":
        return _self_check()
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
