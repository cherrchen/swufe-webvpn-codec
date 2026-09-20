# Operations Documentation

> Status: TBD ｜ Owner: <OWNER> ｜ Last Reviewed: <DATE>
>
> Chinese source of truth: [README.md](README.md)

**Purpose**: record long-lived facts about runtime, environments, configuration, deployment, observability, backup and recovery.
**Current state**: framework only, left as `TBD`; adopting projects fill it in.

> Never invent a deployment design or environment topology.

---

## 1. Environments

| Environment | Purpose | Notes | Access |
| ----------- | ------- | ----- | ------ |
| TBD | dev / test / staging / production | TBD | TBD |

## 2. Configuration

| Key | Purpose | Allowed values | Default | Sensitive | Change impact |
| --- | ------- | -------------- | ------- | --------- | ------------- |
| TBD | TBD | TBD | TBD | TBD | TBD |

Configuration sources and precedence: `TBD`
Secret handling: see [security/](../security/README.md)

## 3. Deployment

```text
Artifact:      TBD
Method:        TBD
Release flow:  TBD
Rollback:      TBD
```

> This template ships no deployment/release automation. If a project needs it, add the documents and process there.

## 4. Observability

| Dimension | Tooling | Key signals | Retention |
| --------- | ------- | ----------- | --------- |
| Logs | TBD | TBD | TBD |
| Metrics | TBD | TBD | TBD |
| Tracing | TBD | TBD | TBD |
| Alerts | TBD | thresholds | TBD |

## 5. Backup and recovery

```text
Scope:           TBD
Frequency:       TBD
Retention:       TBD
Restore drills:  TBD
RPO / RTO:       TBD
```

## 6. Incident response

| Phase | Action | Owner |
| ----- | ------ | ----- |
| Detect | TBD | TBD |
| Contain | TBD | TBD |
| Diagnose | TBD | TBD |
| Postmortem | TBD | TBD |

## 7. Related

- Documentation impact of configuration changes ⇒ the documentation update matrix in [documentation-rules.md](../development/documentation-rules.md)
- Security constraints at runtime ⇒ [security/](../security/README.md)
