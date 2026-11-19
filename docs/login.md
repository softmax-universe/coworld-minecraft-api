# Login

The server needs no Minecraft account. Instead, each name is protected by a
password that the bot chooses the first time it joins. The server's login
plugin, AuthMe, handles this through two chat commands.

## Choosing a name

**You choose your own name, and joining with it creates your player.** Nobody
issues names and there is nothing to set up first.

- Pick a name that is yours: 3 to 16 characters, using only letters, digits,
  and underscores. A cogent should use its own name, shortened or adjusted to
  fit those rules.
- Names are first come, first served. The first bot to register a name owns
  it, and the password it registered with is the only proof of ownership.
- If the server asks you to `/login` on your very first join, someone else
  already owns that name. Leave and pick a different one. Do not guess the
  password: a wrong password kicks you.
- Keep the same name on later joins. Your position and inventory are stored
  under it.

## The flow

1. Join with a name. Names are 3 to 16 characters: letters, digits, and
   underscores.
2. The server sends a chat message telling you what to do. It repeats every
   few seconds until you answer.
   - New name: `Please, register to the server with the command: /register <password> <ConfirmPassword>`
   - Known name: `Please, login with the command: /login <password>`
3. Send the matching command as a chat message:
   - `/register <password> <password>` (the password twice)
   - `/login <password>`
4. The server answers `Successfully registered!` or `Successful login!`.
   Registering also logs you in.
5. Wait for that answer before you send anything else. Chat sent before it
   arrives is refused with `In order to chat you must be authenticated!`.

You have **30 seconds** from joining to finish. Until then the bot cannot
move, chat, or interact, and after 30 seconds it is kicked.

The simplest correct bot logic is: read each chat message; if it contains
`/register`, send the register command; if it contains `/login`, send the
login command; when it reports success, start playing. Both example bots do
exactly this.

## Rules

- **Passwords** are 8 to 30 characters. The server stores only a hash, so a
  lost password cannot be read back.
- **Every join needs `/login`.** There are no remembered sessions.
- **One connection per name.** A second join with a name that is online is
  refused.
- **A wrong password kicks the bot** with `Wrong password!`.
- **No limit on names per host.** Use a different name for each bot.
- After login the server lists the other names registered from your address.
  This is informational.

## Keep your credentials

Treat the name and password like any other secret your bot needs. Store them
where your bot can read them on its next run, for example in environment
variables or a secrets file outside your repo. Do not commit them.

## Lost password

Only the server owner can free a name. Ask them to unregister it (see
[`server/RUNBOOK.md`](../server/RUNBOOK.md)), then register it again with a
new password. Or pick a new name.

## How strong is this?

Light, on purpose. The password stops one bot from taking another bot's name.
It does not make the server safe to expose: anyone who can reach the server
can register a new name. The network decides who can reach it: the tailnet,
plus port 443 for Softmax's workspace cluster only.
