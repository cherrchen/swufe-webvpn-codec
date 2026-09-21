"""L0: process-capture bookkeeping (REQ-003 / ADR-0006, TC-G04).

Deliberately mitmproxy-free: `swufe_bridge.capture` takes every mitmproxy
interaction as an injected callable, so the state machine is testable here.
"""

from __future__ import annotations

import asyncio

import pytest

from swufe_bridge.capture import (
    APPLY_POLL_INTERVAL_SECONDS,
    APPLY_TICKS,
    LOCAL_MODE_PREFIX,
    LocalCapture,
    build_intercept_spec,
    desired_modes,
)

CHROME = "/Applications/Google Chrome.app/"
CURL = "/usr/bin/curl"


class FakeModes:
    """The live `mode` option of the running mitmproxy instance."""

    def __init__(self, modes: list[str] | None = None) -> None:
        self.modes = list(modes if modes is not None else ["regular@8080"])
        self.set_calls: list[list[str]] = []

    def get(self) -> list[str]:
        return list(self.modes)

    def set(self, modes) -> None:
        self.set_calls.append(list(modes))
        self.modes = list(modes)


class FakeSystem:
    """`local_state` + a fake clock, both injectable into `LocalCapture`.

    By default a mode that is present in the mode list counts as running, which
    mirrors mitmproxy (the instance is registered before it is started); explicit
    ``states`` or a ``sequence`` override that.
    """

    def __init__(
        self,
        modes: FakeModes | None = None,
        states: dict[str, tuple[bool, str | None]] | None = None,
        fixed: tuple[bool, str | None] | None = None,
    ) -> None:
        self.modes = modes
        self.states = dict(states or {})
        self.fixed = fixed
        self.sleeps = 0
        self.sequence: list[tuple[bool, str | None]] = []
        self.queries: list[str] = []

    def state(self, mode: str) -> tuple[bool, str | None]:
        self.queries.append(mode)
        if self.fixed is not None:
            return self.fixed
        if self.sequence:
            return self.sequence.pop(0)
        if mode in self.states:
            return self.states[mode]
        registered = self.modes is not None and mode in self.modes.modes
        return (registered, None if registered else "local 模式未注册")

    async def sleep(self, seconds: float) -> None:
        self.sleeps += 1
        await asyncio.sleep(0)


def make_capture(
    system: FakeSystem,
    modes: FakeModes,
    *,
    describe=None,
    unavailable=lambda: None,
) -> LocalCapture:
    return LocalCapture(
        get_modes=modes.get,
        set_modes=modes.set,
        local_state=system.state,
        describe_spec=describe or (lambda spec: None),
        unavailable_reason=unavailable,
        sleep=system.sleep,
    )


def test_spec_ignores_empty_and_comma_entries_and_dedupes() -> None:
    assert build_intercept_spec([]) == ""
    assert build_intercept_spec([CHROME]) == CHROME
    assert build_intercept_spec([CURL, CHROME]) == f"{CURL},{CHROME}"
    assert build_intercept_spec([CHROME, f" {CHROME} ", "", "  "]) == CHROME
    assert build_intercept_spec(["/bin/a,b", CURL]) == CURL


def test_desired_modes_replaces_only_the_local_entry() -> None:
    assert desired_modes(["regular@8080"], "") == ["regular@8080"]
    assert desired_modes(["regular@8080"], CHROME) == [
        "regular@8080",
        f"{LOCAL_MODE_PREFIX}{CHROME}",
    ]
    assert desired_modes(["regular@8080", f"{LOCAL_MODE_PREFIX}{CHROME}"], "") == ["regular@8080"]
    assert desired_modes(
        ["regular@8080", f"{LOCAL_MODE_PREFIX}{CHROME}"], CURL
    ) == ["regular@8080", f"{LOCAL_MODE_PREFIX}{CURL}"]


def test_first_enable_is_pending_then_settles() -> None:
    modes = FakeModes()
    system = FakeSystem(modes)
    capture = make_capture(system, modes)

    assert capture.pending([CHROME], (1, 10)) is True

    result = asyncio.run(capture.apply([CHROME], (1, 10)))

    assert result.enabled is True
    assert result.spec == CHROME
    assert result.error is None
    assert capture.result == result
    assert modes.set_calls == [["regular@8080", f"{LOCAL_MODE_PREFIX}{CHROME}"]]
    assert system.queries == [f"{LOCAL_MODE_PREFIX}{CHROME}"]
    assert capture.pending([CHROME], (1, 10)) is False


