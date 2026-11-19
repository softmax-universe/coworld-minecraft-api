# Notes for coding agents

Three kinds of work happen in this repo. Find yours.

## You build policies for a cogent

You are the agent in a cogent's workspace that builds its policies, and the
cogent should have its own player in this world.

- Start from [`examples/cogent/`](examples/cogent/): `policy.js` is an example
  **daemon policy** for this coworld, and its `README.md` says how to run it.
  It asks the speaker to choose the player's name, joins and stays, records
  the chat, and passes each whisper to the speaker and whispers the answer
  back. Copy it into your own workspace, or use it as a guide for your own.
- A player must be a daemon policy. A bot you start from your shell stops
  when your turn ends, and nothing it hears reaches the cogent.
- This coworld takes no submitted policies. The player runs in the cogent's
  workspace and connects as an ordinary Minecraft client.
- The Softmax episode in [`coworld/`](coworld/) is a placeholder that only
  reports the server's address. The coworld's league holds no competition.
- Then read "You are writing a bot" below: all of it applies to the player.

## You are writing a bot

Read, in this order:

1. [`README.md`](README.md): what the server is and the quick start.
2. [`docs/connecting.md`](docs/connecting.md) and [`docs/login.md`](docs/login.md).
3. [`docs/client-libraries.md`](docs/client-libraries.md): pick a library.
   The choice is yours.
4. [`examples/`](examples/): working bots to copy from. `javascript/` and
   `python/` join, walk and leave; `cogent/` stays in the world as a cogent's
   daemon policy.

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
- Ignore `client/`. It is a private submodule holding a Minecraft client for
  people. It shows as an empty folder, and a bot does not need it.

## You are changing this repo

- `client/` is a git submodule pointing at the private
  `softmax-universe/pomme-softmax` repository (branch `softmax`). Change the
  client in that repository, then update the pointer here with
  `git submodule update --remote client` and commit it. `client/SOFTMAX.md`
  is its guide.
- The live server is installed from [`server/`](server/). `server/config/`
  holds only the settings this project changes; the server fills in the rest.
  `local/` builds from the same files, so test a config change locally first.
- `server/versions.env`, [`server.json`](server.json), `coworld/server.json`,
  the `motd` line in `server/config/server.properties`, and
  [`CHANGELOG.md`](CHANGELOG.md) must agree on the Minecraft version. Change
  them together.
- [`examples/cogent/policy.js`](examples/cogent/policy.js) is what a cogent's
  builder copies. Keep it one small file, and keep its `README.md` and the
  section above in step with it.
- After a server change, run both example bots against the local copy, then
  follow [`server/RUNBOOK.md`](server/RUNBOOK.md) to deploy.
- Never commit passwords, the RCON password, or Tailscale keys. They are
  created on the server host.
- JavaScript follows [standard](https://standardjs.com/) style. Python and
  shell stay simple and synchronous.
