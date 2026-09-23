"""L2: end-to-end bridge — real mitmdump sidecar + curl + fake upstreams.

Covers TC-F01 (allowlisted host reaches the WebVPN upstream in WRD form with the
session cookie), TC-F02 (non-allowlisted host is passed through untouched),
TC-F04 (debug log contract, no secrets), EC-006 (empty allowlist refuses to
start) and the loopback-only listener constraint.
"""

from __future__ import annotations

import json
import re
import shutil
import socket
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import pytest

from swufe_bridge.config import write_runtime_config
from swufe_bridge.wrd_codec import WrdCodec
from tests.conftest import runtime_config

pytestmark = pytest.mark.skipif(shutil.which("curl") is None, reason="curl is required")

ALLOWLISTED_HOST = "jwxt.swufe.edu.cn"
SESSION_VALUE = "SESSION-VALUE"
DIRECT_BODY = "DIRECT-BODY-MARKER"
SHIM_BODY = "SHIM-BODY"
# The gateway's client-shim bootstrap document (KI-011): both markers, under the cap.
BOOTSTRAP_BODY = (
    b'<html><head><script>var __vpn_protocol_host="http://127.0.0.1";</script>'
    b'<script src="/wengine-vpn/js/main.js?ver=20211207"></script></head><body></body></html>'
)
CURL_TIMEOUT = 30
READY_TIMEOUT = 30


class _QuietHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args) -> None:  # silence test output
        pass

    def send_body(self, status: int, content_type: str, body: bytes) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


class WebVPNHandler(_QuietHandler):
    def do_GET(self) -> None:  # noqa: N802 - http.server API
        server = self.server
        server.requests.append((self.path, self.headers.get("Cookie")))
        if self.path.startswith("/wengine-vpn/"):
            # Gateway-owned namespace, served from the gateway root (KI-011).
            self.send_body(200, "application/javascript", SHIM_BODY.encode())
            return
        if self._is_site_root():
            # What the gateway returns for a proxied site root: the shim bootstrap page.
            self.send_body(200, "text/html; charset=utf-8", BOOTSTRAP_BODY)
            return
        prefix = "/" + "/".join(self.path.lstrip("/").split("/", 2)[:2])
        self.send_response(302)
        self.send_header("Location", f"{prefix}/next")
        self.send_header("Set-Cookie", "UPSTREAM=1; Domain=.swufe.edu.cn; Path=/")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def _is_site_root(self) -> bool:
        """``/https/<token>/`` of the allowlisted host, without a further path segment."""
        parts = self.path.strip("/").split("/")
        if len(parts) != 2:
            return False
        scheme_token, token = parts
        if scheme_token not in ("http", "https"):
            return False
        try:
            return WrdCodec().decrypt_host(token) == ALLOWLISTED_HOST
        except Exception:  # not a WRD token at all
            return False


class DirectHandler(_QuietHandler):
    def do_GET(self) -> None:  # noqa: N802 - http.server API
        self.server.requests.append((self.path, self.headers.get("Cookie")))
        body = DIRECT_BODY.encode()
        self.send_response(200)
        self.send_header("Content-Type", "text/plain")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


class FakeUpstream:
    def __init__(self, handler) -> None:
        self.requests: list[tuple[str, str | None]] = []
        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), handler)
        self.httpd.requests = self.requests  # type: ignore[attr-defined]
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.thread.start()

    @property
    def port(self) -> int:
        return self.httpd.server_address[1]

    def stop(self) -> None:
        self.httpd.shutdown()
        self.httpd.server_close()


class Sidecar:
    """The real bridge process, driven the way M2 will drive it (spawn/kill + stderr)."""

    def __init__(self, config_path: Path, port: int, confdir: Path) -> None:
        self.stderr_lines: list[str] = []
        self.proc = subprocess.Popen(
            [
                sys.executable,
                "-m",
                "swufe_bridge.sidecar",
                "--config",
                str(config_path),
                "--port",
                str(port),
                "--confdir",
                str(confdir),
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
        )
        assert self.proc.stderr is not None
        self._reader = threading.Thread(target=self._drain, args=(self.proc.stderr,), daemon=True)
        self._reader.start()

    def _drain(self, stream) -> None:
        for line in stream:
            self.stderr_lines.append(line.rstrip("\n"))

    @property
    def stderr(self) -> str:
        return "\n".join(self.stderr_lines)

    def wait_ready(self, port: int) -> dict[str, object]:
        deadline = time.monotonic() + READY_TIMEOUT
        while time.monotonic() < deadline:
            ready = [line for line in self.stderr_lines if line.startswith("swufe-ready ")]
            if ready and self._accepts_connection(port):
                return json.loads(ready[0][len("swufe-ready ") :])
            assert self.proc.poll() is None, f"sidecar exited early:\n{self.stderr}"
            time.sleep(0.1)
        raise AssertionError(f"sidecar never became ready:\n{self.stderr}")

    @staticmethod
    def _accepts_connection(port: int) -> bool:
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=1):
                return True
        except OSError:
            return False

    def stop(self) -> None:
        self.proc.terminate()
        try:
            self.proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            self.proc.kill()
            self.proc.wait(timeout=10)


