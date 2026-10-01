# NEXUS Device Architecture

## Objective

NEXUS keeps the PWA/web product as the universal interface while adding native runtimes where operating-system permissions are required.

Stage 1 targets Windows through a Tauri 2 desktop shell that reuses the existing NEXUS frontend. Android follows with the same Device Bridge contract and platform-specific native implementations.

## Trust boundary

The AI never receives an unrestricted terminal.

Every native operation is exposed as a named, typed tool. The native layer validates the requested operation again even if the frontend already validated it.

Risk levels:

- **read**: device status and other non-destructive observations.
- **standard**: opening an approved application or showing a notification.
- **sensitive**: clipboard, screenshots, file modifications, messages and account-affecting actions.
- **critical**: lock, shutdown/restart, credential/security changes and future payment/device administration actions.

Sensitive and critical actions require explicit user approval. Critical commands must never rely only on an AI-generated confirmation message.

## Stage 1

Implemented:

- Runtime detection: PWA vs native.
- Device identity/status.
- Allowlisted Windows app launch.
- Explicitly confirmed Windows lock.
- Dedicated NEXUS Device UI.
- Windows MSI/NSIS CI build.

Next native tools:

1. system volume/mute;
2. notifications;
3. clipboard with permission controls;
4. selected-file/folder access;
5. screenshot capture and vision handoff;
6. approved browser/app deep links;
7. local wake-word/voice runtime.

## AI integration

Device tools will join the same future NEXUS Tool Registry as Finance, Projects and Calendar. The AI proposes a typed action; the Permission Broker decides whether it can execute automatically or requires confirmation; the Device Bridge performs the action; an audit record stores the result.

## Mobile

The PWA remains useful for normal NEXUS work. Deep Android capabilities require a native runtime because browser sandboxing intentionally blocks broad device control. Android will implement the same TypeScript Device Bridge contract with mobile-specific native commands and Android permissions.
