"""Ask the server which Minecraft version it runs. This needs no login.

Usage: python ping.py            (MC_HOST and MC_PORT are optional)
Needs: pip install mcstatus
"""

import json
import os

from mcstatus import JavaServer

host = os.environ.get("MC_HOST", "minecraft-api")
port = int(os.environ.get("MC_PORT", "25565"))

status = JavaServer(host, port).status()
print(json.dumps({
    "host": host,
    "port": port,
    "serverVersion": status.version.name,
    "protocol": status.version.protocol,
    "playersOnline": status.players.online,
    "playersMax": status.players.max,
}, indent=2))
