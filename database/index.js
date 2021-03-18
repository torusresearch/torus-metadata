const knex = require("./knex");
const redisClient = require("./redis");
const { getHashAndWriteAsync } = require("./ipfs");

exports.getHashAndWriteAsync = getHashAndWriteAsync;
exports.knexRead = knex.knexRead;
exports.knexWrite = knex.knexWrite;
// exports.knex = knex.knexWrite Use for database migration
exports.redisClient = redisClient;
