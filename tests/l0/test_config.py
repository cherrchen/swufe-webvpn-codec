"""L0: persistent allowlist store, runtime config parsing and hot reload (TC-B05, T012)."""

from __future__ import annotations

import json
import os
import stat
from pathlib import Path

import pytest

from swufe_bridge.allowlist import ConfigError, default_config
from swufe_bridge.config import (
    AllowlistStore,
    BridgeRuntimeConfig,
    ConfigWatcher,
    Cookie,
    load_runtime_config,
    parse_runtime_config,
    write_runtime_config,
)


@pytest.fixture
def store(tmp_path: Path) -> AllowlistStore:
    return AllowlistStore(tmp_path / "config.json")


def test_tc_b01_store_creates_default_file_on_first_load(store: AllowlistStore) -> None:
    cfg = store.load()

    assert cfg.hosts == ("jwxt.swufe.edu.cn",)
    assert cfg.include_swufe_wildcard is False
    assert store.path.exists()
    assert json.loads(store.path.read_text(encoding="utf-8"))["hosts"] == ["jwxt.swufe.edu.cn"]


def test_tc_b05_mutations_survive_a_new_store_instance(store: AllowlistStore) -> None:
    store.load()
    assert store.add_host("jwxt.swufe.edu.cn").hosts == ("jwxt.swufe.edu.cn",)  # dedupe
    assert store.add_host("PORTAL.swufe.edu.cn.").hosts == (
        "jwxt.swufe.edu.cn",
        "portal.swufe.edu.cn",
    )
    assert store.remove_host("jwxt.swufe.edu.cn").hosts == ("portal.swufe.edu.cn",)
    assert store.remove_host("absent.swufe.edu.cn").hosts == ("portal.swufe.edu.cn",)
    store.set_wildcard(True)

    reloaded = AllowlistStore(store.path).load()

    assert reloaded.hosts == ("portal.swufe.edu.cn",)
    assert reloaded.include_swufe_wildcard is True
    assert reloaded.updated_at is not None


def test_store_rejects_invalid_host_atomically(store: AllowlistStore) -> None:
    store.load()
    before = store.path.read_text(encoding="utf-8")

    with pytest.raises(ConfigError):
        store.add_host("not a host")

    assert store.path.read_text(encoding="utf-8") == before


def test_store_rejects_invalid_host_in_file(store: AllowlistStore) -> None:
    store.path.write_text(json.dumps({"hosts": ["a_b.c"], "includeSwufeWildcard": False}), encoding="utf-8")

    with pytest.raises(ConfigError):
        store.load()


def test_runtime_config_defaults_when_keys_are_missing() -> None:
    cfg = parse_runtime_config({})

    assert cfg.allowlist.hosts == default_config().hosts
    assert cfg.cookies == ()
    assert cfg.debug is False
    assert cfg.webvpn_base == "https://webvpn.swufe.edu.cn"
    assert cfg.webvpn_host == "webvpn.swufe.edu.cn"
    assert cfg.wrd_key == cfg.wrd_iv == "wrdvpnisthebest!"
    assert parse_runtime_config({"unknown": {"x": 1}, "cookies": []}).debug is False


def test_runtime_config_parses_cookies_and_debug() -> None:
    cfg = parse_runtime_config(
        {
            "allowlist": {"hosts": ["JWXT.swufe.edu.cn"], "includeSwufeWildcard": True},
            "cookies": [
                {"name": "wrdvpn_session", "value": "SECRET", "domain": ".swufe.edu.cn", "unknown": 1},
                {"name": "plain", "value": "v"},
            ],
            "debug": True,
            "webvpnBase": "http://127.0.0.1:9000/",
            "wrdKey": "0123456789abcdef",
            "wrdIv": "0123456789abcdef",
        }
    )

    assert cfg.cookies == (
        Cookie(name="wrdvpn_session", value="SECRET", domain=".swufe.edu.cn", path=None),
        Cookie(name="plain", value="v"),
    )
    assert cfg.debug is True
    assert cfg.webvpn_base == "http://127.0.0.1:9000"
    assert cfg.webvpn_host == "127.0.0.1"
    assert cfg.has_rewritable_hosts is True


