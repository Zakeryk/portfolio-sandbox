#!/bin/bash
cd "$(dirname "$0")"

# Run the Quick Deploy JS
if [ -f "/usr/local/bin/node" ]; then
    /usr/local/bin/node quick_deploy.js
elif [ -f "/opt/homebrew/bin/node" ]; then
    /opt/homebrew/bin/node quick_deploy.js
else
    node quick_deploy.js
fi

echo ""
read -n 1 -s -r -p "Press any key to close..."