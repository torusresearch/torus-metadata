# for build
FROM node:20-alpine AS build

ENV NODE_OPTIONS --max-old-space-size=4096

WORKDIR /app

RUN apk add --no-cache --virtual .gyp \
        python3 \
        make \
        g++

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build 

# for production
FROM node:20-alpine

ENV NODE_OPTIONS --max-old-space-size=4096

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev --ignore-scripts

COPY --from=build /app/dist ./dist

EXPOSE 5051

CMD npm run prod
