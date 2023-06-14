const migration1663255002 = {
  up: function (db, handler) {
    const query = `CREATE TABLE IF NOT EXISTS keyvalue (
      key TEXT,
      value TEXT,
      created_at TIMEUUID,
      PRIMARY KEY (key)
    );`;
    const params = [];
    db.execute(query, params, { prepare: false }, function (err) {
      if (err) {
        handler(err, false);
      } else {
        handler(false, true);
      }
    });
  },
  down: function (db, handler) {
    const query = "DROP TABLE keyvalue";
    const params = [];
    db.execute(query, params, { prepare: false }, function (err) {
      if (err) {
        handler(err, false);
      } else {
        handler(false, true);
      }
    });
  },
};
module.exports = migration1663255002;
