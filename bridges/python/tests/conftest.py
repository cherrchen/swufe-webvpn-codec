"""Shared fixtures.

Deliberately free of mitmproxy imports so that L0 tests stay runnable without
the proxy stack (and so collection failures in L1 cannot mask L0 results).
"""

from __future__ import annotations

from pathlib import Path

import pytest

from swufe_bridge.config import BridgeRuntimeConfig, parse_runtime_config, write_runtime_config
from swufe_bridge.wrd_codec import WrdCodec

DEFAULT_PAYLOAD: dict[str, object] = {
    "allowlist": {"hosts": ["jwxt.swufe.edu.cn"], "includeSwufeWildcard": False},
    "cookies": [],
    "debug": False,
}


def runtime_config(**overrides: object) -> BridgeRuntimeConfig:
    """Build a runtime config from the M1 contract payload (see bridge-control-protocol)."""
    payload = dict(DEFAULT_PAYLOAD)
    payload.update(overrides)
    return parse_runtime_config(payload)


@pytest.fixture
def config_path(tmp_path: Path):
    """Write a runtime config file and return its path."""

    def _write(cfg: BridgeRuntimeConfig | None = None, name: str = "bridge-config.json", **overrides: object) -> Path:
        path = tmp_path / name
        write_runtime_config(path, cfg if cfg is not None else runtime_config(**overrides))
        return path

    return _write

# Live capture from webvpn.swufe.edu.cn (2026-09-20), see docs/api/wrd-codec-library.md.
SAMPLE_WEBVPN_URL = (
    "https://webvpn.swufe.edu.cn/https/"
    "77726476706e69737468656265737421f1e2559434357a467b1ac7bf8f40253097e41b52087752"
    "/authserver/login?service=http%3A%2F%2Fjwxt.swufe.edu.cn%2Fsso%2Fjziotlogin"
)
SAMPLE_QUERY = "service=http%3A%2F%2Fjwxt.swufe.edu.cn%2Fsso%2Fjziotlogin"
SAMPLE_HOST = "authserver.swufe.edu.cn"
SAMPLE_HOST_TOKEN = (
    "77726476706e69737468656265737421f1e2559434357a467b1ac7bf8f40253097e41b52087752"
)


@pytest.fixture
def codec() -> WrdCodec:
    return WrdCodec()