def free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def wait_for_ca(confdir: Path) -> Path:
    deadline = time.monotonic() + READY_TIMEOUT
    while time.monotonic() < deadline:
        candidates = sorted(confdir.glob("mitmproxy-ca-cert*"))
        if candidates:
            return candidates[0]
        time.sleep(0.1)
    raise AssertionError(f"no mitmproxy CA in {confdir}: {sorted(confdir.iterdir())}")


def curl(*args: str) -> subprocess.CompletedProcess[str]:
    # Windows' curl uses Schannel, which refuses the freshly generated MITM leaf with
    # exit 60 ("the revocation status is unknown"); the flag is Schannel-only, so it is
    # passed on Windows only. See the Windows acceptance run in specs/001/verification.md.
    schannel = ["--ssl-no-revoke"] if sys.platform == "win32" else []
    return subprocess.run(
        ["curl", "--silent", "--show-error", *schannel, *args],
        capture_output=True,
        text=True,
        timeout=CURL_TIMEOUT,
    )


def debug_records(stderr: str) -> list[dict[str, object]]:
    return [
        json.loads(line[len("swufe-debug ") :])
        for line in stderr.splitlines()
        if line.startswith("swufe-debug ")
    ]


@pytest.fixture(scope="module")
def webvpn() -> FakeUpstream:
    upstream = FakeUpstream(WebVPNHandler)
    yield upstream
    upstream.stop()


@pytest.fixture(scope="module")
def direct() -> FakeUpstream:
    upstream = FakeUpstream(DirectHandler)
    yield upstream
    upstream.stop()


@pytest.fixture(scope="module")
def bridge(webvpn, tmp_path_factory):
    """A running sidecar whose WebVPN base points at the fake upstream."""
    tmp_path = tmp_path_factory.mktemp("bridge")
    port = free_port()
    confdir = tmp_path / "mitmproxy"
    config_path = tmp_path / "bridge-config.json"
    write_runtime_config(
        config_path,
        runtime_config(
            allowlist={"hosts": [ALLOWLISTED_HOST], "includeSwufeWildcard": False},
            # Domain-less on purpose: the fake WebVPN lives on 127.0.0.1, which no
            # SWUFE domain covers (see docs/api/bridge-control-protocol.md).
            cookies=[{"name": "wrdvpn_session", "value": SESSION_VALUE}],
            debug=True,
            webvpnBase=f"http://127.0.0.1:{webvpn.port}",
        ),
    )
    sidecar = Sidecar(config_path, port, confdir)
    try:
        ready = sidecar.wait_ready(port)
        ca = wait_for_ca(confdir)
        yield {
            "port": port,
            "confdir": confdir,
            "ca": ca,
            "config": config_path,
            "ready": ready,
            "sidecar": sidecar,
        }
    finally:
        sidecar.stop()


def test_ready_line_reports_the_effective_loopback_listener(bridge) -> None:
    ready = bridge["ready"]

    assert ready["listen_host"] == "127.0.0.1"
    assert ready["listen_port"] == bridge["port"]
    assert ready["config"] == str(bridge["config"])
    assert ready["allowlist"] == [ALLOWLISTED_HOST]
    assert ready["includeSwufeWildcard"] is False
    assert ready["cookies"] == 1
    assert ready["debug"] is True
    # Capture is opt-in: the default config must not add a local mode.
    assert "swufe-capture" not in bridge["sidecar"].stderr


def test_tc_f01_allowlisted_request_is_rewritten_end_to_end(bridge, webvpn) -> None:
    token = WrdCodec().encrypt_host(ALLOWLISTED_HOST)
    expected_path = f"/https/{token}/sso/jziotlogin?x=1"

    result = curl(
        "--include",
        "--proxy",
        f"http://127.0.0.1:{bridge['port']}",
        "--cacert",
        str(bridge["ca"]),
        f"https://{ALLOWLISTED_HOST}/sso/jziotlogin?x=1",
    )

    assert result.returncode == 0, result.stderr
    assert webvpn.requests, "fake WebVPN received no request"
    path, cookie = webvpn.requests[-1]
    assert path == expected_path
    assert cookie is not None
    assert f"wrdvpn_session={SESSION_VALUE}" in cookie
    # Header names are case-insensitive: HTTP/2 lowercases them, while Windows' Schannel
    # curl speaks HTTP/1.1 and echoes upstream's original case.
    assert "location: https://jwxt.swufe.edu.cn/next" in result.stdout.lower()
    assert "set-cookie: upstream=1; domain=.swufe.edu.cn; path=/" in result.stdout.lower()


