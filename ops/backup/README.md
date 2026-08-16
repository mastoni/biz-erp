# PostgreSQL Backup and Restore Toolkit

This directory contains the operational toolkit for backing up and restoring the biz-erp PostgreSQL database.

## Architecture

- **Format:** Logical backup using `pg_dump -Fc` (custom format).
- **RPO (Recovery Point Objective):** <= 1 hour (when scheduled hourly).
- **RTO (Recovery Time Objective):** <= 1 hour (restores are fast via `pg_restore`).
- **Storage:** Offsite via S3-compatible object storage.
- **Security:** Secrets are injected via environment variables; credentials are not hardcoded.

## Retention Policy

- **Hourly Backups:** Retained for 7 days.
- **Daily Backups:** Retained for 30 days.
- **Weekly Backups:** Retained for 12 weeks (Optional).

**Implementation:** We recommend managing retention via S3 Bucket Lifecycle Rules rather than complex local scripts.

## Credentials Required

The backup script relies on the following environment variables:

```bash
# Database
POSTGRES_HOST
POSTGRES_PORT
POSTGRES_DB
POSTGRES_USER
PGPASSWORD (optional if using .pgpass)

# S3 Upload
S3_BACKUP_BUCKET
S3_ENDPOINT_URL (optional)
AWS_REGION
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
```

**S3 Credential Profiles:**
- **Backup Writer:** Used by the automation to write objects. Should ONLY have `s3:PutObject` (and optionally `s3:ListBucket`).
- **Restore/Operator:** Used by an admin to fetch backups for recovery. Should have `s3:GetObject` and `s3:ListBucket`.

## Automation (Systemd Timer / Cron)

We recommend using a systemd timer or cron job on the Docker host to trigger the backup script.

Example cron (hourly):
```cron
0 * * * * /usr/bin/env bash /path/to/ops/backup/backup-postgres.sh >> /var/log/bizerp-backup.log 2>&1
```

**Alerting:** You should configure your monitoring platform to alert if the backup script returns a non-zero exit code, OR if no successful backup is detected for > 2 hours.

## Manual Backup

To run a manual backup:
```bash
./backup-postgres.sh
```

## Restore Drill

Restoring to the production database directly via the script is explicitly disabled.

To test a backup, run the restore verification against a disposable database:

```bash
export RESTORE_TARGET=DISPOSABLE
./restore-postgres.sh <path_to_backup.dump>
```

The script will automatically start a temporary PostgreSQL container, restore the data, verify critical tables, and then clean up the container.

## Incident Recovery Sequence

1. **Assess Failure:** Identify whether the failure is data corruption, accidental deletion, or infrastructure failure.
2. **Locate Backup:** Find the most recent valid `bizerp_*.dump` from S3.
3. **Verify Locally:** Use `RESTORE_TARGET=DISPOSABLE ./restore-postgres.sh <backup.dump>` to ensure the backup is valid.
4. **Prepare Target:** Stop application services (`docker compose stop api`).
5. **Restore:** Restore the database explicitly using `pg_restore` targeting your new/cleaned production database.
6. **Verify:** Check application logs and verify connectivity before opening Nginx traffic.
