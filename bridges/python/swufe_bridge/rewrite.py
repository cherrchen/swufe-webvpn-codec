"""Reverse rewriting of WebVPN responses back to ordinary SWUFE URLs.

Pure functions (no mitmproxy imports) so the rewrite rules are unit-testable and
reusable outside the proxy. The addon wires them to flows.

Rewrite order (REQ-007): ``Location`` → ``Set-Cookie`` Domain/Path → HTML/JS/JSON
absolute URLs; other content types pass through untouched.
"""

from __future__ import annotations

import re
from functools import lru_cache
from typing import Protocol

from swufe_bridge.wrd_codec import WrdCodec, WrdCodecError

REWRITABLE_CONTENT_TYPES = frozenset(
    {"text/html", "application/javascript", "text/javascript", "application/json"}
)

# The gateway hands its client shim to the browser through a minimal bootstrap
# document (KI-011). Its two markers are the shim globals and the vendor runtime
# script the document loads from the gateway root.
GATEWAY_BOOTSTRAP_MARKERS: tuple[str, str] = ("__vpn_", "/wengine-vpn/js/main.js")
# Observed bootstrap page: 925 B (2026-09-21, records in
# specs/001-phase1-local-bridge/verification.md). Real site pages carry the same
# injection on top of tens of kilobytes, so size separates the two.
GATEWAY_BOOTSTRAP_MAX_BYTES = 8192

_SCHEME_TOKEN = r"https?(?:-\d+)?"
_HOST_TOKEN = r"[0-9a-fA-F]{34,}"
# ``\/`` is a valid in-string escape for ``/``: accept it wherever a URL literal
# may carry one and re-escape on the way out.
_SLASH = r"(?:\\?/)"
# A URL literal ends at whitespace, quotes or a backslash.
_REST = r"(?:\\/|[^\s\"'<>\\])*"


class CookieAttrs(Protocol):
    """Subset of mitmproxy's cookie attribute mapping (keys are case-insensitive)."""

    def __contains__(self, key: str) -> bool: ...

    def get(self, key: str, default: object = None) -> str | None: ...

    def __setitem__(self, key: str, value: str) -> None: ...


@lru_cache(maxsize=32)
def _build_re(webvpn_host: str, anchored: bool) -> re.Pattern[str]:
    host = re.escape(webvpn_host) + r"(?::\d+)?"
    prefix = rf"(?:(?:https?:)?{_SLASH}{_SLASH}{host})?"
    path = (
        rf"(?P<path>{_SLASH}(?P<scheme_token>{_SCHEME_TOKEN})"
        rf"{_SLASH}(?P<token>{_HOST_TOKEN})(?P<rest>{_REST}))"
    )
    body = rf"{prefix}{path}"
    return re.compile(rf"^{body}$" if anchored else body, re.IGNORECASE)


def _value_re(webvpn_host: str) -> re.Pattern[str]:
    return _build_re(webvpn_host, True)


def _body_re(webvpn_host: str) -> re.Pattern[str]:
    return _build_re(webvpn_host, False)


def is_rewritable_content_type(value: str | None) -> bool:
    """``text/html; charset=utf-8`` → True; ``image/png`` → False."""
    if not value:
        return False
    return value.split(";", 1)[0].strip().lower() in REWRITABLE_CONTENT_TYPES


def is_gateway_bootstrap_html(content_type: str | None, body: bytes | None) -> bool:
    """Whether a response is the gateway's client-shim bootstrap document.

    The gateway answers a proxied HTML request with a tiny document whose only
    job is to define the ``__vpn_*`` globals and load the vendor client runtime
    from the gateway root (KI-011). Real site pages carry the same injection on
    top of far more bytes, so ``text/html`` + both markers + the size cap
    separates the two. Never raises: an undecodable body is matched on its
    replacement-decoded text.
    """
    if not content_type or content_type.split(";", 1)[0].strip().lower() != "text/html":
        return False
    if not body or len(body) > GATEWAY_BOOTSTRAP_MAX_BYTES:
        return False
    text = body.decode("utf-8", "replace")
    return all(marker in text for marker in GATEWAY_BOOTSTRAP_MARKERS)


def decode_wrd_reference(value: str, codec: WrdCodec, webvpn_host: str) -> str | None:
    """Decode a WRD URL reference in any of its three forms, else ``None``.

    Accepted: absolute (``https://webvpn.../https/<token>/...``),
    protocol-relative (``//webvpn.../...``) and root-relative
    (``/https/<token>/...``); the result is always an absolute ordinary URL.
    """
    if not value:
        return None
    match = _value_re(webvpn_host).match(value)
    if match is None:
        return None
    path = match.group("path").replace("\\/", "/")
    try:
        return codec.decode_url(f"https://{webvpn_host}{path}")
    except WrdCodecError:
        return None


def rewrite_location(value: str, codec: WrdCodec, webvpn_host: str) -> tuple[str, bool]:
    """Rewrite a ``Location`` header value; non-WRD values (e.g. the WebVPN login
    portal redirect) are returned unchanged."""
    decoded = decode_wrd_reference(value, codec, webvpn_host)
    if decoded is None:
        return value, False
    return decoded, True


def strip_wrd_prefix(path: str, wrd_prefix: str) -> str | None:
    """``/https/<token>/app`` → ``/app`` (``/https/<token>`` → ``/``); else ``None``."""
    if not wrd_prefix:
        return None
    if path == wrd_prefix:
        return "/"
    if path.startswith(wrd_prefix + "/"):
        return path[len(wrd_prefix) :]
    return None


def rewrite_set_cookie_attrs(
    attrs: CookieAttrs,
    *,
    original_host: str,
    webvpn_host: str,
    wrd_prefix: str,
) -> bool:
    """Rewrite ``Domain``/``Path`` of a Set-Cookie that points at the WebVPN host.

    Domain is rewritten only when it is the WebVPN host itself or one of its
    subdomains; broader domains such as ``.swufe.edu.cn`` stay untouched.
    Returns whether anything changed.
    """
    changed = False
    if "domain" in attrs:
        domain = attrs.get("domain") or ""
        candidate = domain.lstrip(".").lower()
        if candidate == webvpn_host or candidate.endswith("." + webvpn_host):
            attrs["domain"] = original_host.lstrip(".")
            changed = True
    if "path" in attrs:
        path = attrs.get("path") or ""
        stripped = strip_wrd_prefix(path, wrd_prefix)
        if stripped is not None:
            attrs["path"] = stripped
            changed = True
    return changed


def rewrite_body_text(text: str, codec: WrdCodec, webvpn_host: str) -> tuple[str, int]:
    """Decode every WRD URL literal in ``text``; returns ``(text, count)``.

    Known boundary: only URL literals are handled — base64, ``\\u002f`` and
    percent-encoded payloads are not decoded.
    """
    pattern = _body_re(webvpn_host)
    replacements = 0

    def _replace(match: re.Match[str]) -> str:
        nonlocal replacements
        raw = match.group(0)
        decoded = decode_wrd_reference(raw, codec, webvpn_host)
        if decoded is None:
            return raw
        replacements += 1
        # Keep the source's escaping style so the surrounding JS string stays valid.
        if "\\/" in match.group("path"):
            return decoded.replace("/", "\\/")
        return decoded

    return pattern.sub(_replace, text), replacements
