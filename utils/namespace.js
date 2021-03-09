const old = "";
const tkey = "tkey";
const webauthn = "webauthn";
const DBTableMap = {
  tkey,
  webauthn,
};
DBTableMap[old] = "data";

exports.getDBTableName = (namespace) => {
  const table = DBTableMap[namespace || ""];
  if (!table) throw new Error("Unknown namespace");
  return table;
};
