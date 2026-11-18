#!/usr/bin/env bash
# Install or update the minecraft-api server on an Amazon Linux 2023 host.
# Run as root from a checkout of this repo:  sudo server/install.sh
# Safe to run again: it keeps the world, the AuthMe database, and the RCON
# password, and replaces the server jar, plugin jar, and scripts.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
server_dir=/opt/minecraft-api

# The -devel package adds jcmd, used for diagnosing a slow server (see RUNBOOK.md).
dnf install -y java-25-amazon-corretto-headless java-25-amazon-corretto-devel nftables python3 tar

id mcserver &>/dev/null || useradd --system --home-dir "$server_dir" --shell /sbin/nologin mcserver
mkdir -p "$server_dir" /var/backups/minecraft-api

# Keep state that fetch.sh would otherwise overwrite with the repo defaults.
saved_rcon_line=""
if [[ -f "$server_dir/server.properties" ]]; then
  saved_rcon_line="$(grep '^rcon.password=' "$server_dir/server.properties" || true)"
fi

"$here/fetch.sh" "$server_dir"

if [[ -n "$saved_rcon_line" ]]; then
  sed -i "s|^rcon.password=.*|${saved_rcon_line}|" "$server_dir/server.properties"
fi

install -m 0755 "$here/rcon.py" /usr/local/bin/mc-rcon
install -m 0755 "$here/backup.sh" /usr/local/bin/minecraft-api-backup
chown -R mcserver:mcserver "$server_dir" /var/backups/minecraft-api

# RCON has no bind-address setting of its own, so the firewall keeps it local.
install -m 0644 "$here/nftables-minecraft-api.nft" /etc/nftables/minecraft-api.nft
grep -q 'minecraft-api.nft' /etc/sysconfig/nftables.conf \
  || echo 'include "/etc/nftables/minecraft-api.nft"' >> /etc/sysconfig/nftables.conf
systemctl enable --now nftables
systemctl reload nftables

install -m 0644 "$here/systemd/minecraft-api.service" /etc/systemd/system/
install -m 0644 "$here/systemd/minecraft-api-backup.service" /etc/systemd/system/
install -m 0644 "$here/systemd/minecraft-api-backup.timer" /etc/systemd/system/
systemctl daemon-reload
systemctl enable minecraft-api.service minecraft-api-backup.timer
systemctl restart minecraft-api.service
systemctl start minecraft-api-backup.timer

echo "Installed. Waiting for the server to accept RCON commands..."
for _ in $(seq 1 60); do
  if mc-rcon list &>/dev/null; then
    # World border: 5,000 blocks from the centre in every direction.
    mc-rcon "worldborder set 10000"
    mc-rcon list
    exit 0
  fi
  sleep 5
done
echo "The server did not answer RCON in 5 minutes. Check: journalctl -u minecraft-api" >&2
exit 1
