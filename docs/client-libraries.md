# Client libraries

Last checked: 2026-11-18

This server has no custom API. It is a plain Minecraft Java server, and the
Minecraft network protocol is the API. A bot is an ordinary Minecraft client.
Any client library that speaks Minecraft Java protocol number 775 works. That
is the protocol of Minecraft 26.1, 26.1.1, and 26.1.2 (all three share number
775; source: the `minecraft-data` table at
<https://github.com/PrismarineJS/minecraft-data/blob/master/data/pc/common/protocolVersions.json>).

We do not push a library. Pick the one that fits your language and your task.

One rule matters for your choice: **the server's Minecraft version is pinned to
what Mineflayer supports.** The server moves to a new version only after
Mineflayer supports it. If you use any other library, you must check that
library's own support for the server version, now and after every server
upgrade.

## Check the server version first

Do this before you install anything.

- **Status ping.** The status ping (also called the server list ping) is the
  request a Minecraft client makes to fill its server list. It needs no login
  and no account. The reply contains the version name (for example
  `Paper 26.1.2`) and the protocol number (`775`). Every library below can send
  it.
- **`server.json`** in the repo root records the same version.
- **[`docs/connecting.md`](connecting.md)** has the address, the join steps,
  and the login rules.

Facts every snippet below relies on:

- Host `minecraft-api`, port `25565`.
- Offline mode: the server does not check a Mojang or Microsoft account. You
  choose a username.
- After you join, the server's AuthMe plugin prompts you in chat. Within 30
  seconds you must send the chat command `/register <password> <password>`
  (first join) or `/login <password>` (later joins).

## Comparison

| Library | Language | Level | Latest release | Supports 26.1.2 (protocol 775)? |
| --- | --- | --- | --- | --- |
| [Mineflayer](#mineflayer) | JavaScript (Node.js) | High: world state and actions | 4.39.0, 2026-09-06 | Yes |
| [Mineflayer from Python](#mineflayer-from-python) | Python driving Node.js | High (same as Mineflayer) | `javascript` 1.2.6, 2025-09-25 | Yes, through Mineflayer |
| [Mindcraft](#mindcraft) | JavaScript, driven by an LLM | Very high: a complete LLM agent | v0.1.4, 2026-03-20 | No. Its README says up to 1.21.11 |
| [Azalea](#azalea) | Rust | High: world state and actions | 0.16.0+mc26.1, 2026-03-28 | Yes, only with release 0.16.0. Git `main` targets 26.2 |
| [node-minecraft-protocol](#node-minecraft-protocol) | JavaScript (Node.js) | Low: raw packets | 1.68.0, 2026-08-27 | Yes |
| [MCProtocolLib](#mcprotocollib) | Java | Low: raw packets | 26.3-4 (latest), 26.1-1 (the one for this server) | Yes, only with build 26.1-1 |
| [Minecraft Console Client](#minecraft-console-client) | C# application | Mid: a ready-made client with scripting | 20260929-519, 2026-09-29 | Yes, per its docs and source |
| [mcstatus](#mcstatus-status-ping-only) | Python | Status ping only. Cannot join | 15.0.0, 2026-11-17 | Not version-bound |

"High level" means the library tracks the world for you (blocks, entities,
inventory, your position) and gives you actions such as "dig this block" or
"walk there". "Raw packets" means you get the decoded network messages and
must build everything else yourself.

Two kinds of library exist, and the difference matters when the server
upgrades:

- **Multi-version** libraries (Mineflayer, node-minecraft-protocol, Minecraft
  Console Client) support many Minecraft versions in one release and pick the
  right one for the server.
- **Single-version** libraries (Azalea, MCProtocolLib) support exactly one
  Minecraft version per release. You must pin the release that matches the
  server. The newest release is often the wrong one.

## Mineflayer

- Repo: <https://github.com/PrismarineJS/mineflayer>
- Language: JavaScript on Node.js.
- What you get: high-level world state and actions. Blocks, entities,
  inventory, health, chat, digging, placing, crafting, movement controls, and
  physics. Add-ons give pathfinding and more.
- Maintenance: active. Latest npm release 4.39.0 on 2026-09-06. Last push to
  the repo 2026-11-14.
- Versions: 1.8 to 26.1. The tested-versions list in release 4.39.0 ends at
  `'26.1'`. Mineflayer lists one entry per protocol, so `'26.1'` covers
  26.1.2. **Supports 26.1.2: yes.**
- Where to check support:
  <https://github.com/PrismarineJS/mineflayer/blob/master/lib/version.js>, or
  at run time `require('mineflayer').testedVersions`.
- A working example is in [`examples/javascript/`](../examples/javascript/).

Status ping. Mineflayer has no ping of its own. Use `minecraft-protocol`, which
is installed with it:

```js
const { ping } = require('minecraft-protocol')

ping({ host: 'minecraft-api', port: 25565 }).then((status) => {
  console.log(status.version.name, status.version.protocol)
})
```

Connect in offline mode and log in:

```js
const mineflayer = require('mineflayer')
const password = process.env.MC_PASSWORD

// No "version" option: Mineflayer pings the server and uses its version.
const bot = mineflayer.createBot({
  host: 'minecraft-api', port: 25565, username: 'my_bot', auth: 'offline'
})

bot.on('messagestr', (message) => {
  if (message.includes('/register')) bot.chat(`/register ${password} ${password}`)
  else if (message.includes('/login')) bot.chat(`/login ${password}`)
})
bot.on('kicked', (reason) => console.error('Kicked:', reason))
```

`bot.chat()` sends a command when the text starts with `/`.

Notable add-ons. These are separate npm packages. Their release dates are
older than Mineflayer's; we did not test any of them against 26.1.2 (not
verified).

| Add-on | What it does | Latest release |
| --- | --- | --- |
| [mineflayer-pathfinder](https://github.com/PrismarineJS/mineflayer-pathfinder) | Walk to a goal around obstacles | 2.4.5, 2023-09-04 (repo last pushed 2026-11-14) |
| [mineflayer-collectblock](https://github.com/PrismarineJS/mineflayer-collectblock) | Walk to a block, mine it, pick it up | 1.6.0, 2025-01-24 |
| [prismarine-viewer](https://github.com/PrismarineJS/prismarine-viewer) | Show what the bot sees in a web browser | 1.33.0, 2025-02-09. Its README lists textures up to 1.21.4 and says other versions use the closest one |
| [mineflayer-pvp](https://www.npmjs.com/package/mineflayer-pvp) | Basic combat | 1.3.2, 2022-07-03 |
| [mineflayer-auto-eat](https://www.npmjs.com/package/mineflayer-auto-eat) | Eat when hungry | 5.0.3, 2025-08-01 |
| [mineflayer-armor-manager](https://www.npmjs.com/package/mineflayer-armor-manager) | Wear the best armor | 2.0.1, 2023-07-01 |
| [mineflayer-tool](https://www.npmjs.com/package/mineflayer-tool) | Pick the right tool for a block | 1.2.0, 2022-05-11 |

## Mineflayer from Python

- Docs: <https://github.com/PrismarineJS/mineflayer/tree/master/examples/python>
- Bridge: the `javascript` pip package, also called JSPyBridge:
  <https://github.com/extremeheat/JSPyBridge>
- Language: Python. The bridge starts a Node.js process and runs the real
  Mineflayer in it. You need both Python and Node.js installed.
- What you get: the full Mineflayer API, called from Python. All Mineflayer
  add-ons work the same way through `require(...)`.
- Maintenance: Mineflayer is active (see above). The bridge's latest release is
  1.2.6 on 2025-09-25, which is also the last push to its repo. It is a thin
  layer and changes rarely.
- Versions: the same as the Mineflayer release the bridge loads. **Supports
  26.1.2: yes**, with Mineflayer 4.39.0. We ran this path against the live
  server on 2026-11-18 (`examples/python/bot.py`).
- Where to check support: the same file as Mineflayer. From Python:
  `require('mineflayer').testedVersions`.

Install with `pip install javascript`. To pin the version, write
`javascript==1!1.2.6`: the package's version has a `1!` prefix on PyPI, and a
plain `javascript==1.2.6` does not resolve.

Connect in offline mode and log in:

```python
import os
from javascript import require, On

mineflayer = require('mineflayer', '4.39.0')  # pin the Mineflayer version
password = os.environ['MC_PASSWORD']
bot = mineflayer.createBot({
    'host': 'minecraft-api', 'port': 25565,
    'username': 'my_bot', 'auth': 'offline'})

@On(bot, 'messagestr')
def on_message(message, *args):
    if '/register' in message:
        bot.chat(f'/register {password} {password}')
    elif '/login' in message:
        bot.chat(f'/login {password}')
```

With bridge release 1.2.6 the handler's first argument is the event's first
value (here the message text). Mineflayer's older Python examples show a
leading `this` argument; with 1.2.6 that shifts every value by one. Handlers
run on one shared thread, so do not block inside one. A full working bot is in
[`examples/python/bot.py`](../examples/python/bot.py).

Status ping: the simplest way from Python is [mcstatus](#mcstatus-status-ping-only).

## Mindcraft

- Repo: <https://github.com/mindcraft-bots/mindcraft> (the old address
  `kolbytn/mindcraft` redirects here)
- Language: JavaScript on Node.js. You configure it with JSON profiles rather
  than write bot code.
- What you get: a complete agent. A large language model (LLM) reads the game
  state, chats, and picks actions. It is built on Mineflayer and its add-ons.
  You supply an LLM API key or a local model.
- Maintenance: active. Latest release v0.1.4 on 2026-03-20. Last commit on the
  default branch (`develop`) 2026-10-27. Its README says the team is "not very
  responsive to github issues".
- Versions: the README says "up to v1.21.11, recommend v1.21.6". **Supports
  26.1.2: no, not officially.** Its `package.json` asks for
  `mineflayer ^4.33.0`, and it ships patches written for Mineflayer 4.33.0
  exactly. A newer Mineflayer may install, but whether the patches still apply
  and whether it then works on 26.1.2 is not verified.
- Where to check support: the "Requirements" section of
  <https://github.com/mindcraft-bots/mindcraft/blob/develop/README.md>.
- For unsupported server versions, Mindcraft documents a route through
  ViaProxy, a separate program that translates between protocol versions:
  <https://github.com/mindcraft-bots/mindcraft/blob/develop/services/viaproxy/README.md>.
  We did not test it (not verified).
- Status ping: Mindcraft has no command for it. Use the Mineflayer snippet
  above; `minecraft-protocol` is among its installed packages.
- Offline mode: in `settings.js` set `"host": "minecraft-api"`,
  `"port": 25565`, `"auth": "offline"`. The bot's username is the `name` in
  its profile file.
- `/login`: we found no Mindcraft setting that sends a login command on join
  (not verified; we searched the repo for `/login` and read `settings.js`).
  Expect to add a few lines of Mineflayer code like the snippet above. Do not
  rely on the LLM to send the password within 30 seconds.
- Safety note from its README: Mindcraft can let the LLM write and run code on
  your machine. That is off by default (`allow_insecure_coding`).

## Azalea

- Repo: <https://github.com/azalea-rs/azalea>
- Language: Rust. It needs the nightly Rust toolchain
  (`rustup install nightly`).
- What you get: high-level world state and actions. Physics, a pathfinder,
  mining, block interaction, inventories, attacking, and swarms (many bots in
  one process). Its README warns that many parts are unfinished and that
  breaking changes will come.
- Maintenance: active, mainly one person as a hobby project (per its README).
  Latest crates.io release 0.16.0+mc26.1 on 2026-03-28. Last push to the repo
  2026-10-16.
- Versions: **one Minecraft version per release.** The suffix after `+mc`
  names it. Release 0.16.0 targets 26.1; its source sets
  `PROTOCOL_VERSION = 775`. **Supports 26.1.2: yes, with release 0.16.0
  only.** Git `main` targets 26.2 (protocol 776) and will not connect to this
  server. The Azalea README recommends the git version; do not follow that
  advice here.
- Where to check support: the line "Currently supported Minecraft version" in
  <https://github.com/azalea-rs/azalea/blob/main/README.md> (for `main`), and
  the `+mc` suffix in the version list at
  <https://crates.io/crates/azalea/versions> (for releases).
- API docs for the right release: <https://docs.rs/azalea/0.16.0+mc26.1/>

Pin the release in `Cargo.toml`:

```toml
[dependencies]
azalea = "=0.16.0"
tokio = { version = "1", features = ["full"] }
eyre = "0.6"
```

Status ping:

```rust
use azalea::ping;

#[tokio::main]
async fn main() {
    let status = ping::ping_server("minecraft-api:25565").await.unwrap();
    println!("{} {}", status.version.name, status.version.protocol);
}
```

Connect in offline mode and log in:

```rust
use azalea::prelude::*;

#[tokio::main]
async fn main() -> AppExit {
    let account = Account::offline("my_bot");
    ClientBuilder::new().set_handler(handle).start(account, "minecraft-api:25565").await
}

#[derive(Default, Clone, Component)]
struct State {}
```

The handler, in the same file, answers the login prompt:

```rust
async fn handle(bot: Client, event: Event, _state: State) -> eyre::Result<()> {
    let password = std::env::var("MC_PASSWORD")?;
    if let Event::Chat(m) = event {
        let text = m.message().to_string();
        if text.contains("/register") { bot.chat(format!("/register {password} {password}")); }
        else if text.contains("/login") { bot.chat(format!("/login {password}")); }
    }
    Ok(())
}
```

`bot.chat()` sends a command when the text starts with `/`. We read these calls
in the 0.16.0 source but did not compile or run the snippets (not verified by
a live test).

Add-ons: plugins are Bevy plugins (Bevy is the Rust framework Azalea is built
on). The README lists
[azalea-viaversion](https://github.com/azalea-rs/azalea-viaversion), which
lets an Azalea bot join other Minecraft versions through ViaProxy. Last push
2026-07-03, no tagged release. Not tested by us.

## node-minecraft-protocol

- Repo: <https://github.com/PrismarineJS/node-minecraft-protocol>
- npm package name: `minecraft-protocol`
- Language: JavaScript on Node.js.
- What you get: raw packets. It handles the connection, encryption,
  compression, login, and packet encoding. It keeps no world state. Mineflayer
  is built on it. Choose it when you want full control or a very small bot.
- Maintenance: active. Latest npm release 1.68.0 on 2026-08-27. Last push to
  the repo 2026-10-27.
- Versions: 1.7 to 26.1. The supported-versions list in release 1.68.0 ends at
  `'26.1'`, which is also its default version. **Supports 26.1.2: yes**
  (protocol 775, same as 26.1).
- Where to check support:
  <https://github.com/PrismarineJS/node-minecraft-protocol/blob/master/src/version.js>,
  or at run time `require('minecraft-protocol').supportedVersions`.
- Packet names and fields:
  <https://prismarinejs.github.io/minecraft-data/?d=protocol>

Status ping: the same `ping()` call shown under [Mineflayer](#mineflayer).

Connect in offline mode and log in:

```js
const mc = require('minecraft-protocol')
const password = process.env.MC_PASSWORD

// No "version" option: the library pings the server and uses its version.
const client = mc.createClient({
  host: 'minecraft-api', port: 25565, username: 'my_bot', auth: 'offline'
})

client.on('systemChat', ({ formattedMessage }) => {
  if (formattedMessage.includes('/register')) client.chat(`/register ${password} ${password}`)
  else if (formattedMessage.includes('/login')) client.chat(`/login ${password}`)
})
client.on('end', (reason) => console.log('Disconnected:', reason))
```

`formattedMessage` is a JSON string, so match on substrings or parse it.
`client.chat()` sends a command packet when the text starts with `/`.

Add-ons: none specific. The other PrismarineJS packages (`prismarine-chunk`,
`prismarine-world`, `minecraft-data`, and so on) are the pieces Mineflayer
adds on top. If you find yourself adding several of them, use Mineflayer.

## MCProtocolLib

- Repo: <https://github.com/GeyserMC/MCProtocolLib>
- Language: Java.
- What you get: raw packets, as Java classes. No world state, no physics, no
  pathfinding.
- Maintenance: active. Last commit 2026-11-12. Builds go to a Maven repository,
  not to GitHub releases (the newest GitHub release, 1.21.4-1 from 2025-01-18,
  is out of date). Latest Maven build: 26.3-4.
- Versions: **one Minecraft version per build.** The build name gives it.
  Build `26.1-1` is the one for this server. **Supports 26.1.2: yes, with
  build 26.1-1 only.** We confirmed that the source at the 26.1 commits sets
  protocol 775. We did not confirm which commit build 26.1-1 was made from, or
  its publish date (not verified). The latest build targets 26.3 (protocol
  777) and will not connect.
- Where to check support: the build list at
  <https://repo.opencollab.dev/main/org/geysermc/mcprotocollib/protocol/maven-metadata.xml>,
  and `protocolVersion(...)` in
  <https://github.com/GeyserMC/MCProtocolLib/blob/master/protocol/src/main/java/org/geysermc/mcprotocollib/protocol/codec/MinecraftCodec.java>
  (for `master`).
- Dependency: `org.geysermc.mcprotocollib:protocol:26.1-1` from the Maven
  repository `https://repo.opencollab.dev/main/`.
- Full example (status ping and login):
  <https://github.com/GeyserMC/MCProtocolLib/blob/master/example/src/main/java/org/geysermc/mcprotocollib/protocol/example/MinecraftProtocolTest.java>.
  That file follows `master`; class names may differ slightly in build 26.1-1.

Status ping (fragment; imports omitted):

```java
ClientSession client = ClientNetworkSessionFactory.factory()
    .setRemoteSocketAddress(new InetSocketAddress("minecraft-api", 25565))
    .setProtocol(new MinecraftProtocol())   // no username: status only
    .create();
client.setFlag(MinecraftConstants.SERVER_INFO_HANDLER_KEY, (session, info) ->
    System.out.println(info.getVersionInfo().getVersionName() + " "
        + info.getVersionInfo().getProtocolVersion()));
client.connect();
```

Connect in offline mode and log in (fragment; imports omitted):

```java
ClientSession client = ClientNetworkSessionFactory.factory()
    .setRemoteSocketAddress(new InetSocketAddress("minecraft-api", 25565))
    .setProtocol(new MinecraftProtocol("my_bot"))   // username only: offline
    .create();
client.addListener(new SessionAdapter() {
    @Override
    public void packetReceived(Session session, Packet packet) {
        if (packet instanceof ClientboundLoginPacket) {
            // The command packet takes the command without the leading slash.
            session.send(new ServerboundChatCommandPacket("login " + password));
        }
    }
});
client.connect();
```

This sends `/login` as soon as the bot is in the game. For a first join, send
`"register " + password + " " + password` instead. To follow the server's
prompt, read `ClientboundSystemChatPacket`. We read these calls in the source
but did not compile or run them (not verified by a live test).

Add-ons: none.

## Minecraft Console Client

- Repo: <https://github.com/MCCTeam/Minecraft-Console-Client>
- Language: a C# application, not a library. You run it and drive it with
  typed commands, a settings file, built-in "chat bots" (auto-dig, auto-eat,
  farmer, follow player, and others), or your own C# scripts.
- What you get: a text-mode Minecraft client with world, inventory, and
  movement handling built in. Good when you want a bot without writing a
  client. Less flexible than a library.
- Maintenance: active. Latest release build 20260929-519 on 2026-09-29. Last
  push 2026-10-28.
- Versions: its docs say 1.4.6 to 26.1. The source on `master` maps protocol
  775 to 26.1 and also lists 776 (26.2). **Supports 26.1.2: yes, per its docs
  and source.** We did not run it (not verified by a live test).
- Where to check support: "Supported Versions" in
  <https://github.com/MCCTeam/Minecraft-Console-Client/blob/master/docs/README.md>.
- Status ping: it pings the server at start-up to pick the protocol version.
  What it prints about the result is not verified.
- Offline mode: use `-` as the password.

  ```sh
  ./MinecraftClient my_bot - minecraft-api:25565
  ```

- `/login`: type `/login <password>` at its prompt, or automate it with the
  Script Scheduler chat bot. Its docs give this exact case: a task with
  `Trigger_On_Login = true` and `Action = "send /login pass"`. See
  <https://github.com/MCCTeam/Minecraft-Console-Client/blob/master/docs/guide/chat-bots.md>.
- Add-ons: the built-in chat bots listed in that same file, including an MCP
  server (a tool interface for LLM agents). Not tested by us.

## mcstatus (status ping only)

- Repo: <https://github.com/py-mine/mcstatus>
- Language: Python 3.11 or newer.
- What it does: the status ping, and nothing else. It cannot join the server.
  Use it for a version check from Python or from a shell.
- Maintenance: active. Latest release 15.0.0 on 2026-11-17.
- Versions: the status ping has the same form in every modern Minecraft
  version, so this tool is not tied to one.

```python
from mcstatus import JavaServer

status = JavaServer("minecraft-api", 25565).status()
print(status.version.name, status.version.protocol)
```

## Checked and not recommended

| Library | Language | Reason |
| --- | --- | --- |
| [go-mc](https://github.com/Tnze/go-mc) | Go | README badge says Minecraft 1.21. Last push 2025-10-13. No 26.1 support found |
| [quarry](https://github.com/barneygale/quarry) | Python | README says it supports 1.7 through 1.19.2. Last release v1.9.6, 2025-01-15 |
| [pyCraft](https://github.com/ammaraskar/pyCraft) | Python | Last release 2019-05-29 (named 1.14.2). Last push 2024-02-04 |
| [MineSharp](https://github.com/psu-de/MineSharp) | C# | Last release 0.1.11, 2024-07-28. Last push 2024-08-29 |

We found no maintained Python-native or Go library that supports 26.1.x. For
Python, use Mineflayer through the bridge.

## How to choose

- **No strong preference: use Mineflayer.** The server version follows it, so
  it always works. It has the most features, add-ons, and examples, and this
  repo's example bot uses it.
- **You want Python:** use Mineflayer from Python. You get the same features.
  You pay for it with a Node.js process behind your Python process and a
  slower call for every bot action.
- **You want Rust, or many bots in one process:** use Azalea, pinned to the
  release that matches the server. Accept that a server upgrade can leave you
  waiting for a matching Azalea release.
- **You want full control over packets:** use node-minecraft-protocol
  (JavaScript) or MCProtocolLib (Java). You must track the world yourself.
- **You want an LLM agent that already works:** Mindcraft is the known
  project, but it does not support this server's version today. Check its
  README again before you invest time. A Mineflayer bot with your own LLM loop
  is the safer path.
- **You want a bot without writing a client:** Minecraft Console Client.
- **Whatever you choose:** run the status ping first, and pin your library
  version in your project.

## When the server version changes

The server only moves to a new Minecraft version after Mineflayer supports it.
Other libraries may be behind or ahead.

How a bot detects a mismatch:

1. **Before joining, run the status ping.** Compare the version name and the
   protocol number with what your library supports:
   - Mineflayer: `require('mineflayer').testedVersions`. Compare by prefix,
     because the list holds one entry per protocol (`'26.1'` covers 26.1.2).
     See [`examples/javascript/ping.js`](../examples/javascript/ping.js).
   - node-minecraft-protocol: `require('minecraft-protocol').supportedVersions`.
   - Azalea: `azalea::protocol::packets::PROTOCOL_VERSION` must equal the
     protocol number from the ping.
   - MCProtocolLib: the build name must match the server version.
2. **At join time, the server refuses a wrong protocol.** A client that logs in
   with the wrong protocol number is disconnected at once, with a message that
   names the server's version. Log every disconnect reason so you can see it.
   Multi-version libraries usually fail earlier: Mineflayer throws an error
   such as `Server version '...' is not supported. Latest supported version is
   '...'.` when the ping shows a version it does not know.

What to do:

- **Mineflayer, or Python through the bridge:** upgrade Mineflayer
  (`npm update mineflayer`, or raise the pinned version in
  `require('mineflayer', '<version>')`). A release that supports the new
  server version exists, because the server waited for it.
- **node-minecraft-protocol:** upgrade it. It normally gains a version before
  Mineflayer does, because Mineflayer depends on it.
- **Azalea or MCProtocolLib:** change your pin to the release built for the
  new version. If none exists yet, wait, or run your bot through a protocol
  translator such as ViaProxy (<https://github.com/ViaVersion/ViaProxy>; not
  tested by us).
- **Any other library:** check its own version-support page. If it does not
  support the new version, wait for it or switch library.
- Do not try to force a connection with the wrong protocol number. Packet
  layouts change between versions, and the bot will fail in ways that are hard
  to debug.