@pytest.mark.parametrize(
    "payload",
    [
        {"wrdKey": "too-short"},
        {"wrdIv": "ü" * 16},
        {"debug": "yes"},
        {"cookies": {"name": "a"}},
        {"cookies": [{"name": "", "value": "v"}]},
        {"cookies": [{"name": "a"}]},
        {"cookies": [{"name": "a", "value": "v", "domain": 5}]},
        {"webvpnBase": "ftp://webvpn.swufe.edu.cn"},
        {"webvpnBase": "https:///nohost"},
        {"allowlist": "jwxt.swufe.edu.cn"},
        {"allowlist": {"hosts": ["a_b.c"]}},
    ],
)
def test_runtime_config_rejects_malformed_payloads(payload: dict[str, object]) -> None:
    with pytest.raises(ConfigError):
        parse_runtime_config(payload)


def test_has_rewritable_hosts_false_when_empty_and_no_wildcard() -> None:
    cfg = parse_runtime_config({"allowlist": {"hosts": [], "includeSwufeWildcard": False}})

    assert cfg.has_rewritable_hosts is False


def test_write_runtime_config_is_owner_only_and_round_trips(tmp_path: Path) -> None:
    path = tmp_path / "nested" / "bridge-config.json"
    cfg = parse_runtime_config(
        {
            "allowlist": {"hosts": ["jwxt.swufe.edu.cn"], "includeSwufeWildcard": True},
            "cookies": [{"name": "a", "value": "b", "domain": ".swufe.edu.cn", "path": "/"}],
            "debug": True,
        }
    )

    write_runtime_config(path, cfg)

    assert stat.S_IMODE(os.stat(path).st_mode) == 0o600
    reloaded = load_runtime_config(path)
    assert reloaded.cookies == cfg.cookies
    assert reloaded.debug is True
    assert reloaded.allowlist.hosts == ("jwxt.swufe.edu.cn",)
    assert reloaded.allowlist.include_swufe_wildcard is True
    assert reloaded.allowlist.updated_at is not None
    assert json.loads(path.read_text(encoding="utf-8"))["cookies"][0]["value"] == "b"


def test_load_runtime_config_rejects_missing_file_and_bad_json(tmp_path: Path) -> None:
    with pytest.raises(ConfigError):
        load_runtime_config(tmp_path / "absent.json")

    broken = tmp_path / "broken.json"
    broken.write_text("{not json", encoding="utf-8")
    with pytest.raises(ConfigError):
        load_runtime_config(broken)


def _write(path: Path, hosts: list[str], *, wildcard: bool = False, debug: bool = False) -> None:
    path.write_text(
        json.dumps(
            {
                "allowlist": {"hosts": hosts, "includeSwufeWildcard": wildcard},
                "cookies": [{"name": "a", "value": "b"}],
                "debug": debug,
            }
        ),
        encoding="utf-8",
    )


def test_watcher_reloads_on_change_and_keeps_last_good_value_on_failure(tmp_path: Path) -> None:
    path = tmp_path / "bridge-config.json"
    _write(path, ["jwxt.swufe.edu.cn"])
    watcher = ConfigWatcher(path)

    assert watcher.get() is not None
    assert watcher.error is None
    first = watcher.get()

    _write(path, ["portal.swufe.edu.cn"], debug=True)
    changed = watcher.get()

    assert changed is not first
    assert changed is not None
    assert changed.allowlist.hosts == ("portal.swufe.edu.cn",)
    assert changed.debug is True

    path.write_text("{broken", encoding="utf-8")
    assert watcher.get() is changed
    assert watcher.error is not None


def test_watcher_reports_missing_file_then_recovers(tmp_path: Path) -> None:
    path = tmp_path / "bridge-config.json"
    watcher = ConfigWatcher(path)

    assert watcher.get() is None
    assert watcher.error is not None

    _write(path, ["jwxt.swufe.edu.cn"])

    assert watcher.get() is not None
    assert watcher.error is None


def test_bridge_runtime_config_webvpn_host_requires_hostname() -> None:
    cfg = BridgeRuntimeConfig(allowlist=default_config(), webvpn_base="https:///x")

    with pytest.raises(ConfigError):
        _ = cfg.webvpn_host
