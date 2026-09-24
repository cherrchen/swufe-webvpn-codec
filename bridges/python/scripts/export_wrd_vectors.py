"""Export the shared WRD vectors consumed by packages/webvpn-core-js."""

from __future__ import annotations

import json
from pathlib import Path

from swufe_bridge.wrd_codec import DEFAULT_IV, DEFAULT_KEY, DEFAULT_WEBVPN_HOST, WrdCodec, WrdCodecError
from tests.conftest import SAMPLE_HOST, SAMPLE_HOST_TOKEN, SAMPLE_WEBVPN_URL

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "packages" / "webvpn-core-js" / "tests" / "vectors" / "wrd-codec.json"


def _case(case_id: str, op: str, **fields: object) -> dict[str, object]:
    return {"id": case_id, "op": op, **fields}


def build_vectors() -> dict[str, object]:
    codec = WrdCodec()
    ordinary = [
        "https://jwxt.swufe.edu.cn/sso/jziotlogin",
        "http://host:8080/x",
        "https://host:443/x",
        "https://host:8443/x?q=1#frag",
        "https://jwxt.swufe.edu.cn/a/b?service=http%3A%2F%2Fx%2Fy#s",
        SAMPLE_WEBVPN_URL.replace("https://webvpn.swufe.edu.cn", "https://placeholder"),
    ]
    # The last placeholder is not an ordinary URL we encode; keep explicit cases only.
    del ordinary[-1]
    cases: list[dict[str, object]] = [
        _case("encrypt-authserver", "encryptHost", input=SAMPLE_HOST, output=codec.encrypt_host(SAMPLE_HOST)),
        _case("encrypt-jwxt", "encryptHost", input="jwxt.swufe.edu.cn", output=codec.encrypt_host("jwxt.swufe.edu.cn")),
        _case("decode-captured", "decode", input=SAMPLE_WEBVPN_URL, output=codec.decode_url(SAMPLE_WEBVPN_URL)),
    ]
    for index, url in enumerate(ordinary, start=1):
        encoded = codec.encode_url(url)
        cases.append(_case(f"encode-{index}", "encode", input=url, output=encoded))
        cases.append(_case(f"roundtrip-{index}", "decode", input=encoded, output=codec.decode_url(encoded)))
    cases.extend(
        [
            _case("bad-key-short", "construct", key="short", error="INVALID_KEY"),
            _case("bad-key-long", "construct", key="seventeen-bytes!!", error="INVALID_KEY"),
            _case("bad-iv-short", "construct", iv="short", error="INVALID_IV"),
            _case("bad-token-short", "decryptHost", input="abc", error="INVALID_TOKEN"),
            _case("bad-token-odd", "decryptHost", input="0" * 33, error="INVALID_TOKEN"),
            _case("bad-token-nonhex", "decryptHost", input="z" * 34, error="INVALID_TOKEN"),
            _case("bad-scheme", "encode", input="ftp://host/x", error="UNSUPPORTED_SCHEME"),
            _case("missing-host", "encode", input="https:///x", error="INVALID_URL"),
            _case("bad-wrd-path", "decode", input="https://webvpn.swufe.edu.cn/login", error="INVALID_URL"),
        ]
    )
    return {
        "version": 1,
        "key": DEFAULT_KEY,
        "iv": DEFAULT_IV,
        "gatewayHost": DEFAULT_WEBVPN_HOST,
        "sampleHostToken": SAMPLE_HOST_TOKEN,
        "cases": cases,
    }


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    payload = build_vectors()
    OUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(OUT)


if __name__ == "__main__":
    try:
        main()
    except WrdCodecError as exc:
        raise SystemExit(f"vector export failed: {exc}") from exc
