"""L2: upstream stall behaviour of the real bridge (`KI-019`).

Two things are proven against a real mitmdump + curl, without any campus network:

* an unreachable gateway makes the client fail **within the connect bound** (a `502`
  response, not an empty wait), and the failure is visible in `bridge-upstream.log`;
* the response stage is observable when upstream answers slowly, and the
  connected-but-silent case — the shape of the historical stall — leaves a record too.

The harness (`scripts/diagnose-upstream.ts`) is what distinguishes a local from an
external cause on a live session; these tests pin the bridge-side contract it relies on.
"""

from __future__ import annotations

import json
import shutil
import socket
import time
from contextlib import contextmanager
from collections.abc import Iterator
from http.server import BaseHTTPRequestHandler
from pathlib import Path

import pytest

from swufe_bridge import upstream
from swufe_bridge.config import write_runtime_config

from tests.conftest import runtime_config
from tests.l2.test_proxy_end_to_end import (  # noqa: F401 - shared fixtures/helpers
    ALLOWLISTED_HOST,
    FakeUpstream,
    Sidecar,
    curl,
    free_port,
    wait_for_ca,
)

pytestmark = pytest.mark.skipif(shutil.which("curl") is None, reason="curl is required")

SLOW_RESPONSE_SECONDS = upstream.SLOW_MS / 1000 + 0.5
SILENT_UPSTREAM_SECONDS = 30


class ClosingHandler(BaseHTTPRequestHandler):
    """Accepts the request, then closes without sending an HTTP response."""

    def log_message(self, fmt: str, *args: object) -> None:
        pass

    def do_GET(self) -> None:  # noqa: N802 - http.server API
        self.close_connection = True


class SlowHandler(BaseHTTPRequestHandler):
    """Answers correctly, but only after the response stage has become slow."""

    protocol_version = "HTTP/1.1"

    def log_message(self, fmt: str, *args: object) -> None:  # silence test output
        pass

    def do_GET(self) -> None:  # noqa: N802 - http.server API
        time.sleep(SLOW_RESPONSE_SECONDS)
        body = b"SLOW-OK"
        self.send_response(200)
        self.send_header("Content-Type", "text/plain")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


class SilentHandler(BaseHTTPRequestHandler):
    """Accepts the connection and never sends a byte — the historical stall shape."""

    protocol_version = "HTTP/1.1"

    def log_message(self, fmt: str, *args: object) -> None:  # silence test output
        pass

    def do_GET(self) -> None:  # noqa: N802 - http.server API
        time.sleep(SILENT_UPSTREAM_SECONDS)


@contextmanager
def running_bridge(
    tmp_path: Path, webvpn_base: str, *, debug: bool = False
) -> Iterator[tuple[int, Path]]:
    """A real sidecar whose WebVPN base points at ``webvpn_base``."""
    port = free_port()
    confdir = tmp_path / "mitmproxy"
    config_path = tmp_path / "bridge-config.json"
    write_runtime_config(
        config_path,
        runtime_config(
            allowlist={"hosts": [ALLOWLISTED_HOST], "includeSwufeWildcard": False},
            cookies=[],
            debug=debug,
            webvpnBase=webvpn_base,
        ),
    )
    sidecar = Sidecar(config_path, port, confdir)
    try:
        sidecar.wait_ready(port)
        yield port, wait_for_ca(confdir)
    finally:
        sidecar.stop()


def records(tmp_path: Path) -> list[dict[str, object]]:
    log = tmp_path / upstream.UPSTREAM_LOG_FILENAME
    if not log.exists():
        return []
    return [json.loads(line) for line in log.read_text(encoding="utf-8").splitlines() if line]


