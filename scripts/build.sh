#!/bin/sh
set -eu

rm -rf dist
pnpm exec tsc
mkdir -p dist/gcm
cp src/gcm/android_checkin.proto dist/gcm/android_checkin.proto
cp src/gcm/checkin.proto dist/gcm/checkin.proto
cp src/mcs.proto dist/mcs.proto
