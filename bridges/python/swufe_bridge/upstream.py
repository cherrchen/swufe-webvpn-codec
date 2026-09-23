"""Bounded upstream connects for the WebVPN gateway, plus a stage evidence sink.

`KI-019` (sporadic multi-second stalls on bridged requests) could not be attributed
because mitmproxy dials upstream with a bare `asyncio.open_connection` — no timeout —
and the bridge only logged request rewriting, which happens *before* the connection is
even attempted. This module therefore does two things and nothing else:

1. `install_connect_deadline()` wraps `asyncio.open_connection` so that connecting to
   the WebVPN gateway hosts fails **within a bound** (``CONNECT_TIMEOUT_SECONDS`` per
   attempt, ``CONNECT_ATTEMPTS`` attempts) instead of hanging until the client gives up.
   Mitmproxy turns the raised `TimeoutError` into its regular connect-failure path, so
   the client sees a `502` rather than an empty wait. Hosts outside the policy set are
   passed through untouched: their behaviour is unchanged.
2. `record()` is the single sink for per-stage evidence (`connect_start` …
   `error`), emitted as `swufe-upstream <json>` on stderr and appended to
   `bridge-upstream.log` under the app's user data directory. Records carry timings and
   peer addresses only; every value passes through `_sanitize`, so WRD tokens (which
   only ever appear inside a URL) cannot reach the log (INV-001).

Scope limitation, deliberate and documented in `KI-019`: mitmproxy cannot interrupt a
flow that is already connected (`flow.kill()` does not abort in-flight flows, upstream
issue #4711), so a gateway that accepts the connection and then never answers is
*visible* here, not bounded.
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import sys
from collections.abc import Iterable
from pathlib import Path

from swufe_bridge.allowlist import now_iso

# Bounds applied to every connect to a host in the policy set (`set_policy_hosts`).
CONNECT_TIMEOUT_SECONDS = 4.0
CONNECT_ATTEMPTS = 2

# A stage slower than this is worth recording even when debug logging is off.
SLOW_MS = 3000

UPSTREAM_LOG_FILENAME = "bridge-upstream.log"
LOG_MAX_BYTES = 262144
DETAIL_MAX = 160

# Stages that always leave a trace, so a stall is diagnosable after the fact.
ABNORMAL_STAGES = frozenset(
    {"connect_timeout", "connect_retry", "connect_failed", "tls_failed", "error"}
)

RECORD_KEYS = ("ts", "stage", "host", "addr", "ms", "detail")

# Kept as a module-level alias so tests can inject a stub without touching asyncio.
_orig_open_connection = asyncio.open_connection

_installed = False
_policy_hosts: frozenset[str] = frozenset()
_log_path: Path | None = None
_debug = False
_log_bytes = 0

_URL_IN_TEXT = re.compile(r"https?://[^\s\"']*")
# Hostnames, IP literals and `host:port` pairs only; anything else (a URL, a path) is
# dropped rather than sanitized.
_HOSTLIKE = re.compile(r"^[A-Za-z0-9._:\[\]-]{1,255}$")


def set_policy_hosts(hosts: Iterable[str]) -> None:
    """Hosts whose connects get the deadline. Everything else is passed through."""
    global _policy_hosts
    _policy_hosts = frozenset(host for host in hosts if host)


def configure_log(path: Path | None, debug: bool) -> None:
    """Set the JSONL sink (``None`` keeps stderr only) and the debug switch."""
    global _log_path, _debug, _log_bytes
    if path != _log_path:
        _log_bytes = 0
        _log_path = path
    _debug = debug
    # Abandon a log left behind by an earlier bridge version rather than appending to it.
    if path is not None and _log_bytes == 0:
        try:
            if path.exists():
                path.unlink()
        except OSError:  # pragma: no cover - unreadable leftover must not break startup
            pass


def _sanitize(value: str) -> str:
    """Drop URL-ish runs (WRD tokens), flatten control characters, cap the length."""
    text = _URL_IN_TEXT.sub("", value)
    text = "".join(" " if ch < " " or ch == "\x7f" else ch for ch in text)
    return text.strip()[:DETAIL_MAX]


def _clean_address(value: object) -> str | None:
    """Accept a hostname or `host:port` only; a sanitized form is never a valid host."""
    if not isinstance(value, str):
        return None
    text = value.strip()
    return text if _HOSTLIKE.match(text) else None


def record(
    stage: str,
    *,
    host: str | None = None,
    addr: str | None = None,
    ms: int | None = None,
    detail: str | None = None,
) -> None:
    """Emit one stage record. Never raises: diagnostics must not break forwarding."""
    try:
        if not (stage in ABNORMAL_STAGES or _debug or (ms is not None and ms >= SLOW_MS)):
            return
        entry = {
            "ts": now_iso(),
            "stage": stage,
            "host": _clean_address(host),
            "addr": _clean_address(addr),
            "ms": ms,
            "detail": _sanitize(detail) if detail is not None else None,
        }
        line = json.dumps(entry, ensure_ascii=False)
        print(f"swufe-upstream {line}", file=sys.stderr, flush=True)
        _append(line)
    except Exception:  # pragma: no cover - defensive: never surface a logging bug
        pass


def _append(line: str) -> None:
    path = _log_path
    if path is None:
        return
    global _log_bytes
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "a", encoding="utf-8") as handle:
            handle.write(line + "\n")
        if os.name == "posix":
            os.chmod(path, 0o600)
        _log_bytes += len(line.encode("utf-8")) + 1
        if _log_bytes > LOG_MAX_BYTES:
            _rotate(path)
    except Exception:  # pragma: no cover - unwritable path must not break forwarding
        pass


def _rotate(path: Path) -> None:
    """Keep the newest ~half of the log; the file never exceeds ``LOG_MAX_BYTES``."""
    global _log_bytes
    data = path.read_bytes()
    half = len(data) // 2
    cut = data.rfind(b"\n", 0, half)
    tail = data[cut + 1 :] if cut >= 0 else data[half:]
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_bytes(tail)
    os.replace(tmp, path)
    _log_bytes = len(tail)


async def _open_connection_with_deadline(*args, **kwargs):
    """`asyncio.open_connection`, bounded for hosts in the policy set."""
    host = args[0] if args else kwargs.get("host")
    port = args[1] if len(args) > 1 else kwargs.get("port")
    if host not in _policy_hosts:
        return await _orig_open_connection(*args, **kwargs)

    label = f"{host}:{port}"
    for attempt in range(1, CONNECT_ATTEMPTS + 1):
        started = asyncio.get_running_loop().time()
        try:
            return await asyncio.wait_for(
                _orig_open_connection(*args, **kwargs), CONNECT_TIMEOUT_SECONDS
            )
        except TimeoutError:
            waited = int((asyncio.get_running_loop().time() - started) * 1000)
            record("connect_timeout", host=str(host), addr=label, ms=waited, detail=f"attempt={attempt}")
            if attempt < CONNECT_ATTEMPTS:
                record("connect_retry", host=str(host), addr=label, ms=waited, detail=f"attempt={attempt}")
    # Out of attempts: mitmproxy's own failure path turns this into CONNECT_FAILED (502).
    raise TimeoutError(f"connect timeout after {CONNECT_ATTEMPTS} attempts: {label}")


def install_connect_deadline() -> None:
    """Patch `asyncio.open_connection`; idempotent (safe to call per process)."""
    global _installed
    if _installed:
        return
    _installed = True
    asyncio.open_connection = _open_connection_with_deadline  # type: ignore[assignment]
