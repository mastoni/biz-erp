#!/usr/bin/env bash
set -euo pipefail

if [[ "${RESTORE_TARGET:-}" != "DISPOSABLE" ]]; then
    echo "ERROR: RESTORE_TARGET environment variable MUST be set to 'DISPOSABLE'." >&2
    echo "This script is designed to prevent accidental restores over the production database." >&2
    exit 1
fi

if [[ $# -lt 1 ]]; then
    echo "Usage: $0 <backup_file.dump>" >&2
    exit 1
fi

DUMP_PATH="$1"
CHECKSUM_PATH="${DUMP_PATH%.dump}.sha256"

if [[ ! -f "$DUMP_PATH" ]]; then
    echo "ERROR: File $DUMP_PATH not found." >&2
    exit 1
fi

if [[ -f "$CHECKSUM_PATH" ]]; then
    echo "Verifying checksum..."
    EXPECTED_CHECKSUM=$(cat "$CHECKSUM_PATH")
    if command -v sha256sum >/dev/null 2>&1; then
        ACTUAL_CHECKSUM=$(sha256sum "$DUMP_PATH" | awk '{print $1}')
    elif command -v shasum >/dev/null 2>&1; then
        ACTUAL_CHECKSUM=$(shasum -a 256 "$DUMP_PATH" | awk '{print $1}')
    else
        echo "ERROR: No sha256sum or shasum available." >&2
        exit 1
    fi
    
    if [[ "$EXPECTED_CHECKSUM" != "$ACTUAL_CHECKSUM" ]]; then
        echo "ERROR: Checksum mismatch." >&2
        exit 1
    fi
    echo "Checksum OK."
else
    echo "WARNING: No checksum file found at $CHECKSUM_PATH. Proceeding without checksum verification." >&2
fi

# We use Docker to spin up a disposable DB for verification.
DB_CONTAINER="bizerp_restore_test_$$"
DB_PASSWORD="disposable_pass"
DB_NAME="bizerp_restored"

echo "Starting disposable postgres:16 container..."
docker run --name "$DB_CONTAINER" -e POSTGRES_PASSWORD="$DB_PASSWORD" -d postgres:16

function cleanup {
    echo "Cleaning up disposable container..."
    docker rm -f "$DB_CONTAINER" >/dev/null 2>&1
}
trap cleanup EXIT

echo "Waiting for PostgreSQL to start..."
sleep 5
until docker exec "$DB_CONTAINER" pg_isready -U postgres; do
    echo "Waiting for postgres..."
    sleep 2
done

echo "Creating target database..."
docker exec "$DB_CONTAINER" createdb -U postgres "$DB_NAME"

echo "Running pg_restore..."
# We stream the file to the docker container
docker exec -i "$DB_CONTAINER" pg_restore -U postgres -d "$DB_NAME" -1 --no-owner < "$DUMP_PATH"

echo "Verifying critical tables..."
docker exec -i "$DB_CONTAINER" psql -U postgres -d "$DB_NAME" -tA << 'EOF' > /tmp/verify_$$
SELECT 'businesses:', COUNT(*) FROM businesses;
SELECT 'users:', COUNT(*) FROM users;
SELECT 'user_businesses:', COUNT(*) FROM user_businesses;
SELECT 'products:', COUNT(*) FROM products;
SELECT 'sales:', COUNT(*) FROM sales;
SELECT 'sale_items:', COUNT(*) FROM sale_items;
SELECT 'refresh_tokens:', COUNT(*) FROM refresh_tokens;
SELECT 'idempotency_keys:', COUNT(*) FROM idempotency_keys;
EOF

cat /tmp/verify_$$
rm -f /tmp/verify_$$

echo "Restore verification PASS."
exit 0
