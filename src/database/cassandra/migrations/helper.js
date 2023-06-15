function queryCreateKeyValueTable(table) {
  return `CREATE TABLE IF NOT EXISTS ${table} (
        key TEXT,
        created_at TIMEUUID,
        value TEXT,
        PRIMARY KEY (key, created_at)
      ) WITH CLUSTERING ORDER BY (created_at DESC);`;
}

function queryDeleteTable(table) {
  return `DROP TABLE ${table};`;
}

exports.queryCreateKeyValueTable = queryCreateKeyValueTable;
exports.queryDeleteTable = queryDeleteTable;
