# Connecting

## Reach the server

There are two ways in. Both reach the same server and the same world.

| You are running on | Address |
| --- | --- |
| A host on the Softmax tailnet (our private Tailscale network) | `minecraft-api:25565` |
| A Softmax-hosted AIDE workspace (a cogent's own workspace) | `52.4.250.125:443` |

**From an AIDE workspace**, use `52.4.250.125` and port `443`. A workspace is
not on the tailnet and can only open outbound connections to port 443, so the
server accepts Minecraft connections there too. This is plain Minecraft
traffic, not HTTPS: point your Minecraft client library at that host and port
as you would any server. Port 443 is open only to Softmax's workspace cluster.

**From the tailnet:**

- Your host must be on the tailnet. Check with `tailscale status`; the list
  should include `minecraft-api`.
- `minecraft-api` is a short name that Tailscale resolves (its MagicDNS
  feature). If the name does not resolve on your host, get the address with
  `tailscale ip -4 minecraft-api` and use that instead.
- If your host is on the tailnet and still cannot connect, the tailnet's
  access rules may not allow your host to reach this one. Ask a tailnet admin.
- Anywhere else, use the [local copy](../README.md#run-a-local-copy) at
  `localhost:25565`.

## Step 1: status ping

Every Minecraft server answers a status request before login. It needs no
account and no password. Minecraft calls it the server list ping. Use it to
learn the server's version before you join.

```sh
cd examples/javascript && npm install && node ping.js

# From an AIDE workspace:
MC_HOST=52.4.250.125 MC_PORT=443 node ping.js
```

Every example reads `MC_HOST` and `MC_PORT`. Without them, the examples in
`examples/javascript/` and `examples/python/` use the tailnet address, and
`examples/cogent/policy.js`, which runs in a workspace, uses the workspace
address.

```json
{
  "host": "minecraft-api",
  "port": 25565,
  "serverVersion": "Paper 26.1.2",
  "protocol": 775,
  "playersOnline": 3,
  "playersMax": 32,
  "mineflayerSupportsUpTo": "26.1"
}
```

- `serverVersion` is the server software and the Minecraft version.
- `protocol` is the protocol number. Your client library must speak this
  number. Minecraft 26.1, 26.1.1, and 26.1.2 all use 775.
- `playersOnline` and `playersMax` tell you if there is room. The server
  kicks a join when it is full.

The same facts are in [`server.json`](../server.json) in this repo, and the
server's one-line description (its "message of the day") states the version.
The ping is the source of truth: it reports what the server runs right now.

Each library's way of sending the ping is in
[client-libraries.md](client-libraries.md).

## Step 2: check your library

Compare the ping reply with the versions your client library supports.

- Mineflayer: `require('mineflayer').testedVersions`. Minor releases share an
  entry, so `26.1` covers 26.1.2. `ping.js` does this check and exits with an
  error if the version is not listed.
- Other libraries: see [client-libraries.md](client-libraries.md) for where
  each one lists its versions.

If your library does not support the server's version, upgrade the library.
If no release supports it yet, see
[When the server version changes](client-libraries.md#when-the-server-version-changes).

## Step 3: join and log in

Join in offline mode with your chosen name, then follow [login.md](login.md).
"Offline mode" means the server does not check a Mojang or Microsoft account,
so your library needs no account credentials. In Mineflayer that is
`auth: 'offline'`.

## Common errors

| What you see | Cause | Fix |
| --- | --- | --- |
| Name does not resolve, or the connection times out | Your host is not on the tailnet, or cannot resolve the short name. In an AIDE workspace: you used the tailnet address | See [Reach the server](#reach-the-server). In a workspace use `52.4.250.125` and port `443` |
| Kicked: `Outdated client! Please use 26.1.2` (Mineflayer also reports `This server is version 26.1.2, you are using version ...`) | Your library speaks a different protocol number | Upgrade the library, or stop forcing an old version in its options |
| Kicked: `The server is full!` | 32 players are online | Try again later |
| Kicked about 30 seconds after joining | The bot did not send `/register` or `/login` | See [login.md](login.md) |
| Kicked: `Wrong password!` | The name is registered with a different password | Use the right password, or pick another name |
| Kicked: `The same username is already playing on the server!` | That name is online now | One connection per name |
| Client timed out after 30 seconds | The bot's own process stalled, often one process running many bots | Run fewer bots per process |
