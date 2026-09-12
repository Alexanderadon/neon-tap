#!/usr/bin/env bash
# Separates every registry track that has no 4-stem output yet, one after another, on the CPU.
# Everything heavy lives on D (venv, caches, output); nothing is cleared, finished tracks are skipped.
#   bash tools/demucs/separate-all.sh            # all missing
#   bash tools/demucs/separate-all.sh id1 id2    # only these
set -u
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PY=D:/neon-tap-tools/demucs-venv/Scripts/python.exe
OUT=D:/neon-tap-tools/stems
LOG=D:/neon-tap-tools/separate-all.log
if [ $# -gt 0 ]; then ids="$*"; else ids=$(node -e "console.log(require('$(cygpath -m "$ROOT")/assets-src/tracks.json').map(t=>t.id).join(' '))"); fi
for id in $ids; do
  if [ -f "$OUT/$id/stem-vocals.mp3" ]; then echo "skip $id"; continue; fi
  echo "== $id $(date +%H:%M:%S)" | tee -a "$LOG"
  "$PY" "$ROOT/tools/demucs/separate.py" "$ROOT/public/music/$id.mp3" >> "$LOG" 2>&1 || echo "FAILED $id" | tee -a "$LOG"
done
echo "done $(date +%H:%M:%S)" | tee -a "$LOG"
