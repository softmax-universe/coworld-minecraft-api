# Local copy of the minecraft-api server. It downloads the same Paper and
# AuthMe files and uses the same config as the EC2 box (see ../server).
# Build from the repo root:  docker compose -f local/compose.yaml up --build
FROM amazoncorretto:25

RUN dnf install -y tar gzip && dnf clean all

COPY server /src/server
RUN /src/server/fetch.sh /opt/minecraft-api

WORKDIR /opt/minecraft-api
EXPOSE 25565
CMD ["/opt/minecraft-api/start.sh"]
