const knex = require("./knex");
const redisClient = require("./redis");

exports.knexRead = knex.knexRead;
exports.knexWrite = knex.knexWrite;
// exports.knex = knex.knexWrite Use for database migration
exports.redisClient = redisClient;
