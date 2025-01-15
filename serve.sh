#!/bin/bash

# Kill current ollama processes
PIDS=$(pgrep ollama)
if [ -z "$PIDS" ]; then
    echo "No 'ollama' processes found."
else 
    echo "Killing the following 'ollama' processes: $PIDS"
    for PID in $PIDS; do
        sudo kill -9 "$PID" && echo "Killed process $PID"
    done
    echo "All 'ollama' processes terminated."
fi

# Setup ollama server - TODO: host server on specific interface
export GIN_MODE=release
export OLLAMA_HOST=0.0.0.0:11434
export OLLAMA_NUM_PARALLEL=1
export OLLAMA_MAX_QUEUE=1
export OLLAMA_MAX_LOADED_MODELS=1
export OLLAMA_KEEP_ALIVE=10m
export OLLAMA_DEBUG=0

ollama serve
