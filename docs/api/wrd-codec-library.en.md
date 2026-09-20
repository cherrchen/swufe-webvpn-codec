# WrdCodec Library API

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-21
>
> Chinese source of truth: [wrd-codec-library.md](wrd-codec-library.md)

## Scope

- Provider: the WrdCodec library (logically equivalent to the archived prototype `99-appendix/wrd_codec.py`).
- Consumer: the bridge addon (request rewriting / response reverse rewriting) and app-side tools/tests.
- Form: library-level API; **Python is the authoritative implementation, TypeScript may follow later** (same logic).
- Stability: Evolving — the algorithm and default parameters are verified against a live address-bar URL, but the interface may still change with the Phase 1 implementation.
- Related spec: [specs/001-phase1-local-bridge/spec.md](../../specs/001-phase1-local-bridge/spec.md)

## Authentication and authorisation

Not applicable: a pure functional codec library that touches no network, session state or files; the key/iv come from the caller or from the defaults.

## Common conventions

- Encoding: hostnames are UTF-8; tokens are lowercase hexadecimal strings.
- Time format: not applicable.
- Pagination / rate limiting: not applicable.
- Idempotency: every method is a pure function; the same input yields the same output.

## Methods

```ts
// logically equivalent to wrd_codec.py
encryptHost(host: string, key?: string, iv?: string): string
decryptHost(token: string, key?: string, iv?: string): string
encodeUrl(ordinaryUrl: string, webvpnHost?: string): string
decodeUrl(webvpnUrl: string): string
```

Defaults: `webvpnHost = webvpn.swufe.edu.cn`, `key = iv = wrdvpnisthebest!`.

### `encryptHost(host, key?, iv?): string`

- Purpose: encrypt a hostname into a token (`iv_hex` + ciphertext `hex`), excluding the port.
- Input:

  | Field | Type | Required | Constraint | Notes |
  | ----- | ---- | -------- | ---------- | ----- |
  | `host` | `string` | yes | valid hostname | no port, no scheme |
  | `key` | `string` | no | 16 bytes | default `wrdvpnisthebest!` |
  | `iv` | `string` | no | 16 bytes | default `wrdvpnisthebest!` |

- Output: `{iv_hex}{ciphertext_hex}`.
- Errors: raises when the key or iv is not 16 bytes.

### `decryptHost(token, key?, iv?): string`

- Purpose: decrypt a token back into a hostname.
- Input:

  | Field | Type | Required | Constraint | Notes |
  | ----- | ---- | -------- | ---------- | ----- |
  | `token` | `string` | yes | hexadecimal; length ≥ 34 and even | the first 32 characters are the IV |
  | `key` | `string` | no | 16 bytes | default `wrdvpnisthebest!` |
  | `iv` | `string` | no | 16 bytes | used only as fallback when the token's IV is unusable (length ≠ 16 bytes) |

- Output: the hostname string (trailing `\x00` stripped).
- Errors: raises when the token is too short, has odd length, or contains non-hex characters.

### `encodeUrl(ordinaryUrl, webvpnHost?): string`

- Purpose: ordinary URL → WebVPN URL.
- Input:

  | Field | Type | Required | Constraint | Notes |
  | ----- | ---- | -------- | ---------- | ----- |
  | `ordinaryUrl` | `string` | yes | scheme `http` / `https` with a hostname | e.g. `https://jwxt.swufe.edu.cn/sso/jziotlogin` |
  | `webvpnHost` | `string` | no | — | default `webvpn.swufe.edu.cn` |

- Output: `https://{webvpnHost}/{http|https}[-{port}]/{iv_hex}{ct_hex}{path}?{query}`.
- Errors: raises when the hostname is missing or the scheme is not `http`/`https`.

### `decodeUrl(webvpnUrl): string`

- Purpose: WebVPN URL → ordinary URL (used by response reverse rewriting and for debugging).
- Input:

  | Field | Type | Required | Constraint | Notes |
  | ----- | ---- | -------- | ---------- | ----- |
  | `webvpnUrl` | `string` | yes | path shaped `/{scheme_token}/{token}{path}` | — |

- Output: the ordinary URL (`scheme://host[:port]/path?query#fragment`).
- Errors: raises when the path does not start with `/`, is missing the scheme segment or the host token segment, or has an invalid scheme segment.

## Algorithm facts

- Algorithm: AES-128-CFB with `segment_size=128`.
- Defaults `key = iv = wrdvpnisthebest!` (verified against a live URL; if the school rotates it, configuration can override it — ADR-0005).
- **Only the hostname is encrypted**; path and query stay plaintext.
- URL form: `https://webvpn.swufe.edu.cn/{http|https}[-{port}]/{iv_hex}{ct_hex}{path}?{query}`.
- token = IV (16 bytes) hex + ciphertext hex, i.e. 32 + 2 × host bytes hexadecimal characters.
- Decryption prefers the IV carried in the token (first 32 characters) and falls back to the configured IV when unusable; the plaintext has trailing `\x00` stripped.
- Port: `-{port}` is written only when a port exists and differs from the scheme default (`http` 80 / `https` 443).
- An empty path is treated as `/`; when the input URL carries a fragment, the `#fragment` is preserved after the query.

