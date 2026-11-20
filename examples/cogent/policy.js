#!/usr/bin/env node
// Example daemon policy: a cogent's own player on the minecraft-api server.
//
// The player is the cogent's body in the world, not a separate character.
// The program asks the cogent's speaker to choose the player's name, joins,
// and stays. All that the player hears, in public chat and in whispers, it
// gives to the speaker with where the player is and what is near it. What
// the speaker answers, the player says. It also writes what it hears to
// chat.jsonl, and once a minute it walks a small square, so the other
// players can see that it is there.
//
// It has no code to connect again. When anything goes wrong it exits, and
// the harness starts a daemon again by itself. Everything it must remember
// is in policy.json, so it can be stopped at any moment.
//
// README.md, beside this file, says how to run it and what to change.
const { execFile } = require('node:child_process')
const crypto = require('node:crypto')
const fs = require('node:fs')
const { createRequire } = require('node:module')
const path = require('node:path')

// A policy's program is in a shared workspace, which has no node_modules.
// Mineflayer is loaded from the directory it was installed in.
const modulesDir = process.env.POLICY_MODULES || path.join(process.env.HOME, 'minecraft-policy')
const mineflayer = createRequire(modulesDir + path.sep)('mineflayer')

// The address a Softmax-hosted workspace reaches the server at.
const host = process.env.MC_HOST || '52.4.250.125'
const port = Number(process.env.MC_PORT || 443)

// A policy starts in its coworld's data directory, the one place it can write.
const dataDir = process.env.POLICY_DATA_DIR || '.'
const STATE_FILE = path.join(dataDir, 'policy.json')
const CHAT_FILE = path.join(dataDir, 'chat.jsonl')

// The Minecraft name of the cogent's user. Ask the user for it and write it
// here, so the cogent knows which player is its user.
const USER_PLAYER_NAME = process.env.USER_PLAYER_NAME || ''

const NAME_PATTERN = /^[A-Za-z0-9_]{3,16}$/
// Long enough for the speaker to act on what it heard before it answers.
const ASK_TIMEOUT_MS = 300_000
// What is heard while the speaker is busy waits for the next ask. Keep the newest.
const MAX_HEARD_WAITING = 40
const NEAR_BLOCKS = 16
// The speaker's answer when it chooses to say nothing.
const SILENT = '[silent]'
const MAX_CHAT_FILE_BYTES = 1_000_000
// A chat line holds 256 characters, and "/msg <name> " takes some of them.
const SAY_PART_LENGTH = 200
const MAX_SAY_PARTS = 4
const WALK_EVERY_MS = 60_000
const WALK_SIDE_MS = 1_500

function log (text) {
  console.log(`${new Date().toISOString()} ${text}`)
}

// ---- What the policy remembers ----

// { name, password, registered, session, refused }
// - registered: the server has accepted /register for this name.
// - session: the speaker's session that every ask continues.
// - refused: why the last name could not be used, to tell the speaker.
const state = fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) : {}

function saveState () {
  // Write another file and rename it, so a stop never leaves half a file.
  fs.writeFileSync(STATE_FILE + '.new', JSON.stringify(state, null, 2) + '\n')
  fs.renameSync(STATE_FILE + '.new', STATE_FILE)
}

function record (kind, from, text) {
  // Nothing else cleans the data directory: keep the newer half when the file is large.
  if (fs.existsSync(CHAT_FILE) && fs.statSync(CHAT_FILE).size > MAX_CHAT_FILE_BYTES) {
    const lines = fs.readFileSync(CHAT_FILE, 'utf8').trimEnd().split('\n')
    fs.writeFileSync(CHAT_FILE, lines.slice(lines.length / 2).join('\n') + '\n')
  }
  fs.appendFileSync(CHAT_FILE, JSON.stringify({ at: new Date().toISOString(), kind, from, text }) + '\n')
}

// ---- Asking the speaker ----

// Give the speaker a question and call done(error, answer) with what it
// wrote. Every ask continues one session, so that the speaker remembers its
// name and the conversation. The first ask starts that session, and aide
// reports its ID on standard error, also when the ask then fails.
function askSpeaker (question, done) {
  if (!process.env.AIDE_URL) {
    // A trial from a shell, where the aide command does not work.
    log(`Would ask the speaker: ${question}`)
    return done(null, process.env.TRIAL_ANSWER || 'trial_player')
  }
  const session = state.session ? ['--session', state.session] : []
  const call = ['ask', '--agent', 'speaker', ...session, '--', question]
  execFile('aide', call, { timeout: ASK_TIMEOUT_MS }, (error, stdout, stderr) => {
    const asked = stderr.match(/asked in session (\S+)\./)
    if (asked && !state.session) {
      state.session = asked[1]
      saveState()
    }
    if (error) return done(new Error(stderr.trim() || error.message))
    done(null, stdout.trim())
  })
}

