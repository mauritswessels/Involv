#!/bin/sh
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
cd /Users/maurits/involv
exec "$NVM_DIR/versions/node/v20.20.2/bin/node" \
     "./node_modules/.bin/vite" \
     --host 0.0.0.0 \
     --port 5173
