#!/usr/bin/env sh
# Launcher for tsc.mjs (Linux, macOS, Git Bash). Windows CMD/PowerShell: tsc.cmd
exec node "$(dirname "$0")/tsc.mjs" "$@"
