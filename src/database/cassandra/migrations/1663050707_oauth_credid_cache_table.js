// eslint-disable-next-line @typescript-eslint/no-var-requires
const { queryCreateKeyValueTable, queryDeleteTable } = require("./helper");

const migration1663050707 = {
  up: function (db, handler) {
    const query = queryCreateKeyValueTable("oauth_credid_cache");
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
    const query = queryDeleteTable("oauth_credid_cache");
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
module.exports = migration1663050707;
