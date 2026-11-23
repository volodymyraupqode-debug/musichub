#!/bin/sh
# Idempotent S3 bucket bootstrap for SeaweedFS (ADR-0007).
# Creates $S3_BUCKET when it does not exist yet and exits 0 only once the bucket is listed.
# A bucket that already exists (also one created concurrently) counts as success. Failures of
# `weed shell` are printed, not hidden, and retried a bounded number of times with backoff;
# after the last attempt the script exits 1 with the last output. Every `weed shell` call has a
# time limit (SIGKILL: on SIGTERM `weed shell` exits 0), because it waits forever for a
# master it cannot reach.
set -eu

MASTER="${SEAWEEDFS_MASTER:-seaweedfs:9333}"
BUCKET="${S3_BUCKET:?S3_BUCKET is required}"
ATTEMPTS="${BOOTSTRAP_ATTEMPTS:-6}"      # sleeps 1+2+3+4+5 = 15 s at most between attempts
CALL_TIMEOUT="${BOOTSTRAP_CALL_TIMEOUT:-10}" # seconds per `weed shell` call; worst case ≈ 6 × 3 × 10 + 15 s

log() { echo "[create-bucket $(date -u +%H:%M:%S)] $*"; }

bucket_listed() {
  LIST_OUTPUT=$(echo "s3.bucket.list" | timeout -s KILL "$CALL_TIMEOUT" weed shell -master="$MASTER" 2>&1) || {
    LIST_OUTPUT="${LIST_OUTPUT}
(weed shell exited with status $? within the ${CALL_TIMEOUT}s limit or was stopped by it)"
    return 1
  }
  printf '%s\n' "$LIST_OUTPUT" | grep -Eq "^[[:space:]]*${BUCKET}([[:space:]]|$)"
}

attempt=1
LIST_OUTPUT=''
CREATE_OUTPUT=''
while [ "$attempt" -le "$ATTEMPTS" ]; do
  if bucket_listed; then
    log "bucket '${BUCKET}' is ready (attempt ${attempt})"
    exit 0
  fi
  log "attempt ${attempt}/${ATTEMPTS}: bucket '${BUCKET}' not listed; creating it"
  if CREATE_OUTPUT=$(echo "s3.bucket.create -name ${BUCKET}" | timeout -s KILL "$CALL_TIMEOUT" weed shell -master="$MASTER" 2>&1); then
    printf '%s\n' "$CREATE_OUTPUT"
  else
    status=$?
    log "s3.bucket.create exited with status ${status} (limit ${CALL_TIMEOUT}s):"
    printf '%s\n' "$CREATE_OUTPUT"
  fi
  if bucket_listed; then
    log "bucket '${BUCKET}' is ready (attempt ${attempt})"
    exit 0
  fi
  [ "$attempt" -lt "$ATTEMPTS" ] && sleep "$((attempt < 5 ? attempt : 5))"
  attempt=$((attempt + 1))
done

log "bucket '${BUCKET}' is not listed after ${ATTEMPTS} attempts" >&2
log "last s3.bucket.list output:" >&2
printf '%s\n' "$LIST_OUTPUT" >&2
log "last s3.bucket.create output:" >&2
printf '%s\n' "$CREATE_OUTPUT" >&2
exit 1
