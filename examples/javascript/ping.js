// Ask the server which Minecraft version it runs. This needs no login.
// Usage: node ping.js            (MC_HOST and MC_PORT are optional)
const { ping } = require('minecraft-protocol')
const mineflayer = require('mineflayer')

const host = process.env.MC_HOST || 'minecraft-api'
const port = Number(process.env.MC_PORT || 25565)

async function main () {
  const status = await ping({ host, port })
  const serverVersion = status.version.name.replace(/^Paper /, '')
  const supported = mineflayer.testedVersions

  console.log(JSON.stringify({
    host,
    port,
    serverVersion: status.version.name,
    protocol: status.version.protocol,
    playersOnline: status.players.online,
    playersMax: status.players.max,
    mineflayerSupportsUpTo: mineflayer.latestSupportedVersion
  }, null, 2))

  // Mineflayer lists one tested version per protocol, for example "26.1" for
  // the 26.1.x releases, so compare by prefix.
  const isSupported = supported.some((version) => serverVersion.startsWith(version))
  if (!isSupported) {
    console.error(`This Mineflayer release does not list ${serverVersion}. Run "npm update mineflayer" or see docs/client-libraries.md.`)
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(`Status ping failed: ${error.message}`)
  process.exit(1)
})
