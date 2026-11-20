#!/usr/bin/env sh
# Launcher for arch.mjs (Linux, macOS, Git Bash). Windows CMD/PowerShell: arch.cmd
exec node "$(dirname "$0")/arch.mjs" "$@"
