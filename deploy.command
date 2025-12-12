#!/bin/bash
cd "$(dirname "$0")"

# Run the SMART Deploy
if [ -f "/usr/local/bin/node" ]; then
    /usr/local/bin/node smart_deploy.js
elif [ -f "/opt/homebrew/bin/node" ]; then
    /opt/homebrew/bin/node smart_deploy.js
else
    node smart_deploy.js
fi

echo ""
#read -n 1 -s -r -p "Press any key to close..."

# Kill the window
osascript -e 'tell application "Terminal" to close front window' & exit