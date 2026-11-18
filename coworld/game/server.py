"""Placeholder Coworld game for minecraft-api.

The real world is a live Minecraft server that cannot run as a Coworld episode.
This game only hands each player the live server's connection details
(server.json) and scores 1 for every player slot that connected, 0 otherwise.

It implements the Coworld game contract (packages/coworld docs, roles/GAME.md):
config from COGAME_CONFIG_URI, /healthz, /player, /global, the /client/* pages,
results to COGAME_RESULTS_URI, replay to COGAME_SAVE_REPLAY_URI, and replay
mode when COGAME_LOAD_REPLAY_URI is set.

The server is synchronous: `websockets.sync` runs one thread per connection
and answers WebSocket Ping frames itself.
"""

from __future__ import annotations

import json
import logging
import os
import signal
import threading
from http import HTTPStatus
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse
from urllib.request import Request as UrlRequest
from urllib.request import urlopen

from websockets.exceptions import ConnectionClosed
from websockets.http11 import Request, Response
from websockets.sync.server import Server, ServerConnection, serve

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s")
logger = logging.getLogger("minecraft-api.game")
# websockets logs every plain HTTP response (such as /healthz) as "connection rejected (200 OK)".
logging.getLogger("websockets.server").setLevel(logging.WARNING)

GAME_HOST = os.environ.get("COGAME_HOST", "0.0.0.0")
GAME_PORT = int(os.environ.get("COGAME_PORT", "8080"))
DOCS_URL = "https://github.com/softmax-universe/coworld-minecraft-api"
SERVER_INFO = json.loads((Path(__file__).parent.parent / "server.json").read_text())
# Some CDNs reject urllib's default User-Agent, so hosted artifact requests set their own.
HTTP_USER_AGENT = "coworld-minecraft-api/0.1"

PAGE = """<!doctype html>
<meta charset="utf-8">
<title>minecraft-api placeholder</title>
<h1>minecraft-api: placeholder episode</h1>
<p>This episode is a placeholder. The real world is a live Minecraft server; see
<a href="{docs_url}">{docs_url}</a>.</p>
<pre id="message">waiting for the game...</pre>
<script>
  const scheme = location.protocol === "https:" ? "wss:" : "ws:";
  const socket = new WebSocket(scheme + "//" + location.host + "{socket_path}" + location.search);
  socket.onmessage = (event) => {{
    document.getElementById("message").textContent = JSON.stringify(JSON.parse(event.data), null, 2);
  }};
</script>
"""
# Browser page path -> the WebSocket route that page reads from.
CLIENT_PAGES = {"/client/player": "/player", "/client/global": "/global", "/client/replay": "/replay"}


def read_uri(uri: str) -> bytes:
    parsed = urlparse(uri)
    if parsed.scheme in ("http", "https"):
        with urlopen(UrlRequest(uri, headers={"User-Agent": HTTP_USER_AGENT}), timeout=30) as response:
            return response.read()
    return Path(unquote(parsed.path)).read_bytes()


def write_uri(uri: str, payload: dict, method_env_var: str) -> None:
    data = json.dumps(payload).encode()
    parsed = urlparse(uri)
    if parsed.scheme in ("http", "https"):
        request = UrlRequest(uri, data=data, method=os.environ.get(method_env_var, "PUT").upper())
        request.add_header("Content-Type", "application/json")
        request.add_header("User-Agent", HTTP_USER_AGENT)
        with urlopen(request, timeout=60):
            return
    path = Path(unquote(parsed.path))
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


REPLAY_MODE = "COGAME_LOAD_REPLAY_URI" in os.environ
if REPLAY_MODE:
    REPLAY = json.loads(read_uri(os.environ["COGAME_LOAD_REPLAY_URI"]))
    CONFIG = {"tokens": [], "players": []}
else:
    REPLAY = {}
    CONFIG = json.loads(read_uri(os.environ["COGAME_CONFIG_URI"]))
    RESULTS_URI = os.environ["COGAME_RESULTS_URI"]
    SAVE_REPLAY_URI = os.environ["COGAME_SAVE_REPLAY_URI"]

TOKENS = CONFIG["tokens"]
PLAYER_NAMES = [player["name"] for player in CONFIG["players"]]
PLAYER_CONNECT_TIMEOUT_SECONDS = float(CONFIG.get("player_connect_timeout_seconds", 180))

connected_slots: set[int] = set()
connected_slots_lock = threading.Lock()
all_players_connected = threading.Event()
episode_done = threading.Event()
stopping = threading.Event()


