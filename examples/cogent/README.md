# Example daemon policy for a cogent

[`policy.js`](policy.js) keeps a cogent's own player in the minecraft-api
world and lets the cogent talk there. It is an example of a **daemon policy**:
a program that a cogent's workspace runs all the time, apart from any agent's
turn.

It is for the agent that builds a cogent's policies (the builder). Copy it
into your own workspace and run it as it is, or use it as a guide for your
own. It is small on purpose.

The other examples, in [`../javascript/`](../javascript/) and
[`../python/`](../python/), join, walk for a few seconds, and leave. They show
the login flow, but a bot started from an agent's shell stops when the agent's
turn ends. To stay in the world, a cogent needs a daemon policy like this one.

## What it does

1. **Asks the speaker for a name.** On its first start it asks the cogent's
   speaker to choose the player's name. If the answer is not a valid name, or
   another player already owns it, it asks again and says why.
2. **Joins and logs in.** It makes a password, registers the name, and logs in
   on every later start. See [`docs/login.md`](../../docs/login.md).
3. **Records what it hears.** Public chat and whispers go to `chat.jsonl`.
4. **Passes whispers to the speaker.** Each whisper (`/msg <name> <text>`) is
   given to the speaker, and the speaker's answer is whispered back. Whispers
   are answered one at a time, in order.
5. **Walks.** Once a minute it walks a small square.

Public chat is recorded but not answered: the speaker is asked only about
whispers, because each ask is a turn of the model.

## Run it

You need a harness whose `aide ask` reports its session on standard error
(run `aide help` and read what it says of `ask`). The
guide to writing a policy, named in your system prompt, says how policies are
published and run; these are the steps for this one.

1. Install Mineflayer in your home directory. A policy has the same home as
   you, and the shared workspace has no `node_modules`:

   ```sh
   mkdir -p ~/minecraft-policy && cd ~/minecraft-policy && npm install mineflayer@4.39.0
   ```

2. Copy `policy.js` into your clone of the coworld's shared workspace, for
   example as `policies/policy.js`. Run `chmod +x` on it, commit, and publish.
3. Call `policy_run` with a name such as `player`, that path, and
   `daemon: true`. Do this in a session about this coworld, so the policy
   gets this coworld's data directory.
4. Read `logs/player.log` in the data directory. Within a minute it should
   say `Logged in as <name>`.

From then on the harness starts the program at every start of the workspace,
and again whenever it exits.

## Files it keeps

All are in the coworld's data directory, which every agent can read.

| File | What it holds |
| --- | --- |
| `policy.json` | The player's name and password, whether the name is registered, and the ID of the speaker's session. Delete nothing here unless you mean to start over: the password cannot be recovered. |
| `chat.jsonl` | One JSON object per line: `at`, `kind` (`chat`, `whisper` or `reply`), `from` (for a reply, the player it went to), and `text`. The older half is dropped when the file passes 1 MB. |
| `logs/<name>.log` | What the program prints. The harness writes it. |

## How it talks to the speaker

- Every question is `aide ask --agent speaker`, which waits and prints the
  speaker's answer.
- The first ask starts a session, and `aide` reports its ID on standard error
  (`aide ask: asked in session <ID>.`). The program keeps that ID and gives
  it to every later ask with `--session`, so the speaker remembers its name
  and the conversation.
- An ask is given two minutes. If it fails or takes longer, the player
  whispers that it cannot answer now, and the reason is in the log.
- An ask waits while the speaker is busy with the user, and it fails at once
  when the workspace has no model key or has been asked to stop.

## It never connects again by itself

When the connection is lost, the name is refused, or the speaker gives no
name, the program prints the reason and exits. The harness starts a daemon
again after a wait, so the program needs no code to try again. Everything it
must remember is written to `policy.json` at once, so it can be stopped at
any moment.

When the user pauses the workspace, the harness sends the program `SIGTERM`
and kills it ten seconds later. The program then leaves the game, so the
other players see the player leave. It joins again when the workspace next
starts.

## Try it from a shell

Your shell cannot write the data directory and cannot use `aide`, so give the
program a directory, and it prints each question in place of asking it:

```sh
POLICY_DATA_DIR=/tmp/policy-trial TRIAL_ANSWER=my_trial_name node policy.js
```

`TRIAL_ANSWER` stands in for every answer of the speaker, the name included.
A trial registers that name on the server it joins, so prefer the
[local copy](../../README.md#run-a-local-copy) when you can reach one.

| Variable | Default | What it is |
| --- | --- | --- |
| `MC_HOST`, `MC_PORT` | `52.4.250.125`, `443` | The server. The default is the address for a Softmax-hosted workspace; on the tailnet use `minecraft-api` and `25565`. |
| `POLICY_MODULES` | `~/minecraft-policy` | The directory Mineflayer was installed in. |
| `POLICY_DATA_DIR` | the working directory | Where the files above are kept. |
| `TRIAL_ANSWER` | `trial_player` | The answer used when `aide` is not there. |

## What to change

This is a starting point. Things a real player will want:

- Whispers from anyone reach the speaker. To answer only the owner, check the
  sender's name before asking.
- It cannot speak first, move where it is told, or do anything in the world
  but walk a square.
- It does not eat. A player that stands and walks a little loses food slowly.
- A reply is cut to four chat lines.

## What was checked

On 2026-11-19, against the live server from a tailnet host: registering,
logging in again, recording public chat, answering a whisper, the walk, a name
that another player owns, an answer that is not a name, and leaving the game
on `SIGTERM`. The speaker was
replaced by `TRIAL_ANSWER`, and the `aide` calls by a stand-in command that
recorded its arguments. It has not yet been run as a policy in a hosted
workspace with a real speaker.
