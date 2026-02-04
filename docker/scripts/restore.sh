#!/bin/sh
# PostgreSQL Restore Script for OpenAlert
# This script restores a PostgreSQL database from a backup file

set -e

# Configuration
BACKUP_DIR=${BACKUP_DIR:-/backups}
POSTGRES_HOST=${PGHOST:-postgres}
POSTGRES_DB=${POSTGRES_DB:-openalert}
POSTGRES_USER=${POSTGRES_USER:-openalert}

echo "============================================"
echo "OpenAlert Database Restore"
echo "============================================"

# Check if backup file is provided
if [ -z "$1" ]; then
    echo "Usage: $0 <backup-file>"
    echo ""
    echo "Available backups:"
    ls -1t "${BACKUP_DIR}"/openalert_backup_*.sql.gz 2>/dev/null || echo "  No backups found"
    exit 1
fi

BACKUP_FILE="$1"

# Check if backup file exists
if [ ! -f "${BACKUP_FILE}" ]; then
    echo "✗ Backup file not found: ${BACKUP_FILE}"
    exit 1
fi

echo "Backup file: ${BACKUP_FILE}"
echo "Database: ${POSTGRES_DB}"
echo "Host: ${POSTGRES_HOST}"
echo ""

# Confirmation prompt
read -p "⚠ This will REPLACE all data in ${POSTGRES_DB}. Continue? (yes/no): " -r
if [ "$REPLY" != "yes" ]; then
    echo "Restore cancelled."
    exit 0
fi

# Create restore point backup
RESTORE_POINT="${BACKUP_DIR}/before_restore_$(date +%Y%m%d_%H%M%S).sql.gz"
echo "Creating restore point backup: ${RESTORE_POINT}"
pg_dump -h "${POSTGRES_HOST}" -U "${POSTGRES_USER}" "${POSTGRES_DB}" | gzip > "${RESTORE_POINT}"

# Restore database
echo "Restoring database..."
if gunzip -c "${BACKUP_FILE}" | psql -h "${POSTGRES_HOST}" -U "${POSTGRES_USER}" "${POSTGRES_DB}"; then
    echo "✓ Database restored successfully"
    echo ""
    echo "Restore point saved at: ${RESTORE_POINT}"
else
    echo "✗ Restore failed!"
    echo ""
    echo "To rollback, run:"
    echo "  $0 ${RESTORE_POINT}"
    exit 1
fi

echo ""
echo "Restore completed at: $(date)"
echo "============================================"

exit 0
