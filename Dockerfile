FROM node:20-alpine

ENV NODE_OPTIONS --max-old-space-size=4096

WORKDIR /app

COPY package*.json ./

RUN npm install --omit=dev --ignore-scripts

COPY dist ./dist

EXPOSE 5051

CMD npm run prod
