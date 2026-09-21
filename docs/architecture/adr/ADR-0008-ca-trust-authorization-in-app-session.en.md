# ADR-0008: The app process writes CA trust settings (keychain writes keep the elevation)

> Chinese source of truth: [ADR-0008-ca-trust-authorization-in-app-session.md](ADR-0008-ca-trust-authorization-in-app-session.md)

## Status

`Accepted`

## Date

`2026-09-21`

## Decision Owners

`cherrchen`

## Context

Installing the local CA (REQ-010, AC-005, TC-E01) requires **two independent writes**, and the two have different authorization requirements:

1. **Put the certificate into the system keychain** (`/Library/Keychains/System.keychain`). That file is root-owned, and a non-root process calling `SecCertificateAddToKeychain` (what `security add-trusted-cert -k <keychain>` / `security add-certificates -k <keychain>` do underneath) only gets `errSecWritePerm` — **no authorization dialog is shown** (measured: `SecCertificateAddToKeychain: Write permissions error.`, exit code 1).
2. **Write trust settings into the admin domain** (`-d`, `kSecTrustSettingsDomainAdmin`). `SecTrustSettingsSetTrustSettings` is governed by `com.apple.trust-settings.admin`, whose rule on this machine is `entitled | authenticate-admin`, and Apple states that "you can only modify trust settings when running in a GUI environment; for example, a launch daemon can't modify the settings" (<https://developer.apple.com/documentation/security/sectrustsettingssettrustsettings(_:_:_:)>).

`KI-007` (kept `Open` until 2026-09-21) was exactly step 2 failing: the app used `runPrivilegedDarwin()` (`osascript -e 'do shell script "…" with administrator privileges'`) to run the whole `security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain <caCert>` — step 1 (root writing the keychain) succeeded, step 2 failed:

```text
SecTrustSettingsSetTrustSettings: The authorization was denied since no user interaction was possible. (1)
```

The root cause is that osascript's privileged child is spawned by `securityd` outside the user's GUI/audit session, so it cannot carry that authorization. The same symptom is publicly reproduced for "Electron + sudo-prompt", together with the manual-`sudo` workaround (<https://stackoverflow.com/questions/65699160/electron-import-x509-cert-to-local-keychain-macos-the-authorization-was-deni>, <https://github.com/jorangreef/sudo-prompt/issues/137>). This round re-verified the root cause: from an osascript child, `security trust-settings-import -d <plist>` reports `SecTrustSettingsImportExternalRepresentation: The authorization was denied since no user interaction was possible. (1)`.

Paths measured as working / not working this round (macOS 15.6, arm64, console user in the `admin` group):

| Command (caller) | Result |
| ---------------- | ------ |
| `security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain <ca>` (plain user) | Exit code 1, `SecCertificateAddToKeychain: Write permissions error.`, no dialog |
| `security add-certificates -k /Library/Keychains/System.keychain <ca>` (osascript elevation = root) | Succeeds; importing twice yields `already in <keychain>` (exit code 1) |
| `security add-trusted-cert -d -r trustRoot <ca>` (plain user, **without** `-k`) | Exit code 0; **without `-k` no keychain write happens** (`trusted_cert_add` only calls `SecCertificateAddToKeychain` when `-k` was given), only that certificate's trust settings are written into the admin domain; `security trust-settings-export -d` then shows the CA's SHA-1 with a fresh `modDate` |
| Effect of that write (end to end) | A leaf issued by that CA is accepted by `/usr/bin/curl` (SecureTransport, i.e. real system trust evaluation) against a local TLS server, HTTP 200; `security verify-cert -c <caCert> -p ssl` exits 0 |
| `security remove-trusted-cert -d <ca>` / `security trust-settings-import -d <plist>` (plain user) | Block (no output, no effect; still hung after 15s / 70s) → unusable for clearing trust settings |
| `security trust-settings-import -d <plist>` (osascript elevation = root) | Fails: `SecTrustSettingsImportExternalRepresentation: The authorization was denied since no user interaction was possible. (1)` |

Conclusion: **the root cause is not "the elevation is not strong enough" but "the process that writes trust settings must live inside the user's GUI session"** — whereas the keychain write is the opposite and must be root.

## Decision

1. On macOS, `install()` in `app/src/main/platform/darwin/cert.ts` performs the CA install in two sequential steps that must use different authorization paths:
   - **Step 1 (keychain, needs root)**: `runPrivilegedDarwin()` runs `security add-certificates -k /Library/Keychains/System.keychain "<caCert>"`. It writes the keychain only and **never touches trust settings**; a stdout line of `already in <keychain>` counts as success (idempotent).
   - **Step 2 (trust settings, admin domain)**: the **app process itself** runs `security add-trusted-cert -d -r trustRoot "<caCert>"` (**without `-k`**), so macOS handles the authorization for this app's own session. It uses `PRIVILEGE_PROMPT_TIMEOUT_MS` (120s) rather than the 10s default command timeout.
2. Scope and prohibitions:
   - `runPrivilegedDarwin()` **may only** be used for "keychain-only" operations (step 1 of the install, and the uninstall's `security delete-certificate -Z <sha1>`); it is **forbidden** to use it for any command that writes trust settings (`add-trusted-cert`, `remove-trusted-cert`, `trust-settings-import`).
   - Anything that loosens the authorization database to buy "no authorization" — such as `security authorizationdb write com.apple.trust-settings.admin allow` — is **forbidden**.
   - A terminal `sudo …` command may appear only as the last-resort hint in an error message, never as an implementation path.
3. Uninstall (`security delete-certificate -Z <sha1>`, osascript elevation) does not touch trust settings: the CLI offers no usable way to clear an admin-domain trust entry (see the table above). The "not installed" state reported by the UI and by `getCaStatus()` is decided by keychain membership (that residue is recorded by `KI-010`).
4. After the install, `security find-certificate … -Z` plus `security verify-cert -c <caCert> -p ssl` (i.e. `getStatus()`) still double-checks the result; the two exit codes and that check together decide what `installCa` returns.

## Alternatives

| Alternative | Pros | Cons | Why not chosen |
| ----------- | ---- | ---- | -------------- |
| Do nothing (keep the manual `sudo security add-trusted-cert …`) | Zero change, worked on real hardware in M4 | Requires the user to open a terminal, defeating the "one click inside the app" goal | Removing that step is the whole point of `KI-007`; the error text also leaks implementation details to the user |
| Keep using osascript elevation for the whole `add-trusted-cert -d -k …` | Reuses existing code | Step 2 always fails (`KI-007`, measured) | Falsified by the Context above: a privileged child is not in the GUI session |
| User trust domain (write `login.keychain-db`, drop `-d`) | Needs no administrator authorization at all | Shrinks the trust scope to "current user only", which does not match REQ-010's system-trust-store acceptance wording | Acceptance requires system-wide trust; changing that wording would be a requirements change |
| Configuration profile (`.mobileconfig`) | Apple's supported deployment path; the system owns the dialogs | Requires a multi-step install in System Settings and targets managed devices; unusable on a developer Mac | Higher interaction cost than today and not "one click in the app" |
| `SMJobBless` privileged helper | Reusable long-term root capability | Adds native code and signing requirements, and **still** needs GUI authorization — it does not solve the session problem of step 2 | Complexity out of proportion to the benefit |
| Have the app call `security add-trusted-cert -d -r trustRoot -k <system keychain>` on its own (steps 1+2 combined) | Fewer commands | Step 1 aborts with `errSecWritePerm` (measured), so step 2 is never reached | Measured failure |
| Skip installing and guide the user through Keychain Access (import by hand, set "Always Trust") | Pure GUI, no terminal | Requires several manual steps and cannot be scripted | Kept only as a last-resort idea for "the authorization dialog could not be shown", never as the default path |

## Consequences

### Positive

- One click inside the app now installs the CA: the keychain write keeps the existing elevation path, the trust-settings write is done by the app process that holds the GUI session, and the user no longer needs a terminal (`KI-007` resolved).
- The responsibility boundary is explicit: `runPrivilegedDarwin()` is narrowed to "keychain-only", so future implementers cannot put trust settings back into the privileged child.
- Failures are classified into "the authorization dialog could not be shown" versus "the user cancelled", and the cancel path leaves nothing behind.

### Negative

- Depends on a `security` CLI detail: **without `-k` it does not write the keychain** (`trusted_cert_add` implementation detail). If Apple changes that behaviour, the "write the keychain first, then the trust settings" split must be re-evaluated.
- Installation still requires an administrator account (root for step 1).
- An admin-domain trust entry cannot be cleared by the CLI after uninstall (`remove-trusted-cert` / `trust-settings-import` hang for a plain user process and fail for an elevated child): after uninstalling, `security verify-cert` may still succeed and `getCaStatus().trusted` may still be `true`, while the UI and the bridge gate (`!installed || !trusted`) decide on keychain membership. That residue is recorded by `KI-010` as a known implementation limitation.
- Whether an authorization dialog appears at all depends on macOS' credential cache: in this round's measurements the install raises a system administrator dialog (`SecurityAgent`'s `SFAuthenticationWindow`, with `authorizationhost` logging `Verify basic credentials`), while repeat operations inside the same session reuse the cached credential (valid for `system.privilege.admin`'s `timeout = 300`) and show no dialog. Re-verifying the "cancel the authorization" branch therefore requires arranging a cold cache.

### Risks

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| Apple changes `security add-trusted-cert`'s behaviour without `-k` (for example by re-adding the keychain write) | Medium | Install fails or drifts | The `find-certificate + verify-cert` double-check at the end of `install()` surfaces any drift as a failure; the `KI-007` re-verification steps can be replayed |
| The authorization dialog cannot be shown in a context without a GUI session | Low | Install fails with a misleading message | Error text is classified on `no user interaction was possible` / user cancel; `PRIVILEGE_PROMPT_TIMEOUT_MS` prevents an unbounded hang |
| The admin-domain trust residue is misread as "still trusted" | Medium | Status misread | The UI decides "not installed" on keychain membership; `KI-010` records the residue and the decision rule |

## References

- Requirements: REQ-010, REQ-011, NFR-005, AC-005
- Spec: `specs/001-phase1-local-bridge/` (TC-E01 / TC-E02 / TC-E03)
- Related ADR: [ADR-0003](ADR-0003-electron-gui-for-phase-1.en.md) (Electron for phase 1)
- Related known issues: `KI-007` (resolved by this ADR), `KI-010` (trust residue after uninstall)
- Implementation: `app/src/main/platform/darwin/cert.ts`, `app/src/main/exec.ts`, `app/src/main/constants.ts`
- External material:
  - <https://developer.apple.com/documentation/security/sectrustsettingssettrustsettings(_:_:_:)>
  - <https://developer.apple.com/documentation/security/security-framework-result-codes>
  - <https://stackoverflow.com/questions/65699160/electron-import-x509-cert-to-local-keychain-macos-the-authorization-was-deni>
  - <https://github.com/jorangreef/sudo-prompt/issues/137>
