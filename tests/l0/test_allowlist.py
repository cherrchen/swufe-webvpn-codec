"""L0: allowlist matching, defaults and hostname validation (TC-B01..TC-B04)."""

from __future__ import annotations

import pytest

from swufe_bridge.allowlist import (
    DEFAULT_HOSTS,
    EXCLUDED_HOSTS,
    AllowlistConfig,
    ConfigError,
    InvalidHostError,
    allowlist_to_json,
    default_config,
    match,
    normalize_host,
    parse_allowlist,
)


def test_tc_b01_defaults_disable_wildcard_and_include_jwxt() -> None:
    cfg = default_config()

    assert cfg.hosts == ("jwxt.swufe.edu.cn",)
    assert cfg.hosts == DEFAULT_HOSTS
    assert cfg.include_swufe_wildcard is False
    assert allowlist_to_json(cfg)["hosts"] == ["jwxt.swufe.edu.cn"]


@pytest.mark.parametrize("host", ["jwxt.swufe.edu.cn", "JWXT.SWUFE.EDU.CN", " JWXT.swufe.edu.cn. "])
def test_tc_b02_exact_host_hits_regardless_of_case_and_trailing_dot(host: str) -> None:
    assert match(host, default_config()) is True


@pytest.mark.parametrize("host", ["example.com", "jwxt.swufe.edu.cn.evil.com", "jwxt.swufe.edu.com"])
def test_tc_b03_non_listed_hosts_are_not_rewritten(host: str) -> None:
    assert match(host, default_config()) is False


def test_tc_b04_wildcard_matches_apex_and_subdomains_only() -> None:
    cfg = AllowlistConfig(hosts=(), include_swufe_wildcard=True)

    assert match("jwxt.swufe.edu.cn", cfg) is True
    assert match("swufe.edu.cn", cfg) is True
    assert match("portal.swufe.edu.cn", cfg) is True
    assert match("notswufe.edu.cn", cfg) is False
    assert match("evilswufe.edu.cn", cfg) is False


@pytest.mark.parametrize("host", ["webvpn.swufe.edu.cn", "authserver.swufe.edu.cn"])
def test_b04_excluded_hosts_never_rewritten_even_with_wildcard(host: str) -> None:
    cfg = AllowlistConfig(hosts=tuple(EXCLUDED_HOSTS) + (host,), include_swufe_wildcard=True)

    assert host in EXCLUDED_HOSTS
    assert match(host, cfg) is False


def test_match_honours_extra_excluded_hosts() -> None:
    cfg = AllowlistConfig(hosts=("jwxt.swufe.edu.cn",), include_swufe_wildcard=False)

    assert match("jwxt.swufe.edu.cn", cfg, excluded=("jwxt.swufe.edu.cn",)) is False
    assert match("jwxt.swufe.edu.cn", cfg, excluded=("other.swufe.edu.cn",)) is True


def test_match_never_crashes_on_unusable_hosts() -> None:
    cfg = AllowlistConfig(hosts=("jwxt.swufe.edu.cn",), include_swufe_wildcard=True)

    for host in ["", "jwxt.swufe.edu.cn:443", "*.swufe.edu.cn", "a_b.swufe.edu.cn", None, 42]:
        assert match(host, cfg) is False  # type: ignore[arg-type]


@pytest.mark.parametrize("host", ["Host:8080", "", "a_b.c", "-a.b", "a..b", "*.swufe.edu.cn", " a b "])
def test_normalize_host_rejects_invalid_input(host: str) -> None:
    with pytest.raises(InvalidHostError):
        normalize_host(host)


def test_normalize_host_canonicalizes() -> None:
    assert normalize_host("JWXT.SWUFE.EDU.CN.") == "jwxt.swufe.edu.cn"


def test_allowlist_config_normalizes_and_dedupes_hosts() -> None:
    cfg = AllowlistConfig(hosts=("JWXT.swufe.edu.cn", "jwxt.swufe.edu.cn.", "PORTAL.swufe.edu.cn"), include_swufe_wildcard=False)

    assert cfg.hosts == ("jwxt.swufe.edu.cn", "portal.swufe.edu.cn")


def test_parse_allowlist_accepts_camel_case_payload() -> None:
    cfg = parse_allowlist({"hosts": ["Jwxt.SWUFE.edu.cn"], "includeSwufeWildcard": True, "updatedAt": "2026-09-21T00:00:00+00:00"})

    assert cfg.hosts == ("jwxt.swufe.edu.cn",)
    assert cfg.include_swufe_wildcard is True
    assert cfg.updated_at == "2026-09-21T00:00:00+00:00"


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"hosts": "jwxt.swufe.edu.cn"},
        {"hosts": [1]},
        {"hosts": [], "includeSwufeWildcard": "yes"},
        {"hosts": ["not a host"]},
        {"hosts": [], "updatedAt": 5},
    ],
)
def test_parse_allowlist_rejects_malformed_payloads(payload: dict[str, object]) -> None:
    with pytest.raises(ConfigError):
        parse_allowlist(payload)
