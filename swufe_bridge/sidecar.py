"""Sidecar entry point: validate config, then run mitmdump with the bridge addon.

Control-plane option A (see docs/api/bridge-control-protocol.md): the process is
driven by spawn/kill, configuration is a file the addon hot-reloads, and
readiness/failures are reported as machine-readable stderr lines
(``swufe-ready`` / ``swufe-error``). The listener is always loopback — there is
deliberately no option to change it (hard constraint: never listen on 0.0.0.0).
"""

from __future__ import annotations

import argparse
from pathlib import Path

from swufe_bridge.addon import report_error
from swufe_bridge.config import (
    DEFAULT_CONFIG_DIR,
    RUNTIME_FILENAME,
    ConfigError,
    load_runtime_config,
)

ADDON_SCRIPT = Path(__file__).with_name("addon.py")

LISTEN_HOST = "127.0.0.1"
DEFAULT_PORT = 8080

ALLOWLIST_EMPTY_MESSAGE = "allowlist 为空：请添加主机或启用 *.swufe.edu.cn"


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="swufe_bridge.sidecar",
        description="SWUFE WebVPN bridge sidecar (mitmproxy + WRD addon)",
    )
    parser.add_argument(
        "--config",
        default=str(DEFAULT_CONFIG_DIR / RUNTIME_FILENAME),
        help="path to the bridge runtime config JSON file",
    )
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="loopback listen port")
    parser.add_argument(
        "--confdir",
        default=str(DEFAULT_CONFIG_DIR / "mitmproxy"),
        help="mitmproxy confdir (CA store); created if missing",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    config_path = Path(args.config)

    try:
        cfg = load_runtime_config(config_path)
    except ConfigError as exc:
        report_error("CONFIG_INVALID", str(exc))
        return 2
    if not cfg.has_rewritable_hosts:
        report_error("ALLOWLIST_EMPTY", ALLOWLIST_EMPTY_MESSAGE)
        return 2

    confdir = Path(args.confdir)
    confdir.mkdir(parents=True, exist_ok=True)

    # `--mode regular@<port>` (never `--listen-port`): a global listen port applies
    # to every mode, so mitmproxy's duplicate-listen-address check would reject the
    # `local:` mode added at runtime for process capture (ADR-0006).
    mitmdump_argv = [
        "--listen-host",
        LISTEN_HOST,
        "--mode",
        f"regular@{args.port}",
        "-s",
        str(ADDON_SCRIPT),
        # Lazy upstream connections: with the default (eager) mitmproxy dials the
        # *original* host before the request hook runs, which both leaks a direct
        # connection attempt to an allowlisted host and can hang the first
        # navigation when that route is blocked.
        "--set",
        "connection_strategy=lazy",
        "--set",
        f"confdir={confdir}",
        "--set",
        f"swufe_config={config_path}",
    ]

    from mitmproxy.tools.main import mitmdump

    try:
        mitmdump(mitmdump_argv)
    except SystemExit as exc:
        code = exc.code
        return code if isinstance(code, int) else 0
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
