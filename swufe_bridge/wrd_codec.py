"""SWUFE / 网瑞达 (WRD) WebVPN URL codec.

Confirmed against a live webvpn.swufe.edu.cn address-bar URL (2026-09-20):

  AES-128-CFB, segment_size=128 (CFB128)
  key = iv = b"wrdvpnisthebest!"
  form:
    https://WEBVPN_HOST/{scheme}[-{port}]/{iv_hex}{encrypted_host_hex}{path}?{query}

Only the hostname is encrypted; path and query stay plaintext.

The AES primitive comes from ``cryptography`` (a transitive dependency of
mitmproxy); the archived prototype used pycryptodome, which is not a
dependency of this project.
"""

from __future__ import annotations

import argparse
import binascii
import re
import sys
from typing import Optional
from urllib.parse import urlparse, urlunparse

from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

try:  # cryptography >= 43 (CFB lives in `decrepit` from 49 on)
    from cryptography.hazmat.decrepit.ciphers.modes import CFB
except ImportError:  # pragma: no cover - cryptography < 43
    from cryptography.hazmat.primitives.ciphers.modes import CFB

DEFAULT_KEY = DEFAULT_IV = "wrdvpnisthebest!"
DEFAULT_WEBVPN_HOST = "webvpn.swufe.edu.cn"

_SCHEME_RE = re.compile(r"^(?P<scheme>https?|http|https)(?:-(?P<port>\d+))?$")


class WrdCodecError(ValueError):
    """Raised for malformed keys/IVs, hosts, tokens and WRD URLs."""


def _key_bytes(value: str | bytes, what: str) -> bytes:
    raw = value.encode("utf-8") if isinstance(value, str) else bytes(value)
    if len(raw) != 16:
        raise WrdCodecError(f"WRD AES-128 {what} must be 16 bytes")
    return raw


class WrdCodec:
    """Encrypt / decrypt WRD WebVPN host segments and full URLs."""

    def __init__(
        self,
        key: str | bytes = DEFAULT_KEY,
        iv: str | bytes = DEFAULT_IV,
        webvpn_host: str = DEFAULT_WEBVPN_HOST,
    ) -> None:
        self.key = _key_bytes(key, "key")
        self.iv = _key_bytes(iv, "IV")
        self.webvpn_host = webvpn_host.rstrip("/")

    def _cipher(self, iv: bytes):
        return Cipher(algorithms.AES(self.key), CFB(iv))

    def encrypt_host(self, host: str) -> str:
        """Return iv_hex + ciphertext_hex for a hostname (no port)."""
        encryptor = self._cipher(self.iv).encryptor()
        ct = encryptor.update(host.encode("utf-8")) + encryptor.finalize()
        return binascii.hexlify(self.iv).decode("ascii") + binascii.hexlify(ct).decode("ascii")

    def decrypt_host(self, token: str) -> str:
        """Decrypt iv_hex+ciphertext_hex back to a hostname."""
        if len(token) < 34 or len(token) % 2:
            raise WrdCodecError("host token too short or not hex")
        iv_hex, ct_hex = token[:32], token[32:]
        try:
            iv = binascii.unhexlify(iv_hex)
            ct = binascii.unhexlify(ct_hex)
        except (binascii.Error, ValueError) as exc:
            raise WrdCodecError(f"host token too short or not hex: {exc}") from exc
        # Prefer the IV carried in the URL (matches portal.js); fall back to the configured IV.
        use_iv = iv if len(iv) == 16 else self.iv
        decryptor = self._cipher(use_iv).decryptor()
        pt = decryptor.update(ct) + decryptor.finalize()
        try:
            return pt.decode("utf-8").rstrip("\x00")
        except UnicodeDecodeError as exc:
            raise WrdCodecError(f"host token does not decrypt to a hostname: {exc}") from exc

    def encode_url(self, ordinary_url: str, webvpn_base: str | None = None) -> str:
        """Ordinary https://host/path → WebVPN URL."""
        parsed = urlparse(ordinary_url)
        if parsed.scheme not in ("http", "https"):
            raise WrdCodecError(f"unsupported scheme: {parsed.scheme!r}")
        if not parsed.hostname:
            raise WrdCodecError("missing hostname")

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

    def decode_url(self, webvpn_url: str) -> str:
        """WebVPN URL → ordinary URL."""
        parsed = urlparse(webvpn_url)
        # path: /{scheme_token}/{token}{rest_path}
        raw = parsed.path
        if not raw.startswith("/"):
            raise WrdCodecError("invalid WebVPN path")
        pieces = raw.lstrip("/").split("/", 2)
        if len(pieces) < 2:
            raise WrdCodecError("WebVPN path missing scheme or host token")
        scheme_token, token = pieces[0], pieces[1]
        rest = "/" + pieces[2] if len(pieces) > 2 else "/"

        m = _SCHEME_RE.match(scheme_token)
        if not m:
            raise WrdCodecError(f"bad scheme token: {scheme_token!r}")
        scheme = m.group("scheme")
        port_s = m.group("port")
        port = int(port_s) if port_s else None

        host = self.decrypt_host(token)
        netloc = host if port is None else f"{host}:{port}"
        return urlunparse((scheme, netloc, rest, "", parsed.query, parsed.fragment))


def main(argv: Optional[list[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="SWUFE WRD WebVPN URL codec")
    parser.add_argument("--key", default=DEFAULT_KEY, help="16-byte AES key string")
    parser.add_argument("--iv", default=DEFAULT_IV, help="16-byte AES IV string")
    parser.add_argument("--webvpn-host", default=DEFAULT_WEBVPN_HOST)
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_enc = sub.add_parser("encode", help="ordinary URL → WebVPN URL")
    p_enc.add_argument("url")

    p_dec = sub.add_parser("decode", help="WebVPN URL → ordinary URL")
    p_dec.add_argument("url")

    args = parser.parse_args(argv)
    try:
        codec = WrdCodec(key=args.key, iv=args.iv, webvpn_host=args.webvpn_host)
        if args.cmd == "encode":
            print(codec.encode_url(args.url))
        else:
            print(codec.decode_url(args.url))
    except WrdCodecError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
