# M5: Open-Source Preparation

> Status: Done | Owner: cherrchen | Target: TBD | Completed: 2026-09-23

## Goal

Help a first-time repository visitor understand the project's purpose, current usability, risks, and source-run path, while making unresolved decisions for a possible public release explicit. This milestone completes documentation preparation; it does not mean an installable release exists or that the repository has been made public on a hosting platform.

## Scope

- Reshape the repository root README for users and developers, with a semantically aligned English version.
- Remove entry-document status and instructions that conflict with the current implementation.
- Explain the MITM CA impact, authorised-use boundary, supported platforms, known issues, and the current lack of installers in the README.
- Record the boundaries and questions for a future TUN/transparent-gateway design. This memo is not an implementation commitment or an architecture decision.

## Exit criteria

- [x] The root README gives both users and developers a clear entry point; Chinese and English are semantically aligned and repository links point to existing documents.
- [x] The README distinguishes accepted capabilities, known issues, the current source-run path, and unavailable release artifacts.
- [x] The README surfaces the open-source security boundary and MITM CA risk, linking to the security source of truth.
- [x] A future TUN design memo records the scope boundary without promising implementation.
- [x] The roadmap, milestone index, project overview, and README describe the current stage consistently.

## Completion record

2026-09-23: Reorganised the Chinese and English root READMEs, corrected Windows acceptance and `KI-019` status, added source-run instructions, CA risk and release-status notes, and created the [TUN follow-up design memo](../tun-follow-up.en.md).

This milestone does not deliver installers, signing/notarisation, a line-by-line dependency licence audit, a final product name, or a public release. No approved release plan for those items exists in the repository; a public release needs a separately defined scope and plan.
