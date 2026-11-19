#!/usr/bin/env node
// Example daemon policy: a cogent's own player on the minecraft-api server.
//
// It asks the cogent's speaker to choose a player name, joins, and stays.
// It writes what it hears to chat.jsonl. It gives each whisper to the
// speaker, and whispers the speaker's answer back. Once a minute it walks a
// small square, so the other players can see that it is there.
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

const NAME_PATTERN = /^[A-Za-z0-9_]{3,16}$/
const ASK_TIMEOUT_MS = 120_000
const MAX_CHAT_FILE_BYTES = 1_000_000
// A chat line holds 256 characters, and "/msg <name> " takes some of them.
const REPLY_PART_LENGTH = 200
const MAX_REPLY_PARTS = 4
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
    'You are about to join the minecraft-api Minecraft server as your own player, and this program will hold ' +
    'that player in the world for you. Choose your player name: 3 to 16 characters, only letters, digits and ' +
    'underscores. Use your own name if you have one, changed to fit. ' +
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

  // The server's login plugin tells a new arrival what to send.
  bot.on('messagestr', (message) => {
    if (loggedIn) return
    log(`[server] ${message}`)
    if (/successfully (registered|logged in)|successful login/i.test(message)) {
      loggedIn = true
      state.registered = true
      saveState()
      log(`Logged in as ${bot.username} on Minecraft ${bot.version}`)
      setInterval(() => walkSquare(bot), WALK_EVERY_MS)
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

  bot.on('chat', (from, text) => {
    if (from !== bot.username) record('chat', from, text)
  })

  // Whispers are answered one at a time, in the order they arrived.
  const waiting = []
  let answering = false
  function answerNext () {
    if (answering || waiting.length === 0) return
    answering = true
    const { from, text } = waiting.shift()
    const question =
      `You are in the minecraft-api Minecraft world as the player ${bot.username}. ` +
      `The player ${from} whispered to you: "${text}"\n` +
      `Answer as you would say it in the game: plain text on one line, at most ${REPLY_PART_LENGTH} characters. ` +
      'Your answer is whispered back to them as it is.'
    askSpeaker(question, (error, answer) => {
      if (error) log(`No answer for ${from}: ${error.message}`)
      whisper(bot, from, error ? 'I cannot answer right now. Try again in a little while.' : answer)
      answering = false
      answerNext()
    })
  }
  bot.on('whisper', (from, text) => {
    if (from === bot.username) return
    record('whisper', from, text)
    waiting.push({ from, text })
    answerNext()
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

/** Whisper text to a player, in as many chat lines as it needs. */
function whisper (bot, to, text) {
  const words = text.replace(/\s+/g, ' ').trim().split(' ')
  const parts = ['']
  for (const word of words) {
    const last = parts.length - 1
    if (parts[last] && (parts[last] + ' ' + word).length > REPLY_PART_LENGTH) parts.push(word.slice(0, REPLY_PART_LENGTH))
    else parts[last] = (parts[last] ? parts[last] + ' ' : '') + word.slice(0, REPLY_PART_LENGTH)
  }
  parts.slice(0, MAX_REPLY_PARTS).forEach((part, index) => {
    // A second apart: the server kicks a player who sends chat too fast.
    setTimeout(() => {
      bot.chat(`/msg ${to} ${part}`)
      record('reply', to, part)
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