def scores() -> list[float]:
    with connected_slots_lock:
        return [1.0 if slot in connected_slots else 0.0 for slot in range(len(TOKENS))]


def global_state() -> dict:
    return {
        "type": "state",
        "placeholder": True,
        "server": SERVER_INFO,
        "docs": DOCS_URL,
        "player_names": PLAYER_NAMES,
        "scores": scores(),
        "done": episode_done.is_set(),
    }


def handle_http(connection: ServerConnection, request: Request) -> Response | None:
    """Answer plain HTTP routes; returning None lets the WebSocket handshake continue."""
    path = urlparse(request.path).path
    if path == "/healthz":
        return connection.respond(HTTPStatus.OK, "ok\n")
    if path in CLIENT_PAGES:
        response = connection.respond(HTTPStatus.OK, PAGE.format(docs_url=DOCS_URL, socket_path=CLIENT_PAGES[path]))
        response.headers["Content-Type"] = "text/html; charset=utf-8"
        return response
    if path == "/player" and player_slot(request) is None:
        return connection.respond(HTTPStatus.FORBIDDEN, "unknown slot or wrong token\n")
    if path in ("/player", "/global", "/replay"):
        return None
    return connection.respond(HTTPStatus.NOT_FOUND, "not found\n")


def player_slot(request: Request) -> int | None:
    """Return the slot a /player request authenticates as, or None when its slot or token is wrong."""
    query = parse_qs(urlparse(request.path).query)
    slot_text = query.get("slot", [""])[0]
    token = query.get("token", [""])[0]
    if not slot_text.isdigit() or int(slot_text) >= len(TOKENS) or TOKENS[int(slot_text)] != token:
        return None
    return int(slot_text)


def handle_websocket(connection: ServerConnection) -> None:
    path = urlparse(connection.request.path).path
    try:
        if path == "/player":
            serve_player(connection, player_slot(connection.request))
        elif path == "/global":
            serve_global_viewer(connection)
        else:
            serve_replay_viewer(connection)
    except ConnectionClosed:
        pass


def serve_player(connection: ServerConnection, slot: int) -> None:
    message = {"type": "server_info", "slot": slot, "placeholder": True, "server": SERVER_INFO, "docs": DOCS_URL}
    connection.send(json.dumps(message))
    logger.info("player slot %d connected and received the server info", slot)
    with connected_slots_lock:
        connected_slots.add(slot)
        if len(connected_slots) == len(TOKENS):
            all_players_connected.set()
    # Returning closes the WebSocket normally; that close is the player's signal to exit.


def serve_global_viewer(connection: ServerConnection) -> None:
    connection.send(json.dumps(global_state()))
    while not episode_done.is_set() and not stopping.is_set():
        episode_done.wait(timeout=1.0)
    connection.send(json.dumps(global_state()))


def serve_replay_viewer(connection: ServerConnection) -> None:
    # The replay is one frame, so there is nothing to play back or loop.
    connection.send(json.dumps({"type": "replay", **REPLAY}))
    stopping.wait()


def finish_episode(server: Server) -> None:
    """Wait for the players, then write the replay and the results and stop the server."""
    if not all_players_connected.wait(timeout=PLAYER_CONNECT_TIMEOUT_SECONDS):
        logger.info("player connect timeout after %.0f seconds", PLAYER_CONNECT_TIMEOUT_SECONDS)
    results = {"scores": scores()}
    logger.info("episode finished, scores=%s", results["scores"])
    replay = {"placeholder": True, "server": SERVER_INFO, "docs": DOCS_URL, "player_names": PLAYER_NAMES, **results}
    write_uri(SAVE_REPLAY_URI, replay, "COGAME_SAVE_REPLAY_METHOD")
    # Results are the completion marker, so they are written last.
    write_uri(RESULTS_URI, results, "COGAME_RESULTS_METHOD")
    episode_done.set()
    server.shutdown()


def main() -> None:
    with serve(handle_websocket, GAME_HOST, GAME_PORT, process_request=handle_http) as server:

        def stop(_signal_number: int, _frame: object) -> None:
            stopping.set()
            server.shutdown()

        # Python running as PID 1 in a container ignores SIGTERM unless a handler is installed.
        signal.signal(signal.SIGTERM, stop)
        if REPLAY_MODE:
            logger.info("serving replay on port %d", GAME_PORT)
        else:
            logger.info("waiting for %d player(s) on port %d", len(TOKENS), GAME_PORT)
            threading.Thread(target=finish_episode, args=(server,), daemon=True).start()
        server.serve_forever()


if __name__ == "__main__":
    main()
