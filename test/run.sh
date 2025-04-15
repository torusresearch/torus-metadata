#!/bin/sh

echo "RUNNING DB MIGRATIONS"
sleep 10
npm run migrate

echo "WAITING FOR WEB SERVER"
npm run serve &
/app/node_modules/.bin/wait-port 5051

echo "RUN TESTS"
sleep 10
npm run test
