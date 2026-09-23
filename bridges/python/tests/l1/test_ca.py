"""L1: standalone CA generation entry point (T022, TC-E01 prerequisite)."""

from __future__ import annotations

import json
import stat
from pathlib import Path

import pytest

from swufe_bridge.ca import ca_paths, ensure_ca, main

from tests.conftest import POSIX_FILE_MODES


def test_ensure_ca_creates_reusable_store_unmodified_on_second_call(tmp_path: Path) -> None:
    first = ensure_ca(tmp_path)
    snapshot = {name: path.read_bytes() for name, path in first.items() if path.exists()}
    stamps = {name: path.stat().st_mtime_ns for name, path in first.items() if path.exists()}

    second = ensure_ca(tmp_path)

    assert second == first
    assert (tmp_path / "mitmproxy-ca-cert.pem").exists()
    assert {name: path.read_bytes() for name, path in second.items() if path.exists()} == snapshot
    assert {name: path.stat().st_mtime_ns for name, path in second.items() if path.exists()} == stamps


def test_ca_private_key_is_owner_only(tmp_path: Path) -> None:
    paths = ensure_ca(tmp_path)

    if POSIX_FILE_MODES:
        assert stat.S_IMODE(paths["ca_pem"].stat().st_mode) == 0o600


def test_main_reports_created_ca_on_stdout(capsys: pytest.CaptureFixture[str], tmp_path: Path) -> None:
    code = main(["--confdir", str(tmp_path)])

    assert code == 0
    payload = json.loads(capsys.readouterr().out.strip())
    assert payload["caCert"] == str(ca_paths(tmp_path)["ca_cert_pem"])
    assert payload["caPem"] == str(ca_paths(tmp_path)["ca_pem"])
    assert payload["caCer"] == str(ca_paths(tmp_path)["ca_cert_cer"])
    assert payload["created"] is True
    assert Path(payload["caCert"]).exists()


def test_main_is_idempotent_and_reports_not_created(
    capsys: pytest.CaptureFixture[str], tmp_path: Path
) -> None:
    assert main(["--confdir", str(tmp_path)]) == 0
    capsys.readouterr()

    assert main(["--confdir", str(tmp_path)]) == 0

    assert json.loads(capsys.readouterr().out.strip())["created"] is False


def test_main_fails_when_confdir_is_a_file(capsys: pytest.CaptureFixture[str], tmp_path: Path) -> None:
    blocker = tmp_path / "not-a-directory"
    blocker.write_text("occupied", encoding="utf-8")

    assert main(["--confdir", str(blocker)]) == 2

    captured = capsys.readouterr()
    assert captured.out == ""
    assert "swufe-error CA_FAILED" in captured.err