def test_gateway_owned_path_and_promotion_end_to_end(bridge, webvpn) -> None:
    """`KI-011`: the shim comes from the gateway root, the site root gets promoted."""
    proxy = f"http://127.0.0.1:{bridge['port']}"
    token = WrdCodec().encrypt_host(ALLOWLISTED_HOST)

    shim = curl("--proxy", proxy, f"http://{ALLOWLISTED_HOST}/wengine-vpn/js/main.js?ver=20211207")

    assert shim.returncode == 0, shim.stderr
    assert shim.stdout == SHIM_BODY
    assert webvpn.requests[-1][0] == "/wengine-vpn/js/main.js?ver=20211207"

    entry = curl("--include", "--proxy", proxy, f"http://{ALLOWLISTED_HOST}/")

    assert entry.returncode == 0, entry.stderr
    assert entry.stdout.splitlines()[0].startswith("HTTP/1.1 302"), entry.stdout
    assert f"location: http://127.0.0.1:{webvpn.port}/http/{token}/" in entry.stdout.lower()
    assert WrdCodec().decrypt_host(token) == ALLOWLISTED_HOST


def test_tc_f02_non_allowlisted_request_is_passed_through(bridge, direct) -> None:
    result = curl(
        "--proxy",
        f"http://127.0.0.1:{bridge['port']}",
        f"http://127.0.0.1:{direct.port}/plain",
    )

    assert result.returncode == 0, result.stderr
    assert result.stdout == DIRECT_BODY
    assert direct.requests[-1] == ("/plain", None)


def test_tc_f04_debug_log_contract_and_secret_redaction(bridge) -> None:
    stderr = bridge["sidecar"].stderr

    records = debug_records(stderr)
    assert records, "no swufe-debug records were emitted"
    for record in records:
        assert set(record) == {"ts", "host", "rewritten", "direction", "detail"}
    assert {record["direction"] for record in records} == {"request", "response"}
    assert any(
        record["host"] == ALLOWLISTED_HOST and record["rewritten"] is True for record in records
    )
    assert any(record["host"] == "127.0.0.1" and record["rewritten"] is False for record in records)
    assert SESSION_VALUE not in stderr
    assert DIRECT_BODY not in stderr


def test_listener_is_loopback_only(bridge) -> None:
    """The proxy port must not be reachable on any non-loopback address.

    Probed by connection rather than by reading the option: a machine with a
    TUN-based proxy tool may accept connections to its own TUN address, so the
    assertion is that at least one real interface address refuses the port.
    """
    addresses = _non_loopback_ipv4_addresses()
    if not addresses:
        pytest.skip("no non-loopback IPv4 address available")

    reachable = [addr for addr in addresses if _accepts_connection(addr, bridge["port"])]

    assert len(reachable) < len(addresses), (
        f"proxy port {bridge['port']} is reachable on every non-loopback address: {addresses}"
    )


def _non_loopback_ipv4_addresses() -> list[str]:
    """Local IPv4 addresses, without shelling out to a per-OS tool (`ifconfig` is absent
    on Windows, which used to skip this security assertion there)."""
    addresses: list[str] = []
    try:
        infos = socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET)
    except OSError:
        infos = []
    for info in infos:
        candidate = info[4][0]
        if not candidate.startswith("127.") and candidate not in addresses:
            addresses.append(candidate)
    # A hostname may resolve to loopback only; ask the routing table which local address
    # would carry outbound traffic instead (no packet is sent for a connected UDP socket).
    probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        probe.connect(("192.0.2.1", 9))  # TEST-NET-1
        candidate = probe.getsockname()[0]
        if not candidate.startswith("127.") and candidate not in addresses:
            addresses.append(candidate)
    except OSError:
        pass
    finally:
        probe.close()
    return addresses


def _accepts_connection(address: str, port: int) -> bool:
    try:
        socket.create_connection((address, port), timeout=1).close()
    except OSError:
        return False
    return True


def test_ec_006_empty_allowlist_refuses_to_start(tmp_path: Path) -> None:
    config_path = tmp_path / "empty.json"
    write_runtime_config(
        config_path,
        runtime_config(allowlist={"hosts": [], "includeSwufeWildcard": False}),
    )

    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "swufe_bridge.sidecar",
            "--config",
            str(config_path),
            "--port",
            str(free_port()),
            "--confdir",
            str(tmp_path / "mitmproxy"),
        ],
        capture_output=True,
        text=True,
        timeout=READY_TIMEOUT,
    )

    assert result.returncode == 2
    assert "swufe-error ALLOWLIST_EMPTY" in result.stderr


def test_an_invalid_capture_spec_is_rejected_before_anything_starts(tmp_path: Path) -> None:
    """A comma inside a pattern is a config error, not a local-mode enable (ADR-0006)."""
    config_path = tmp_path / "capture.json"
    write_runtime_config(
        config_path,
        runtime_config(allowlist={"hosts": [ALLOWLISTED_HOST], "includeSwufeWildcard": False}),
    )
    raw = json.loads(config_path.read_text(encoding="utf-8"))
    raw["capture"] = {"processes": ["/bin/a,b"]}
    config_path.write_text(json.dumps(raw), encoding="utf-8")

    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "swufe_bridge.sidecar",
            "--config",
            str(config_path),
            "--port",
            str(free_port()),
            "--confdir",
            str(tmp_path / "mitmproxy"),
        ],
        capture_output=True,
        text=True,
        timeout=READY_TIMEOUT,
    )

    assert result.returncode == 2
    assert "swufe-error CONFIG_INVALID" in result.stderr
    assert "capture.processes[0]" in result.stderr
    assert "swufe-capture" not in result.stderr
