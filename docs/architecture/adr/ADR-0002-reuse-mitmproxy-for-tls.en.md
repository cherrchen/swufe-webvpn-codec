# ADR-0002: Reuse mitmproxy instead of building a custom TLS / MITM stack

> Chinese source of truth: [ADR-0002-reuse-mitmproxy-for-tls.md](ADR-0002-reuse-mitmproxy-for-tls.md)

## Status

`Accepted`

## Date

`2026-09-20`

## Decision Owners

`cherrchen`

## Context

To rewrite HTTP/HTTPS requests into the WebVPN form and reverse-rewrite responses, the local bridge must act as an HTTPS man-in-the-middle: dynamically issue certificates per target host, terminate TLS, handle HTTP/2 and connection reuse, and decrypt traffic once the client trusts a local CA (REQ-006, REQ-007, REQ-010). Building that PKI and TLS stack in-house is expensive and any mistake becomes a security hole (certificate validation, algorithm negotiation, protocol downgrade, key storage); the earlier prototype (rwppa-like) already showed that burden.

Constraints: NFR-001 explicitly forbids building a custom proxy kernel / TLS / PKI and prefers handing TLS, HTTP2 and certificate issuance to mitmproxy or an equally mature stack; REQ-010 recommends reusing the mitmproxy CA mechanism, with the CA private key staying on the local machine only (NFR-003); REQ-003 requires supporting both "system proxy pointing at the local bridge port" and "mitmproxy local (or equivalent) per-process capture". The MITM runtime must therefore be chosen now, because it determines packaging and deployment.

## Decision

Reuse mitmproxy as the MITM and proxy runtime of the local bridge (Regular proxy + local capture + a thin WRD addon); do **not** build a custom TLS termination, HTTP/2 or certificate-issuance stack.

- Certificate issuance, CA lifecycle and confdir use mitmproxy's existing mechanisms: the CA lives in a dedicated mitmproxy confdir and its private key never leaves the local machine (REQ-010, NFR-003);
- WRD rewriting attaches to mitmproxy only as a thin addon; mitmproxy itself is not modified;
- Procure-don't-build for the proxy kernel, TLS and PKI is in force from Phase 1 on both macOS and Windows;
- Replacing the MITM runtime (self-built or another stack) requires a new ADR superseding this one;
- Owner: cherrchen.

## Alternatives

| Alternative | Pros | Cons | Why not adopted |
| ----------- | ---- | ---- | --------------- |
| Do nothing (no HTTPS decryption and rewriting) | No MITM risk; no CA trust needed | Academic-affairs and similar sites are mostly HTTPS; REQ-006 / REQ-007 cannot be met and G-001 fails | HTTPS rewriting is impossible; requirement unmet |
| Build a custom MITM / TLS stack (e.g. the earlier rwppa-like implementation) | Fully controllable; no external runtime dependency; small package | PKI and TLS security costs are high: certificate issuance, protocol details and private-key protection all become ours to guarantee, forever | Costly and directly conflicts with NFR-001 |
| Use an existing commercial proxy such as Proxifier | No TLS work; works out of the box | Closed source and not customisable; cannot host allowlist rewriting, cookie injection or response reverse-rewriting | Not customisable; cannot carry WRD semantics |

## Consequences

### Positive

- Gain proven TLS / HTTP2 and certificate-issuance capability, with the security boundary owned by a mature project (NFR-001);
- Certificate and CA lifecycle follow mitmproxy machinery, so REQ-010 install / uninstall only wraps its confdir (no custom PKI);
- Local capture and Regular proxy come from the same source, so the two capture paths of REQ-003 need only one implementation.

### Negative

- A Python runtime must ship with the app (embedded interpreter) or be installed on the system, increasing package size and code-signing complexity (R3);
- Core bridge capability is bound to mitmproxy's addon API and version behaviour; upgrades need regression verification;
- Debugging involves both the TypeScript side and the Python sidecar.

### Risks

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| mitm embedding size and code signing (R3) | Medium | Medium | Defer the release form to implementation (embedded Python vs distributing a `mitmproxy` executable); verify size and signing once during packaging |
| A mitmproxy upgrade changes addon behaviour and regresses rewriting | Medium | Medium | Pin dependency versions; cover addon behaviour with layered L1/L2 tests (recorded traffic + fake upstream) |
| CA private key stored in the wrong place | Low | High | Use a dedicated mitmproxy confdir with tightened permissions; key stays local and is never uploaded (NFR-003) |

## References

- Related requirements: REQ-003, REQ-006, REQ-007, REQ-010, NFR-001, NFR-003
- Related spec: [specs/001-phase1-local-bridge/spec.md](../../../specs/001-phase1-local-bridge/spec.md)
- Related ADRs: [ADR-0001](ADR-0001-wrd-rewrite-in-mitm-layer.en.md) (rewriting lives in the mitm layer; this decision supplies that MITM capability)
- Source (archived package, historical provenance only): [04-architecture-and-tech-selection.md §2 ADR-2, §3 technology comparison](../../archive/2026-09-20-swufe-webvpn-bridge-docs-v1.0/01-requirements/04-architecture-and-tech-selection.md)
