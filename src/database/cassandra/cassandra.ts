import { Client, types } from "cassandra-driver";
import log from "loglevel";

import { DataInsertType } from "../../utils/interfaces";

const { CASSANDRA_HOSTS, CASSANDRA_KEYSPACE, CASSANDRA_LOCAL_DATACENTER, CASSANDRA_USER, CASSANDRA_PASSWORD } = process.env;
const hosts = (CASSANDRA_HOSTS ?? "").split(",");

const client = new Client({
  contactPoints: hosts,
  protocolOptions: {
    maxVersion: 4,
  },
  localDataCenter: CASSANDRA_LOCAL_DATACENTER,
  keyspace: CASSANDRA_KEYSPACE,
  credentials: {
    username: CASSANDRA_USER,
    password: CASSANDRA_PASSWORD,
  },
});

client.connect();

client.on("log", (level, loggerName, message) => {
  switch (level) {
    case "info":
      log.info(`${loggerName}:  ${message}`);
      break;
    case "warning":
      log.warn(`${loggerName}:  ${message}`);
      break;
    case "error":
      log.error(`${loggerName}:  ${message}`);
      break;
    case "verbose":
      log.debug(`${loggerName}:  ${message}`);
      break;
    default:
      log.info(`${level} - ${loggerName}:  ${message}`);
  }
});

export async function getMetadata(table: string, key: string, consistencyLevel: types.consistencies): Promise<string | undefined> {
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

export async function setMetadata(table: string, key: string, value: string, consistencyLevel: types.consistencies): Promise<void> {
  log.info({ table });
  const result = await client.execute(`INSERT INTO ${table} (key, created_at, value) VALUES (?, NOW(),?)`, [key, value], {
    prepare: true,
    consistency: consistencyLevel,
  });
  if (!result.wasApplied()) throw new Error("fail to write data to Cassandra");
}

export async function setMetadataInMultiTables(batch: Record<string, DataInsertType[]>, consistencyLevel: types.consistencies): Promise<void> {
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

export async function setMetadataInBulk(table: string, batches: DataInsertType[][], consistencyLevel: types.consistencies): Promise<void> {
  const queries = [];
  for (const batch of batches) {
    for (const data of batch) {
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

// simulate Redis using keyvalue table in cassandra
export async function getKeyValue(key: string, consistencyLevel: types.consistencies): Promise<string | undefined> {
  const result = await client.execute(`SELECT * FROM keyvalue WHERE key = ?`, [key], {
    prepare: true,
    consistency: consistencyLevel,
  });
  if (result.rowLength > 0) {
    const { value } = result.first();
    return value;
  }
  return undefined;
}

export async function setKeyValue(key: string, value: string, ttl: number, consistencyLevel: types.consistencies): Promise<void> {
  const result = await client.execute(`INSERT INTO keyvalue (key, value, created_at) VALUES (?, ?, NOW()) USING TTL ?`, [key, value, ttl], {
    prepare: true,
    consistency: consistencyLevel,
  });
  if (!result.wasApplied()) throw new Error("fail to write data to Cassandra");
}

export async function deleteKeyValue(key: string, consistencyLevel: types.consistencies): Promise<void> {
  const result = await client.execute(`DELETE FROM keyvalue WHERE key = ?`, [key], {
    prepare: true,
    consistency: consistencyLevel,
  });
  if (!result.wasApplied()) throw new Error("fail to delete data in Cassandra");
}

export default client;
