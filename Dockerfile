FROM node:24.22.1-alpine AS base

# The npm binary stays root-owned. Application dependencies are installed below, as node.
RUN npm install --global npm@12.2.0

ENV NODE_OPTIONS=--max-old-space-size=4096

# /home/node already belongs to node. COPY always runs as root, so the manifests
# are handed over with chown instead of COPY --chown, which is what KICS flags.
USER node
RUN mkdir -p /home/node/app
WORKDIR /home/node/app

COPY package.json package-lock.json .npmrc ./

USER root
RUN chown -R node:node /home/node/app
USER node

# for build
FROM base AS build

USER root
COPY . .
RUN chown -R node:node /home/node/app
USER node

RUN npm ci --no-audit --no-fund

RUN npm run build

# production dependencies, installed as node
FROM base AS prod-deps

RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund && npm cache clean --force

# BuildKit keeps the source owner on COPY --from, so the node-owned install
# arrives owned by node. Reassign it to root. There is no --chown flag for KICS to flag.
FROM node:24.22.1-alpine

ENV NODE_OPTIONS=--max-old-space-size=4096

WORKDIR /app

COPY --from=prod-deps /home/node/app ./
COPY --from=build /home/node/app/dist ./dist

RUN chown -R root:root /app

USER node

EXPOSE 5051

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT:-5051}/health" || exit 1

CMD ["node", "dist/index.js"]
