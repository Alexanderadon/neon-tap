#!/usr/bin/env bash
# Production deploy that survives Vercel's stuck-project bug:
# build locally, upload the prebuilt output into a brand-new Vercel project, move the public
# domain onto it, relink the repo. Usage: bash scripts/deploy-fresh.sh [project-name]
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NAME="${1:-neon-tap-$(date +%s | tail -c 6)}"
DOMAIN="neon-tap-virid.vercel.app"
cd "$ROOT"
npm run -s build
vercel build --prod --yes > /dev/null
TMPDIR_DEPLOY="$ROOT/../.neon-tap-deploy"
rm -rf "$TMPDIR_DEPLOY" && mkdir -p "$TMPDIR_DEPLOY/.vercel"
cp -r .vercel/output "$TMPDIR_DEPLOY/.vercel/output"
cp vercel.json "$TMPDIR_DEPLOY/"
cd "$TMPDIR_DEPLOY"
vercel link --yes --project "$NAME" > /dev/null
URL=$(vercel deploy --prebuilt --prod --yes 2>&1 | grep -o 'https://[a-z0-9-]*-fistin103-3986s-projects.vercel.app' | head -1)
echo "deployed: $URL"
vercel alias set "$URL" "$DOMAIN" 2>&1 | grep -E "Success|Error" | head -1
cp .vercel/project.json "$ROOT/.vercel/project.json"
cd "$ROOT" && rm -rf "$TMPDIR_DEPLOY"
echo "project: $NAME → https://$DOMAIN"
