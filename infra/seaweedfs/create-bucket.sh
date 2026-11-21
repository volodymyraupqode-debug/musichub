#!/bin/sh
# Idempotent S3 bucket bootstrap for SeaweedFS (ADR-0007).
# Creates $S3_BUCKET only when it does not exist yet, then verifies it is listed.
set -eu

MASTER="${SEAWEEDFS_MASTER:-seaweedfs:9333}"
BUCKET="${S3_BUCKET:?S3_BUCKET is required}"

list_buckets() {
  echo "s3.bucket.list" | weed shell -master="$MASTER" 2>/dev/null
}

if list_buckets | grep -Eq "^[[:space:]]*${BUCKET}([[:space:]]|$)"; then
  echo "bucket '${BUCKET}' already exists"
else
  echo "s3.bucket.create -name ${BUCKET}" | weed shell -master="$MASTER"
fi

if list_buckets | grep -Eq "^[[:space:]]*${BUCKET}([[:space:]]|$)"; then
  echo "bucket '${BUCKET}' is ready"
else
  echo "bucket '${BUCKET}' was not created" >&2
  exit 1
fi
