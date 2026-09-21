"""CA generation entry point (T022): materialize the mitmproxy CA without a bridge run.

The bridge sidecar only creates its CA when mitmdump starts, but the App must be
able to install the CA *before* the first bridge start. This module therefore
exposes the same mitmproxy CertStore (`--confdir`) generation as a standalone
command; no PKI is implemented here (NFR-001).

``mitmproxy`` is imported lazily (inside ``ensure_ca``) so that importing
``swufe_bridge.ca`` stays cheap and the L0 "no mitmproxy" convention of the
package is untouched.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Sequence

__all__ = ["CA_BASENAME", "CA_KEY_SIZE", "ca_paths", "ensure_ca", "main"]

CA_BASENAME = "mitmproxy"
CA_KEY_SIZE = 2048


def ca_paths(confdir: Path | str, *, basename: str = CA_BASENAME) -> dict[str, Path]:
    """Return the mitmproxy CA files inside ``confdir`` as absolute paths."""
    base = Path(confdir).resolve() / basename
    return {
        "ca_pem": Path(f"{base}-ca.pem"),
        "ca_cert_pem": Path(f"{base}-ca-cert.pem"),
        "ca_cert_cer": Path(f"{base}-ca-cert.cer"),
        "ca_p12": Path(f"{base}-ca.p12"),
    }


def ensure_ca(
    confdir: Path | str, *, basename: str = CA_BASENAME, key_size: int = CA_KEY_SIZE
) -> dict[str, Path]:
    """Materialize the CA if missing and return its paths (idempotent)."""
    from mitmproxy.certs import CertStore

    directory = Path(confdir).resolve()
    directory.mkdir(parents=True, exist_ok=True)
    CertStore.from_store(directory, basename, key_size)
    return ca_paths(directory, basename=basename)


def _report_error(code: str, message: str) -> None:
    # Same machine-readable single line as the sidecar (see bridge-control-protocol.md).
    from swufe_bridge.addon import report_error

    report_error(code, message)


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="swufe_bridge.ca",
        description="Generate the mitmproxy CA used by the bridge (idempotent)",
    )
    parser.add_argument("--confdir", required=True, help="mitmproxy confdir holding the CA store")
    args = parser.parse_args(argv)

    confdir = Path(args.confdir)
    created = not ca_paths(confdir)["ca_pem"].exists()
    try:
        paths = ensure_ca(confdir)
    except OSError as exc:
        _report_error("CA_FAILED", f"cannot create CA in {confdir}: {exc}")
        return 2
    except Exception as exc:  # mitmproxy / cryptography failures
        _report_error("CA_FAILED", str(exc))
        return 2

    print(
        json.dumps(
            {
                "caCert": str(paths["ca_cert_pem"]),
                "caPem": str(paths["ca_pem"]),
                "caCer": str(paths["ca_cert_cer"]),
                "created": created,
            },
            ensure_ascii=False,
        ),
        flush=True,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
