"""L1: response reverse rewriting — Location, Set-Cookie and body (T009–T011)."""

from __future__ import annotations

import gzip

import pytest
from mitmproxy import http

from swufe_bridge.addon import METADATA_ORIGINAL_URL, METADATA_WRD_PREFIX, BridgeAddon
from swufe_bridge.wrd_codec import WrdCodec
from tests.conftest import runtime_config

WEBVPN_HOST = "webvpn.swufe.edu.cn"
CHINESE_TEXT = "教务"

# The gateway's client-shim bootstrap document (KI-011): both markers, 925 B live.
BOOTSTRAP_BODY = (
    b'<html><head><script>var __vpn_protocol_host="https://webvpn.swufe.edu.cn";</script>'
    b'<script src="/wengine-vpn/js/main.js?ver=20211207"></script></head><body></body></html>'
)


@pytest.fixture
def token() -> str:
    return WrdCodec().encrypt_host("jwxt.swufe.edu.cn")


@pytest.fixture
def rewritten_flow(addon, flow_factory):
    """A flow already rewritten for the WebVPN host, ready to carry a response."""

    def _make(url: str = "https://jwxt.swufe.edu.cn/main") -> http.HTTPFlow:
        flow = flow_factory(url)
        addon.request(flow)
        return flow

    return _make


def respond(flow: http.HTTPFlow, addon: BridgeAddon, response: http.Response) -> None:
    flow.response = response
    addon.response(flow)


def set_location(flow: http.HTTPFlow, addon: BridgeAddon, value: str) -> str | None:
    respond(flow, addon, http.Response.make(302, b"", {"Location": value}))
    return flow.response.headers.get("location")


@pytest.mark.parametrize(
    ("location", "expected"),
    [
        ("https://webvpn.swufe.edu.cn/https/{token}/main", "https://jwxt.swufe.edu.cn/main"),
        ("//webvpn.swufe.edu.cn/https/{token}/main", "https://jwxt.swufe.edu.cn/main"),
        ("/https/{token}/main", "https://jwxt.swufe.edu.cn/main"),
        (
            "https://webvpn.swufe.edu.cn/login?service=http%3A%2F%2Fjwxt.swufe.edu.cn",
            "https://webvpn.swufe.edu.cn/login?service=http%3A%2F%2Fjwxt.swufe.edu.cn",
        ),
        ("https://other.example/x", "https://other.example/x"),
    ],
)
def test_tc_f03_location_is_reversed(
    addon, rewritten_flow, token: str, location: str, expected: str
) -> None:
    flow = rewritten_flow()

    assert set_location(flow, addon, location.format(token=token)) == expected


def test_set_cookie_attributes_are_reversed_for_the_original_host(
    addon, rewritten_flow, token: str
) -> None:
    flow = rewritten_flow()
    respond(
        flow,
        addon,
        http.Response.make(
            200,
            b"",
            {
                "Set-Cookie": (
                    f"SESS=1; Domain=webvpn.swufe.edu.cn; Path=/https/{token}/app; HttpOnly, "
                    "A=2; Domain=.swufe.edu.cn; Path=/, "
                    f"B=3; Path=/https/{token}"
                )
            },
        ),
    )

    assert flow.response.headers.get_all("set-cookie") == [
        "SESS=1; Domain=jwxt.swufe.edu.cn; Path=/app; HttpOnly",
        "A=2; Domain=.swufe.edu.cn; Path=/",
        "B=3; Path=/",
    ]


def test_set_cookie_without_relevant_attributes_is_untouched(addon, rewritten_flow) -> None:
    flow = rewritten_flow()
    respond(
        flow,
        addon,
        http.Response.make(200, b"", {"Set-Cookie": "PLAIN=1; Secure; SameSite=Lax"}),
    )

    assert flow.response.headers.get_all("set-cookie") == ["PLAIN=1; Secure; SameSite=Lax"]


@pytest.mark.parametrize(
    "content_type",
    ["text/html; charset=utf-8", "text/html", "text/javascript", "application/javascript", "application/json"],
)
def test_body_urls_are_reversed_for_rewritable_types(
    addon, rewritten_flow, token: str, content_type: str
) -> None:
    flow = rewritten_flow()
    body = (
        f'<a href="/https/{token}/page">x</a>'
        f'"https://webvpn.swufe.edu.cn/https/{token}/abs"'
    ).encode()

    respond(flow, addon, http.Response.make(200, body, {"Content-Type": content_type}))

    text = flow.response.raw_content.decode()
    assert 'href="https://jwxt.swufe.edu.cn/page"' in text
    assert '"https://jwxt.swufe.edu.cn/abs"' in text
    assert int(flow.response.headers["content-length"]) == len(flow.response.raw_content)


def test_json_and_javascript_escaped_slashes_are_reversed(addon, rewritten_flow, token: str) -> None:
    flow = rewritten_flow()
    body = ('x = "\\/https\\/' + token + '\\/api";').encode()

    respond(flow, addon, http.Response.make(200, body, {"Content-Type": "application/javascript"}))

    assert flow.response.get_text(strict=True) == 'x = "https:\\/\\/jwxt.swufe.edu.cn\\/api";'


@pytest.mark.parametrize("content_type", ["image/png", "text/css", "application/octet-stream"])
def test_bodies_with_other_content_types_pass_through(
    addon, rewritten_flow, token: str, content_type: str
) -> None:
    flow = rewritten_flow()
    body = f'<a href="/https/{token}/page">x</a>'.encode()

    respond(flow, addon, http.Response.make(200, body, {"Content-Type": content_type}))

    assert flow.response.raw_content == body


