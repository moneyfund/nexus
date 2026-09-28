# NEXUS 2.0 — SQL Connect migration plan

## Goal

Move NEXUS from a browser/local + Firestore workspace snapshot toward a relational,
multi-user backend without breaking the current application.

## Target stack

- Firebase Authentication: identity and Google login
- Firebase SQL Connect + Cloud SQL PostgreSQL: primary structured data
- Firebase Storage: files and attachments
- Firestore: temporary legacy compatibility during migration
- Next.js/Vercel: application runtime
- OpenAI: NEXUS AI and future voice/agent workflows

## Migration principles

1. Do not delete or overwrite Firestore data during the transition.
2. Build SQL Connect in parallel.
3. Use Firebase Auth UID server-side; client operations must not choose arbitrary user IDs.
4. Store money in integer minor units (cents) instead of floating-point values.
5. Scope business data by workspace from day one.
6. Keep AI write actions auditable and confirmation-gated when sensitive.
7. Keep Firebase Storage paths; PostgreSQL stores only file metadata and references.
8. Migrate entity-by-entity and verify counts before switching reads/writes.

## Phases

### Phase A — relational foundation
Schema, service configuration, connector, generated SDK.

### Phase B — identity and workspace bootstrap
Create AppUser from Firebase Auth, personal workspace, owner membership.

### Phase C — core business modules
Projects, milestones, tasks, dependencies, ideas, goals, calendar and Flow.

### Phase D — finance
Accounts, transactions, receivables, payables, commitments and financial goals.

### Phase E — knowledge and files
Knowledge metadata in PostgreSQL; bytes stay in Firebase Storage.

### Phase F — AI
Conversations, messages, memory, usage, tool actions and audit logs.

### Phase G — automations
Automation definitions/runs, notifications and scheduled execution.

### Phase H — legacy migration
Convert the current Workspace snapshot into relational rows, validate, then switch
read paths first and write paths second.

## Current branch

`nexus-2-sql-connect`

The production `main` branch remains unchanged until SQL Connect is validated.
