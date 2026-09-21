"""L1: debug log contract (TC-F04) and log minimization (INV-001)."""

from __future__ import annotations

import json

from mitmproxy import http

from swufe_bridge.addon import METADATA_WRD_PREFIX, BridgeAddon

SECRET_COOKIE = "SECRET-COOKIE"
SECRET_BODY = "SECRET-BODY"
RECORD_KEYS = {"ts", "host", "rewritten", "direction", "detail"}
DETAIL_MARKERS = {
    "not-allowlisted",
    "encode-failed",
    "location",
    "set-cookie",
    "body",
    "body-skipped",
    "no-wrd-match",
}


def records(stderr: str) -> list[dict[str, object]]:
    return [
        json.loads(line[len("swufe-debug ") :])
        for line in stderr.splitlines()
        if line.startswith("swufe-debug ")
    ]


def exercise(addon: BridgeAddon, flow) -> None:
    addon.request(flow)
    flow.response = http.Response.make(
        200,
        f'<a href="{flow.metadata[METADATA_WRD_PREFIX]}/page">{SECRET_BODY}</a>'.encode(),
        {
            "Content-Type": "text/html; charset=utf-8",
            "Location": f"{flow.metadata[METADATA_WRD_PREFIX]}/next",
            "Set-Cookie": f"S=1; Domain=webvpn.swufe.edu.cn; Path={flow.metadata[METADATA_WRD_PREFIX]}/app",
        },
    )
    addon.response(flow)


def test_debug_logging_is_off_by_default(addon_factory, flow_factory, capsys) -> None:
    addon, _ = addon_factory(cookies=[{"name": "sid", "value": SECRET_COOKIE}])
    flow = flow_factory("https://jwxt.swufe.edu.cn/main")

    exercise(addon, flow)

    assert "swufe-debug" not in capsys.readouterr().err


def test_debug_records_both_directions_with_the_contract_keys(
    addon_factory, flow_factory, capsys
) -> None:
    addon, _ = addon_factory(cookies=[{"name": "sid", "value": SECRET_COOKIE}], debug=True)
    flow = flow_factory("https://jwxt.swufe.edu.cn/main")

    exercise(addon, flow)

    stderr = capsys.readouterr().err
    logged = records(stderr)
    assert [record["direction"] for record in logged] == ["request", "response"]
    assert [record["rewritten"] for record in logged] == [True, True]
    assert logged[0]["host"] == "jwxt.swufe.edu.cn"
    assert logged[1]["host"] == "jwxt.swufe.edu.cn"
    assert logged[1]["detail"] == "location, set-cookie, body"
    for record in logged:
        assert set(record) == RECORD_KEYS
        assert record["detail"] is None or record["detail"] in DETAIL_MARKERS or "," in str(
            record["detail"]
        )
    assert SECRET_COOKIE not in stderr
    assert SECRET_BODY not in stderr


def test_non_allowlisted_flow_logs_no_wrd_detail(addon_factory, flow_factory, capsys) -> None:
    addon, _ = addon_factory(debug=True)
    flow = flow_factory("https://example.com/main")

    addon.request(flow)
    flow.response = http.Response.make(200, SECRET_BODY.encode(), {"Content-Type": "text/html"})
    addon.response(flow)

    stderr = capsys.readouterr().err
    logged = records(stderr)
    assert len(logged) == 1
    assert logged[0]["direction"] == "request"
    assert logged[0]["rewritten"] is False
    assert logged[0]["detail"] == "not-allowlisted"
    assert SECRET_BODY not in stderr
