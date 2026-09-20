"""L0: WRD codec vectors (TC-A01..TC-A05) and error branches (REQ-006 / NFR-002)."""

from __future__ import annotations

from urllib.parse import urlparse

import pytest

from swufe_bridge.wrd_codec import (
    DEFAULT_IV,
    DEFAULT_KEY,
    DEFAULT_WEBVPN_HOST,
    WrdCodec,
    WrdCodecError,
)
from tests.conftest import SAMPLE_HOST, SAMPLE_HOST_TOKEN, SAMPLE_QUERY, SAMPLE_WEBVPN_URL


def test_defaults() -> None:
    assert DEFAULT_KEY == DEFAULT_IV == "wrdvpnisthebest!"
    assert DEFAULT_WEBVPN_HOST == "webvpn.swufe.edu.cn"


def test_tc_a01_decode_sample_url(codec: WrdCodec) -> None:
    decoded = codec.decode_url(SAMPLE_WEBVPN_URL)

    parsed = urlparse(decoded)
    assert parsed.hostname == SAMPLE_HOST
    assert parsed.path == "/authserver/login"
    assert parsed.query == SAMPLE_QUERY


def test_tc_a02_encrypt_host_matches_captured_token(codec: WrdCodec) -> None:
    # Gate for CFB128: a segment-size mismatch would produce a different token.
    assert codec.encrypt_host(SAMPLE_HOST) == SAMPLE_HOST_TOKEN


def test_tc_a03_encode_jwxt_round_trip(codec: WrdCodec) -> None:
    ordinary = "https://jwxt.swufe.edu.cn/sso/jziotlogin"

    encoded = codec.encode_url(ordinary)

    assert encoded == (
        f"https://webvpn.swufe.edu.cn/https/{codec.encrypt_host('jwxt.swufe.edu.cn')}"
        "/sso/jziotlogin"
    )
    assert codec.decode_url(encoded) == ordinary


@pytest.mark.parametrize(
    ("ordinary", "scheme_token", "expected_round_trip"),
    [
        ("http://host:8080/x", "http-8080", "http://host:8080/x"),
        ("https://host:443/x", "https", "https://host/x"),
        ("https://host:8000/x", "https-8000", "https://host:8000/x"),
    ],
)
def test_tc_a04_port_forms(
    codec: WrdCodec, ordinary: str, scheme_token: str, expected_round_trip: str
) -> None:
    encoded = codec.encode_url(ordinary)

    assert f"/{scheme_token}/{codec.encrypt_host('host')}/x" in encoded
    assert codec.decode_url(encoded) == expected_round_trip


def test_tc_a05_wrong_key_does_not_yield_the_real_host() -> None:
    codec = WrdCodec(key=b"wrongkeywrongkey", iv=b"wrongkeywrongkey")

    try:
        decoded = codec.decrypt_host(SAMPLE_HOST_TOKEN)
    except WrdCodecError:
        return
    assert decoded != SAMPLE_HOST


@pytest.mark.parametrize("key", ["short", "seventeen-bytes!!"])
def test_key_must_be_16_bytes(key: str) -> None:
    with pytest.raises(WrdCodecError, match="key must be 16 bytes"):
        WrdCodec(key=key)


@pytest.mark.parametrize("iv", ["short", "seventeen-bytes!!"])
def test_iv_must_be_16_bytes(iv: str) -> None:
    with pytest.raises(WrdCodecError, match="IV must be 16 bytes"):
        WrdCodec(iv=iv)


@pytest.mark.parametrize("token", ["", "abc", "0" * 33, "0" * 35, "z" * 34])
def test_bad_host_token(codec: WrdCodec, token: str) -> None:
    with pytest.raises(WrdCodecError):
        codec.decrypt_host(token)


def test_encode_url_rejects_non_http_scheme(codec: WrdCodec) -> None:
    with pytest.raises(WrdCodecError, match="unsupported scheme"):
        codec.encode_url("ftp://host/x")


def test_encode_url_requires_hostname(codec: WrdCodec) -> None:
    with pytest.raises(WrdCodecError, match="missing hostname"):
        codec.encode_url("https:///x")


@pytest.mark.parametrize(
    "webvpn_url",
    [
        "https://webvpn.swufe.edu.cn/login",
        "https://webvpn.swufe.edu.cn/login/longer/path",
        "https://webvpn.swufe.edu.cn/https",
    ],
)
def test_decode_url_rejects_non_wrd_paths(codec: WrdCodec, webvpn_url: str) -> None:
    with pytest.raises(WrdCodecError):
        codec.decode_url(webvpn_url)


def test_decode_url_rejects_bad_scheme_token(codec: WrdCodec) -> None:
    url = f"https://webvpn.swufe.edu.cn/ftp/{SAMPLE_HOST_TOKEN}/x"

    with pytest.raises(WrdCodecError, match="bad scheme token"):
        codec.decode_url(url)
