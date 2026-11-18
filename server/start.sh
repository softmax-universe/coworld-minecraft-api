#!/usr/bin/env bash
# Start Paper. MC_HEAP sets the Java heap (default 16G, the EC2 box's size;
# local/compose.yaml sets a smaller one).
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
heap="${MC_HEAP:-16G}"

# The Minecraft EULA must be accepted to run a server:
# https://aka.ms/MinecraftEULA
echo "eula=true" > eula.txt

# RCON is the admin console. Its password is created on first start and never
# committed. rcon.py reads it back from server.properties.
if grep -q '^rcon.password=$' server.properties; then
  password="$(head -c 24 /dev/urandom | base64 | tr -d '/+=')"
  sed -i "s|^rcon.password=$|rcon.password=${password}|" server.properties
fi

# JVM flags are the "Aikar's flags" set recommended in the Paper docs:
# https://docs.papermc.io/paper/aikars-flags
exec java "-Xms${heap}" "-Xmx${heap}" \
  -XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 \
  -XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC -XX:+AlwaysPreTouch \
  -XX:G1NewSizePercent=30 -XX:G1MaxNewSizePercent=40 -XX:G1HeapRegionSize=8M \
  -XX:G1ReservePercent=20 -XX:G1HeapWastePercent=5 -XX:G1MixedGCCountTarget=4 \
  -XX:InitiatingHeapOccupancyPercent=15 -XX:G1MixedGCLiveThresholdPercent=90 \
  -XX:G1RSetUpdatingPauseTimePercent=5 -XX:SurvivorRatio=32 \
  -XX:+PerfDisableSharedMem -XX:MaxTenuringThreshold=1 \
  -jar paper.jar --nogui
