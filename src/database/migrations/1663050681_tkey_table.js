// eslint-disable-next-line @typescript-eslint/no-var-requires
const { queryCreateKeyValueTable, queryDeleteTable } = require("./helper");

const migration1663050681 = {
  up: function (db, handler) {
    const query = queryCreateKeyValueTable("tkey");
    const params = [];
    db.execute(query, params, { prepare: true }, function (err) {
      if (err) {
        handler(err, false);
      } else {
        handler(false, true);
      }
    });
  },
  down: function (db, handler) {
    const query = queryDeleteTable("tkey");
    const params = [];
    db.execute(query, params, { prepare: true }, function (err) {
      if (err) {
        handler(err, false);
      } else {
        handler(false, true);
      }
    });
  },
};
module.exports = migration1663050681;
