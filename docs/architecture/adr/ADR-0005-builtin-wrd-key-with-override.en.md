# ADR-0005: Ship a built-in default WRD key with a configuration override

> Chinese source of truth: [ADR-0005-builtin-wrd-key-with-override.md](ADR-0005-builtin-wrd-key-with-override.md)

## Status

`Accepted`

## Date

`2026-09-20`

## Decision Owners

`cherrchen`

## Context

The WRD URL form encrypts the hostname with AES-128-CFB (`segment_size=128`): `https://webvpn.swufe.edu.cn/{http|https}[-{port}]/{iv_hex}{ct_hex}{path}?{query}`, where IV and ciphertext are concatenated as hex and path/query stay in clear text. Encryption and decryption need a key and an IV. A real-device address-bar URL verified that this deployment's default is `key = iv = wrdvpnisthebest!`; if the portal rotates the key, a purely hard-coded distribution would break all rewriting (R6).

Constraints: NFR-002 requires the codec to match the vectors of the verified prototype `wrd_codec.py` (including the authserver / jwxt samples); G-002 requires ≤3 clicks from "logged in" to "browser opens the academic-affairs site", and any manual configuration step that makes the user hunt for a key breaks that experience; the WRD codec library API (`encryptHost` / `decryptHost` / `encodeUrl` / `decodeUrl`) already accepts optional key/iv parameters. The default value and override mechanism must therefore be fixed now.

## Decision

Ship the default `wrdKey` and `wrdIv` built in as `wrdvpnisthebest!` while **keeping a configuration override in `AppSettings`**, so a portal key rotation can be handled by hot configuration change without shipping a new release.

- Built-in defaults: `AppSettings.wrdKey = wrdIv = "wrdvpnisthebest!"`;
- Override: users / maintainers may change `wrdKey` and `wrdIv` through configuration; WrdCodec's `encryptHost(host, key?, iv?)`, `decryptHost(token, key?, iv?)` and `encodeUrl(ordinaryUrl, webvpnHost?)` accept an explicit key/iv at call time and otherwise fall back to the built-in values;
- Do not fetch the key from the portal at runtime (deferred past Phase 1, see Alternatives);
- The key is not a user secret: it introduces no extra logging or storage restrictions, but debug logs still must not contain cookies or bodies (NFR-003);
- In force from Phase 1; owner: cherrchen.

## Alternatives

| Alternative | Pros | Cons | Why not adopted |
| ----------- | ---- | ---- | --------------- |
| Do nothing (neither a built-in default nor an override) | No extra implementation | The codec has no usable key and `encodeUrl` cannot work, so G-001 fails | Requirement unmet |
| Fetch the key from the portal at runtime | In theory tracks rotations automatically | Requires an extra fetch and parse path (breaks when page structure changes), adds an unverified runtime dependency, and no real-device evidence supports that interface | Out of Phase 1 scope; poor value against complexity and uncertainty |
| Require users to enter the key / iv manually | No constant shipped at all | Users must dig the key out of browser dev tools, breaking G-002's click budget; most users cannot do it | Poor experience; directly contradicts the intent of G-002 |

## Consequences

### Positive

- Works out of the box: the default matches the real-device verified value, so the academic-affairs rewriting path needs no configuration (G-001, NFR-002);
- Rotation recoverable: when the portal changes the key, editing configuration restores service without waiting for a release (R6);
- Codec and mitm addon share one default source in the same process, avoiding constant drift between two places.

### Negative

- The default is frozen per release: if the portal rotates while configuration is stale, rewriting fails outright (surfacing as a rewriting error rather than `SESSION_EXPIRED`, and diagnosable only from logs);
- The clear-text default key appears in the repository and in packaged artefacts, as a known and accepted public constant.

### Risks

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| A default-key rotation breaks all rewriting (R6) | Low | Medium | Keep the `wrdKey` / `wrdIv` override; debug logs expose the hosts whose rewriting failed, enabling fast diagnosis and configuration change |
| Codec and configuration defaults diverge (e.g. only one side changed) | Low | Medium | Single source for the default, falling back to the built-in value when configuration omits it; pin behaviour with L0 codec vector tests (NFR-002) |

## References

- Related requirements: REQ-006, NFR-002, NFR-003
- Related spec: [specs/001-phase1-local-bridge/spec.md](../../../specs/001-phase1-local-bridge/spec.md)
- Related ADRs: [ADR-0001](ADR-0001-wrd-rewrite-in-mitm-layer.en.md) (the rewriting layer hosts codec calls), [ADR-0002](ADR-0002-reuse-mitmproxy-for-tls.en.md) (codec and mitm share one Python process)
- Source (archived package, historical provenance only): [04-architecture-and-tech-selection.md §2 ADR-5](../../archive/2026-09-20-swufe-webvpn-bridge-docs-v1.0/01-requirements/04-architecture-and-tech-selection.md)
