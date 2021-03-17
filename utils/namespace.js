const old = "";
const tkey = "tkey";
const webauthn = "webauthn";
const test = "test";
const DBTableMap = {
  tkey,
  webauthn,
  test,
};
DBTableMap[old] = "data";

exports.getDBTableName = (namespace) => {
  const table = DBTableMap[namespace || ""] || "test";
  return table;
};