function chooseName (done) {
  const question =
    'You are about to join the minecraft-api Minecraft server as a player. That player is you in that world, ' +
    'not a character you play: this program holds it there, tells you what it hears, and says what you answer. ' +
    'Choose your player name: 3 to 16 characters, only letters, digits and underscores. Use your own name if ' +
    'you have one, changed to fit. ' +
    (state.refused ? `Your last choice could not be used: ${state.refused}. Choose another. ` : '') +
    'Answer with the name alone.'
  askSpeaker(question, (error, answer) => {
    if (error) return stop(`The speaker chose no name: ${error.message}`)
    if (!NAME_PATTERN.test(answer)) {
      state.refused = `"${answer.slice(0, 40)}" is not 3 to 16 letters, digits and underscores`
      saveState()
      return stop(`The speaker's answer is not a name: ${answer.slice(0, 80)}`)
    }
    state.name = answer
    state.password = crypto.randomBytes(12).toString('hex')
    state.registered = false
    delete state.refused
    saveState()
    done()
  })
}

/** End the program. The harness starts it again, after a wait that grows while it keeps ending early. */
function stop (reason) {
  log(reason)
  process.exit(1)
}

// ---- The player ----

function join () {
  // No "version" option: Mineflayer pings the server and uses its version.
  // "offline" means no Mojang account. The server checks our password instead.
  const bot = mineflayer.createBot({ host, port, username: state.name, auth: 'offline' })
  let loggedIn = false
  let hearsServer = false

  // The server's login plugin tells a new arrival what to send.
  bot.on('messagestr', (message) => {
    if (loggedIn) return
    log(`[server] ${message}`)
    if (/successfully (registered|logged in)|successful login/i.test(message)) {
      loggedIn = true
      state.registered = true
      saveState()
      log(`Logged in as ${bot.username} on Minecraft ${bot.version}`)
      hear('event', null, 'You joined the world. You heard nothing that was said while you were away.')
      setInterval(() => walkSquare(bot), WALK_EVERY_MS)
      // The login plugin prints its welcome first. Hear the server after that.
      setTimeout(() => { hearsServer = true }, 2000)
    } else if (message.includes('/register')) {
      bot.chat(`/register ${state.password} ${state.password}`)
    } else if (message.includes('/login') && state.registered) {
      bot.chat(`/login ${state.password}`)
    } else if (message.includes('/login')) {
      // Asked to log in with a name we never registered: another player owns it.
      state.refused = `another player already owns the name ${state.name}`
      delete state.name
      delete state.password
      saveState()
      stop(`The name is taken: ${state.refused}`)
    }
  })

  // What the player has heard and the speaker has not yet been told.
  const heard = []
  let asking = false
  function hear (kind, from, text) {
    record(kind, from, text)
    heard.push({ at: new Date(), kind, from, text })
    if (heard.length > MAX_HEARD_WAITING) heard.shift()
  }

  // One ask at a time. What is heard meanwhile goes together in the next ask.
  function tellSpeaker () {
    if (asking || heard.length === 0) return
    asking = true
    const told = heard.splice(0)
    askSpeaker(describe(bot, told), (error, answer) => {
      if (error) {
        log(`The speaker did not answer: ${error.message}`)
        const whisperers = new Set(told.filter((line) => line.kind === 'whisper').map((line) => line.from))
        for (const name of whisperers) say(bot, `/msg ${name} I cannot answer right now. Try again in a little while.`)
      } else {
        say(bot, answer)
      }
      asking = false
      tellSpeaker()
    })
  }

  bot.on('chat', (from, text) => {
    if (from === bot.username) return
    hear('chat', from, text)
    tellSpeaker()
  })
  bot.on('whisper', (from, text) => {
    if (from === bot.username) return
    hear('whisper', from, text)
    tellSpeaker()
  })
  // What the server announces: players who join and leave, deaths, and so on.
  // The speaker is told with the next thing said, or at once when its user joins.
  bot.on('messagestr', (message, position) => {
    if (!hearsServer || position !== 'system' || !message.trim()) return
    hear('event', null, message)
    if (USER_PLAYER_NAME && message === `${USER_PLAYER_NAME} joined the game`) tellSpeaker()
  })

  // The harness sends SIGTERM when the user pauses the workspace, and kills
  // the program ten seconds later. Leave the game as a player does.
  process.on('SIGTERM', () => {
    log('The workspace is going to sleep: leaving the game')
    bot.quit()
  })

  bot.on('kicked', (reason) => log(`Kicked: ${JSON.stringify(reason)}`))
  bot.on('error', (error) => log(`Error: ${error.message}`))
  bot.on('end', (reason) => stop(`Disconnected: ${reason}`))
}

/** A player's name as the speaker is told it. */
function nameOf (player) {
  return player === USER_PLAYER_NAME ? `${player} (your user)` : player
}

