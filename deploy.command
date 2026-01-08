#!/bin/bash
cd "$(dirname "$0")"

# --- 1. WEB DEPLOY (Smart FTP) ---
echo "--------------------------------------"
# Try to find Node in common locations
if [ -f "/usr/local/bin/node" ]; then
    /usr/local/bin/node smart_deploy.js
elif [ -f "/opt/homebrew/bin/node" ]; then
    /opt/homebrew/bin/node smart_deploy.js
else
    node smart_deploy.js
fi

# --- 2. GITHUB SYNC ---
echo "--------------------------------------"
echo "🐙  CHECKING GITHUB STATUS..."

# Check if there are changes to commit
if [[ `git status --porcelain` ]]; then
  # Add all changes
  git add .
  
  # Commit with timestamp
  git commit -m "Deploy: $(date '+%Y-%m-%d %H:%M')"
  
  # Push to the cloud
  git push origin main
  
  echo "✅  PUSHED TO GITHUB."
else
  echo "✅  NO NEW CHANGES FOR GITHUB."
fi

echo "--------------------------------------"

# --- 3. FINISH ---
exit 0