# NEXUS deployment flow

`main` is the source of truth.

## Automatic now

- Frontend: every push to `main` is verified and deployed to GitHub Pages.
- CI: tests, TypeScript, lint and production build run on every relevant push.

## Firebase CD prepared

`.github/workflows/firebase-cd.yml` deploys Firebase Functions, Firestore rules
and Storage rules whenever those paths change.

It is intentionally gated until production credentials are configured.

Required GitHub repository configuration:

- Secret: `FIREBASE_SERVICE_ACCOUNT_NEXUS_96795`
- Repository variable: `FIREBASE_AUTO_DEPLOY=true`

Once enabled, ordinary backend updates follow:

`main -> CI -> Firebase CD -> production`

No Cloud Shell is required for normal Functions/rules deployments after this
one-time setup.

## Operations that remain manual by design

- SQL schema migrations / destructive Data Connect changes
- one-off owner data migrations
- backup recovery
- privileged administrative diagnostics

These stay manual because an automatic database migration can be materially
riskier than a normal application deployment.
