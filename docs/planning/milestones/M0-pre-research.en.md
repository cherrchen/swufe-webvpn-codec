# M0: Pre-research

> Status: Done
> Owner: cherrchen
> Target: TBD (the original package defines no date)
>
> Chinese source of truth: [M0-pre-research.md](M0-pre-research.md)

## Goal

Freeze the factual base of Phase 1 so the implementation phase does not have to redo it:

- **WRD codec verified**: the codec conclusions match the vectors of the verified prototype `wrd_codec.py` (including the authserver / jwxt samples, NFR-002);
- **Requirement specs complete**: goals and non-goals, product/functional/non-functional requirements, UI/UX, technical design, architecture selection, interfaces, data model, test plan and cases;
- **Document package archived**: the original document package is kept verbatim as history and provenance evidence.

## Included specs

| Spec | Status | Dependencies |
| ---- | ------ | ------------ |
| — (M0 belongs to no spec; its output is the requirement input of [001-phase1-local-bridge](../../../specs/001-phase1-local-bridge/spec.md)) | — | — |

## Exit criteria

- [x] WRD codec verification passed: codec conclusions match the prototype vectors (the samples covered by TC-A01..TC-A05 work; default `key=iv=wrdvpnisthebest!`, overridable by config)
- [x] Phase 1 requirement specs finalized: G-001..G-004, NG-001..NG-008, PR-001..PR-005, REQ-001..REQ-011, NFR-001..NFR-007
- [x] Architecture and interface facts frozen: components/data flow/data model/interfaces, ADR-0001..ADR-0005, bridge state machine and error codes
- [x] Test plan and case table (TC-A01..TC-H02), WBS, milestones and risk register (R1..R6) written
- [x] Document package archived: [docs/archive/2026-09-20-swufe-webvpn-bridge-docs-v1.0/](../../archive/2026-09-20-swufe-webvpn-bridge-docs-v1.0/README.md)

## Risks

| Risk | Impact | Mitigation |
| ---- | ------ | ---------- |
| R5 School policy restricts automation (low/high) | If the school disallows this access method, the main path cannot ship | Private use first; documentation states the usage boundary (only serves users entitled to use WebVPN); degrade to manual conversion if needed |
| R6 Default key rotation (low/medium) | The default `key`/`iv` that codec verification relies on stops working, breaking URL rewriting and decoding | Built-in default + config override (see [ADR-0005](../../architecture/adr/ADR-0005-builtin-wrd-key-with-override.md)), with room reserved for reading the portal |

## Completion record

- Completed on: 2026-09-20;
- Evidence: archived package [docs/archive/2026-09-20-swufe-webvpn-bridge-docs-v1.0/](../../archive/2026-09-20-swufe-webvpn-bridge-docs-v1.0/README.md) (verbatim copy of the original zip, 16 files, including `99-appendix/wrd_codec.py`);
- Remaining issues: none (implementation has not started; the original package defines no calendar dates, so later milestones have `Target: TBD`).
