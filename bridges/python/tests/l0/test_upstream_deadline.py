"""L0: bounded upstream connects and stage records (`KI-019`).

Injected and deterministic: the real `asyncio.open_connection` is replaced by a stub, so
nothing here touches the network. The module-level `record()` is exercised for real — the
records are read back from stderr, which is the only sink when no log path is configured.
"""

from __future__ import annotations

import asyncio
import json
import time

import pytest

from swufe_bridge import upstream

POLICY_HOST = "webvpn.swufe.edu.cn"
SHORT_TIMEOUT = 0.2


@pytest.fixture(autouse=True)
def _clean_upstream_state(monkeypatch: pytest.MonkeyPatch) -> None:
    """No policy host, no log file, default debug per test."""
    monkeypatch.setattr(upstream, "_policy_hosts", frozenset())
    monkeypatch.setattr(upstream, "_log_path", None)
    monkeypatch.setattr(upstream, "_debug", False)
    monkeypatch.setattr(upstream, "CONNECT_TIMEOUT_SECONDS", SHORT_TIMEOUT)


def records(capsys: pytest.CaptureFixture[str]) -> list[dict[str, object]]:
    return [
        json.loads(line[len("swufe-upstream ") :])
        for line in capsys.readouterr().err.splitlines()
        if line.startswith("swufe-upstream ")
    ]


def test_connect_timeout_is_retried_once_and_the_second_attempt_wins(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    calls: list[tuple[object, ...]] = []
    opened = object()

    async def stub(*args: object, **kwargs: object) -> object:
        calls.append(args)
        if len(calls) == 1:
            await asyncio.sleep(3600)  # only cancelled by the deadline
        return opened

    monkeypatch.setattr(upstream, "_orig_open_connection", stub)
    upstream.set_policy_hosts({POLICY_HOST})

    started = time.monotonic()
    result = asyncio.run(upstream._open_connection_with_deadline(POLICY_HOST, 443))
    elapsed = time.monotonic() - started

    assert result is opened
    assert len(calls) == 2, "the deadline must be retried exactly once"
    assert elapsed >= SHORT_TIMEOUT, "the first attempt has to be cut off by the deadline"
    assert elapsed < 2 * SHORT_TIMEOUT + 1
    entries = records(capsys)
    assert [entry["stage"] for entry in entries] == ["connect_timeout", "connect_retry"]
    assert {entry["addr"] for entry in entries} == {f"{POLICY_HOST}:443"}
    assert all(isinstance(entry["ms"], int) and entry["ms"] >= SHORT_TIMEOUT * 500 for entry in entries)


def test_all_attempts_timing_out_raise_timeout_error(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    calls = 0

    async def stub(*args: object, **kwargs: object) -> object:
        nonlocal calls
        calls += 1
        await asyncio.sleep(3600)
        raise AssertionError("unreachable")

    monkeypatch.setattr(upstream, "_orig_open_connection", stub)
    upstream.set_policy_hosts({POLICY_HOST})

    with pytest.raises(TimeoutError):
        asyncio.run(upstream._open_connection_with_deadline(POLICY_HOST, 443))

    assert calls == upstream.CONNECT_ATTEMPTS
    # mitmproxy turns this exception into `connect_failed` plus a 502 for the client,
    # so the bound has to end in a raised timeout rather than a silent return.
    assert [entry["stage"] for entry in records(capsys)] == [
        "connect_timeout",
        "connect_retry",
        "connect_timeout",
    ]


def test_hosts_outside_the_policy_are_passed_through_untouched(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    calls: list[tuple[object, ...]] = []
    opened = object()

    async def stub(*args: object, **kwargs: object) -> object:
        calls.append(args)
        return opened

    monkeypatch.setattr(upstream, "_orig_open_connection", stub)
    upstream.set_policy_hosts({POLICY_HOST})

    result = asyncio.run(
        upstream._open_connection_with_deadline("example.com", 80, local_addr=("127.0.0.1", 0))
    )

    assert result is opened
    assert calls == [("example.com", 80)]
    assert records(capsys) == [], "a non-policy host must not produce diagnostics"


def test_connect_errors_are_not_swallowed_or_converted(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    async def stub(*args: object, **kwargs: object) -> object:
        raise ConnectionRefusedError("refused")

    monkeypatch.setattr(upstream, "_orig_open_connection", stub)
    upstream.set_policy_hosts({POLICY_HOST})

    with pytest.raises(ConnectionRefusedError):
        asyncio.run(upstream._open_connection_with_deadline(POLICY_HOST, 443))

    assert records(capsys) == []


def test_keyword_arguments_are_accepted(monkeypatch: pytest.MonkeyPatch) -> None:
    """mitmproxy passes the address positionally, but the wrapper stays a drop-in."""
    seen: list[dict[str, object]] = []
    opened = object()

    async def stub(*args: object, **kwargs: object) -> object:
        seen.append(kwargs)
        return opened

    monkeypatch.setattr(upstream, "_orig_open_connection", stub)
    upstream.set_policy_hosts({POLICY_HOST})

    result = asyncio.run(
        upstream._open_connection_with_deadline(host=POLICY_HOST, port=443, local_addr=None)
    )

    assert result is opened
    assert seen == [{"host": POLICY_HOST, "port": 443, "local_addr": None}]


def test_install_connect_deadline_patches_asyncio_once() -> None:
    original = asyncio.open_connection
    was_installed = upstream._installed
    try:
        upstream._installed = False
        upstream.install_connect_deadline()
        upstream.install_connect_deadline()
        assert asyncio.open_connection is upstream._open_connection_with_deadline
        assert upstream._orig_open_connection is original, "the original must stay reachable"
    finally:
        asyncio.open_connection = original
        upstream._installed = was_installed
