# NEXUS Auto Update

## Goal

NEXUS Companion checks GitHub Releases after startup and offers **Actualizar y reiniciar** when a newer signed version exists.

The PWA remains independent and continues updating through GitHub Pages.

## Security model

Tauri updater signatures are mandatory. NEXUS uses:

- a **public updater key** embedded into release builds;
- a **private updater key** stored only as an encrypted GitHub Actions secret;
- HTTPS GitHub Releases as the update endpoint;
- Tauri's signature verification before installation.

The private updater key must never be committed, copied into Firestore, placed in the app bundle or shared in chat.

## One-time bootstrap

Run on a trusted Windows machine:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup-nexus-updater.ps1
```

The script generates the key pair under `%USERPROFILE%\.nexus`.

If GitHub CLI is installed and authenticated, it stores the required GitHub Actions secrets automatically. Otherwise add them manually under:

**Repository → Settings → Secrets and variables → Actions**

Required names:

- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
- `NEXUS_UPDATER_PUBKEY`

Keep an offline backup of the private key and its password. Losing it prevents existing updater-enabled installations from accepting future releases.

## Release flow

The updater-enabled release workflow runs from branch `release`.

```text
main
  ↓ verified
release
  ↓
NEXUS Desktop Release
  ↓
signed MSI/NSIS + signatures
  ↓
GitHub Release
  ↓
latest.json
  ↓
installed NEXUS Companion
  ↓
signature verification
  ↓
Update & restart
```

The release workflow uses `tauri-apps/tauri-action`, which creates the GitHub Release assets and `latest.json`.

## Version 0.2.1

0.2.1 is the bootstrap version for the updater code. A user already on 0.2.0 must install the signed 0.2.1 release once. From then on, newer signed releases can be installed inside NEXUS Companion.

## Development builds

Normal pull-request and `main` builds intentionally do not receive the private signing key. They compile and test the updater code but report updater status as **SETUP REQUIRED**. Only release builds carry the public key and can query/install signed updates.
