# SWUFE WebVPN Bridge

<p align="center"><a href="README.md">简体中文</a> • <a href="README.en.md">English</a></p>

SWUFE WebVPN Bridge is a desktop tool for macOS and Windows. After the user signs in to the university's official Wengine WebVPN (CAS/MFA) inside the app, the local bridge can forward HTTP/HTTPS requests for allowlisted hosts through WebVPN, so a local browser can reach authorised campus sites such as the academic-affairs system at `jwxt.swufe.edu.cn`.

**This is not a VPN.** It does not forward arbitrary TCP/UDP traffic or replace the university's SSLVPN. The project is maintained independently and is not affiliated with SWUFE or the Wengine vendor. The university's WebVPN and campus websites are third-party systems.

## Project status

- Phase 1 real-machine acceptance and browser interaction with the academic-affairs site have passed on macOS and Windows. See the [acceptance record](specs/001-phase1-local-bridge/verification.md) and [known issues](specs/001-phase1-local-bridge/known-issues.md).
- `KI-019` remains `Open`: occasional requests to the academic-affairs site stop responding through the bridge. Field records locate the issue in the bridge's upstream request/response stage, but there is no packet-level evidence establishing the root cause. Reloading the page may recover; the issue is not fixed.
- The repository currently provides source code and developer run instructions. It has **no end-user installer, signed/notarised build, or official distribution channel**. Open-source preparation does not mean an installable release is available.
- License: [MIT](LICENSE).

## Before using it

The app uses a local MITM CA to decrypt and rewrite HTTPS. This capability is available only after the user explicitly installs the CA. Its private key stays on the device, and the app can uninstall the CA. Installing it may allow trusted HTTPS traffic on that device to be decrypted; use it only on a device you manage and understand. See the [security notes](docs/security/README.en.md) for trust boundaries and limitations.

Users must be authorised to sign in to the university's WebVPN and access the relevant sites. The app does not store university passwords, bypass CAS/MFA, or provide unauthorised access. The machine needs access to the university's WebVPN. Outside campus, the academic-affairs host may not resolve or be reachable directly; use the app's default “system proxy” mode for it. If the browser upgrades the entry URL to HTTPS, the university gateway may not handle that entry. See the [run guide](docs/operations/development-run.en.md) for operational limitations.

The current platform targets are macOS and Windows. Linux, app-store distribution, bulk deployment, simultaneous use with another system-proxy/TUN tool, certificate-pinned clients, and arbitrary TCP/UDP are outside the current scope.

## For users

There is currently no official installer to download. To try the app from source, prepare the environment using the developer steps below, then follow the [complete run guide](docs/operations/development-run.en.md) for sign-in, CA installation, and bridge operation. The first launch builds the Electron development app. Before enabling HTTPS decryption, read the in-app warning and explicitly install the local CA.

## For developers: run from source

Prerequisites: Node.js 22 or later, pnpm (version specified in `package.json`), uv, and macOS or Windows.

```bash
uv sync --directory bridges/python
pnpm install
pnpm start
```

After launch, complete the official WebVPN sign-in in the app's login window. Install the local CA and start the bridge as needed. The [development run guide](docs/operations/development-run.en.md) covers prerequisites, privileged operations, troubleshooting, and limitations. See the [desktop app notes](apps/desktop/README.md) for Electron commands and directory details.

Common development checks:

```bash
pnpm run docs:check
pnpm --filter swufe-webvpn-bridge run typecheck
pnpm --filter swufe-webvpn-bridge run test:unit
pnpm --filter swufe-webvpn-bridge run test:ui
```

See [CONTRIBUTING.en.md](CONTRIBUTING.en.md) for contribution flow. Before making changes, read [AGENTS.md](AGENTS.md) and follow the relevant [project documentation](docs/README.en.md) or [feature spec index](specs/README.en.md).

## Project navigation

| To learn about | Start here |
| --- | --- |
| User-visible behaviour, boundaries, and terms | [Project overview](docs/overview/project-overview.en.md), [goals and non-goals](docs/overview/goals-and-non-goals.en.md), [glossary](docs/overview/glossary.en.md) |
| Risks of CA installation, data, and security boundaries | [Security notes](docs/security/README.en.md) |
| Local run, system permissions, and common problems | [Development run guide](docs/operations/development-run.en.md) |
| Implementation and acceptance status | [Spec 001](specs/001-phase1-local-bridge/spec.md), [Spec 002](specs/002-desktop-ui-multiwindow/spec.md), [acceptance record](specs/001-phase1-local-bridge/verification.md) |
| Architecture and interfaces | [Architecture index](docs/architecture/README.en.md), [API index](docs/api/README.en.md) |
| Contribution process and documentation conventions | [Contributing](CONTRIBUTING.en.md), [documentation index](docs/README.en.md) |

## License

[MIT](LICENSE) © 2026 cherrchen.
