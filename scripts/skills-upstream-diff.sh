#!/usr/bin/env sh
# Launcher for skills-upstream-diff.mjs (Linux, macOS, Git Bash). Windows CMD/PowerShell: skills-upstream-diff.cmd
exec node "$(dirname "$0")/skills-upstream-diff.mjs" "$@"
