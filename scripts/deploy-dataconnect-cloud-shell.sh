#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="nexus-96795"
SERVICE_ID="nexus-core"

echo "== NEXUS 2.0 · Firebase SQL Connect deployment =="
echo "Project: $PROJECT_ID"
echo "Service: $SERVICE_ID"
echo

if ! command -v firebase >/dev/null 2>&1; then
  echo "Firebase CLI not found. Using latest CLI through npx..."
  FIREBASE=(npx --yes firebase-tools@latest)
else
  FIREBASE=(firebase)
fi

echo "1/6 · Verifying Firebase authentication..."
"${FIREBASE[@]}" projects:list --json >/tmp/nexus-firebase-projects.json
if ! grep -q "$PROJECT_ID" /tmp/nexus-firebase-projects.json; then
  echo "ERROR: Authenticated Google account does not have access to $PROJECT_ID."
  exit 2
fi

echo "2/6 · Generating SQL Connect SDKs..."
"${FIREBASE[@]}" dataconnect:sdk:generate --project "$PROJECT_ID"

echo "3/6 · Showing database schema diff..."
DIFF_FILE="/tmp/nexus-sql-diff.txt"
"${FIREBASE[@]}" dataconnect:sql:diff "$SERVICE_ID" --project "$PROJECT_ID" | tee "$DIFF_FILE"

if grep -Eiq '(^|[[:space:]])(DROP|TRUNCATE)[[:space:]]' "$DIFF_FILE"; then
  echo "SAFETY STOP: The SQL diff contains DROP/TRUNCATE. No migration was applied."
  exit 3
fi

echo "Safety check passed: no DROP/TRUNCATE detected."
echo "4/6 · Applying PostgreSQL schema migration..."
"${FIREBASE[@]}" dataconnect:sql:migrate --force "$SERVICE_ID" --project "$PROJECT_ID"

echo "5/6 · Deploying SQL Connect schema and connectors..."
"${FIREBASE[@]}" deploy --only dataconnect --project "$PROJECT_ID" -m "NEXUS 2.0 relational foundation"

echo "6/6 · Verifying deployed SQL Connect services..."
"${FIREBASE[@]}" dataconnect:services:list --project "$PROJECT_ID"

echo
echo "SUCCESS: NEXUS SQL Connect deployment completed."
echo "Firestore/Storage were not deployed or modified by this script."
