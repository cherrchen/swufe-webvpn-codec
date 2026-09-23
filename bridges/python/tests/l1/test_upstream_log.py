"""L1: `bridge-upstream.log` — record shape, redaction, triggers and rotation.

The sink is the one piece of `KI-019` evidence that leaves the bridge, so its contract is
asserted here: a frozen key set, sanitized values (no URL, hence no WRD token), a record
whenever something is abnormal or slow, and a hard file-size cap.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from swufe_bridge import upstream

from tests.conftest import POSIX_FILE_MODES

LOG_NAME = "bridge-upstream.log"
STAGES = ("connect_start", "connect_done", "connect_timeout", "connect_retry", "connect_failed",
          "tls_start", "tls_done", "tls_failed", "response", "error")


@pytest.fixture
def log(tmp_path: Path) -> Path:
    return tmp_path / LOG_NAME


@pytest.fixture(autouse=True)
def _clean_upstream_state(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setattr(upstream, "_log_path", None)
    monkeypatch.setattr(upstream, "_log_bytes", 0)
    monkeypatch.setattr(upstream, "_debug", False)
    monkeypatch.setattr(upstream, "_policy_hosts", frozenset())


def lines(log: Path) -> list[dict[str, object]]:
    return [json.loads(line) for line in log.read_text(encoding="utf-8").splitlines() if line]


def test_every_record_has_exactly_the_documented_keys(log: Path) -> None:
    upstream.configure_log(log, debug=True)

    for stage in STAGES:
        upstream.record(stage, host="webvpn.swufe.edu.cn", addr="202.115.115.140:443", ms=1)

    entries = lines(log)
    assert [entry["stage"] for entry in entries] == list(STAGES)
    for entry in entries:
        assert list(entry) == ["ts", "stage", "host", "addr", "ms", "detail"]
        assert isinstance(entry["ts"], str)


def test_urls_in_details_are_dropped_so_wrd_tokens_cannot_leak(log: Path) -> None:
    upstream.configure_log(log, debug=True)

    upstream.record(
        "error",
        host="webvpn.swufe.edu.cn",
        addr="202.115.115.140:443",
        detail="connection failed http://127.0.0.1:8080/https/TOKEN-ABCDEF/x?service=jwxt",
    )

    text = log.read_text(encoding="utf-8")
    assert "http://" not in text
    assert "TOKEN-ABCDEF" not in text
    assert "connection failed" in text


def test_non_hostlike_host_and_addr_are_dropped(log: Path) -> None:
    upstream.configure_log(log, debug=True)

    upstream.record("error", host="https://webvpn.swufe.edu.cn/https/TOKEN/x", addr="/login?t=1")

    entry = lines(log)[0]
    assert entry["host"] is None
    assert entry["addr"] is None


def test_details_are_capped_and_control_characters_are_flattened(log: Path) -> None:
    upstream.configure_log(log, debug=True)

    upstream.record("error", detail="line\nbreak\x00" + "x" * 400)

    detail = lines(log)[0]["detail"]
    assert isinstance(detail, str)
    assert len(detail) == upstream.DETAIL_MAX
    assert "\n" not in detail and "\x00" not in detail


def test_with_debug_off_only_abnormal_or_slow_stages_are_written(log: Path) -> None:
    upstream.configure_log(log, debug=False)

    upstream.record("connect_start")
    upstream.record("connect_done", ms=10)
    upstream.record("response", ms=upstream.SLOW_MS)
    upstream.record("connect_timeout", ms=4000)
    upstream.record("error", detail="client disconnected")

    assert [entry["stage"] for entry in lines(log)] == ["response", "connect_timeout", "error"]


def test_with_debug_on_every_stage_is_written(log: Path) -> None:
    upstream.configure_log(log, debug=True)

    upstream.record("connect_start")
    upstream.record("connect_done", ms=2)

    assert [entry["stage"] for entry in lines(log)] == ["connect_start", "connect_done"]


def test_records_are_also_printed_to_stderr(capsys: pytest.CaptureFixture[str]) -> None:
    upstream.record("connect_timeout", host="webvpn.swufe.edu.cn", ms=4000)

    err = capsys.readouterr().err
    assert err.startswith("swufe-upstream ")
    assert json.loads(err[len("swufe-upstream ") :])["stage"] == "connect_timeout"


def test_the_log_is_capped_and_keeps_the_newest_records(log: Path) -> None:
    upstream.configure_log(log, debug=True)

    for index in range(1200):
        upstream.record("connect_start", host=f"host-{index}.swufe.edu.cn", detail="d" * 160)

    assert log.stat().st_size <= upstream.LOG_MAX_BYTES
    assert len(lines(log)) < 1200, "the file must have been rotated"
    assert lines(log)[-1]["host"] == "host-1199.swufe.edu.cn"


def test_an_unwritable_log_path_never_breaks_forwarding(tmp_path: Path) -> None:
    """Diagnostics are best-effort: a bad path must not raise into the proxy."""
    blocker = tmp_path / "not-a-directory"
    blocker.write_text("", encoding="utf-8")
    upstream.configure_log(blocker / LOG_NAME, debug=True)

    upstream.record("connect_timeout", host="webvpn.swufe.edu.cn", ms=4000)


def test_the_log_file_is_owner_only(log: Path) -> None:
    upstream.configure_log(log, debug=True)
    upstream.record("connect_start")

    if POSIX_FILE_MODES:
        assert (log.stat().st_mode & 0o777) == 0o600
