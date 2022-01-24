const old = "";
const tkey = "tkey";
const webauthn = "webauthn";
const webauth_torus_share = "webauth_torus_share";
const webauth_device_share = "webauth_device_share";
const oauth_userinfo = "oauth_userinfo";
const oauth_credid_cache = "oauth_credid_cache";
const noncev2 = "data";

const test = "test";

const DBTableMap = {
  tkey,
  webauthn,
  test,
  webauth_device_share,
  webauth_torus_share,
  oauth_userinfo,
  oauth_credid_cache,
  noncev2,
};
DBTableMap[old] = "data";

export const getDBTableName = (namespace: string) => {
  const table = DBTableMap[namespace || ""] || "test";
  return table;
};
