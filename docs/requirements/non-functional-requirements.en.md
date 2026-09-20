# Non-functional Requirements

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-20
>
> Chinese source of truth: [non-functional-requirements.md](non-functional-requirements.md)

**Purpose**: define quality attributes and constraints. Non-functional requirements need verifiable criteria, otherwise they are slogans.
**Do not write**: implementation mechanisms (e.g. "use Redis" is design, and belongs in a spec or ADR).

---

## Template

```markdown
### NFR-001 <name>

- Category: performance | reliability | security | usability | maintainability | portability | observability | compliance
- Status: Proposed
- Priority: Must

**Requirement**
…

**Verification**
… (measurement method, threshold, environment)

**Consequence of missing the target**
…
```

## List

| ID | Category | Summary | Verification | Status |
| -- | -------- | ------- | ------------ | ------ |
| NFR-001 | maintainability | No home-grown proxy core/TLS/PKI; TLS/HTTP2/certificate issuance delegated to a mature stack | Code and dependency review: no home-grown PKI or proxy core | Accepted |
| NFR-002 | reliability | The WRD codec matches the vectors of the validated prototype `wrd_codec.py` | TC-A01..TC-A05 vectors | Accepted |
| NFR-003 | security | No password stored; cookies live in the user directory with tightened permissions; logging off by default and free of bodies/cookies; CA private key local only | File and permission checks + TC-D01 + TC-F04 | Accepted |
| NFR-004 | security | No half-open system proxy after shutdown, expiry or app exit (only proxies this app set are cleared) | TC-C03 / TC-C04 / TC-D03 | Accepted |
| NFR-005 | usability | Installing the CA must show a risk notice (HTTPS decryption, personal devices only, uninstallable at any time) | TC-E01 + UI copy check | Accepted |
| NFR-006 | portability | Phase 1 targets macOS + Windows; TUN/transparent gateway does not block Phase 1 acceptance | Two-platform build and start-up (test plan §7) | Accepted |
| NFR-007 | usability | UI and copy are Chinese-first; an English README may follow when open-sourcing | UI copy check | Accepted |

### NFR-001 No home-grown proxy core or TLS/PKI

- Category: maintainability
- Status: Accepted
- Priority: Must
- Related: [ADR-0002](../architecture/adr/ADR-0002-reuse-mitmproxy-for-tls.md) / [REQ-003](functional-requirements.md)

**Requirement**
No complete proxy core, TLS stack or PKI is implemented in-house; TLS/HTTP2 handling and certificate issuance are delegated to mitmproxy or an equivalent mature stack.

**Verification**
Code and dependency review: confirm that certificate issuance, TLS termination and HTTP/2 handling come from mitmproxy (or an equivalent mature stack), and that the repository contains no home-grown PKI or proxy core.

**Consequence of missing the target**
The project would own the long-term security maintenance of a MITM PKI and its protocols, incurring protocol-compatibility and vulnerability-response risk, and directly violating ADR-0002.

### NFR-002 WRD codec vector consistency

- Category: reliability
- Status: Accepted
- Priority: Must
- Related: [ADR-0005](../architecture/adr/ADR-0005-builtin-wrd-key-with-override.md) / [REQ-006](functional-requirements.md)

**Requirement**
The WRD codec implementation must match the vectors of the validated prototype `wrd_codec.py`, covering at least the authserver and jwxt samples.

**Verification**
Run the L0 unit vectors TC-A01..TC-A05 in CI, asserting that encode/decode results for the sample URLs match the prototype (TC-A01 authserver decode, TC-A02 authserver re-encryption consistency, TC-A03 stable jwxt encoding, TC-A04 port form `http-8080`, TC-A05 wrong-key behaviour).

**Consequence of missing the target**
The rewritten WebVPN URLs would not match the Wengine server's contract, the academic-affairs pages would fail to open, and Phase 1 acceptance would fail outright.

### NFR-003 Credential and log minimisation

- Category: security
- Status: Accepted
- Priority: Must
- Related: G-003 / [REQ-002](functional-requirements.md) / [REQ-009](functional-requirements.md) / [REQ-010](functional-requirements.md)

**Requirement**
No password is stored; session cookies live in the user directory with tightened permissions; debug logging is off by default and free of response bodies, request bodies and cookies; the CA private key stays local and is never uploaded.

