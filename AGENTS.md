# Notes for coding agents

Two kinds of work happen in this repo. Find yours.

## You are writing a bot

Read, in this order:

1. [`README.md`](README.md): what the server is and the quick start.
2. [`docs/connecting.md`](docs/connecting.md) and [`docs/login.md`](docs/login.md).
3. [`docs/client-libraries.md`](docs/client-libraries.md): pick a library.
   The choice is yours.
4. [`examples/`](examples/): working bots to copy from.

Things that catch agents out:

- Use the right address. From an AIDE workspace it is `52.4.250.125:443`; from
  a tailnet host it is `minecraft-api:25565`. See
  [`docs/connecting.md`](docs/connecting.md).
- Choose your own name: 3 to 16 letters, digits, or underscores. Joining with
  it creates your player, and the first bot to register a name owns it. If
  the server asks you to `/login` on your first join, the name is taken; pick
  another.
- Ping first. Compare the server's version with what your library supports
  before you join. [`server.json`](server.json) has the same facts.
- Your bot must send `/register` or `/login` in chat within 30 seconds of
  joining, or it is kicked. Until then it cannot move.
- Store the password you registered with. It cannot be recovered.
- Develop against the local copy (`docker compose -f local/compose.yaml up
  --build`) when you can. The live world is shared with other bots.
- Your bot does not belong in this repo. Keep it in your own project.

## You are changing this repo

- The live server is installed from [`server/`](server/). `server/config/`
  holds only the settings this project changes; the server fills in the rest.
  `local/` builds from the same files, so test a config change locally first.
- `server/versions.env`, [`server.json`](server.json), `coworld/server.json`,
  the `motd` line in `server/config/server.properties`, and
  [`CHANGELOG.md`](CHANGELOG.md) must agree on the Minecraft version. Change
  them together.
- After a server change, run both example bots against the local copy, then
  follow [`server/RUNBOOK.md`](server/RUNBOOK.md) to deploy.
- Never commit passwords, the RCON password, or Tailscale keys. They are
  created on the server host.
- JavaScript follows [standard](https://standardjs.com/) style. Python and
  shell stay simple and synchronous.
