# OSMBC container image. Build from a release tag:
#
#   podman build -t osmbc:<version> .
#
# Runtime layout (see docs/container.md):
#   /config  config.production.yaml (+ editorial file), mounted read-only
#   /data    everything OSMBC writes: cache, public profiles, mail/export log;
#            the config keys cache_directory, profile_directory,
#            maillog_directory and exportlog_directory point there
# The app directory /app belongs to root and is read-only for the service.
# Logs go to stdout/stderr only.

# Node 22 or newer (checked at start, see bin/www.js and "engines").
FROM docker.io/library/node:22-bookworm-slim

# git: only needed if the optional wiki is switched on (it keeps its pages
# in a git repository); small enough to always have it.
RUN apt-get update \
    && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dependencies first, so a code-only change reuses this layer.
# --ignore-scripts: no runtime package needs an install script; OSMBC's own
# postinstall (copies browser assets into public/) runs below, after the
# code is in place, so local copies in the build context can't override it.
COPY package.json package-lock.json .npmrc ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund \
    && npm cache clean --force

COPY . .
RUN node postinstall.js

# Mount points. Owned by the unprivileged user, so the image also runs
# without volumes (rootless Podman: mount with :U or UserNS=keep-id).
RUN mkdir -p /config /data/cache /data/profile /data/log \
    && chown -R node:node /config /data

ENV NODE_ENV=production \
    OSMBC_CONFIG_DIR=/config

USER node

# Documentation only: the port is set by serverport in the config.
EXPOSE 3000

# A fresh /data volume is empty and hides the folders created above, but
# OSMBC refuses to start without its log folder: create them on start.
# exec keeps node as PID 1, so it gets the stop signal itself.
# Not `npm start`: that sets NODE_ENV=development.
CMD ["sh", "-c", "mkdir -p /data/cache /data/profile /data/log && exec node bin/www.js"]
