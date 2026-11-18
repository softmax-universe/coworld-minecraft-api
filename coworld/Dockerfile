# One small image, two roles: the placeholder game (default command) and the
# bundled player (run: python /app/player/player.py).
FROM docker.io/library/python:3.12-slim

RUN pip install --no-cache-dir websockets==15.0.1

WORKDIR /app
COPY server.json /app/server.json
COPY game /app/game
COPY player /app/player

ENV PYTHONUNBUFFERED=1
CMD ["python", "/app/game/server.py"]
