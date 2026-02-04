#!/bin/sh
# PostgreSQL Backup Script for OpenAlert
# This script creates timestamped backups of the PostgreSQL database

set -e

# Configuration
BACKUP_DIR=${BACKUP_DIR:-/backups}
POSTGRES_HOST=${PGHOST:-postgres}
POSTGRES_DB=${POSTGRES_DB:-openalert}
POSTGRES_USER=${POSTGRES_USER:-openalert}
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-7}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/openalert_backup_${TIMESTAMP}.sql.gz"

echo "============================================"
echo "OpenAlert Database Backup"
echo "============================================"
echo "Started at: $(date)"
echo "Backup file: ${BACKUP_FILE}"

# Create backup directory if it doesn't exist
mkdir -p "${BACKUP_DIR}"

# Create backup
echo "Creating database backup..."
if pg_dump -h "${POSTGRES_HOST}" -U "${POSTGRES_USER}" "${POSTGRES_DB}" | gzip > "${BACKUP_FILE}"; then
    echo "✓ Backup completed successfully"
    echo "  Size: $(du -h "${BACKUP_FILE}" | cut -f1)"
else
    echo "✗ Backup failed!"
    exit 1
fi

# Clean up old backups
echo "Cleaning up old backups (older than ${RETENTION_DAYS} days)..."
find "${BACKUP_DIR}" -name "openalert_backup_*.sql.gz" -type f -mtime +${RETENTION_DAYS} -delete
echo "✓ Cleanup completed"

# List current backups
echo ""
echo "Current backups:"
ls -lh "${BACKUP_DIR}"/openalert_backup_*.sql.gz 2>/dev/null || echo "  No backups found"

echo ""
echo "Backup completed at: $(date)"
echo "============================================"

# Optional: Upload to S3 if configured
if [ -n "${AWS_BACKUP_BUCKET}" ]; then
    echo "Uploading to S3: ${AWS_BACKUP_BUCKET}..."
    if command -v aws >/dev/null 2>&1; then
        aws s3 cp "${BACKUP_FILE}" "s3://${AWS_BACKUP_BUCKET}/database-backups/" --storage-class GLACIER
        echo "✓ Uploaded to S3"
    else
        echo "⚠ AWS CLI not found, skipping S3 upload"
    fi
fi

exit 0
