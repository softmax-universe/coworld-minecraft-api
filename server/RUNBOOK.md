# Server runbook

Operator tasks for the live server. Bot authors do not need this file.

## Where things are

| Thing | Location |
| --- | --- |
| Host | EC2 instance named `minecraft-api`, m7i.2xlarge, Amazon Linux 2023, us-east-1 |
| Tailnet name | `minecraft-api` |
| Server files | `/opt/minecraft-api` (world in `world/`, login database in `plugins/AuthMe/`) |
| Service | `minecraft-api.service`, runs as user `mcserver` |
| Backups | `/var/backups/minecraft-api`, daily at 10:00 UTC, kept 7 days |
| Admin console | `mc-rcon "<command>"` on the host, as root |
| Repo checkout on the host | `~ec2-user/coworld-minecraft-api` |

Admin access is over the tailnet only: `ssh ec2-user@minecraft-api` with the
instance's SSH key.

The security group's only inbound rule is TCP 443 from the three outbound
(NAT gateway) addresses of Softmax's `main` Kubernetes cluster, where hosted
AIDE workspaces run. Those workspaces can only open outbound connections to
port 443. On the host, `server/nftables-minecraft-api.nft` redirects port 443
arriving on the public interface to the Minecraft port, 25565. To check the
rule: `sudo nft list table inet minecraft_api`.

The public address in the docs (`52.4.250.125`) is an Elastic IP named
`minecraft-api`, so it stays the same when the instance is stopped and started.

RCON is Minecraft's remote admin console. `mc-rcon` reads its password from
`/opt/minecraft-api/server.properties`. A firewall rule drops RCON traffic
from everything but localhost.

## Everyday commands

```sh
sudo systemctl status minecraft-api       # is it running
sudo journalctl -u minecraft-api -f       # live log
sudo mc-rcon list                         # who is online
sudo mc-rcon tps                          # ticks per second: 20.0 is healthy
sudo mc-rcon mspt                         # milliseconds per tick: under 50 is healthy
sudo systemctl restart minecraft-api      # restart (kicks everyone)
```

## Deploy a change from this repo

`install.sh` is safe to run again. It keeps the world, the login database, and
the RCON password, replaces the server jar, plugin jar, scripts, and config,
and restarts the server.

```sh
# On your machine, from the repo root:
COPYFILE_DISABLE=1 tar czf - server | ssh ec2-user@minecraft-api \
  'tar xzf - -C ~/coworld-minecraft-api && sudo ~/coworld-minecraft-api/server/install.sh'
```

Test config changes on the local copy first (`local/compose.yaml`).

## Free a name whose password was lost

```sh
sudo mc-rcon "authme unregister <name>"
```

The name can then be registered again. To set a new password without
unregistering: `sudo mc-rcon "authme password <name> <new-password>"`.

## Back up and restore

```sh
sudo systemctl start minecraft-api-backup          # back up now
ls -lh /var/backups/minecraft-api                  # list backups
```

Restore replaces the world and the login database with a backup's contents:

```sh
sudo systemctl stop minecraft-api
sudo mv /opt/minecraft-api/world /opt/minecraft-api/world.broken
sudo -u mcserver tar -C /opt/minecraft-api -xzf /var/backups/minecraft-api/world-<stamp>.tar.gz
sudo systemctl start minecraft-api
```

Delete `world.broken` once the restored world is confirmed good.

Backups are on the same disk as the world. They protect against a wrecked
world, not against losing the disk. EBS snapshots are not set up.

## Upgrade Minecraft

Upgrade only after Mineflayer supports the new version (check
`lib/version.js` in the Mineflayer repo).

1. In `server/versions.env`, set the new `MC_VERSION` and the Paper build's
   URL and SHA-256 (from `https://fill.papermc.io/v3/projects/paper/versions/<version>/builds/latest`),
   and an AuthMe build that supports it.
2. Update `server.json`, `coworld/server.json`, the `motd` in
   `server/config/server.properties`, and `CHANGELOG.md`.
3. Run both example bots against the local copy.
4. Back up, then deploy. Paper upgrades the world in place; it cannot be
   downgraded, so the backup matters.
5. Run the example bots against the live server.

## The server is slow

Healthy is 20.0 ticks per second and under 50 ms per tick.

1. `sudo mc-rcon "paper entity list * minecraft:overworld"` shows creature
   counts. Thousands of ticking monsters means mob limits are too high: lower
   `spawn-limits` in `server/config/bukkit.yml`.
2. Lower `view-distance` and `simulation-distance` in
   `server/config/server.properties`.
3. To see what the main thread is doing, sample it:
   `sudo -u mcserver jcmd $(systemctl show -p MainPID --value minecraft-api) Thread.print`
   and read the `"Server thread"` stack.
4. Only then consider a larger instance. Minecraft does most of its work on
   one thread, so more cores help little.

`examples/javascript/load-test.js` connects 32 bots for a load check (the
player limit). On 2026-11-18, before the limit was lowered from 64 to 32, with
64 bots spread 400 blocks apart and sprinting, the server
held 20.0 ticks per second at about 31 ms per tick. Commands that move many
players at once into new terrain (`spreadplayers @a`) can stall the server for
tens of seconds; move players one at a time.

## Tailscale

The host joined the tailnet as a personal device, not a tagged one. Its
Tailscale key expires (180 days by default) unless a tailnet admin disables
key expiry for the device in the Tailscale admin console. If the host drops
off the tailnet, run `sudo tailscale up --ssh --hostname=minecraft-api` on it
and approve the login. With no SSH port open to the internet, getting to the host then
needs a temporary SSH rule in its security group.

## Secrets

None are in this repo. On the host: the RCON password (in
`server.properties`), bot password hashes (in `plugins/AuthMe/authme.db`), and
Tailscale state. The instance's SSH key is held by the server owner.
