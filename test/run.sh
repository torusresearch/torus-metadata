#!/bin/sh
npm run migrate
npm run serve &
/app/node_modules/.bin/wait-port 5051
sleep 10
npm run test