#!/usr/bin/env sh
# Launcher for sync-baseline.mjs (Linux, macOS, Git Bash). Windows CMD/PowerShell: sync-baseline.cmd
exec node "$(dirname "$0")/sync-baseline.mjs" "$@"
