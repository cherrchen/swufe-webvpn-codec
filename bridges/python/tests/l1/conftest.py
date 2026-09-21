"""L1 fixtures: mitmproxy flows and an addon bound to a temp runtime config."""

from __future__ import annotations

from pathlib import Path
from urllib.parse import urlsplit

import pytest
from mitmproxy import http
from mitmproxy.test import tflow

from swufe_bridge.addon import BridgeAddon
from swufe_bridge.config import BridgeRuntimeConfig
from tests.conftest import runtime_config


def make_flow(
    url: str,
    *,
    method: str = "GET",
    headers: dict[str, str] | None = None,
) -> http.HTTPFlow:
    """A flow shaped like a real proxied request: authority plus a Host header."""
    parsed = urlsplit(url)
    merged: dict[str, str] = {"Host": parsed.hostname or ""} if parsed.hostname else {}
    merged.update(headers or {})
    return tflow.tflow(req=http.Request.make(method, url, headers=merged))


@pytest.fixture
def flow_factory():
    return make_flow


@pytest.fixture
def addon_factory(config_path):
    """``addon_factory(**payload_overrides)`` → (addon, effective config)."""

    def _make(**overrides: object) -> tuple[BridgeAddon, BridgeRuntimeConfig]:
        cfg = runtime_config(**overrides)
        return BridgeAddon(config_path(cfg)), cfg

    return _make


@pytest.fixture
def addon(addon_factory) -> BridgeAddon:
    addon, _ = addon_factory()
    return addon
