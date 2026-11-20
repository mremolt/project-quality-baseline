#!/usr/bin/env sh
# Launcher for apply-ide-config.mjs (Linux, macOS, Git Bash). Windows CMD/PowerShell: apply-ide-config.cmd
exec node "$(dirname "$0")/apply-ide-config.mjs" "$@"
