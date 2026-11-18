// Load check: connect many bots at once and keep them walking.
//
// Usage:
//   MC_PASSWORD=a-long-password node load-test.js
//
// Optional: MC_HOST, MC_PORT, MC_BOTS (default 32, the server's player limit), MC_SECONDS (default 120),
// MC_NAME_PREFIX (default "load_"). Bots are named load_01, load_02, ...
// While it runs, read the tick rate on the server host with: mc-rcon tps
const mineflayer = require('mineflayer')

const host = process.env.MC_HOST || 'minecraft-api'
const port = Number(process.env.MC_PORT || 25565)
const password = process.env.MC_PASSWORD
const botCount = Number(process.env.MC_BOTS || 32)
const runSeconds = Number(process.env.MC_SECONDS || 120)
const namePrefix = process.env.MC_NAME_PREFIX || 'load_'
const joinGapMilliseconds = 400

if (!password) {
  console.error('Set MC_PASSWORD (8 or more characters). All load bots share it.')
  process.exit(2)
}

const counts = { loggedIn: 0, kicked: 0, errors: 0, ended: 0 }

function startBot (index) {
  const username = `${namePrefix}${String(index).padStart(2, '0')}`
  const bot = mineflayer.createBot({ host, port, username, auth: 'offline' })
  let loggedIn = false

  bot.on('messagestr', (message) => {
    if (loggedIn) return
    if (/successfully (registered|logged in)|successful login/i.test(message)) {
      loggedIn = true
      counts.loggedIn += 1
      walk(bot)
    } else if (message.includes('/register')) {
      bot.chat(`/register ${password} ${password}`)
    } else if (message.includes('/login')) {
      bot.chat(`/login ${password}`)
    }
  })
  bot.on('kicked', (reason) => {
    counts.kicked += 1
    console.error(`${username} kicked: ${JSON.stringify(reason).slice(0, 200)}`)
  })
  bot.on('error', (error) => {
    counts.errors += 1
    console.error(`${username} error: ${error.message}`)
  })
  bot.on('end', () => { counts.ended += 1 })
  return bot
}

// Walk forward and turn to a new random heading every few seconds.
function walk (bot) {
  bot.setControlState('forward', true)
  bot.setControlState('jump', true)
  bot.setControlState('sprint', true)
  setInterval(() => {
    if (bot.entity) bot.look(Math.random() * 2 * Math.PI, 0)
  }, 5000)
}

const bots = []
for (let index = 1; index <= botCount; index++) {
  setTimeout(() => bots.push(startBot(index)), index * joinGapMilliseconds)
}

const report = setInterval(() => {
  console.log(`${new Date().toISOString()} loggedIn=${counts.loggedIn}/${botCount} kicked=${counts.kicked} errors=${counts.errors} ended=${counts.ended}`)
}, 10000)

setTimeout(() => {
  clearInterval(report)
  console.log(`Final: loggedIn=${counts.loggedIn}/${botCount} kicked=${counts.kicked} errors=${counts.errors} endedEarly=${counts.ended}`)
  for (const bot of bots) bot.quit()
  setTimeout(() => process.exit(counts.loggedIn === botCount && counts.kicked === 0 ? 0 : 1), 2000)
}, runSeconds * 1000 + botCount * joinGapMilliseconds)
