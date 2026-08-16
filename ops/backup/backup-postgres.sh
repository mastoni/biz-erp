#!/usr/bin/env bash
set -euo pipefail

# Ensure script is not run concurrently
exec 9>/tmp/backup-postgres.lock
if ! flock -n 9; then
    echo "Another backup is already running. Exiting." >&2
    exit 1
fi

echo "Starting backup process..."

POSTGRES_HOST=${POSTGRES_HOST:-postgres}
POSTGRES_PORT=${POSTGRES_PORT:-5432}
POSTGRES_DB=${POSTGRES_DB:-bizerp}
POSTGRES_USER=${POSTGRES_USER:-bizerp}
# PGPASSWORD can be set in environment or via .pgpass

S3_BACKUP_BUCKET=${S3_BACKUP_BUCKET:-""}
AWS_REGION=${AWS_REGION:-"us-east-1"}

if [[ -z "${S3_BACKUP_BUCKET}" ]]; then
    echo "WARNING: S3_BACKUP_BUCKET not set. Backup will be local only." >&2
fi

TIMESTAMP=$(date -u +"%Y%m%d_%H%M%S")
FILENAME="bizerp_${TIMESTAMP}.dump"
CHECKSUM_FILENAME="bizerp_${TIMESTAMP}.sha256"
TEMP_DIR=$(mktemp -d)

# Set secure permissions
chmod 700 "$TEMP_DIR"

DUMP_PATH="${TEMP_DIR}/${FILENAME}"
CHECKSUM_PATH="${TEMP_DIR}/${CHECKSUM_FILENAME}"

echo "Creating logical backup using pg_dump -Fc..."
# Use PGPASSWORD if it's set and pg_dump doesn't get credentials from .pgpass
pg_dump -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f "$DUMP_PATH"

if [[ ! -s "$DUMP_PATH" ]]; then
    echo "ERROR: Backup file is empty or missing." >&2
    rm -rf "$TEMP_DIR"
    exit 1
fi

echo "Calculating SHA-256 checksum..."
# Works on macOS and Linux
if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$DUMP_PATH" | awk '{print $1}' > "$CHECKSUM_PATH"
elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$DUMP_PATH" | awk '{print $1}' > "$CHECKSUM_PATH"
else
    echo "ERROR: No sha256sum or shasum available." >&2
    exit 1
fi

echo "Checksum: $(cat "$CHECKSUM_PATH")"

if [[ -n "${S3_BACKUP_BUCKET}" ]]; then
    echo "Uploading to S3..."
    
    YEAR=$(date -u +"%Y")
    MONTH=$(date -u +"%m")
    DAY=$(date -u +"%d")
    
    # Path inside the bucket
    S3_BASE_PATH="s3://${S3_BACKUP_BUCKET}/postgres/hourly/${YEAR}/${MONTH}/${DAY}"
    
    ENDPOINT_FLAG=""
    if [[ -n "${S3_ENDPOINT_URL:-}" ]]; then
        ENDPOINT_FLAG="--endpoint-url ${S3_ENDPOINT_URL}"
    fi

    # Upload dump
    aws $ENDPOINT_FLAG s3 cp "$DUMP_PATH" "${S3_BASE_PATH}/${FILENAME}"
    
    # Upload checksum
    aws $ENDPOINT_FLAG s3 cp "$CHECKSUM_PATH" "${S3_BASE_PATH}/${CHECKSUM_FILENAME}"
    
    echo "Upload complete."
fi

# Cleanup
echo "Cleaning up local temporary files..."
rm -rf "$TEMP_DIR"

echo "Backup success."
exit 0