## Python implementation mapping

Authoritative implementation: `swufe_bridge/wrd_codec.py` (landed in M1).

```python
class WrdCodec:
    def __init__(self, key: str | bytes = "wrdvpnisthebest!", iv: str | bytes = "wrdvpnisthebest!",
                 webvpn_host: str = "webvpn.swufe.edu.cn") -> None: ...
    def encrypt_host(self, host: str) -> str: ...
    def decrypt_host(self, token: str) -> str: ...
    def encode_url(self, ordinary_url: str, webvpn_base: str | None = None) -> str: ...
    def decode_url(self, webvpn_url: str) -> str: ...
```

- Method mapping: `encryptHost` → `encrypt_host`, `decryptHost` → `decrypt_host`, `encodeUrl` → `encode_url` (second parameter is `webvpn_base`, defaulting to `https://{webvpn_host}`), `decodeUrl` → `decode_url`.
- `key` / `iv` accept `str` (encoded as UTF-8) or `bytes` and must be 16 bytes long; the defaults come from the module constants `DEFAULT_KEY` / `DEFAULT_IV` / `DEFAULT_WEBVPN_HOST`.
- AES implementation: `cryptography`'s `Cipher(algorithms.AES(key), CFB(iv))` (i.e. CFB128, equivalent to the prototype's `segment_size=128`; TC-A02 is the gate vector); pycryptodome is not used (see [dependency-policy.md](../development/dependency-policy.md)).
- Errors uniformly raise `WrdCodecError` (a `ValueError` subclass), with messages kept from the prototype: `WRD AES-128 key must be 16 bytes`, `WRD AES-128 IV must be 16 bytes`, `unsupported scheme: ...`, `missing hostname`, `host token too short or not hex`, `invalid WebVPN path`, `WebVPN path missing scheme or host token`, `bad scheme token: ...`; in addition, when the bytes decrypted from a token are not valid UTF-8, a `WrdCodecError` is raised too (the usual outcome of a wrong key).
- CLI: `uv run python -m swufe_bridge.wrd_codec encode <ordinary-url>` / `decode <webvpn-url>` (optional `--key` / `--iv` / `--webvpn-host`; on failure it prints `error: <message>` and returns `2`).
- Tests: `tests/l0/test_wrd_codec.py` (TC-A01..TC-A05 plus the error branches).

## Errors and boundaries

| Condition | Behaviour |
| --------- | --------- |
| key length ≠ 16 bytes | raises `WRD AES-128 key must be 16 bytes` |
| iv length ≠ 16 bytes | raises `WRD AES-128 IV must be 16 bytes` |
| `encodeUrl` input missing a hostname | raises `missing hostname` |
| `encodeUrl` input scheme not `http`/`https` | raises (`unsupported scheme`) |
| `decryptHost` token shorter than 34 characters or of odd length | raises (host token too short or not hex) |
| token contains non-hex characters | hex decoding fails and raises |
| IV carried in the `decryptHost` token is not 16 bytes | falls back to the configured IV, no error |
| decrypted plaintext has trailing `\x00` | trailing `\x00` is stripped before returning |
| `decodeUrl` path does not start with `/` | raises (invalid WebVPN path) |
| `decodeUrl` path missing the scheme or host token segment | raises (WebVPN path missing scheme or host token) |
| `decodeUrl` scheme segment not matching `^(?P<scheme>https?\|http\|https)(?:-(?P<port>\d+))?$` | raises (bad scheme token) |

## Test vectors

- Owned by spec 001, TC-A01..TC-A05, see [../../specs/001-phase1-local-bridge/verification.md](../../specs/001-phase1-local-bridge/verification.md).
- Fixed sample from the prototype `self-check` (includes `authserver`):

  ```text
  https://webvpn.swufe.edu.cn/https/77726476706e69737468656265737421f1e2559434357a467b1ac7bf8f40253097e41b52087752/authserver/login?service=http%3A%2F%2Fjwxt.swufe.edu.cn%2Fsso%2Fjziotlogin
  ```

  It must decode to host `authserver.swufe.edu.cn`, and re-encrypting that host must reproduce the sample token.

## Compatibility promises

- The implementation must match the verified prototype `wrd_codec.py` vectors, including the `authserver` / `jwxt` samples (NFR-002).
- The default key/iv and `webvpnHost` are configurable and may be overridden; an override changes neither the algorithm nor the URL form (ADR-0005).

## Change log

| Date | Change | Compatibility | Related spec / ADR |
| ---- | ------ | ------------- | ------------------ |
| 2026-09-20 | First version: 4 methods, algorithm facts, errors and boundaries, test vector ownership | — | [spec 001](../../specs/001-phase1-local-bridge/spec.md) / [ADR-0005](../architecture/adr/ADR-0005-builtin-wrd-key-with-override.md) |
| 2026-09-21 | Added "Python implementation mapping": module and method signatures, the `cryptography` CFB128 implementation, the `WrdCodecError` error surface, the CLI and the test location | Compatible (new implementation-mapping subsection, no interface semantics changed) | [spec 001](../../specs/001-phase1-local-bridge/spec.md) / [ADR-0005](../architecture/adr/ADR-0005-builtin-wrd-key-with-override.md) |
