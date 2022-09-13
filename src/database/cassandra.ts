import { Client, types } from "cassandra-driver";
import log from "loglevel";

import { DataInsertType, DBTableName } from "../utils/interfaces";

const { CASSANDRA_HOSTS, CASSANDRA_KEYSPACE, CASSANDRA_LOCAL_DATACENTER, CASSANDRA_USER, CASSANDRA_PASSWORD } = process.env;
const hosts = (CASSANDRA_HOSTS ?? "").split(",");

const client = new Client({
  contactPoints: hosts,
  localDataCenter: CASSANDRA_LOCAL_DATACENTER,
  keyspace: CASSANDRA_KEYSPACE,
  credentials: {
    username: CASSANDRA_USER,
    password: CASSANDRA_PASSWORD,
  },
});

client.on("log", (level, loggerName, message) => {
  log.info(`${level} - ${loggerName}:  ${message}`);
});

async function getKey(table: string, key: string, consistencyLevel: types.consistencies): Promise<string | undefined> {
  const result = await client.execute(`SELECT * FROM ${table} WHERE key = ? ORDER BY created_at DESC LIMIT 1`, [key], {
    prepare: true,
    consistency: consistencyLevel,
  });
  if (result.rowLength > 0) {
    const { value } = result.first();
    return value;
  }
  return undefined;
}

async function setKey(table: string, key: string, value: string, consistencyLevel: types.consistencies): Promise<void> {
  const result = await client.execute(`INSERT INTO ${table} (key, created_at, value) VALUES (?, NOW(),?)`, [key, value], {
    prepare: true,
    consistency: consistencyLevel,
  });
  if (!result.wasApplied()) throw new Error("fail to write data to Cassandra");
}

async function setKeysInBatch(batch: Record<keyof DBTableName, DataInsertType[]>, consistencyLevel: types.consistencies): Promise<void> {
  const queries = [];
  for (const table in batch) {
    for (const data of batch[`${table}`]) {
      queries.push({
        query: `INSERT INTO ${table} (key, created_at, value) VALUES (?, NOW(),?)`,
        params: [data.key, data.value],
      });
    }
  }
  const result = await client.batch(queries, {
    prepare: true,
    consistency: consistencyLevel,
  });
  if (!result.wasApplied()) throw new Error("fail to write data to Cassandra");
}

export { getKey, setKey, setKeysInBatch };
