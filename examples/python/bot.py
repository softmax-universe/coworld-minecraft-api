"""Example bot in Python: join, register or log in, walk, chat, and leave.

This drives Mineflayer (a JavaScript library) from Python through the
`javascript` bridge package, so Node.js 22 or later must be installed too.

Usage:
    MC_USERNAME=my_bot MC_PASSWORD=a-long-password python bot.py

Optional: MC_HOST (default minecraft-api), MC_PORT (default 25565),
MC_SECONDS (how long to walk, default 10).
"""

import os
import re
import sys
import threading

from javascript import On, require

MINEFLAYER_VERSION = "4.39.0"
LOGIN_SUCCESS = re.compile(r"successfully (registered|logged in)|successful login", re.IGNORECASE)

host = os.environ.get("MC_HOST", "minecraft-api")
port = int(os.environ.get("MC_PORT", "25565"))
username = os.environ.get("MC_USERNAME")
password = os.environ.get("MC_PASSWORD")
walk_seconds = int(os.environ.get("MC_SECONDS", "10"))

if not username or not password:
    sys.exit("Set MC_USERNAME (3 to 16 letters, digits, or underscores) and MC_PASSWORD (8 or more characters).")

mineflayer = require("mineflayer", MINEFLAYER_VERSION)

# No "version" option: Mineflayer pings the server and uses its version.
# "offline" means no Mojang account. The server checks our password instead.
bot = mineflayer.createBot({"host": host, "port": port, "username": username, "auth": "offline"})

logged_in = threading.Event()
disconnected = threading.Event()


@On(bot, "messagestr")
def handle_message(message, *args):
    """Answer the login plugin's prompt, which repeats until the bot answers."""
    print(f"[server] {message}")
    if logged_in.is_set():
        return
    if LOGIN_SUCCESS.search(message):
        logged_in.set()
    elif "/register" in message:
        bot.chat(f"/register {password} {password}")
    elif "/login" in message:
        bot.chat(f"/login {password}")


@On(bot, "kicked")
def handle_kicked(*args):
    # For example "The server is full!" when all 64 places are taken.
    print(f"Kicked: {args[0] if args else 'no reason given'}", file=sys.stderr)


@On(bot, "end")
def handle_end(*args):
    print(f"Disconnected: {args[0] if args else 'no reason given'}")
    disconnected.set()


def describe_position() -> str:
    position = bot.entity.position
    return f"x={position.x:.1f} y={position.y:.1f} z={position.z:.1f}"


# The login plugin kicks a bot that has not logged in after 30 seconds.
if not logged_in.wait(timeout=40):
    print("Did not log in within 40 seconds.", file=sys.stderr)
    os._exit(1)

print(f"Logged in as {bot.username} on Minecraft {bot.version}. Start: {describe_position()}")
bot.chat(f"Hello from {bot.username} (Python). I will walk for {walk_seconds} seconds.")

# Hold "forward" and "jump" so the bot walks and hops over low obstacles.
bot.setControlState("forward", True)
bot.setControlState("jump", True)
disconnected.wait(timeout=walk_seconds)
bot.clearControlStates()

print(f"End: {describe_position()} health={bot.health} food={bot.food}")
bot.quit()
disconnected.wait(timeout=5)
# The bridge keeps a Node.js process alive, so exit explicitly.
os._exit(0)
