const knex = require("./knex");

exports.knexRead = knex.knexRead;
exports.knexWrite = knex.knexWrite;
// exports.knex = knex.knexWrite Use for database migration
