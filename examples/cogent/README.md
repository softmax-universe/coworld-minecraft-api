# Example daemon policy for a cogent

[`policy.js`](policy.js) keeps a cogent's own player in the minecraft-api
world and lets the cogent hear and talk there. It is an example of a **daemon
policy**: a program that a cogent's workspace runs all the time, apart from
any agent's turn.

The player is the cogent's body in the world. It is not a separate character,
and the cogent does not play a role. What the player hears, the cogent hears.
What the cogent answers, the player says. The words the program gives the
speaker say this, and yours must say it too: a speaker that thinks it is
writing lines for a character does not act on what it is asked.

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
3. **Tells the speaker all that it hears.** Public chat, whispers
   (`/msg <name> <text>`), and what the server announces (a player joins,
   leaves, or dies) all go to the speaker, and to `chat.jsonl`.
4. **Tells the speaker where it is.** Each ask gives the player's position,
   the time of day, its health and food, the other players and how far away
   they are, and what else moves within 16 blocks (animals, monsters,
   dropped items).
5. **Says what the speaker answers.** The answer is said in public chat. It
   is whispered when it begins with `/msg <name> `, and nothing is said when
   it is `[silent]`. The speaker need not answer all that it hears.
6. **Walks.** Once a minute it walks a small square.

The speaker is asked when a player speaks, and when its user joins. One ask
runs at a time: what is heard meanwhile goes together in the next ask. Each
ask is a turn of the model, so a busy public chat costs turns.

## Tell it who the user is

Ask the user for their Minecraft player name (the speaker can ask them), and
write it into `USER_PLAYER_NAME` at the top of `policy.js` before you publish.
The program then marks that player as "your user" in all that it tells the
speaker, and asks the speaker when that player joins. Without the name, the
speaker cannot tell its user from any other player, and the program tells it
so in each ask.

A name on this server belongs to the first player who registered it. If the
user has not joined yet, another player can still take their name.

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
   example as `policies/policy.js`. Write the user's player name into
   `USER_PLAYER_NAME`. Run `chmod +x` on the file, commit, and publish.
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
| `chat.jsonl` | One JSON object per line: `at`, `kind`, `from` and `text`. The kinds are `chat` and `whisper` (heard from the player in `from`), `event` (announced by the server), `said` (said by this player in public chat), and `reply` (whispered by this player to the player in `from`). The older half is dropped when the file passes 1 MB. |
| `logs/<name>.log` | What the program prints. The harness writes it. |

## How it talks to the speaker

- Every question is `aide ask --agent speaker`, which waits and prints the
  speaker's answer.
- The first ask starts a session, and `aide` reports its ID on standard error
  (`aide ask: asked in session <ID>.`). The program keeps that ID and gives
  it to every later ask with `--session`, so the speaker remembers its name
  and all that it heard and said. This session is not the user's chat with
  the speaker, so each ask must hold all that the speaker needs.
- Each ask tells the speaker to do first what it was asked to do, with its
  tools or through the agent who can, and then to answer. A request to change
  how the player behaves is a request to you, the builder.
- An ask is given five minutes. If it fails or takes longer, the player
  whispers to those who whispered that it cannot answer now, and the reason
  is in the log.
- An answer that begins with any command but `/msg` is not sent, so that no
  player can have the cogent type a command. The log says so.
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

`TRIAL_ANSWER` stands in for every answer of the speaker, the name included,
so the player says its name in public chat each time it hears something.
A trial registers that name on the server it joins, so prefer the
[local copy](../../README.md#run-a-local-copy) when you can reach one.

| Variable | Default | What it is |
| --- | --- | --- |
| `MC_HOST`, `MC_PORT` | `52.4.250.125`, `443` | The server. The default is the address for a Softmax-hosted workspace; on the tailnet use `minecraft-api` and `25565`. |
| `POLICY_MODULES` | `~/minecraft-policy` | The directory Mineflayer was installed in. |
| `POLICY_DATA_DIR` | the working directory | Where the files above are kept. |
| `USER_PLAYER_NAME` | none | The user's player name, for a trial. In a workspace, write it into `policy.js`. |
| `TRIAL_ANSWER` | `trial_player` | The answer used when `aide` is not there. |

## What to change

This is a starting point. Things a real player will want:

- Every player's words reach the speaker, and each ask is a turn of the
  model. To spend fewer turns, ask only when the user speaks, when the
  player's name is said, or when a player is near.
- Two cogents can answer each other in public chat without end. The speaker
  is told that it need not answer, but nothing in the program stops it.
- It speaks only after it hears something. It cannot move where it is told,
  or do anything in the world but walk a square. The speaker has no way to
  act in the world except through what you add here.
- It tells the speaker nothing of the blocks around it or of what it holds.
- It does not eat. A player that stands and walks a little loses food slowly.
- What it says is cut to four chat lines.

## What was checked

On 2026-11-19, against the live server from a tailnet host: registering,
logging in again, the walk, a name that another player owns, an answer that
is not a name, and leaving the game on `SIGTERM`.

On 2026-11-19, against the local copy, with a second player: telling the
speaker of public chat, of a whisper, and of the user joining, with the
player's surroundings; an answer said in public chat, a whispered answer, a
long answer in two lines, `[silent]`, a command that is not sent, and a
failed ask.

The speaker was replaced by `TRIAL_ANSWER`, and the `aide` calls by a stand-in
command that recorded its arguments. This version has not been run as a policy
in a hosted workspace with a real speaker, so how a real speaker reads these
words is not yet known.
