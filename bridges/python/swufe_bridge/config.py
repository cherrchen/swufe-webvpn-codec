"""Configuration surfaces of the bridge sidecar.

Two files live here:

- ``config.json`` (``AllowlistStore``): the persistent allowlist owned by the
  App side; M2 consumes it over IPC.
- ``bridge-config.json`` (``BridgeRuntimeConfig``): the runtime config the
  sidecar reads, written by whoever orchestrates the bridge (M1: a human, M2:
  Electron Main). The sidecar never writes it — it only reads and hot-reloads.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, replace
from pathlib import Path
from typing import Any, Mapping
from urllib.parse import urlsplit

from swufe_bridge.allowlist import (
    AllowlistConfig,
    ConfigError,
    allowlist_to_json,
    default_config,
    normalize_host,
    now_iso,
    parse_allowlist,
    with_hosts,
)
from swufe_bridge.wrd_codec import DEFAULT_IV, DEFAULT_KEY, DEFAULT_WEBVPN_HOST

__all__ = [
    "ALLOWLIST_FILENAME",
    "DEFAULT_CONFIG_DIR",
    "RUNTIME_FILENAME",
    "AllowlistStore",
    "BridgeRuntimeConfig",
    "ConfigError",
    "ConfigWatcher",
    "Cookie",
    "load_runtime_config",
    "parse_runtime_config",
    "write_runtime_config",
]

# Development-time stand-in; M2 passes the Electron userData directory instead.
DEFAULT_CONFIG_DIR = Path.home() / ".swufe-webvpn-bridge"
ALLOWLIST_FILENAME = "config.json"
RUNTIME_FILENAME = "bridge-config.json"

DEFAULT_WEBVPN_BASE = f"https://{DEFAULT_WEBVPN_HOST}"


@dataclass(frozen=True)
class Cookie:
    name: str
    value: str
    domain: str | None = None
    path: str | None = None


@dataclass(frozen=True)
class BridgeRuntimeConfig:
    allowlist: AllowlistConfig
    cookies: tuple[Cookie, ...] = ()
    debug: bool = False
    webvpn_base: str = DEFAULT_WEBVPN_BASE
    wrd_key: str = DEFAULT_KEY
    wrd_iv: str = DEFAULT_IV
    # mitmproxy intercept patterns (local mode); empty means system-proxy mode.
    capture_processes: tuple[str, ...] = ()

    @property
    def webvpn_host(self) -> str:
        host = urlsplit(self.webvpn_base).hostname
        if not host:
            raise ConfigError(f"webvpnBase has no hostname: {self.webvpn_base!r}")
        return normalize_host(host)

    @property
    def has_rewritable_hosts(self) -> bool:
        return bool(self.allowlist.hosts) or self.allowlist.include_swufe_wildcard


def _parse_cookies(raw: object) -> tuple[Cookie, ...]:
    if not isinstance(raw, (list, tuple)):
        raise ConfigError("cookies must be a list")
    cookies: list[Cookie] = []
    for index, item in enumerate(raw):
        if not isinstance(item, Mapping):
            raise ConfigError(f"cookies[{index}] must be an object")
        name = item.get("name")
        value = item.get("value")
        if not isinstance(name, str) or not name:
            raise ConfigError(f"cookies[{index}].name must be a non-empty string")
        if not isinstance(value, str):
            raise ConfigError(f"cookies[{index}].value must be a string")
        domain = item.get("domain")
        path = item.get("path")
        for key, entry in (("domain", domain), ("path", path)):
            if entry is not None and not isinstance(entry, str):
                raise ConfigError(f"cookies[{index}].{key} must be a string or null")
        cookies.append(Cookie(name=name, value=value, domain=domain, path=path))
    return tuple(cookies)


def _parse_capture_processes(raw: object) -> tuple[str, ...]:
    """mitmproxy intercept patterns for local mode.

    A comma separates entries in a mitmproxy intercept spec, so patterns must not
    contain one (see ADR-0006).
    """
    if not isinstance(raw, (list, tuple)):
        raise ConfigError("capture.processes must be a list")
    patterns: list[str] = []
    for index, item in enumerate(raw):
        if not isinstance(item, str):
            raise ConfigError(f"capture.processes[{index}] must be a string")
        pattern = item.strip()
        if not pattern or "," in pattern:
            raise ConfigError(
                f"capture.processes[{index}] must be a non-empty process pattern without commas"
            )
        if pattern not in patterns:
            patterns.append(pattern)
    return tuple(patterns)


def _require_wrd_secret(value: object, field: str) -> str:
    if not isinstance(value, str):
        raise ConfigError(f"{field} must be a string")
    if len(value.encode("utf-8")) != 16:
        raise ConfigError(f"WRD AES-128 {field} must be 16 bytes")
    return value


def _parse_webvpn_base(raw: object) -> str:
    if not isinstance(raw, str):
        raise ConfigError("webvpnBase must be a string")
    parsed = urlsplit(raw)
    if parsed.scheme not in ("http", "https"):
        raise ConfigError(f"webvpnBase must be an http(s) URL: {raw!r}")
    if not parsed.hostname:
        raise ConfigError(f"webvpnBase has no hostname: {raw!r}")
    try:
        normalize_host(parsed.hostname)
    except ConfigError as exc:
        raise ConfigError(f"webvpnBase hostname is invalid: {exc}") from exc
    return raw.rstrip("/")


def parse_runtime_config(data: Mapping[str, object]) -> BridgeRuntimeConfig:
    """Parse the sidecar runtime config; missing keys fall back to defaults."""
    if not isinstance(data, Mapping):
        raise ConfigError("bridge runtime config must be a JSON object")

    raw_allowlist = data.get("allowlist")
    if raw_allowlist is None:
        allowlist = default_config()
    elif isinstance(raw_allowlist, Mapping):
        allowlist = parse_allowlist(raw_allowlist)
    else:
        raise ConfigError("allowlist must be a JSON object")

    debug = data.get("debug", False)
    if not isinstance(debug, bool):
        raise ConfigError("debug must be a boolean")

    raw_capture = data.get("capture")
    if raw_capture is None:
        capture_processes: tuple[str, ...] = ()
    elif isinstance(raw_capture, Mapping):
        capture_processes = _parse_capture_processes(raw_capture.get("processes", []))
    else:
        raise ConfigError("capture must be a JSON object")

    return BridgeRuntimeConfig(
        allowlist=allowlist,
        cookies=_parse_cookies(data.get("cookies", [])),
        debug=debug,
        webvpn_base=_parse_webvpn_base(data.get("webvpnBase", DEFAULT_WEBVPN_BASE)),
        wrd_key=_require_wrd_secret(data.get("wrdKey", DEFAULT_KEY), "key"),
        wrd_iv=_require_wrd_secret(data.get("wrdIv", DEFAULT_IV), "IV"),
        capture_processes=capture_processes,
    )


def load_runtime_config(path: Path | str) -> BridgeRuntimeConfig:
    """Read the runtime config file. Missing file or bad JSON → ``ConfigError``."""
    file_path = Path(path)
    try:
        text = file_path.read_text(encoding="utf-8")
    except OSError as exc:
        raise ConfigError(f"cannot read config file {file_path}: {exc}") from exc
    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        raise ConfigError(f"config file {file_path} is not valid JSON: {exc}") from exc
    return parse_runtime_config(data)


def write_runtime_config(path: Path | str, cfg: BridgeRuntimeConfig) -> None:
    """Write the runtime config (0600: it carries WebVPN session cookies)."""
    file_path = Path(path)
    file_path.parent.mkdir(parents=True, exist_ok=True)
    payload: dict[str, Any] = {
        "allowlist": allowlist_to_json(cfg.allowlist),
        "cookies": [
            {
                key: value
                for key, value in (
                    ("name", cookie.name),
                    ("value", cookie.value),
                    ("domain", cookie.domain),
                    ("path", cookie.path),
                )
                if value is not None
            }
            for cookie in cfg.cookies
        ],
        "debug": cfg.debug,
        "webvpnBase": cfg.webvpn_base,
        "wrdKey": cfg.wrd_key,
        "wrdIv": cfg.wrd_iv,
        "capture": {"processes": list(cfg.capture_processes)},
    }
    fd = os.open(file_path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    os.chmod(file_path, 0o600)


class AllowlistStore:
    """Persistent allowlist at ``config.json`` (INV-003: lowercase, exact match)."""

    def __init__(self, path: Path | str) -> None:
        self.path = Path(path)

    def load(self) -> AllowlistConfig:
        if not self.path.exists():
            cfg = default_config()
            self.save(cfg)
            return cfg
        try:
            text = self.path.read_text(encoding="utf-8")
        except OSError as exc:
            raise ConfigError(f"cannot read allowlist file {self.path}: {exc}") from exc
        try:
            data = json.loads(text)
        except json.JSONDecodeError as exc:
            raise ConfigError(f"allowlist file {self.path} is not valid JSON: {exc}") from exc
        return parse_allowlist(data)

    def save(self, cfg: AllowlistConfig) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if cfg.updated_at is None:
            cfg = replace(cfg, updated_at=now_iso())
        self.path.write_text(
            json.dumps(allowlist_to_json(cfg), ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

    def add_host(self, host: str) -> AllowlistConfig:
        cfg = self.load()
        candidate = normalize_host(host)
        if candidate in cfg.hosts:
            return cfg
        updated = with_hosts(cfg, (*cfg.hosts, candidate))
        self.save(updated)
        return updated

    def remove_host(self, host: str) -> AllowlistConfig:
        cfg = self.load()
        candidate = normalize_host(host)
        if candidate not in cfg.hosts:
            return cfg
        updated = with_hosts(cfg, tuple(item for item in cfg.hosts if item != candidate))
        self.save(updated)
        return updated

    def set_wildcard(self, enabled: bool) -> AllowlistConfig:
        cfg = self.load()
        updated = replace(cfg, include_swufe_wildcard=bool(enabled), updated_at=now_iso())
        self.save(updated)
        return updated


class ConfigWatcher:
    """mtime+size polling reload (T012).

    A failed reload keeps the last usable configuration and exposes the reason;
    ``get()`` returns ``None`` only while no configuration has ever loaded.
    """

    def __init__(self, path: Path | str) -> None:
        self.path = Path(path)
        self._stamp: tuple[int, int] | None = None
        self._stamp_taken = False
        self._config: BridgeRuntimeConfig | None = None
        self._error: str | None = None

    @property
    def error(self) -> str | None:
        return self._error

    @property
    def stamp(self) -> tuple[int, int] | None:
        """mtime+size of the config as of the last successful ``get()``.

        Lets the capture loop tell "the same config is still there" from "the
        config was rewritten", so a failed attempt is not retried in a loop.
        """
        return self._stamp

    @property
    def config(self) -> BridgeRuntimeConfig | None:
        return self._config

    def _current_stamp(self) -> tuple[int, int] | None:
        try:
            stat = self.path.stat()
        except OSError:
            return None
        return (stat.st_mtime_ns, stat.st_size)

    def _reload(self) -> None:
        try:
            self._config = load_runtime_config(self.path)
        except ConfigError as exc:
            self._error = str(exc)
            return
        self._error = None

    def get(self) -> BridgeRuntimeConfig | None:
        stamp = self._current_stamp()
        if self._stamp_taken and stamp == self._stamp:
            return self._config
        self._stamp = stamp
        self._stamp_taken = True
        self._reload()
        return self._config
