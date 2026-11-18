# minecraft-api Coworld package (placeholder)

The real `minecraft-api` world is a live Minecraft Java server (Paper 26.1.2) that bots reach at
`minecraft-api:25565` on the Softmax tailnet and join as ordinary Minecraft clients. See the
[repository README](../README.md) and `docs/connecting.md`, `docs/login.md`, `docs/client-libraries.md`.

A live, persistent server cannot run as a Coworld episode, but registering a Coworld needs a manifest with a game and a
bundled player that pass `coworld certify`. This directory is that package. Its episode is a placeholder:

- The game accepts each player connection, sends it the contents of `server.json`, and closes the connection. When
  every slot has connected (or `player_connect_timeout_seconds` passes) it writes a score of 1 for each slot that
  connected and 0 for each that did not, then exits.
- The bundled player connects, logs what it received, and exits.

Scores say nothing about Minecraft skill.

## Files

| File | Purpose |
| --- | --- |
| `coworld_manifest_template.json` | Manifest template: schemas, protocol and readme text, the `info` variant, the certification fixture. |
| `compose.yaml` | One service, `minecraft-api`, which fills the `{{MINECRAFT_API_IMAGE}}` placeholder. Built for `linux/amd64`, the platform hosted episodes run on. |
| `Dockerfile` | One image for both roles (game and player). |
| `game/server.py` | The placeholder game. Synchronous `websockets` server. |
| `player/player.py` | The bundled `info-reader` player. |
| `server.json` | Copy of the repository-root `server.json`, so the image build needs only this directory. Keep the two identical. |

The player and global protocols are written inline in the manifest template (`game.protocols`).

## Build, run, certify

Requirements: Docker, [`uv`](https://docs.astral.sh/uv/), and on Apple Silicon Rosetta emulation in the Docker provider
(the images are `linux/amd64`). `uvx` runs the released `coworld` CLI in its own environment; nothing is installed
globally. These commands were last run with `coworld` 0.1.69, which needs Python 3.11 or 3.12.

Run from the repository root:

```bash
export DOCKER_DEFAULT_PLATFORM=linux/amd64   # Apple Silicon only

# 1. Build the image and write coworld/dist/coworld_manifest.json
uvx --python 3.12 coworld@0.1.69 build --project coworld --version 0.1.0

# 2. Run one local episode (a few seconds); prints the results, replay, and log paths
uvx --python 3.12 coworld@0.1.69 run-episode coworld/dist/coworld_manifest.json

# 3. Certify; expect all 10 steps to pass
uvx --python 3.12 coworld@0.1.69 certify coworld/dist/coworld_manifest.json
```

`coworld build` reads `git remote get-url origin` and pins each `source_url` to the current commit, so it fails in a
checkout that has no `origin` remote or no commits. Commit and push to
`https://github.com/softmax-universe/coworld-minecraft-api` before building the version you upload.

The `source-resolves` certification step passes even when the source is not public, but its report then says
"Public source verified for 0/2 runnables". Read the report: after the repository is public it should say 2/2.

## Upload (needs a Softmax user login)

Upload publishes the images and manifest to Softmax, so only do it on purpose. Use a user credential, not a player
identity:

```bash
uvx --python 3.12 coworld@0.1.69 player unset
uvx --python 3.12 --from coworld@0.1.69 softmax status
uvx --python 3.12 coworld@0.1.69 upload-coworld coworld/dist/coworld_manifest.json --wait-certification
```

Add `--visibility private` to the first upload to keep the Coworld visible only to the uploader and the Softmax team.
The first upload of the name `minecraft-api` makes the uploader its owner. For a later version, change `--version` in
the build step.
