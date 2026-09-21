"""Process capture: the sidecar half of REQ-003 / ADR-0006.

The bridge always runs a regular listener on ``bridgePort``. "Capture selected
apps" is layered on top by adding a ``local:<spec>`` mode to the same mitmproxy
instance, which asks the OS to redirect only the matching processes into the
transparent layer. The two modes are mutually exclusive at the App level (the
orchestrator never sets a system proxy while capturing), but mitmproxy itself
keeps both listeners so switching modes never drops the port.

Nothing here imports mitmproxy: every mitmproxy interaction is injected as a
callable so the state machine is unit-testable at L0.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable, Sequence
from dataclasses import dataclass

LOCAL_MODE_PREFIX = "local:"
POLL_INTERVAL_SECONDS = 1.0
APPLY_TIMEOUT_SECONDS = 20.0
APPLY_POLL_INTERVAL_SECONDS = 0.2

#: Number of ``local_state`` polls before an attempt is declared a failure.
#: Expressed in ticks (not wall clock) so tests can drive it with an injected sleep.
APPLY_TICKS = int(APPLY_TIMEOUT_SECONDS / APPLY_POLL_INTERVAL_SECONDS)


def build_intercept_spec(patterns: Sequence[str]) -> str:
    """Join patterns into a mitmproxy intercept spec (``,`` separates entries)."""
    unique: list[str] = []
    for raw in patterns:
        pattern = raw.strip()
        if not pattern or "," in pattern or pattern in unique:
            continue
        unique.append(pattern)
    return ",".join(unique)


def desired_modes(modes: Sequence[str], spec: str) -> list[str]:
    """``modes`` minus every ``local:`` entry, plus ``local:<spec>`` when non-empty."""
    wanted = [mode for mode in modes if not mode.startswith(LOCAL_MODE_PREFIX)]
    if spec:
        wanted.append(LOCAL_MODE_PREFIX + spec)
    return wanted


@dataclass(frozen=True)
class CaptureResult:
    enabled: bool
    spec: str
    error: str | None = None


class LocalCapture:
    """Applies the configured intercept spec to the running mitmproxy instance.

    Injected collaborators:

    - ``get_modes`` / ``set_modes``: the live ``mode`` option of the proxy.
    - ``local_state(mode)``: ``(is_running, error)`` for a mode instance.
    - ``describe_spec(spec)``: validates a spec, raising ``ValueError`` when invalid.
    - ``unavailable_reason()``: why OS-level redirection is unavailable, if it is.
    - ``sleep(seconds)``: ``asyncio.sleep``.
    """

    def __init__(
        self,
        get_modes: Callable[[], Sequence[str]],
        set_modes: Callable[[Sequence[str]], None],
        local_state: Callable[[str], tuple[bool, str | None]],
        describe_spec: Callable[[str], None],
        unavailable_reason: Callable[[], str | None],
        sleep: Callable[[float], Awaitable[None]],
    ) -> None:
        self._get_modes = get_modes
        self._set_modes = set_modes
        self._local_state = local_state
        self._describe_spec = describe_spec
        self._unavailable_reason = unavailable_reason
        self._sleep = sleep
        self._result: CaptureResult | None = None
        self._last_attempt: tuple[str, object] | None = None

    @property
    def result(self) -> CaptureResult | None:
        """The outcome of the last attempt (``None`` before the first one)."""
        return self._result

    def pending(self, patterns: Sequence[str], stamp: object) -> bool:
        """Whether (spec, config) still needs to be applied.

        A failed attempt is *not* retried until the config is rewritten: the first
        enable triggers a macOS authorization prompt and a retry loop would flood it.
        """
        spec = build_intercept_spec(patterns)
        current = list(self._get_modes())
        if desired_modes(current, spec) == current:
            return False
        return self._last_attempt != (spec, stamp)

    async def apply(self, patterns: Sequence[str], stamp: object) -> CaptureResult:
        spec = build_intercept_spec(patterns)
        self._last_attempt = (spec, stamp)

        if spec:
            try:
                self._describe_spec(spec)
            except ValueError as exc:
                return self._record(CaptureResult(False, spec, str(exc)))
            reason = self._unavailable_reason()
            if reason:
                return self._record(CaptureResult(False, spec, reason))

        previous = list(self._get_modes())
        try:
            self._set_modes(desired_modes(previous, spec))
        except Exception as exc:  # mitmproxy rejects the option update
            return self._record(CaptureResult(False, "", str(exc)))

        if not spec:
            return self._record(CaptureResult(False, "", None))

        error: str | None = None
        for _ in range(APPLY_TICKS):
            await self._sleep(APPLY_POLL_INTERVAL_SECONDS)
            try:
                running, state_error = self._local_state(LOCAL_MODE_PREFIX + spec)
            except Exception as exc:  # defensive: never lose the reason
                running, state_error = False, str(exc)
            if state_error:
                error = state_error
                break
            if running:
                return self._record(CaptureResult(True, spec, None))
        if error is None:
            error = f"未在 {APPLY_TIMEOUT_SECONDS:.0f} 秒内启用进程捕获"

        try:
            self._set_modes(previous)
        except Exception as exc:
            error = f"{error}；回滚失败：{exc}"
        return self._record(CaptureResult(False, "", error))

    def _record(self, result: CaptureResult) -> CaptureResult:
        self._result = result
        return result
