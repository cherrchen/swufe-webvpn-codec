"""L1: reverse-rewrite rules (pure functions, T009–T011 logic layer)."""

from __future__ import annotations

import pytest
from mitmproxy.net.http.cookies import CookieAttrs

from swufe_bridge.rewrite import (
    REWRITABLE_CONTENT_TYPES,
    decode_wrd_reference,
    is_rewritable_content_type,
    rewrite_body_text,
    rewrite_location,
    rewrite_set_cookie_attrs,
    strip_wrd_prefix,
)
from swufe_bridge.wrd_codec import WrdCodec

WEBVPN_HOST = "webvpn.swufe.edu.cn"


@pytest.fixture
def token(codec: WrdCodec) -> str:
    return codec.encrypt_host("jwxt.swufe.edu.cn")


@pytest.fixture
def prefix(token: str) -> str:
    return f"/https/{token}"


def test_reference_forms_decode_to_absolute_urls(codec: WrdCodec, token: str) -> None:
    expected = "https://jwxt.swufe.edu.cn/main"

    for reference in (
        f"https://{WEBVPN_HOST}/https/{token}/main",
        f"//{WEBVPN_HOST}/https/{token}/main",
        f"/https/{token}/main",
        f"https://{WEBVPN_HOST}:8443/https/{token}/main",
    ):
        assert decode_wrd_reference(reference, codec, WEBVPN_HOST) == expected


def test_reference_keeps_query_and_fragment(codec: WrdCodec, token: str) -> None:
    decoded = decode_wrd_reference(
        f"/https/{token}/sso/jziotlogin?service=x%20y#frag", codec, WEBVPN_HOST
    )

    assert decoded == "https://jwxt.swufe.edu.cn/sso/jziotlogin?service=x%20y#frag"


@pytest.mark.parametrize(
    "reference",
    [
        "https://webvpn.swufe.edu.cn/login?service=http%3A%2F%2Fjwxt.swufe.edu.cn%2Fsso",
        "https://other.example/https/77726476706e69737468656265737421f1e2559434357a/",
        "https://jwxt.swufe.edu.cn/main",
        "/login",
        "",
        f"/ftp/{'0' * 34}/x",
        f"/https/{'f' * 34}/x",
    ],
)
def test_non_wrd_or_undecodable_references_are_left_alone(
    codec: WrdCodec, reference: str
) -> None:
    assert decode_wrd_reference(reference, codec, WEBVPN_HOST) is None
    assert rewrite_location(reference, codec, WEBVPN_HOST) == (reference, False)


def test_rewrite_location_reports_change(codec: WrdCodec, token: str) -> None:
    value, changed = rewrite_location(f"/https/{token}/main", codec, WEBVPN_HOST)

    assert changed is True
    assert value == "https://jwxt.swufe.edu.cn/main"


@pytest.mark.parametrize(
    ("path", "expected"),
    [
        ("/https/tok", "/"),
        ("/https/tok/app", "/app"),
        ("/https/tok/app/nested", "/app/nested"),
        ("/https/tok/", "/"),
        ("/application", None),
        ("", None),
    ],
)
def test_strip_wrd_prefix(path: str, expected: str | None) -> None:
    assert strip_wrd_prefix(path, "/https/tok") == expected


def test_strip_wrd_prefix_without_prefix_is_none() -> None:
    assert strip_wrd_prefix("/x", "") is None


def _attrs(**pairs: str | None) -> CookieAttrs:
    attrs = CookieAttrs()
    for key, value in pairs.items():
        attrs[key] = value  # type: ignore[assignment]
    return attrs


def test_set_cookie_domain_rewritten_only_for_webvpn_host(token: str) -> None:
    prefix = f"/https/{token}"

    webvpn_attrs = _attrs(domain="webvpn.swufe.edu.cn", path=prefix + "/app")
    assert rewrite_set_cookie_attrs(
        webvpn_attrs, original_host="jwxt.swufe.edu.cn", webvpn_host=WEBVPN_HOST, wrd_prefix=prefix
    )
    assert webvpn_attrs.get("domain") == "jwxt.swufe.edu.cn"
    assert webvpn_attrs.get("path") == "/app"

    subdomain_attrs = _attrs(domain=".WEBVPN.swufe.edu.cn")
    assert rewrite_set_cookie_attrs(
        subdomain_attrs,
        original_host="jwxt.swufe.edu.cn",
        webvpn_host=WEBVPN_HOST,
        wrd_prefix=prefix,
    )
    assert subdomain_attrs.get("domain") == "jwxt.swufe.edu.cn"

    broad_attrs = _attrs(domain=".swufe.edu.cn", path="/")
    assert not rewrite_set_cookie_attrs(
        broad_attrs, original_host="jwxt.swufe.edu.cn", webvpn_host=WEBVPN_HOST, wrd_prefix=prefix
    )
    assert broad_attrs.get("domain") == ".swufe.edu.cn"


def test_set_cookie_without_domain_or_path_is_untouched(token: str) -> None:
    attrs = _attrs(secure=None)

    assert not rewrite_set_cookie_attrs(
        attrs, original_host="jwxt.swufe.edu.cn", webvpn_host=WEBVPN_HOST, wrd_prefix=f"/https/{token}"
    )
    assert "domain" not in attrs


def test_body_text_rewrites_all_forms_and_counts(codec: WrdCodec, token: str) -> None:
    text = (
        f'<a href="/https/{token}/main">a</a>'
        f'<img src="https://{WEBVPN_HOST}/https/{token}/i.png">'
        f'<script>x = "//{WEBVPN_HOST}/https/{token}/js";</script>'
        f"<script>y = 'https:\\/\\/{WEBVPN_HOST}\\/https\\/{token}\\/esc';</script>"
        '<span>https://example.com/plain/nope</span>'
    )

    rewritten, count = rewrite_body_text(text, codec, WEBVPN_HOST)

    assert count == 4
    assert 'href="https://jwxt.swufe.edu.cn/main"' in rewritten
    assert f'src="https://jwxt.swufe.edu.cn/i.png"' in rewritten
    assert 'x = "https://jwxt.swufe.edu.cn/js"' in rewritten
    assert "<span>https://example.com/plain/nope</span>" in rewritten


def test_body_text_keeps_escaped_slashes(codec: WrdCodec, token: str) -> None:
    text = 'x = "\\/https\\/' + token + '\\/api\\/v1";'

    rewritten, count = rewrite_body_text(text, codec, WEBVPN_HOST)

    assert count == 1
    assert rewritten == 'x = "https:\\/\\/jwxt.swufe.edu.cn\\/api\\/v1";'


def test_body_text_without_webvpn_host_is_unchanged(codec: WrdCodec) -> None:
    text = '<a href="https://example.com/x">plain</a>'

    assert rewrite_body_text(text, codec, WEBVPN_HOST) == (text, 0)


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("text/html", True),
        ("TEXT/HTML; charset=GBK", True),
        ("application/javascript", True),
        ("text/javascript", True),
        ("application/json", True),
        ("text/css", False),
        ("image/png", False),
        ("application/octet-stream", False),
        ("", False),
        (None, False),
    ],
)
def test_is_rewritable_content_type(value: str | None, expected: bool) -> None:
    assert is_rewritable_content_type(value) is expected


def test_rewritable_content_types_are_exactly_the_documented_set() -> None:
    assert REWRITABLE_CONTENT_TYPES == {
        "text/html",
        "application/javascript",
        "text/javascript",
        "application/json",
    }
