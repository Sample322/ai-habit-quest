# DB backup automation

Production PostgreSQL on Timeweb Managed PG. Backups via daily `pg_dump`
shipped to off-server storage. Two recommended paths — pick one.

## Option A — Timeweb panel (zero-code, recommended for now)

Timeweb Managed PG gives you scheduled backups in the panel:

1. https://timeweb.cloud → Cloud → Базы данных → твоя PG → **Бэкапы**.
2. Enable **Автоматические бэкапы** → выбери частоту **раз в сутки** + время
   (например 03:00 МСК).
3. Set **глубину хранения** = 7 дней.
4. Скачать вручную: панель → Бэкапы → последний → Download.

Done. No code, no env vars, no servers to maintain.

Restore from a panel backup:
1. Создай новую Managed PG того же тира.
2. На странице бэкапов → Restore → выбери целевую базу.
3. Поменяй `DATABASE_URL` на бэкенде через `tw set-env backend DATABASE_URL=…`
   и сделай `tw deploy backend`.

## Option B — Manual cron from a worker (when you want off-Timeweb copies)

Useful if you want backups landing in S3 / Backblaze B2 / Yandex Object
Storage instead of Timeweb.

### Script

`infra/scripts/pg_backup.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
TS=$(date -u +%Y%m%d-%H%M%SZ)
OUT=/tmp/ahq-${TS}.sql.gz
pg_dump --no-owner --no-privileges "$DATABASE_URL" | gzip -9 > "$OUT"

# Ship to S3-compatible bucket. Replace endpoint + bucket with yours.
aws --endpoint-url "$S3_ENDPOINT" s3 cp "$OUT" \
  "s3://$BUCKET/ahq/$(basename "$OUT")"

# Retention: keep last 7 days.
aws --endpoint-url "$S3_ENDPOINT" s3 ls "s3://$BUCKET/ahq/" \
  | awk '{print $4}' | sort -r | tail -n +8 \
  | while read -r key; do
      aws --endpoint-url "$S3_ENDPOINT" s3 rm "s3://$BUCKET/ahq/$key"
    done

rm -f "$OUT"
```

### Where to run

Three options:

1. **Cloudflare Workers Cron Triggers** — already have a Worker for the bot
   proxy. Add a cron trigger that does a `fetch` to an internal backup
   endpoint on a separate tiny container. Cleanest but most setup.
2. **GitHub Actions scheduled workflow** — `.github/workflows/db-backup.yml`
   with `on: schedule: - cron: '0 0 * * *'`. Set repository secrets
   `DATABASE_URL`, `S3_ENDPOINT`, `BUCKET`, `AWS_ACCESS_KEY_ID`,
   `AWS_SECRET_ACCESS_KEY`. Free for public repos, ~2000 min/mo private.
3. **Local crontab on your machine** — fine for the test phase. `crontab -e`
   add `0 3 * * * /path/to/pg_backup.sh > /var/log/ahq-backup.log 2>&1`.

### Minimal GitHub Action

`.github/workflows/db-backup.yml`:

```yaml
name: db-backup
on:
  schedule:
    - cron: '0 0 * * *'   # daily 00:00 UTC = 03:00 МСК
  workflow_dispatch: {}

jobs:
  dump:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    env:
      DATABASE_URL: ${{ secrets.DATABASE_URL }}
      S3_ENDPOINT: ${{ secrets.S3_ENDPOINT }}
      BUCKET: ${{ secrets.BUCKET }}
      AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
      AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
    steps:
      - uses: actions/checkout@v4
      - name: Install pg_dump (matching server major)
        run: |
          sudo apt-get update -qq
          sudo apt-get install -y postgresql-client-16
      - run: chmod +x infra/scripts/pg_backup.sh
      - run: ./infra/scripts/pg_backup.sh
```

## What's in the DB today

Roughly 20 MB compressed at the time of writing. A full nightly dump
finishes in under 30 seconds even on a free GitHub Actions runner —
nothing to worry about in terms of cost.

## Restore test

Restoration is only as good as the rehearsal. At least once:

1. Pull the latest dump from your bucket / panel.
2. Spin up a throwaway local Postgres:
   ```bash
   docker run --rm -d -p 5433:5432 -e POSTGRES_PASSWORD=test postgres:16
   ```
3. Restore:
   ```bash
   gunzip -c ahq-YYYYMMDD-HHMMSSZ.sql.gz | psql postgresql://postgres:test@localhost:5433/postgres
   ```
4. Inspect a few tables — `User`, `Goal`, `DailyTask` row counts should
   match the prod admin dashboard.

If everything matches, you've proven the backup is restorable.

## Status

Pick **A** today (zero work, panel-driven). Migrate to **B** when you
want geographic redundancy or S3-compatible storage.
