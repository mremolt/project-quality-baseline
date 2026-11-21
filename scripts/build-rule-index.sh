#!/usr/bin/env sh
# Launcher for build-rule-index.mjs (Linux, macOS, Git Bash). Windows CMD/PowerShell: build-rule-index.cmd
exec node "$(dirname "$0")/build-rule-index.mjs" "$@"
