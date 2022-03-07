import { Knex } from "knex";

import {
  Data,
  DataInsertType,
  DataUpdateType,
  NONCEV2,
  OAUTH_CREDID_CACHE,
  OAUTH_USERINFO,
  OLD,
  TEST,
  TKEY,
  WEBAUTHN,
  WEBAUTHN_DEVICE_SHARE,
  WEBAUTHN_TORUS_SHARE,
} from "../utils/interfaces";

// Update these types whenever migrations change
declare module "knex/types/tables" {
  interface Tables {
    [OLD]: Knex.CompositeTableType<Data, DataInsertType, DataUpdateType>;
    [TKEY]: Knex.CompositeTableType<Data, DataInsertType, DataUpdateType>;
    [WEBAUTHN]: Knex.CompositeTableType<Data, DataInsertType, DataUpdateType>;
    [WEBAUTHN_TORUS_SHARE]: Knex.CompositeTableType<Data, DataInsertType, DataUpdateType>;
    [WEBAUTHN_DEVICE_SHARE]: Knex.CompositeTableType<Data, DataInsertType, DataUpdateType>;
    [OAUTH_USERINFO]: Knex.CompositeTableType<Data, DataInsertType, DataUpdateType>;
    [OAUTH_CREDID_CACHE]: Knex.CompositeTableType<Data, DataInsertType, DataUpdateType>;
    [NONCEV2]: Knex.CompositeTableType<Data, DataInsertType, DataUpdateType>;
    [TEST]: Knex.CompositeTableType<Data, DataInsertType, DataUpdateType>;
  }
}
