import { knex } from "knex";
import { attachOnDuplicateUpdate } from "knex-on-duplicate-update";

import config from "./knexfile";

let dbConfig1 = config.development;
let dbConfig2 = config.development;

if (process.env.NODE_ENV === "production") {
  dbConfig1 = config.productionRead;
  dbConfig2 = config.productionWrite;
} else if (process.env.NODE_ENV === "staging") {
  dbConfig1 = config.stagingRead;
  dbConfig2 = config.stagingWrite;
}
const knexRead = knex(dbConfig1);
const knexWrite = knex(dbConfig2);

attachOnDuplicateUpdate();

export { knexRead, knexWrite };
