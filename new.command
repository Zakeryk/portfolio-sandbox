#!/bin/bash
cd "$(dirname "$0")"

# Run the Generator
if [ -f "/usr/local/bin/node" ]; then
    /usr/local/bin/node new_project.js
elif [ -f "/opt/homebrew/bin/node" ]; then
    /opt/homebrew/bin/node new_project.js
else
    node new_project.js
fi

echo ""
# Don't close immediately so you can see the result
read -n 1 -s -r -p "Press any key to finish..."
osascript -e 'tell application "Terminal" to close front window' & exit