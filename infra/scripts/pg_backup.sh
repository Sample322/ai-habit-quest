#!/usr/bin/env bash
set -euo pipefail
TS=$(date -u +%Y%m%d-%H%M%SZ)
OUT=/tmp/ahq-${TS}.sql.gz

: "${DATABASE_URL:?must set}"
: "${S3_ENDPOINT:?must set}"
: "${BUCKET:?must set}"

pg_dump --no-owner --no-privileges "$DATABASE_URL" | gzip -9 > "$OUT"

aws --endpoint-url "$S3_ENDPOINT" s3 cp "$OUT" "s3://$BUCKET/ahq/$(basename "$OUT")"

aws --endpoint-url "$S3_ENDPOINT" s3 ls "s3://$BUCKET/ahq/" \
  | awk '{print $4}' | sort -r | tail -n +8 \
  | while read -r key; do
      [ -z "$key" ] && continue
      aws --endpoint-url "$S3_ENDPOINT" s3 rm "s3://$BUCKET/ahq/$key"
    done

rm -f "$OUT"
echo "backup OK: $OUT"