def test_gzip_encoded_body_is_rewritten_and_recompressed(addon, rewritten_flow, token: str) -> None:
    flow = rewritten_flow()
    html = f'<a href="/https/{token}/page">x</a>'
    response = http.Response.make(200, b"", {"Content-Type": "text/html; charset=utf-8", "Content-Encoding": "gzip"})
    response.content = html.encode()
    assert response.raw_content.startswith(b"\x1f\x8b")

    respond(flow, addon, response)

    assert flow.response.raw_content.startswith(b"\x1f\x8b")
    assert gzip.decompress(flow.response.raw_content).decode() == '<a href="https://jwxt.swufe.edu.cn/page">x</a>'


def test_gbk_body_stays_gbk(addon, rewritten_flow, token: str) -> None:
    flow = rewritten_flow()
    html = f'<a href="/https/{token}/page">{CHINESE_TEXT}</a>'
    response = http.Response.make(
        200, html.encode("gbk"), {"Content-Type": "text/html; charset=gbk"}
    )

    respond(flow, addon, response)

    assert flow.response.raw_content.decode("gbk") == f'<a href="https://jwxt.swufe.edu.cn/page">{CHINESE_TEXT}</a>'
    with pytest.raises(UnicodeDecodeError):
        flow.response.raw_content.decode("utf-8")


def test_undecodable_body_is_skipped_while_headers_are_still_rewritten(
    addon, rewritten_flow, token: str
) -> None:
    flow = rewritten_flow()
    # No charset declared and not valid UTF-8: the body cannot be decoded safely.
    body = f'<a href="/https/{token}/page">{CHINESE_TEXT}</a>'.encode("gbk")
    respond(
        flow,
        addon,
        http.Response.make(
            302, body, {"Content-Type": "text/html", "Location": f"/https/{token}/main"}
        ),
    )

    assert flow.response.raw_content == body
    assert flow.response.headers["location"] == "https://jwxt.swufe.edu.cn/main"


def test_body_encoded_with_a_foreign_key_is_left_alone(addon_factory, flow_factory, config_path) -> None:
    addon, _ = addon_factory()
    flow = flow_factory("https://jwxt.swufe.edu.cn/main")
    addon.request(flow)
    foreign = BridgeAddon(
        config_path(
            runtime_config(wrdKey="0123456789abcdef", wrdIv="0123456789abcdef"),
            name="foreign.json",
        )
    )
    body = f'<a href="{flow.metadata[METADATA_WRD_PREFIX]}/page">x</a>'.encode()

    respond(flow, foreign, http.Response.make(200, body, {"Content-Type": "text/html; charset=utf-8"}))

    assert flow.response.raw_content == body


def test_client_initiated_webvpn_traffic_is_never_reversed(addon, flow_factory, token: str) -> None:
    flow = flow_factory(f"https://{WEBVPN_HOST}/https/{token}/x")
    body = f'<a href="/https/{token}/page">x</a>'.encode()
    response = http.Response.make(
        200,
        body,
        {
            "Content-Type": "text/html; charset=utf-8",
            "Location": f"/https/{token}/main",
            "Set-Cookie": f"S=1; Domain={WEBVPN_HOST}; Path=/https/{token}/app",
        },
    )

    respond(flow, addon, response)

    assert flow.response.raw_content == body
    assert flow.response.headers["location"] == f"/https/{token}/main"
    assert flow.response.headers["set-cookie"] == f"S=1; Domain={WEBVPN_HOST}; Path=/https/{token}/app"


def test_response_without_a_body_is_handled(rewritten_flow, addon) -> None:
    flow = rewritten_flow()
    respond(flow, addon, http.Response.make(204, b"", {"Content-Type": "text/html; charset=utf-8"}))

    assert flow.response.status_code == 204


def test_gateway_owned_response_is_not_reverse_rewritten(addon, rewritten_flow, token: str) -> None:
    """The shim runtime must reach the browser byte-identical (KI-011)."""
    flow = rewritten_flow("http://jwxt.swufe.edu.cn/wengine-vpn/js/main.js?ver=20211207")
    body = f'var u = "\\/https\\/{token}\\/api";'.encode()

    respond(flow, addon, http.Response.make(200, body, {"Content-Type": "application/javascript"}))

    assert flow.response.raw_content == body
    assert flow.response.headers.get("location") is None


def test_bootstrap_document_is_promoted(addon, rewritten_flow) -> None:
    flow = rewritten_flow()
    respond(flow, addon, http.Response.make(200, BOOTSTRAP_BODY, {"Content-Type": "text/html"}))

    assert flow.response.status_code == 302
    assert flow.response.headers["location"] == WrdCodec().encode_url(
        flow.metadata[METADATA_ORIGINAL_URL], webvpn_base="https://webvpn.swufe.edu.cn"
    )
    assert flow.response.headers["cache-control"] == "no-store"


def test_site_page_with_injected_shim_is_not_promoted(addon, rewritten_flow) -> None:
    """A real page carries the same injection on far more bytes: it stays ordinary."""
    flow = rewritten_flow()
    body = b"<html><body>" + b"x" * 20000 + BOOTSTRAP_BODY + b"</body></html>"

    respond(flow, addon, http.Response.make(200, body, {"Content-Type": "text/html; charset=utf-8"}))

    assert flow.response.status_code == 200
    assert flow.response.headers.get("cache-control") is None
    assert flow.response.raw_content == body
