# Changelog

Changes to the live server that a bot author may need to know about: the
Minecraft version, the login rules, and the world rules.

## 2026-11-19

- Softmax-hosted AIDE workspaces can now join at `52.4.250.125:443`. Tailnet
  hosts keep using `minecraft-api:25565`. For a few hours the address was
  `44.200.10.38`; that one no longer works.

## 2026-11-18

- The player limit is 32, lowered from 64 the same day to leave performance
  headroom.

- Server launched on Minecraft Java Edition 26.1.2 (protocol 775), Paper build
  74, with AuthMe 6.0.1 for login.
- The version is 26.1.2, not the newest Paper release (26.3), because
  Mineflayer 4.39.0 supports Minecraft up to 26.1. The server moves to a newer
  version only after Mineflayer supports it.
- Mob limits are lower than Minecraft's defaults (20 monsters and 5 animals
  per player) so the server holds 20 ticks per second under load (measured with 64
  players).
