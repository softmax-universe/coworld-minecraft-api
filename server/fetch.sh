#!/usr/bin/env bash
# Download the pinned Paper server and AuthMe plugin into a server directory
# and copy the shared config files next to them. Used by install.sh on the
# EC2 box and by local/Dockerfile, so both run the same files.
#
# Usage: fetch.sh <server-dir>
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
server_dir="$1"
# shellcheck source=versions.env
source "$here/versions.env"

mkdir -p "$server_dir/plugins"

curl -fsSL -o "$server_dir/paper.jar" "$PAPER_URL"
echo "$PAPER_SHA256  $server_dir/paper.jar" | sha256sum -c -

curl -fsSL -o "$server_dir/plugins/AuthMe.jar" "$AUTHME_URL"
echo "$AUTHME_SHA512  $server_dir/plugins/AuthMe.jar" | sha512sum -c -

cp -R "$here/config/." "$server_dir/"
cp "$here/start.sh" "$server_dir/start.sh"
chmod +x "$server_dir/start.sh"
