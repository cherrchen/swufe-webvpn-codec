"""L1: request rewriting — allowlist routing, WRD encoding, cookies, headers."""

from __future__ import annotations

import json

from swufe_bridge.addon import (
    METADATA_GATEWAY_ROOT,
    METADATA_ORIGINAL_URL,
    METADATA_WRD_PREFIX,
    BridgeAddon,
)
from swufe_bridge.wrd_codec import WrdCodec

WEBVPN_HOST = "webvpn.swufe.edu.cn"


def debug_records(capsys) -> list[dict[str, object]]:
    out = capsys.readouterr().err
    return [
        json.loads(line[len("swufe-debug ") :])
        for line in out.splitlines()
        if line.startswith("swufe-debug ")
    ]


def test_allowlisted_request_is_rewritten_to_webvpn_form(addon_factory, flow_factory) -> None:
    addon, _ = addon_factory()
    flow = flow_factory("https://jwxt.swufe.edu.cn/sso/jziotlogin?x=1")
    token = WrdCodec().encrypt_host("jwxt.swufe.edu.cn")

    addon.request(flow)

    assert flow.request.scheme == "https"
    assert flow.request.host == WEBVPN_HOST
    assert flow.request.port == 443
    assert flow.request.host_header == WEBVPN_HOST
    assert flow.request.path == f"/https/{token}/sso/jziotlogin?x=1"
    assert flow.metadata[METADATA_ORIGINAL_URL] == "https://jwxt.swufe.edu.cn/sso/jziotlogin?x=1"
    assert flow.metadata[METADATA_WRD_PREFIX] == f"/https/{token}"


def test_tc_f02_non_allowlisted_request_passes_through(addon_factory, flow_factory, capsys) -> None:
    addon, _ = addon_factory(debug=True)
    flow = flow_factory("https://example.com/x", headers={"Cookie": "a=1"})
    before = flow.request.url

    addon.request(flow)

    assert flow.request.url == before
    assert flow.request.headers["cookie"] == "a=1"
    assert flow.metadata == {}
    records = debug_records(capsys)
    assert len(records) == 1
    assert records[0]["host"] == "example.com"
    assert records[0]["rewritten"] is False
    assert records[0]["direction"] == "request"
    assert records[0]["detail"] == "not-allowlisted"


def test_injected_cookies_are_not_added_for_non_allowlisted_hosts(addon_factory, flow_factory) -> None:
    addon, _ = addon_factory(cookies=[{"name": "sid", "value": "SECRET", "domain": ".swufe.edu.cn"}])
    flow = flow_factory("https://example.com/x")

    addon.request(flow)

    assert "cookie" not in flow.request.headers


def test_ec_004_already_webvpn_shaped_traffic_is_never_rewrapped(
    addon_factory, flow_factory
) -> None:
    addon, _ = addon_factory()
    token = WrdCodec().encrypt_host("jwxt.swufe.edu.cn")
    urls = [
        f"https://{WEBVPN_HOST}/https/{token}/x",
        "https://authserver.swufe.edu.cn/authserver/login",
        "https://webvpn.swufe.edu.cn/login?service=x",
        "https://authserver.swufe.edu.cn/cas",
    ]

    for url in urls:
        flow = flow_factory(url)
        addon.request(flow)
        assert flow.request.url == url, url
        assert flow.metadata == {}, url


def test_ec_004_configured_webvpn_host_is_also_excluded(config_path, flow_factory) -> None:
    addon = BridgeAddon(
        config_path(
            webvpnBase="https://vpn.example.edu:8443",
            allowlist={"hosts": ["vpn.example.edu"], "includeSwufeWildcard": True},
        )
    )
    flow = flow_factory("https://vpn.example.edu/x")

    addon.request(flow)

    assert flow.request.url == "https://vpn.example.edu/x"
    assert flow.metadata == {}


def test_ec_002_non_default_port_becomes_scheme_token(addon_factory, flow_factory) -> None:
    addon, _ = addon_factory(allowlist={"hosts": ["host"], "includeSwufeWildcard": False})
    flow = flow_factory("http://host:8080/x")

    addon.request(flow)

    token = WrdCodec().encrypt_host("host")
    assert flow.request.path == f"/http-8080/{token}/x"
    assert flow.request.host == WEBVPN_HOST


def test_wildcard_allows_subdomains(addon_factory, flow_factory) -> None:
    addon, _ = addon_factory(allowlist={"hosts": [], "includeSwufeWildcard": True})
    flow = flow_factory("https://portal.swufe.edu.cn/x")

    addon.request(flow)

    assert flow.request.host == WEBVPN_HOST
    assert flow.request.host_header == WEBVPN_HOST


def test_tc_request_cookie_injection_dedupes_and_orders(addon_factory, flow_factory) -> None:
    addon, _ = addon_factory(
        cookies=[
            {"name": "a", "value": "CFG-A", "domain": ".swufe.edu.cn"},
            {"name": "b", "value": "CFG-B", "domain": "webvpn.swufe.edu.cn"},
            {"name": "c", "value": "CFG-C"},
            {"name": "d", "value": "CFG-D", "domain": "jwxt.swufe.edu.cn"},
        ]
    )
    flow = flow_factory("https://jwxt.swufe.edu.cn/x", headers={"Cookie": "a=client; e=5"})

    addon.request(flow)

    assert flow.request.headers["cookie"] == "e=5; a=CFG-A; b=CFG-B; c=CFG-C"
    assert flow.request.headers.get_all("cookie") == ["e=5; a=CFG-A; b=CFG-B; c=CFG-C"]