def test_disabling_removes_the_local_mode_and_is_not_retried() -> None:
    modes = FakeModes(["regular@8080", f"{LOCAL_MODE_PREFIX}{CHROME}"])
    system = FakeSystem(modes)
    capture = make_capture(system, modes)

    assert capture.pending([], (1, 10)) is True
    result = asyncio.run(capture.apply([], (1, 10)))

    assert result == type(result)(enabled=False, spec="", error=None)
    assert modes.modes == ["regular@8080"]
    assert system.queries == []
    assert capture.pending([], (1, 10)) is False


def test_an_invalid_spec_reports_the_reason_without_touching_the_modes() -> None:
    def describe(spec: str) -> None:
        raise ValueError("invalid intercept spec")

    modes = FakeModes()
    capture = make_capture(FakeSystem(), modes, describe=describe)

    result = asyncio.run(capture.apply(["/bin/a b"], (1, 10)))

    assert result.enabled is False
    assert result.error == "invalid intercept spec"
    assert modes.set_calls == []
    # The same invalid spec must not be retried for the same config, but a
    # rewritten config (new stamp) may try again.
    assert capture.pending(["/bin/a b"], (1, 10)) is False
    assert capture.pending(["/bin/a b"], (2, 10)) is True


def test_unavailable_platform_reports_the_reason_without_touching_the_modes() -> None:
    modes = FakeModes()
    capture = make_capture(FakeSystem(), modes, unavailable=lambda: "需要系统扩展授权")

    result = asyncio.run(capture.apply([CHROME], (1, 10)))

    assert result.error == "需要系统扩展授权"
    assert modes.set_calls == []


def test_a_failed_enable_rolls_back_and_is_not_retried_for_the_same_config() -> None:
    modes = FakeModes()
    system = FakeSystem(fixed=(False, "系统扩展未授权"))
    capture = make_capture(system, modes)

    result = asyncio.run(capture.apply([CHROME], (1, 10)))

    assert result.enabled is False
    assert result.spec == ""
    assert result.error == "系统扩展未授权"
    assert modes.modes == ["regular@8080"]
    assert modes.set_calls == [
        ["regular@8080", f"{LOCAL_MODE_PREFIX}{CHROME}"],
        ["regular@8080"],
    ]
    assert capture.pending([CHROME], (1, 10)) is False
    assert capture.pending([CHROME], (2, 10)) is True


def test_a_never_running_enable_times_out_in_ticks() -> None:
    modes = FakeModes()
    system = FakeSystem(fixed=(False, None))
    capture = make_capture(system, modes)

    result = asyncio.run(capture.apply([CHROME], (1, 10)))

    assert result.enabled is False
    assert result.error == "未在 20 秒内启用进程捕获"
    assert system.sleeps == APPLY_TICKS
    assert system.queries == [f"{LOCAL_MODE_PREFIX}{CHROME}"] * APPLY_TICKS
    assert modes.modes == ["regular@8080"]


def test_a_late_success_is_reported_and_poll_interval_matches_the_contract() -> None:
    modes = FakeModes()
    system = FakeSystem(modes)
    system.sequence = [(False, None), (False, None), (True, None)]
    capture = make_capture(system, modes)

    result = asyncio.run(capture.apply([CHROME], (1, 10)))

    assert result.enabled is True
    assert system.sleeps == 3
    assert APPLY_POLL_INTERVAL_SECONDS == 0.2


def test_apply_uses_one_spec_for_several_patterns() -> None:
    modes = FakeModes()
    system = FakeSystem(modes)
    capture = make_capture(system, modes)

    result = asyncio.run(capture.apply([CURL, CHROME, CURL], (1, 10)))

    assert result.enabled is True
    assert result.spec == f"{CURL},{CHROME}"
    assert modes.modes == ["regular@8080", f"{LOCAL_MODE_PREFIX}{CURL},{CHROME}"]


def test_mode_option_rejecting_the_update_is_reported() -> None:
    class RejectingModes(FakeModes):
        def set(self, modes) -> None:
            raise RuntimeError("Invalid value for mode")

    capture = make_capture(FakeSystem(), RejectingModes())

    result = asyncio.run(capture.apply([CHROME], (1, 10)))

    assert result.enabled is False
    assert "Invalid value for mode" in (result.error or "")


@pytest.mark.parametrize("patterns", [(), ("",), ("  ",)])
def test_empty_patterns_disable_capture(patterns: tuple[str, ...]) -> None:
    modes = FakeModes(["regular@8080", f"{LOCAL_MODE_PREFIX}{CHROME}"])
    capture = make_capture(FakeSystem(), modes)

    result = asyncio.run(capture.apply(patterns, (1, 10)))

    assert result.enabled is False
    assert modes.modes == ["regular@8080"]
