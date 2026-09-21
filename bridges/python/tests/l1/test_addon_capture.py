"""L1: process-capture loop in the real addon (REQ-003 / ADR-0006, TC-G04).

The mitmproxy local-mode half is faked on purpose: really enabling it unpacks
`/Applications/Mitmproxy Redirector.app` and asks for a system-extension
authorization, which no automated test may trigger (see M3 verification notes).
"""

from __future__ import annotations

import asyncio
import json
from contextlib import suppress

from mitmproxy.test import taddons

from swufe_bridge.addon import BridgeAddon, regular_listen_port, report_capture
from swufe_bridge.capture import LOCAL_MODE_PREFIX, LocalCapture

CHROME = "/Applications/Google Chrome.app/"
CURL = "/usr/bin/curl"


class FakeModes:
    def __init__(self, modes: list[str] | None = None) -> None:
        self.modes = list(modes if modes is not None else ["regular@8080"])
        self.set_calls: list[list[str]] = []

    def get(self) -> list[str]:
        return list(self.modes)

    def set(self, modes) -> None:
        self.set_calls.append(list(modes))
        self.modes = list(modes)


def fake_capture(
    modes: FakeModes,
    *,
    state=None,
    unavailable=lambda: None,
) -> LocalCapture:
    """A real `LocalCapture` whose every mitmproxy interaction is faked."""

    async def sleep(_seconds: float) -> None:
        await asyncio.sleep(0)

    def local_state(mode: str):
        if state is not None:
            return state(mode)
        return (mode in modes.modes, None)

    return LocalCapture(
        get_modes=modes.get,
        set_modes=modes.set,
        local_state=local_state,
        describe_spec=lambda spec: None,
        unavailable_reason=unavailable,
        sleep=sleep,
    )


def capture_lines(stderr: str) -> list[dict[str, object]]:
    return [
        json.loads(line[len("swufe-capture ") :])
        for line in stderr.splitlines()
        if line.startswith("swufe-capture ")
    ]


def test_regular_listen_port_comes_from_the_regular_mode() -> None:
    assert regular_listen_port(["regular@18080"]) == 18080
    assert regular_listen_port(["regular@18080", f"{LOCAL_MODE_PREFIX}{CHROME}"]) == 18080
    assert regular_listen_port([f"{LOCAL_MODE_PREFIX}{CHROME}", "regular@19090"]) == 19090
    assert regular_listen_port([f"{LOCAL_MODE_PREFIX}{CHROME}"]) is None
    assert regular_listen_port(["not-a-mode@"]) is None


def test_capture_tick_enables_and_reports_the_spec(addon_factory, capsys) -> None:
    addon, _ = addon_factory(capture={"processes": [CURL, CHROME]})
    modes = FakeModes()
    addon._capture = fake_capture(modes)

    asyncio.run(addon._capture_tick())

    assert modes.modes == ["regular@8080", f"{LOCAL_MODE_PREFIX}{CURL},{CHROME}"]
    assert capture_lines(capsys.readouterr().err) == [
        {"enabled": True, "processes": [CURL, CHROME], "error": None}
    ]


def test_capture_tick_disables_when_the_config_drops_the_patterns(
    config_path, capsys
) -> None:
    path = config_path(capture={"processes": []})
    addon = BridgeAddon(path)
    modes = FakeModes(["regular@8080", f"{LOCAL_MODE_PREFIX}{CURL}"])
    addon._capture = fake_capture(modes)

    asyncio.run(addon._capture_tick())

    assert capture_lines(capsys.readouterr().err) == [
        {"enabled": False, "processes": [], "error": None}
    ]
    assert modes.modes == ["regular@8080"]

    # A rewritten config re-enables capture without restarting the sidecar.
    path.unlink()
    config_path(capture={"processes": [CURL, CHROME]})

    asyncio.run(addon._capture_tick())

    assert modes.modes == ["regular@8080", f"{LOCAL_MODE_PREFIX}{CURL},{CHROME}"]
    assert capture_lines(capsys.readouterr().err) == [
        {"enabled": True, "processes": [CURL, CHROME], "error": None}
    ]


def test_a_failed_capture_is_reported_once_per_message(config_path, capsys) -> None:
    path = config_path(capture={"processes": [CHROME]})
    addon = BridgeAddon(path)
    failure = "macOS 系统扩展未授权"
    modes = FakeModes()
    addon._capture = fake_capture(modes, state=lambda mode: (False, failure))

    asyncio.run(addon._capture_tick())
    asyncio.run(addon._capture_tick())
    asyncio.run(addon._capture_tick())

    assert capture_lines(capsys.readouterr().err) == [
        {"enabled": False, "processes": [], "error": failure}
    ]
    assert modes.modes == ["regular@8080"]
    assert addon._capture.pending([CHROME], addon._watcher.stamp) is False

    # A rewritten config is a new attempt (the user asked to retry), but the
    # identical failure is not repeated: the UI already shows it.
    path.unlink()
    config_path(capture={"processes": [CHROME, CURL]})
    attempts = len(modes.set_calls)

    asyncio.run(addon._capture_tick())

    assert len(modes.set_calls) == attempts + 2  # apply + rollback
    assert capture_lines(capsys.readouterr().err) == []

    # A different failure is new information and is reported.
    addon._capture = fake_capture(modes, state=lambda mode: (False, "进程捕获被拒绝"))
    path.unlink()
    config_path(capture={"processes": [CURL]})

    asyncio.run(addon._capture_tick())

    assert capture_lines(capsys.readouterr().err) == [
        {"enabled": False, "processes": [], "error": "进程捕获被拒绝"}
    ]


def test_capture_tick_is_a_noop_without_a_config_or_capture(addon_factory, capsys) -> None:
    addon, _ = addon_factory()
    asyncio.run(addon._capture_tick())  # no capture built yet

    addon._capture = fake_capture(FakeModes(["regular@8080", f"{LOCAL_MODE_PREFIX}{CURL}"]))
    addon._watcher = None
    addon._config_path = None
    asyncio.run(addon._capture_tick())

    assert capture_lines(capsys.readouterr().err) == []


def test_report_capture_shape_is_frozen(capsys) -> None:
    report_capture(True, [CHROME], None)

    line = capsys.readouterr().err.strip()
    assert line == f'swufe-capture {{"enabled": true, "processes": ["{CHROME}"], "error": null}}'
    assert json.loads(line[len("swufe-capture ") :]).keys() == {"enabled", "processes", "error"}


def test_running_announces_the_regular_port_and_starts_the_capture_loop(config_path, capsys) -> None:
    addon = BridgeAddon(config_path())

    async def main() -> None:
        with taddons.context(addon) as context:
            context.options.update(listen_host="127.0.0.1", mode=["regular@18080"])
            addon.running()
            await asyncio.sleep(0)
            tasks = [
                task
                for task in asyncio.all_tasks()
                if task.get_name().startswith("swufe-capture")
            ]
            assert len(tasks) == 1
            for task in tasks:
                task.cancel()
                with suppress(asyncio.CancelledError):
                    await task

    asyncio.run(main())

    stderr = capsys.readouterr().err
    ready = json.loads(stderr.split("swufe-ready ", 1)[1].splitlines()[0])
    assert ready["listen_host"] == "127.0.0.1"
    assert ready["listen_port"] == 18080
    assert capture_lines(stderr) == []
