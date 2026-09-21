"""L1: config hot reload and failure fallback (T012)."""

from __future__ import annotations

from swufe_bridge.addon import BridgeAddon
from tests.conftest import runtime_config

ALLOWLISTED = "https://jwxt.swufe.edu.cn/main"
OTHER = "https://portal.swufe.edu.cn/main"


def test_allowlist_change_takes_effect_without_restart(config_path, flow_factory) -> None:
    path = config_path()
    addon = BridgeAddon(path)

    jwxt = flow_factory(ALLOWLISTED)
    other = flow_factory(OTHER)
    addon.request(jwxt)
    addon.request(other)
    assert jwxt.request.host == "webvpn.swufe.edu.cn"
    assert other.request.url == OTHER

    path.unlink()
    config_path(runtime_config(allowlist={"hosts": ["portal.swufe.edu.cn"], "includeSwufeWildcard": False}))

    jwxt_after = flow_factory(ALLOWLISTED)
    other_after = flow_factory(OTHER)
    addon.request(jwxt_after)
    addon.request(other_after)

    assert jwxt_after.request.url == ALLOWLISTED
    assert other_after.request.host == "webvpn.swufe.edu.cn"


def test_cookie_change_takes_effect_without_restart(config_path, flow_factory) -> None:
    path = config_path()
    addon = BridgeAddon(path)

    first = flow_factory(ALLOWLISTED)
    addon.request(first)
    assert "cookie" not in first.request.headers

    path.unlink()
    config_path(runtime_config(cookies=[{"name": "sid", "value": "NEW", "domain": ".swufe.edu.cn"}]))

    second = flow_factory(ALLOWLISTED)
    addon.request(second)

    assert second.request.headers["cookie"] == "sid=NEW"


def test_broken_config_keeps_last_usable_config_and_reports_once(
    config_path, flow_factory, capsys
) -> None:
    path = config_path()
    addon = BridgeAddon(path)
    good = flow_factory(ALLOWLISTED)
    addon.request(good)
    assert good.request.host == "webvpn.swufe.edu.cn"

    path.write_text("{ broken json", encoding="utf-8")

    broken = flow_factory(ALLOWLISTED)
    addon.request(broken)
    addon.request(flow_factory(ALLOWLISTED))

    assert broken.request.host == "webvpn.swufe.edu.cn"  # last good config still applied
    assert capsys.readouterr().err.count("swufe-error CONFIG_INVALID") == 1

    path.unlink()
    config_path(runtime_config(allowlist={"hosts": [], "includeSwufeWildcard": False}))

    recovered = flow_factory(ALLOWLISTED)
    addon.request(recovered)

    assert recovered.request.url == ALLOWLISTED
