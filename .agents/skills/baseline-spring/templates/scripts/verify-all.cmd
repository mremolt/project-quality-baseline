@echo off
rem Windows twin of verify-all.sh (JAVA-TOOL-24): runs every gate of mvnw verify, reports all failures, fails at the end.
setlocal
set FAILED=
call mvnw.cmd -q spotless:check || set FAILED=%FAILED% format(spotless:apply)
call mvnw.cmd -q compile spotbugs:check || set FAILED=%FAILED% compile/ErrorProne/NullAway/SpotBugs
call mvnw.cmd -q verify -Dspotless.check.skip=true -Dspotbugs.skip=true || set FAILED=%FAILED% tests/ArchUnit/ITs
if not "%FAILED%"=="" (
  echo verify-all: FAILED:%FAILED% 1>&2
  exit /b 1
)
echo verify-all: all gates green
