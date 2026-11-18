// Example bot: join, register or log in, walk, chat, and leave.
//
// Usage:
//   MC_USERNAME=my_bot MC_PASSWORD=a-long-password node bot.js
//
// Optional: MC_HOST (default minecraft-api), MC_PORT (default 25565),
// MC_SECONDS (how long to walk, default 10).
const mineflayer = require('mineflayer')

const host = process.env.MC_HOST || 'minecraft-api'
const port = Number(process.env.MC_PORT || 25565)
const username = process.env.MC_USERNAME
const password = process.env.MC_PASSWORD
const walkSeconds = Number(process.env.MC_SECONDS || 10)

if (!username || !password) {
  console.error('Set MC_USERNAME (3 to 16 letters, digits, or underscores) and MC_PASSWORD (8 or more characters).')
  process.exit(2)
}

// No "version" option: Mineflayer pings the server and uses its version.
// "offline" means no Mojang account. The server checks our password instead.
const bot = mineflayer.createBot({ host, port, username, auth: 'offline' })

let loggedIn = false

// The server's login plugin tells a new arrival what to send. The same
// prompt repeats every few seconds until the bot answers.
bot.on('messagestr', (message) => {
  console.log(`[server] ${message}`)
  if (loggedIn) return

  if (/successfully (registered|logged in)|successful login/i.test(message)) {
    loggedIn = true
    play()
  } else if (message.includes('/register')) {
    bot.chat(`/register ${password} ${password}`)
  } else if (message.includes('/login')) {
    bot.chat(`/login ${password}`)
  }
})

function describePosition () {
  const { x, y, z } = bot.entity.position
  return `x=${x.toFixed(1)} y=${y.toFixed(1)} z=${z.toFixed(1)}`
}

function play () {
  console.log(`Logged in as ${bot.username} on Minecraft ${bot.version}. Start: ${describePosition()}`)
  bot.chat(`Hello from ${bot.username}. I will walk for ${walkSeconds} seconds.`)

  // Hold "forward" and "jump" so the bot walks and hops over low obstacles.
  bot.setControlState('forward', true)
  bot.setControlState('jump', true)

  // If something blocks the way, turn a quarter turn and keep going.
  let lastPosition = bot.entity.position.clone()
  const unstick = setInterval(() => {
    if (bot.entity.position.distanceTo(lastPosition) < 1) {
      bot.look(bot.entity.yaw + Math.PI / 2, 0)
    }
    lastPosition = bot.entity.position.clone()
  }, 1500)

  setTimeout(() => {
    clearInterval(unstick)
    bot.clearControlStates()
    const nearest = bot.nearestEntity()
    console.log(`End: ${describePosition()} health=${bot.health} food=${bot.food}`)
    console.log(`Block under the bot: ${bot.blockAt(bot.entity.position.offset(0, -1, 0))?.name}`)
    console.log(`Nearest entity: ${nearest ? nearest.name : 'none'}`)
    bot.quit()
  }, walkSeconds * 1000)
}

bot.on('kicked', (reason) => console.error('Kicked:', JSON.stringify(reason)))
bot.on('error', (error) => console.error('Error:', error.message))
bot.on('end', (reason) => {
  console.log(`Disconnected: ${reason}`)
  process.exit(loggedIn ? 0 : 1)
})
