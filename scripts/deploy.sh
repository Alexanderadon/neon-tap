#!/usr/bin/env bash
# Production deploy to the ONE linked Vercel project (see .vercel/project.json): build locally,
# upload the prebuilt output, move the public domain onto the new deployment. Environment
# variables (Upstash Redis for records and duels) live on that project and survive every deploy.
# Usage: bash scripts/deploy.sh
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DOMAIN="neon-tap-virid.vercel.app"
cd "$ROOT"
npm run -s build
vercel build --prod --yes > /dev/null
URL=$(vercel deploy --prebuilt --prod --yes 2>&1 | grep -o 'https://[a-z0-9-]*-fistin103-3986s-projects.vercel.app' | head -1)
[ -n "$URL" ] || { echo "deploy failed"; exit 1; }
echo "deployed: $URL"
vercel alias set "$URL" "$DOMAIN" 2>&1 | grep -E "Success|Error" | head -1
echo "live: https://$DOMAIN"
