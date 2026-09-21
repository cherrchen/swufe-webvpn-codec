"""Allowlist semantics: hostname validation, normalization and routing.

This module is the single source of truth for "does this host get rewritten?".
It owns ``ConfigError`` (also used by :mod:`swufe_bridge.config`) to keep the
dependency direction one-way: config → allowlist.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, replace
from datetime import datetime, timezone
from typing import Iterable, Mapping

DEFAULT_HOSTS: tuple[str, ...] = ("jwxt.swufe.edu.cn",)
DEFAULT_WILDCARD = False

# Never rewritten: these hosts carry the WebVPN/CAS login flow itself (INV-004).
EXCLUDED_HOSTS: tuple[str, ...] = ("webvpn.swufe.edu.cn", "authserver.swufe.edu.cn")

MAX_HOST_LENGTH = 253
_LABEL_RE = re.compile(r"^[a-z0-9]([a-z0-9-]*[a-z0-9])?$")
_BANNED_CHARS = (":", "/", " ", "\t", "*", "?", "#", "@")


class ConfigError(ValueError):
    """Raised when configuration data is missing, malformed or inconsistent."""


class InvalidHostError(ConfigError):
    """Raised when a hostname fails validation."""


def lower_host(host: str) -> str:
    """Lowercase and drop a single trailing dot, without validating."""
    return host.strip().lower().rstrip(".") if host else ""


def normalize_host(host: str) -> str:
    """Validate and canonicalize a hostname.

    Raises :class:`InvalidHostError` for anything that is not a bare hostname
    (ports, schemes, wildcards, spaces). Wildcards are expressed only through
    ``includeSwufeWildcard``.
    """
    if not isinstance(host, str):
        raise InvalidHostError(f"host must be a string, got {type(host).__name__}")
    candidate = lower_host(host)
    if not candidate:
        raise InvalidHostError("host must not be empty")
    if any(char in candidate for char in _BANNED_CHARS):
        raise InvalidHostError(f"host contains forbidden characters: {host!r}")
    if len(candidate) > MAX_HOST_LENGTH:
        raise InvalidHostError(f"host is longer than {MAX_HOST_LENGTH} characters: {host!r}")
    for label in candidate.split("."):
        if not label or len(label) > 63 or not _LABEL_RE.match(label):
            raise InvalidHostError(f"host has an invalid label: {host!r}")
    return candidate


def try_normalize_host(host: object) -> str | None:
    """Best-effort normalization for hot paths: invalid input yields ``None``."""
    if not isinstance(host, str):
        return None
    try:
        return normalize_host(host)
    except InvalidHostError:
        return None


@dataclass(frozen=True)
class AllowlistConfig:
    hosts: tuple[str, ...]
    include_swufe_wildcard: bool
    updated_at: str | None = None

    def __post_init__(self) -> None:
        normalized: list[str] = []
        for host in self.hosts:
            candidate = normalize_host(host)
            if candidate not in normalized:
                normalized.append(candidate)
        object.__setattr__(self, "hosts", tuple(normalized))


def default_config() -> AllowlistConfig:
    return AllowlistConfig(hosts=DEFAULT_HOSTS, include_swufe_wildcard=DEFAULT_WILDCARD)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def match(host: str, cfg: AllowlistConfig, *, excluded: Iterable[str] = ()) -> bool:
    """Return whether ``host`` must be rewritten to a WebVPN URL.

    Order: excluded set → exact host match → ``*.swufe.edu.cn`` wildcard.
    Hosts that cannot be normalized are never rewritten.
    """
    candidate = try_normalize_host(host)
    if candidate is None:
        return False
    if candidate in EXCLUDED_HOSTS:
        return False
    for entry in excluded:
        if try_normalize_host(entry) == candidate:
            return False
    if candidate in cfg.hosts:
        return True
    if cfg.include_swufe_wildcard and (
        candidate == "swufe.edu.cn" or candidate.endswith(".swufe.edu.cn")
    ):
        return True
    return False


def parse_allowlist(data: Mapping[str, object]) -> AllowlistConfig:
    """Parse ``{hosts, includeSwufeWildcard, updatedAt}`` (camelCase keys)."""
    if not isinstance(data, Mapping):
        raise ConfigError("allowlist must be a JSON object")
    if "hosts" not in data:
        raise ConfigError("allowlist.hosts is required")
    hosts = data["hosts"]
    if not isinstance(hosts, (list, tuple)):
        raise ConfigError("allowlist.hosts must be a list of hostnames")
    if not all(isinstance(item, str) for item in hosts):
        raise ConfigError("allowlist.hosts must be a list of hostnames")
    wildcard = data.get("includeSwufeWildcard", DEFAULT_WILDCARD)
    if not isinstance(wildcard, bool):
        raise ConfigError("allowlist.includeSwufeWildcard must be a boolean")
    updated_at = data.get("updatedAt")
    if updated_at is not None and not isinstance(updated_at, str):
        raise ConfigError("allowlist.updatedAt must be a string or null")
    try:
        return AllowlistConfig(
            hosts=tuple(hosts),
            include_swufe_wildcard=wildcard,
            updated_at=updated_at,
        )
    except InvalidHostError as exc:
        raise ConfigError(str(exc)) from exc


def allowlist_to_json(cfg: AllowlistConfig) -> dict[str, object]:
    return {
        "hosts": list(cfg.hosts),
        "includeSwufeWildcard": cfg.include_swufe_wildcard,
        "updatedAt": cfg.updated_at or now_iso(),
    }


def with_hosts(cfg: AllowlistConfig, hosts: Iterable[str]) -> AllowlistConfig:
    """Return a copy with a fresh ``updatedAt`` (used by AllowlistStore)."""
    return replace(cfg, hosts=tuple(hosts), updated_at=now_iso())
