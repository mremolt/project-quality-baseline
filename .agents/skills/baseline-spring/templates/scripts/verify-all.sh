#!/usr/bin/env sh
# Runs every gate of `./mvnw verify` and reports all failures in one run (JAVA-TOOL-24); exits non-zero if any failed.
# Maven stops a single-module build at the first failing execution (-fae only continues other modules), so the
# checks run as three independent invocations. Nothing is ignored: each one fails on its own findings.
# Copy to backend/verify-all.sh (chmod +x) and run it from the component folder before the commit. CI runs ./mvnw verify.
failed=""
./mvnw -q spotless:check || failed="$failed format(spotless:apply)"
./mvnw -q compile spotbugs:check || failed="$failed compile/ErrorProne/NullAway/SpotBugs"
./mvnw -q verify -Dspotless.check.skip=true -Dspotbugs.skip=true || failed="$failed tests/ArchUnit/ITs"
if [ -n "$failed" ]; then
  echo "verify-all: FAILED:$failed" >&2
  exit 1
fi
echo "verify-all: all gates green"
