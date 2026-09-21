# ADR-0011: A fake-ip (TUN / virtual-interface) environment is refused at start with `PROXY_CONFLICT` too

> Chinese source of truth: [ADR-0011-refuse-start-on-fake-ip-dns.md](ADR-0011-refuse-start-on-fake-ip-dns.md)

## Status

`Accepted`

## Date

`2026-09-21`

## Decision Owners

`cherrchen`

## Context

[ADR-0004](ADR-0004-refuse-start-when-system-proxy-in-use.en.md) fixed the principle "check for environment conflicts before starting the bridge and refuse on conflict", but it only inspects the **system proxy** (the HTTP/HTTPS proxy entries read via macOS `networksetup` / Windows WinINET).

M4 acceptance measured a second kind of conflict (2026-09-21, see `KI-013`): with Clash / mihomo in **TUN (virtual-interface) mode** running on the same machine, its fake-ip DNS resolves upstream hostnames into `198.18.0.0/15` (the RFC 2544 benchmarking range, the default fake-ip pool of Clash / mihomo / sing-box) and requests through the bridge (including the academic-affairs site) **hang wholesale** instead of failing. In that state:

- the system proxy may not be occupied at all, so `PROXY_CONFLICT` never fires;
- the user sees "the browser just spins after starting the bridge" while the bridge state is still `running` and the log carries no failure line - the opposite of ADR-0004's "refuse rather than half-work";
- that prerequisite only existed in documentation ([development-run.md](../../operations/development-run.en.md), [testing-strategy.md](../../development/testing-strategy.en.md)), so users who do not read it are bound to hit it.

Constraints: the error-code set is frozen at six codes by [coding-conventions.md](../../development/coding-conventions.en.md) (`PROXY_CONFLICT` / `CA_MISSING` / `NOT_LOGGED_IN` / `SESSION_EXPIRED` / `BRIDGE_CRASH` / `ALLOWLIST_EMPTY`), and adding one is a public-interface change; checks on the start path must have **zero false positives** (refusing an environment that would have worked is unacceptable); the detection must not need a platform-specific implementation (the Windows real-machine items `KI-001` are not verifiable yet).

## Decision

`startBridge` gains a fake-ip preflight **after the system-proxy conflict check and before the port probe**; a hit refuses the start:

- Target of the lookup = the currently configured gateway host (`settings.webvpnBase`, default `https://webvpn.swufe.edu.cn`) - that is the upstream the bridge actually connects to after WRD rewriting;
- Criterion = any resolved IPv4 address inside `198.18.0.0/15` (`isFakeIpAddress` in `apps/desktop/src/main/fake-ip.ts`, a pure function);
- On a hit it returns the **existing** code `PROXY_CONFLICT`; no new error code is introduced. The user-facing copy covers both causes (system proxy occupied / TUN mode present) and gives an executable action (turn off the **system proxy and TUN mode** of Clash / mihomo / other VPNs), reusing the existing conflict modal;
- A failed or timed-out lookup never blocks (fail open): a DNS hiccup must not stop an otherwise valid start;
- The criterion is the **deterministic state** "already on fake-ip"; there is no full DNS sweep, no default-route or virtual-interface probing and no caching of the result;
- It applies to `startBridge` only; switching capture mode (`selected-apps`) runs no such preflight because it establishes no upstream connection;
- This ADR does **not** supersede [ADR-0004](ADR-0004-refuse-start-when-system-proxy-in-use.en.md): the system-proxy conflict criterion, its error code and the "clear only a proxy this app installed" semantics are unchanged; both criteria apply side by side on the same start path;
- In force from `2026-09-21`; accountable owner: cherrchen.

## Alternatives

| Alternative | Pros | Cons | Why not adopted |
| ----------- | ---- | ---- | --------------- |
| Do nothing (keep the prerequisite in documentation only) | Zero implementation cost | The user hits a silent hang while the bridge state stays `running`, with no readable signal; contradicts ADR-0004's principle | The measured hang is on the critical path, so it must leave a readable, actionable failure signal |
| Add a dedicated error code (e.g. `TUN_INTERFERENCE`) | More precise attribution; fully separate copy | The code set is frozen by coding-conventions; adding one is a public-interface change and drags UI/docs/tests along | The semantics belong to the same "environment conflict" family; the existing code and modal already drive the user's action |
| Detect the default route / virtual interfaces | Broader coverage (catches `redir-host` TUN as well) | Platform-specific and prone to false positives (corporate VPNs and other legitimate tunnels would be refused); the Windows side needs a second implementation that cannot be verified on real hardware yet | Zero false positives first: the fake-ip range is the sufficient signal already proven to cause the hang |
| Warn instead of blocking when fake-ip is detected | Changes no currently working path | By the time the warning shows, the bridge has necessarily hung and the user must still back out; needs a new alert channel and status field | Inconsistent with ADR-0004's "refuse rather than half-work", and it does not rescue the user from the hang |

## Consequences

### Positive

- The user gets "refused + executable action" instead of a silent hang after starting the bridge;
- No new error code and no new UI channel: ADR-0004's conflict modal and copy slot are reused;
- False positives are practically impossible: `198.18.0.0/15` is a reserved range that ordinary sites never resolve into;
- The criterion is platform-independent, so the Windows side needs no second implementation (`KI-001` being deferred does not block this decision).

### Negative

- Only the fake-ip shape is covered: a `redir-host` TUN can still hang, which keeps relying on the documented prerequisite (noted in `KI-013` as the leftover);
- Each start performs one extra DNS lookup of the gateway host (milliseconds, skipped on failure) and caches nothing;
- With a non-default `webvpnBase` the check follows that address too (the lookup target is the actual upstream, so the semantics still hold).

### Risks

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| DNS returns `198.18.0.0/15` without TUN interference (in theory only fake-ip tooling does this) | Very low | The user is refused a start | The conflict copy names the action (turn off TUN / fake-ip) so the user can recover; lookup failures fail open |
| A TUN using a non-default fake-ip range in the user's environment | Low | Still hangs (missed detection) | The documented prerequisite stays; `KI-013` records the leftover and leaves room for a later extension |
| Treating "gateway hostname lookup failed" as "safe to start" | Low | Upstream problems surface at runtime instead | A failed lookup only skips the preflight; the bridge's own error/log paths are unchanged (`BRIDGE_CRASH` still covers explicit upstream failures) |

## References

- Related requirements: REQ-004 (environment-conflict check before starting), NFR-004
- Related spec: [specs/001-phase1-local-bridge/spec.md](../../../specs/001-phase1-local-bridge/spec.md), `KI-013`
- Related ADR: [ADR-0004](ADR-0004-refuse-start-when-system-proxy-in-use.en.md)
- Related implementation: [fake-ip.ts](../../../apps/desktop/src/main/fake-ip.ts), `ProxyOrchestrator.runStart()`
