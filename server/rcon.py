#!/usr/bin/env python3
"""Send one admin command to the local Minecraft server over RCON.

Usage: mc-rcon "<command>"        for example: mc-rcon list

RCON is Minecraft's remote admin console. This reads the port and password
from the server's own server.properties, so it must run as root or as the
mcserver user on the server host.
"""

import socket
import struct
import sys

SERVER_PROPERTIES = "/opt/minecraft-api/server.properties"
PACKET_TYPE_LOGIN = 3
PACKET_TYPE_COMMAND = 2
LOGIN_REQUEST_ID = 1
COMMAND_REQUEST_ID = 2


def read_properties(path: str) -> dict[str, str]:
    properties = {}
    with open(path) as properties_file:
        for line in properties_file:
            if "=" in line and not line.startswith("#"):
                key, value = line.rstrip("\n").split("=", 1)
                properties[key] = value
    return properties


def send_packet(connection: socket.socket, request_id: int, packet_type: int, body: str) -> None:
    payload = struct.pack("<ii", request_id, packet_type) + body.encode() + b"\x00\x00"
    connection.sendall(struct.pack("<i", len(payload)) + payload)


def read_exactly(connection: socket.socket, length: int) -> bytes:
    data = b""
    while len(data) < length:
        chunk = connection.recv(length - len(data))
        if not chunk:
            raise ConnectionError("The server closed the RCON connection.")
        data += chunk
    return data


def read_packet(connection: socket.socket) -> tuple[int, str]:
    (length,) = struct.unpack("<i", read_exactly(connection, 4))
    payload = read_exactly(connection, length)
    (request_id, _packet_type) = struct.unpack("<ii", payload[:8])
    return request_id, payload[8:-2].decode(errors="replace")


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__, file=sys.stderr)
        return 2
    command = " ".join(sys.argv[1:])
    properties = read_properties(SERVER_PROPERTIES)
    port = int(properties.get("rcon.port", "25575"))

    with socket.create_connection(("127.0.0.1", port), timeout=60) as connection:
        send_packet(connection, LOGIN_REQUEST_ID, PACKET_TYPE_LOGIN, properties["rcon.password"])
        request_id, _ = read_packet(connection)
        if request_id != LOGIN_REQUEST_ID:
            print("RCON login failed: wrong password.", file=sys.stderr)
            return 1
        send_packet(connection, COMMAND_REQUEST_ID, PACKET_TYPE_COMMAND, command)
        _, response = read_packet(connection)
        print(response)
    return 0


if __name__ == "__main__":
    sys.exit(main())
