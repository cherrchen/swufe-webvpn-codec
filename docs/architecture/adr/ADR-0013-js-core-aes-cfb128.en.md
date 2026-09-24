# ADR-0013: Shared JS core for iOS plugins, with aes-js as the AES block primitive

## Status

`Accepted`

## Date

`2026-09-24`

## Decision Owners

`cherrchen`

## Context

Spec 003 must reproduce the desktop WRD URL rules inside Stash and Loon scripts. The Python authority is AES-128-CFB with a 128-bit segment; the host token is `iv_hex + ciphertext_hex`. Web Crypto and Loon's public AES API do not offer CFB. CryptoJS is unmaintained. `aes-js` 3.1.2 is MIT and has no Node dependency, but its built-in CFB mode does not default to a 128-bit segment.

## Decision

1. Mobile business logic lives in `packages/webvpn-core-js`. That package does not touch host globals or `node:crypto`.
2. The block cipher is pinned to `aes-js@3.1.2`. Core implements CFB128 feedback itself and is checked by the shared Python vectors. The first gate is the captured host token.
3. The desktop Python codec stays as it is. Loon and Stash only add adapters.
4. Effective 2026-09-24. Owner: cherrchen.

## Alternatives

| Option | Benefit | Cost | Why not |
| ------ | ------- | ---- | ------- |
| Copy the Python rules into each host | No new dependency | Two protocol implementations drift | Breaks the shared core |
| Use aes-js CFB directly | Less code | Segment size does not match Python CFB128 | Vectors would fail |
| CryptoJS | CFB is built in | Upstream development has stopped | Already rejected by the spec |

## Consequences

### Positive

- Both hosts share encoding, routing, session handling, and rewrite.
- Protocol drift shows up in the shared vectors.

### Negative

- One more pure-JS dependency to review inside the bundle.
- Core owns the CFB128 feedback instead of delegating the mode.

### Risks

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| aes-js stops receiving updates | Medium | Medium | Pin the version; the block primitive can be replaced; vectors remain |
| Host script size grows | Medium | Low | Bundle scan; size review stays in M4 |

## References

- Requirements: IOS-REQ-005 / IOS-NFR-001 / IOS-REQ-011
- Spec: `specs/003-ios-proxy-client-plugins/`
- Related ADR: ADR-0005
- External: `https://github.com/ricmoo/aes-js`
