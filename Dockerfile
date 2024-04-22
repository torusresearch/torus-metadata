FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

ENV NODE_OPTIONS --max-old-space-size=4096

RUN apk add --no-cache --virtual .gyp \
        python3 \
        make \
        g++ \
        && npm ci && apk del .gyp

COPY . .

RUN npm run build

EXPOSE 5051

CMD npm run prod
