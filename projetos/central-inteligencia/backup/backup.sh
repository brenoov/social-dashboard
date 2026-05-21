#!/bin/bash
# Daily backup — overwrites the same file each day
PROJ_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cp "$PROJ_DIR/central-inteligencia-v1.1.html" "$PROJ_DIR/backup/central-inteligencia-v1.1.bak.html"
echo "$(date): backup saved" >> "$PROJ_DIR/backup/backup.log"