def test_an_unreachable_gateway_gives_the_client_a_bounded_failure(tmp_path: Path) -> None:
    # Reserve a local port without listening, so it cannot accept TCP and no
    # other server can take the port while the bridge starts. A TEST-NET address
    # can be intercepted by the network and accept TCP before closing instead.
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as refused:
        refused.bind(("127.0.0.1", 0))
        upstream_addr = f"127.0.0.1:{refused.getsockname()[1]}"
        with running_bridge(tmp_path, f"http://{upstream_addr}") as (port, ca):
            started = time.monotonic()
            result = curl(
                "--include",
                "--proxy",
                f"http://127.0.0.1:{port}",
                "--cacert",
                str(ca),
                "-m",
                "20",
                f"http://{ALLOWLISTED_HOST}/",
            )
            elapsed = time.monotonic() - started

    assert result.returncode == 0, f"the client must get a response, not a timeout: {result.stderr}"
    assert result.stdout.splitlines()[0].startswith("HTTP/1.1 502"), result.stdout
    assert elapsed <= 2 * upstream.CONNECT_TIMEOUT_SECONDS + 4, (
        f"the failure must be bounded, took {elapsed:.1f}s"
    )

    entries = records(tmp_path)
    stages = [entry["stage"] for entry in entries]
    assert "connect_failed" in stages, stages
    assert "connect_done" not in stages, stages
    # Depending on the OS, a bound but non-listening socket refuses or times out.
    if "connect_timeout" in stages:
        assert stages.index("connect_timeout") < stages.index("connect_failed")
        assert "connect_retry" in stages, "a timed-out attempt must be retried"
    assert any(entry["addr"] == upstream_addr for entry in entries), entries


def test_a_gateway_closing_before_response_reports_a_response_stage_error(tmp_path: Path) -> None:
    closing = FakeUpstream(ClosingHandler)
    try:
        with running_bridge(tmp_path, f"http://127.0.0.1:{closing.port}", debug=True) as (port, ca):
            started = time.monotonic()
            result = curl(
                "--include",
                "--proxy",
                f"http://127.0.0.1:{port}",
                "--cacert",
                str(ca),
                "-m",
                "20",
                f"http://{ALLOWLISTED_HOST}/",
            )
            elapsed = time.monotonic() - started
    finally:
        closing.stop()

    assert result.returncode == 0, result.stderr
    assert result.stdout.splitlines()[0].startswith("HTTP/1.1 502"), result.stdout
    assert elapsed <= 2 * upstream.CONNECT_TIMEOUT_SECONDS + 4
    entries = records(tmp_path)
    stages = [entry["stage"] for entry in entries]
    assert "connect_done" in stages, entries
    assert "error" in stages, entries
    assert stages.index("connect_done") < stages.index("error"), entries
    assert "connect_failed" not in stages, entries
    assert "response" not in stages, entries


def test_a_slow_but_answering_gateway_shows_up_as_a_response_record(tmp_path: Path) -> None:
    slow = FakeUpstream(SlowHandler)
    try:
        with running_bridge(tmp_path, f"http://127.0.0.1:{slow.port}") as (port, ca):
            result = curl(
                "--proxy",
                f"http://127.0.0.1:{port}",
                "--cacert",
                str(ca),
                "-m",
                "20",
                f"http://{ALLOWLISTED_HOST}/",
            )
    finally:
        slow.stop()

    assert result.returncode == 0, result.stderr
    assert result.stdout == "SLOW-OK"

    entries = records(tmp_path)
    responses = [entry for entry in entries if entry["stage"] == "response"]
    assert responses, f"a slow response must be recorded: {entries}"
    assert all(
        isinstance(entry["ms"], int) and entry["ms"] >= upstream.SLOW_MS for entry in responses
    ), responses
    assert responses[-1]["host"] == ALLOWLISTED_HOST
    assert responses[-1]["detail"] == "status=200"


def test_a_connected_but_silent_gateway_is_visible(tmp_path: Path) -> None:
    """The stage that mitmproxy cannot bound (`flow.kill` does not abort in-flight flows)
    still has to leave evidence once the client gives up."""
    silent = FakeUpstream(SilentHandler)
    try:
        with running_bridge(tmp_path, f"http://127.0.0.1:{silent.port}", debug=True) as (port, ca):
            result = curl(
                "--proxy",
                f"http://127.0.0.1:{port}",
                "--cacert",
                str(ca),
                "-m",
                "6",
                f"http://{ALLOWLISTED_HOST}/",
            )
    finally:
        silent.stop()

    assert result.returncode == 28, result.stderr  # the client times out: bridge-side bound is not at play
    entries = records(tmp_path)
    stages = [entry["stage"] for entry in entries]
    assert "connect_done" in stages, f"the connect must be visible: {entries}"
    assert "response" not in stages, f"nothing was ever answered here: {entries}"
    assert "error" in stages, f"the stalled response stage must be visible: {entries}"