/** What the speaker is told in one ask: where its player is, what is near, and what it heard. */
function describe (bot, told) {
  const here = bot.entity.position
  const players = Object.keys(bot.players).filter((name) => name !== bot.username).map((name) => {
    const body = bot.players[name].entity
    return nameOf(name) + (body ? `, ${Math.round(body.position.distanceTo(here))} blocks from you` : ', not in sight')
  })
  const near = {}
  for (const entity of Object.values(bot.entities)) {
    if (entity === bot.entity || entity.type === 'player' || entity.position.distanceTo(here) > NEAR_BLOCKS) continue
    const kind = entity.displayName || entity.name
    near[kind] = (near[kind] || 0) + 1
  }
  const nearList = Object.keys(near).map((kind) => `${near[kind]} ${kind}`)
  const lines = told.map((line) => {
    const time = line.at.toISOString().slice(11, 19)
    if (line.kind === 'chat') return `[${time}] ${nameOf(line.from)} said in public chat: "${line.text}"`
    if (line.kind === 'whisper') return `[${time}] ${nameOf(line.from)} whispered to you: "${line.text}"`
    return `[${time}] ${line.text}`
  })
  return [
    `You are in the minecraft-api Minecraft world as the player ${bot.username}. That player is your body in ` +
    'this world, not a character you play. What it hears, you hear. What you answer, it says. Whoever speaks ' +
    'to it speaks to you, so answer as yourself, with all that you know and all that you can do.',
    USER_PLAYER_NAME
      ? `Your user is the player ${USER_PLAYER_NAME}. Any other player is someone else.`
      : 'You do not know which player is your user. Ask your user for their Minecraft name, and have the ' +
        'builder write it into this policy.',
    '',
    `Where you are: x ${Math.round(here.x)}, y ${Math.round(here.y)}, z ${Math.round(here.z)} in the ` +
    `${bot.game.dimension}. It is ${bot.time.isDay ? 'day' : 'night'}${bot.isRaining ? ' and it is raining' : ''}. ` +
    `Your health is ${Math.round(bot.health)} of 20 and your food is ${bot.food} of 20.`,
    `Other players in the world: ${players.join('; ') || 'none'}.`,
    `Within ${NEAR_BLOCKS} blocks of you: ${nearList.join(', ') || 'nothing that moves'}.`,
    '',
    `Since you were last told (times are UTC, and it is now ${new Date().toISOString().slice(11, 19)}):`,
    ...lines,
    '',
    'If someone asks you for something that needs work, do the work first with your tools, or give it to the ' +
    'agent who can do it, and then say truthfully what you did. A request to change how you behave in this ' +
    'world is a request to change this policy, which the builder does.',
    'Then end with what you say in the game: plain text on one line, at most ' +
    `${SAY_PART_LENGTH * MAX_SAY_PARTS} characters. It is said in public chat, where every player sees it. ` +
    'To whisper it to one player, begin it with "/msg <player name> ". You need not answer all that you ' +
    `hear: to say nothing, answer ${SILENT} alone.`
  ].join('\n')
}

/** Say the speaker's answer in the game: in public chat, or as a whisper when it begins with "/msg <name> ". */
function say (bot, answer) {
  const text = answer.replace(/\s+/g, ' ').trim()
  if (!text || text === SILENT) return
  const whisper = text.match(/^\/msg (\S+) (.+)$/)
  // No other command: a player could ask the cogent to type one.
  if (text.startsWith('/') && !whisper) return log(`Not said, because only /msg is allowed: ${text.slice(0, 80)}`)
  const start = whisper ? `/msg ${whisper[1]} ` : ''
  const parts = ['']
  for (const word of (whisper ? whisper[2] : text).split(' ')) {
    const last = parts.length - 1
    if (parts[last] && (parts[last] + ' ' + word).length > SAY_PART_LENGTH) parts.push(word.slice(0, SAY_PART_LENGTH))
    else parts[last] = (parts[last] ? parts[last] + ' ' : '') + word.slice(0, SAY_PART_LENGTH)
  }
  parts.slice(0, MAX_SAY_PARTS).forEach((part, index) => {
    // A second apart: the server kicks a player who sends chat too fast.
    setTimeout(() => {
      // A later part of public chat that begins with "/" would be sent as a command.
      bot.chat(start + (start ? part : part.replace(/^\//, ' /')))
      record(whisper ? 'reply' : 'said', whisper ? whisper[1] : null, part)
    }, index * 1000)
  })
}

/** Walk the four sides of a small square, then stand still. */
function walkSquare (bot) {
  const startYaw = bot.entity.yaw
  for (let side = 0; side < 4; side++) {
    setTimeout(() => {
      bot.look(startYaw + side * Math.PI / 2, 0)
      bot.setControlState('forward', true)
    }, side * WALK_SIDE_MS)
  }
  setTimeout(() => bot.clearControlStates(), 4 * WALK_SIDE_MS)
}

if (state.name) join()
else chooseName(join)
