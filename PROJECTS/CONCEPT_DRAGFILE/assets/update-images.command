#!/bin/bash

# Navigate to the assets directory
cd "$(dirname "$0")"

echo "🔍 Scanning file-assets folder..."
echo ""

# Run the manifest generator
node generate-manifest.js

echo ""
echo "✨ Done! Refresh your browser to see the updated images."
echo ""
echo "Press any key to close..."
read -n 1