**Verification**
Check that no password file exists in the user directory (TC-D01); check that the permission bits of the session file and CA private key are tightened; with debug logging on and traffic flowing, check that records contain only `ts/host/rewritten/direction/detail` and no bodies or cookies (TC-F04).

**Consequence of missing the target**
A credential-exposure surface appears, violating security goal G-003; once cleartext reaches disk or logs, users must rotate their credentials themselves.

### NFR-004 No half-open system proxy

- Category: security
- Status: Accepted
- Priority: Must
- Related: G-003 / [REQ-002](functional-requirements.md) / [REQ-003](functional-requirements.md)

**Requirement**
Turning the bridge off, session expiry, or exiting the app must not leave a half-open system proxy; the clearing operation targets only proxy settings this app set and marked itself.

**Verification**
TC-C03 (system proxy returns to not-owned-by-app after stopping the bridge), TC-C04 (same result after exiting the app while the bridge runs), TC-D03 (session expiry stops the bridge and clears the proxy); additionally verify that a proxy not set by this app is never cleared by it.

**Consequence of missing the target**
After the app is closed, the user's network still points at a stopped local port — "every site is broken" — and the user has no easy way to diagnose it.

### NFR-005 CA installation risk notice

- Category: usability
- Status: Accepted
- Priority: Must
- Related: G-003 / [REQ-010](functional-requirements.md)

**Requirement**
Installing the CA must show a risk notice: local HTTPS will be decrypted and rewritten, the certificate is for personal devices only, and it can be uninstalled at any time.

**Verification**
In TC-E01, check that the notice appears before installation; check the UI copy for the three elements (scope of decryption, personal devices only, uninstallable at any time).

**Consequence of missing the target**
The user trusts a local MITM CA without informed consent, which is a missing-consent defect and undermines the "dangerous operations reversible" premise of security goal G-003.

### NFR-006 Platform scope

- Category: portability
- Status: Accepted
- Priority: Must
- Related: [ADR-0003](../architecture/adr/ADR-0003-electron-gui-for-phase-1.md) / [REQ-011](functional-requirements.md)

**Requirement**
Phase 1 supports macOS and Windows; TUN/transparent gateway is not part of Phase 1 (see [non-goals](../overview/goals-and-non-goals.md)) and does not block Phase 1 acceptance.

**Verification**
Build and start the Electron development build and the mitm sidecar on one macOS and one Windows test machine (test plan §7 environment), and confirm the main path is executable; TUN items are not acceptance entry criteria.

**Consequence of missing the target**
The acceptance scope creeps into TUN/kernel-level takeover and Phase 1 slips; or one desktop platform cannot start, so browser acceptance cannot satisfy "at least one side passes".

### NFR-007 Chinese-first UI and copy

- Category: usability
- Status: Accepted
- Priority: Should
- Related: G-004 / [REQ-001](functional-requirements.md)

**Requirement**
UI and copy are Chinese-first; adding an English README when open-sourcing may follow later.

**Verification**
UI copy check: the main window, status bar and error prompts (CA risk notice, proxy-conflict prompt, session-expiry prompt) are all in Chinese and match the design wording.

**Consequence of missing the target**
The target users (SWUFE students and staff) face higher comprehension cost and unactionable error prompts; it does not block functional acceptance but counts as experience debt.

## Category prompts

| Category | What must be made explicit |
| -------- | -------------------------- |
| performance | latency, throughput, concurrency, data volume, measurement environment |
| reliability | availability target, failure recovery, idempotency, data consistency |
| security | trust boundaries, authentication, authorisation, input validation, secret management (→ [security/](../security/README.md)) |
| usability | learnability, error messaging, accessibility |
| maintainability | modularity, testability, documentation obligations |
| portability | supported platforms, runtime versions, dependency constraints (→ [dependency-policy.md](../development/dependency-policy.md)) |
| observability | logging, metrics, tracing requirements |
| compliance | regulation, licensing, data retention |

## Relationship to ADRs

If a non-functional requirement forces a hard-to-reverse technical choice, add an ADR and reference it from this entry's `Related` field.
Applied in this phase: NFR-001 → [ADR-0002](../architecture/adr/ADR-0002-reuse-mitmproxy-for-tls.md); NFR-002 → [ADR-0005](../architecture/adr/ADR-0005-builtin-wrd-key-with-override.md); NFR-006 → [ADR-0003](../architecture/adr/ADR-0003-electron-gui-for-phase-1.md).
