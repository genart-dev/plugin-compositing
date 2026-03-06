#!/usr/bin/env bash
# Render compositing plugin test images using the genart CLI.
# Usage: bash test-renders/render.sh
#
# Prerequisites:
#   cd ~/genart-dev/cli && npm link   (makes `genart` available globally)
#   — or use: npx --prefix ~/genart-dev/cli genart ...

set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"

GENART="${GENART_CLI:-genart}"

echo "Rendering gradient-types..."
"$GENART" render "$DIR/gradient-types.genart" -o "$DIR/gradient-types.png"

echo "Rendering gradient-variations..."
"$GENART" render "$DIR/gradient-variations.genart" -o "$DIR/gradient-variations.png"

echo "Done. Output in $DIR/"
