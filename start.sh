#!/usr/bin/env bash
cd "$(dirname "$0")/app"
PORT=8765
echo "Avvio Sneaker Cover su http://localhost:$PORT ..."
# Ottieni IP locale per aprirlo da iPhone se collegato alla stessa Wi-Fi
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "localhost")
echo "📱 Da iPhone (sulla stessa Wi-Fi): http://$LOCAL_IP:$PORT"
echo "💻 Da Mac: http://localhost:$PORT"
open "http://localhost:$PORT" 2>/dev/null || true
python3 -m http.server $PORT
