export const OLD = "";
export const TKEY = "tkey";
export const WEBAUTHN = "webauthn";
export const WEBAUTHN_TORUS_SHARE = "webauth_torus_share";
export const WEBAUTHN_DEVICE_SHARE = "webauth_device_share";
export const OAUTH_USERINFO = "oauth_userinfo";
export const OAUTH_CREDID_CACHE = "oauth_credid_cache";
export const NONCEV2 = "noncev2";
export const TEST = "test";

const DBTableMap: Record<string, string> = {
  [OLD]: "data",
  [TKEY]: TKEY,
  [WEBAUTHN]: WEBAUTHN,
  [WEBAUTHN_TORUS_SHARE]: WEBAUTHN_TORUS_SHARE,
  [WEBAUTHN_DEVICE_SHARE]: WEBAUTHN_DEVICE_SHARE,
  [OAUTH_USERINFO]: OAUTH_USERINFO,
  [OAUTH_CREDID_CACHE]: OAUTH_CREDID_CACHE,
  [NONCEV2]: "data",
  [TEST]: TEST,
};

export type DBTableName = keyof typeof DBTableMap;

export interface Data {
  id: string;
  created_at: Date;
  updated_at: Date;
  key: string;
  value: string;
}

export type DataInsertType = Omit<Data, "id" | "created_at" | "updated_at">;
export type DataUpdateType = Omit<Data, "id" | "created_at" | "updated_at" | "key">;

export interface SetDataData {
  data: string;
  timestamp: string;
}

export interface SetDataInput {
  namespace?: string;
  pub_key_X: string;
  pub_key_Y: string;
  set_data: SetDataData;
  tableName?: DBTableName;
  signature: string;
}

export interface LockDataInput {
  key: string;
  signature: string;
  data: Partial<SetDataData> & Pick<SetDataData, "timestamp">;
}

export const getDBTableName = (namespace: string) => {
  const table = DBTableMap[namespace || ""] || "test";
  return table;
};
