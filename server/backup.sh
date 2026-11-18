#!/usr/bin/env bash
# Save a copy of the world and the AuthMe database to /var/backups/minecraft-api
# and delete copies older than 7 days. Runs daily from a systemd timer.
set -euo pipefail

server_dir=/opt/minecraft-api
backup_dir=/var/backups/minecraft-api
stamp="$(date -u +%Y%m%dT%H%M%SZ)"

# Flush the world to disk and pause saving so the copy is consistent.
mc-rcon "save-off" >/dev/null
mc-rcon "save-all flush" >/dev/null
trap 'mc-rcon "save-on" >/dev/null' EXIT

tar -C "$server_dir" -czf "$backup_dir/world-$stamp.tar.gz" world plugins/AuthMe

find "$backup_dir" -name 'world-*.tar.gz' -mtime +7 -delete
