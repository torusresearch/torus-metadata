FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

ENV NODE_OPTIONS --max-old-space-size=4096

RUN apk add --no-cache --virtual .gyp \
        python3 \
        make \
        g++ \
        && npm ci && apk del .gyp

COPY . .

EXPOSE 5051

CMD npm run build && npm run prod