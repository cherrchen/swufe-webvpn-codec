"""Shared WRD vectors stay aligned with the Python codec (IOS-TC-A09)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from scripts.export_wrd_vectors import OUT, build_vectors
from swufe_bridge.wrd_codec import WrdCodec, WrdCodecError
from tests.conftest import SAMPLE_HOST_TOKEN


def test_committed_vectors_match_python_codec() -> None:
    fresh = build_vectors()
    committed = json.loads(OUT.read_text(encoding="utf-8"))
    assert committed == fresh
    assert committed["sampleHostToken"] == SAMPLE_HOST_TOKEN

    codec = WrdCodec()
    for case in committed["cases"]:
        op = case["op"]
        if op == "encryptHost":
            assert codec.encrypt_host(case["input"]) == case["output"]
        elif op == "encode":
            if "error" in case:
                with pytest.raises(WrdCodecError):
                    codec.encode_url(case["input"])
            else:
                assert codec.encode_url(case["input"]) == case["output"]
        elif op == "decode":
            if "error" in case:
                with pytest.raises(WrdCodecError):
                    codec.decode_url(case["input"])
            else:
                assert codec.decode_url(case["input"]) == case["output"]
        elif op == "decryptHost":
            with pytest.raises(WrdCodecError):
                codec.decrypt_host(case["input"])
        elif op == "construct":
            kwargs = {}
            if "key" in case:
                kwargs["key"] = case["key"]
            if "iv" in case:
                kwargs["iv"] = case["iv"]
            with pytest.raises(WrdCodecError):
                WrdCodec(**kwargs)
        else:
            raise AssertionError(op)


def test_vector_file_lives_in_the_js_package() -> None:
    assert Path(OUT).parts[-3:] == ("tests", "vectors", "wrd-codec.json")
