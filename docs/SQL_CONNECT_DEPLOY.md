# Deploy SQL Connect for NEXUS 2.0

Target Firebase project: `nexus-96795`
Service: `nexus-core`
Location: `us-east4`
Cloud SQL instance: `nexus-core-instance`
Database: `nexus-core`

## Preconditions

- Cloud SQL / SQL Connect service shows a healthy green state in Firebase Console.
- Work only from branch `nexus-2-sql-connect`.
- Do not delete or modify Firestore/Storage data during this phase.

## Local deployment sequence

```bash
git checkout nexus-2-sql-connect
git pull
npm ci

# Sign in only if the Firebase CLI asks for authentication.
npx --yes firebase-tools@latest login

# Generate the typed SDK from the local schema/connectors.
npm run dataconnect:generate

# Review what SQL schema changes will be applied.
npm run dataconnect:diff

# Apply the relational schema to Cloud SQL.
npm run dataconnect:migrate

# Deploy SQL Connect schema + connectors.
npm run dataconnect:deploy

# Verify the web application remains healthy.
npm test
npm run typecheck
npm run lint
npm run build
```

## Safety policy

1. Never run a destructive migration without reviewing `dataconnect:diff`.
2. Firestore remains the current production source until migration validation is complete.
3. Firebase Storage remains the file store.
4. Existing data is copied, never moved, during the first migration.
5. Read switching happens before write switching.
6. The SQL migration records counts/issues before the production cutover.

## First validation after deployment

- AppUser can be upserted from Firebase Auth `auth.uid`.
- Personal workspace can be bootstrapped.
- Authenticated user sees only workspaces where they have an active membership.
- Project CRUD works through connector operations.
- Finance values preserve cents using integer minor units.
- Calendar records persist with provider/sync metadata.
- Knowledge metadata points to Firebase Storage instead of moving file bytes.
- NEXUS AI persistence and tool-action audit tables exist.
- Voice session telemetry table exists.
- Automation definitions can be created but execution remains server-side/future.

## Cutover stages

1. Deploy empty relational schema.
2. Generate/validate SDK.
3. Bootstrap current Firebase user/workspace.
4. Create dry-run migration plan from existing Workspace snapshot.
5. Compare entity counts and issues.
6. Copy legacy data.
7. Verify UI reads against PostgreSQL in a preview branch.
8. Enable PostgreSQL writes.
9. Keep Firestore rollback path temporarily.
10. Merge to main only after verification.
