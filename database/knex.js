/* eslint-disable import/order */
const config = require("./knexfile");

let dbConfig1 = config.development;
let dbConfig2 = config.development;

if (process.env.NODE_ENV === "production") {
  dbConfig1 = config.productionRead;
  dbConfig2 = config.productionWrite;
} else if (process.env.NODE_ENV === "staging") {
  dbConfig1 = config.stagingRead;
  dbConfig2 = config.stagingWrite;
}
const knexRead = require("knex")(dbConfig1);
const knexWrite = require("knex")(dbConfig2);

const { attachOnDuplicateUpdate } = require("knex-on-duplicate-update");

attachOnDuplicateUpdate();

exports.knexRead = knexRead;
exports.knexWrite = knexWrite;
