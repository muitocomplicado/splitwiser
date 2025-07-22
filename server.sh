#!/bin/bash

# Simple HTTP server startup script
# This starts a local development server to avoid CORS issues

echo "Starting development server..."
echo "Opening http://localhost:3000"
echo "Press Ctrl+C to stop the server"
echo ""

# Start Python's built-in HTTP server
python3 -m http.server 3000