def test_tc_request_origin_and_referer_follow_the_rewrite(addon_factory, flow_factory) -> None:
    addon, _ = addon_factory()
    token = WrdCodec().encrypt_host("jwxt.swufe.edu.cn")
    flow = flow_factory(
        "https://jwxt.swufe.edu.cn/sso/x",
        headers={
            "Origin": "https://jwxt.swufe.edu.cn",
            "Referer": "https://jwxt.swufe.edu.cn/sso/prev",
        },
    )

    addon.request(flow)

    assert flow.request.headers["origin"] == f"https://{WEBVPN_HOST}"
    assert flow.request.headers["referer"] == f"https://{WEBVPN_HOST}/https/{token}/sso/prev"


def test_foreign_origin_and_referer_are_left_alone(addon_factory, flow_factory) -> None:
    addon, _ = addon_factory()
    flow = flow_factory(
        "https://jwxt.swufe.edu.cn/x",
        headers={"Origin": "https://example.com", "Referer": "https://example.com/page"},
    )

    addon.request(flow)

    assert flow.request.headers["origin"] == "https://example.com"
    assert flow.request.headers["referer"] == "https://example.com/page"


def test_broken_config_file_lets_requests_through_with_one_error_line(
    config_path, flow_factory, capsys
) -> None:
    path = config_path()
    path.write_text("{ broken", encoding="utf-8")
    addon = BridgeAddon(path)
    flow = flow_factory("https://jwxt.swufe.edu.cn/x")
    before = flow.request.url

    addon.request(flow)
    addon.request(flow_factory("https://jwxt.swufe.edu.cn/y"))

    assert flow.request.url == before
    stderr = capsys.readouterr().err
    assert stderr.count("swufe-error CONFIG_INVALID") == 1


def test_addon_reports_config_error_when_no_config_path_is_configured(flow_factory, capsys) -> None:
    addon = BridgeAddon()
    flow = flow_factory("https://jwxt.swufe.edu.cn/x")
    before = flow.request.url

    addon.request(flow)

    assert flow.request.url == before
    assert "swufe-error CONFIG_INVALID" in capsys.readouterr().err


def test_gateway_owned_path_is_not_token_wrapped(addon_factory, flow_factory, capsys) -> None:
    addon, _ = addon_factory(debug=True)
    flow = flow_factory("http://jwxt.swufe.edu.cn/wengine-vpn/js/main.js?ver=20211207")

    addon.request(flow)

    assert flow.request.url == f"https://{WEBVPN_HOST}/wengine-vpn/js/main.js?ver=20211207"
    assert flow.request.host == WEBVPN_HOST
    assert flow.metadata[METADATA_GATEWAY_ROOT] == "1"
    assert METADATA_WRD_PREFIX not in flow.metadata
    records = debug_records(capsys)
    assert records[-1]["host"] == "jwxt.swufe.edu.cn"
    assert records[-1]["rewritten"] is True
    assert records[-1]["detail"] == "gateway-root"


def test_gateway_owned_authserver_path_is_not_token_wrapped(addon_factory, flow_factory) -> None:
    addon, _ = addon_factory(cookies=[{"name": "sid", "value": "CFG-SID", "domain": ".swufe.edu.cn"}])
    flow = flow_factory("http://jwxt.swufe.edu.cn/authserver/login?service=x")

    addon.request(flow)

    assert flow.request.url == f"https://{WEBVPN_HOST}/authserver/login?service=x"
    assert flow.metadata == {METADATA_GATEWAY_ROOT: "1"}
    assert flow.request.headers["cookie"] == "sid=CFG-SID"


def test_site_path_containing_gateway_prefix_is_still_wrapped(addon_factory, flow_factory) -> None:
    addon, _ = addon_factory()
    flow = flow_factory("http://jwxt.swufe.edu.cn/xtgl/wengine-vpn/x")

    addon.request(flow)

    token = WrdCodec().encrypt_host("jwxt.swufe.edu.cn")
    assert flow.request.host == WEBVPN_HOST
    assert flow.request.path == f"/http/{token}/xtgl/wengine-vpn/x"
    assert flow.metadata[METADATA_WRD_PREFIX] == f"/http/{token}"
    assert METADATA_GATEWAY_ROOT not in flow.metadata


def test_gateway_owned_path_on_non_allowlisted_host_is_untouched(
    addon_factory, flow_factory, capsys
) -> None:
    addon, _ = addon_factory(debug=True)
    flow = flow_factory("http://example.com/wengine-vpn/a")

    addon.request(flow)

    assert flow.request.url == "http://example.com/wengine-vpn/a"
    assert flow.metadata == {}
    assert debug_records(capsys)[-1]["detail"] == "not-allowlisted"


def test_plain_http_allowlisted_request_uses_http_scheme_token(addon_factory, flow_factory) -> None:
    addon, _ = addon_factory()
    flow = flow_factory("http://jwxt.swufe.edu.cn/x")

    addon.request(flow)

    token = WrdCodec().encrypt_host("jwxt.swufe.edu.cn")
    assert flow.request.path == f"/http/{token}/x"
    assert flow.request.scheme == "https"
    assert flow.request.port == 443
