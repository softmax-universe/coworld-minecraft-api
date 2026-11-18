"""Bundled placeholder player for minecraft-api.

Connects to the placeholder game, logs the live Minecraft server's connection
details that the game sends, and exits. It does not play Minecraft; a real bot
logs in to the live server as an ordinary Minecraft client (see the repo docs).
"""

from __future__ import annotations

import json
import logging
import os

from websockets.sync.client import connect

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s")
logger = logging.getLogger("minecraft-api.player")


def main() -> None:
    url = os.environ["COWORLD_PLAYER_WS_URL"]
    logger.info("connecting to the placeholder game")
    # ping_timeout=None is required by the Coworld player contract (roles/PLAYER.md).
    with connect(url, ping_timeout=None) as websocket:
        message = json.loads(websocket.recv())
    server = message["server"]
    logger.info("live server info: %s", json.dumps(server))
    logger.info(
        "the real world is the live Minecraft %s server at %s:%d (%s); docs: %s",
        server["minecraft_version"],
        server["host"],
        server["port"],
        server["network"],
        message["docs"],
    )


if __name__ == "__main__":
    main()
