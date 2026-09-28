#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="nexus-96795"

echo "== NEXUS AI · Firebase Functions deployment =="
echo "Project: $PROJECT_ID"
echo

echo "1/4 · Checking Firebase access..."
firebase projects:list --json | grep -q "$PROJECT_ID"

echo "2/4 · Installing Functions dependencies..."
npm install --prefix functions

echo "3/4 · Checking OpenAI secret..."
if firebase functions:secrets:access OPENAI_API_KEY >/dev/null 2>&1; then
  echo "OPENAI_API_KEY exists."
else
  echo
  echo "OPENAI_API_KEY is not configured yet."
  echo "Firebase will now ask you to paste the key securely."
  echo "Do not paste the key into GitHub or the NEXUS source code."
  firebase functions:secrets:set OPENAI_API_KEY
fi

echo "4/4 · Deploying NEXUS AI..."
firebase deploy --only functions:nexusAI,functions:nexusAIStatus --project "$PROJECT_ID"

echo
echo "SUCCESS: NEXUS AI backend is deployed."
echo "Open NEXUS > Nexus AI and refresh the page."
