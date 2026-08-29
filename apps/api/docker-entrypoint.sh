#!/bin/sh
set -e

# No usa pnpm/corepack: el stage "runtime" no copia package.json, así que
# corepack no tiene de dónde leer la versión a usar. El binario ya está en
# node_modules/.bin porque prisma queda instalado ahí (ver nota en el
# Dockerfile sobre devDependencies en runtime).
./node_modules/.bin/prisma migrate deploy

exec node dist/index.js
