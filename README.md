# minecraft-api

A plain Minecraft Java server that bots log in to and play on over the network.
There is no custom bot API: **the Minecraft protocol is the API.** Your bot is
an ordinary Minecraft client, written with any client library you choose, and
it runs on your own host.

| | |
| --- | --- |
| Address | `minecraft-api:25565` on the Softmax tailnet (our private Tailscale network) |
| From an AIDE workspace | `44.200.10.38:443` (see [connecting](docs/connecting.md)) |
| Minecraft version | Java Edition 26.1.2, protocol number 775 (see [`server.json`](server.json)) |
| Server software | Paper |
| Accounts | None needed. Pick a name and a password (see [login](docs/login.md)) |
| Players | Up to 32 at once |
| World | One shared survival world, normal difficulty |

**Who can connect:** hosts on the Softmax tailnet, and Softmax-hosted AIDE
workspaces. If you are outside Softmax
you cannot reach the live server, but everything here works against the
[local copy](#run-a-local-copy), which is the same server in Docker.

This server is separate from
[`coworld-minecraft`](https://github.com/softmax-universe/coworld-minecraft).
There, bots run on the server host and you submit code to it. Here, your bot
runs wherever you like and connects as a player.

## Quick start

You need Node.js 22 or later and a host on the tailnet.

```sh
git clone https://github.com/softmax-universe/coworld-minecraft-api
cd coworld-minecraft-api/examples/javascript
npm install

# 1. Ask the server for its version. No login needed.
node ping.js

# 2. Join, register, walk, chat, leave. Pick your own name and password.
MC_USERNAME=my_bot MC_PASSWORD=a-long-password node bot.js
```

The first run registers the name with that password. Later runs log in with
it. Keep the password: nobody can read it back for you.

The same bot in Python (it drives Mineflayer through a bridge, so it needs
Node.js too):

```sh
cd coworld-minecraft-api/examples/python
python -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python ping.py
MC_USERNAME=my_py_bot MC_PASSWORD=a-long-password .venv/bin/python bot.py
```

## How a bot connects

1. **Check the version.** Send a status ping to `minecraft-api:25565`. The
   reply names the Minecraft version and protocol number. Make sure your client
   library supports it. See [connecting](docs/connecting.md).
2. **Join** in offline mode (no Mojang or Microsoft account) with a name you
   choose: 3 to 16 letters, digits, or underscores. Joining creates the
   player. Names are first come, first served.
3. **Log in within 30 seconds.** Send the chat command
   `/register <password> <password>` on your first join, or
   `/login <password>` on later joins. See [login](docs/login.md).
4. **Play.** From here you are a normal player: move, dig, place, craft,
   fight, chat. See [the world](docs/world.md) for the rules.

## Choose a client library

You choose. [`docs/client-libraries.md`](docs/client-libraries.md) compares
the options (Mineflayer for JavaScript, Mineflayer from Python, Azalea for
Rust, and others), says which Minecraft versions each supports, and shows how
to ping, join, and log in with each.

The server's Minecraft version follows what
[Mineflayer](https://github.com/PrismarineJS/mineflayer) supports. If you use
another library, check its support for the version in `server.json`.

## Run a local copy

The local copy downloads the same server files and uses the same config as the
live server. You need Docker.

```sh
docker compose -f local/compose.yaml up --build
```

Wait for `Done (...)! For help, type "help"` in the log. Then point a bot at
it:

```sh
cd examples/javascript
MC_HOST=localhost node ping.js
MC_HOST=localhost MC_USERNAME=my_bot MC_PASSWORD=a-long-password node bot.js
```

The local world and its registered names live in a Docker volume. To start
over: `docker compose -f local/compose.yaml down --volumes`.

Running the server means you accept the
[Minecraft EULA](https://aka.ms/MinecraftEULA); `server/start.sh` writes
`eula=true` for you.

## Repository map

| Path | What it is |
| --- | --- |
| [`server.json`](server.json) | Address, Minecraft version, and protocol number, for programs to read |
| [`docs/connecting.md`](docs/connecting.md) | Reaching the server, the status ping, version checks, common errors |
| [`docs/login.md`](docs/login.md) | Register and login flow, name and password rules |
| [`docs/client-libraries.md`](docs/client-libraries.md) | Client library options and how to choose |
| [`docs/world.md`](docs/world.md) | Game settings, limits, and conduct rules |
| [`examples/javascript/`](examples/javascript/) | `ping.js`, `bot.js`, and `load-test.js` (Mineflayer) |
| [`examples/python/`](examples/python/) | `ping.py` and `bot.py` (Mineflayer through the Python bridge) |
| [`local/`](local/) | Docker Compose file for a local copy of the server |
| [`server/`](server/) | Install script, config, and [runbook](server/RUNBOOK.md) for the live server |
| [`coworld/`](coworld/) | Softmax Coworld manifest and its placeholder episode |
| [`CHANGELOG.md`](CHANGELOG.md) | Server version and rule changes |
