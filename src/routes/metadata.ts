/* eslint-disable security/detect-object-injection */
import { generatePrivate } from "@toruslabs/eccrypto";
import { types } from "cassandra-driver";
import { celebrate, Joi, Segments } from "celebrate";
import { ec as EC } from "elliptic";
import express, { Request, Response } from "express";
import log from "loglevel";
import multer from "multer";

import { getMetadata, setMetadata, setMetadataInBulk, setMetadataInMultiTables } from "../cassandra/cassandra";
import { getHashAndWriteAsync } from "../database/ipfs";
import { knexRead, knexWrite } from "../database/knex";
import redis from "../database/redis";
import {
  serializeStreamBody,
  validateDataTimeStamp,
  validateGetOrSetNonceSetInput,
  validateGetOrSetNonceSignature,
  validateLoopSignature,
  validateMetadataLoopInput,
  validateNamespace,
  validateNamespaceLoop,
  validateSignature,
} from "../middleware";
import { constructKey, getError, getTraceIdLogMsg, MAX_BATCH_SIZE, REDIS_TIMEOUT } from "../utils";
import { DataInsertType, DBTableName, SetDataInput } from "../utils/interfaces";

const upload = multer({
  limits: { fieldSize: 30 * 1024 * 1024 },
});

const elliptic = new EC("secp256k1");

const router = express.Router();

const NAMESPACES = {
  nonceV2: "noncev2",
  pubNonceV2: "pub_noncev2",
  private_nonce: "private_nonce",
  public_nonce: "public_nonce",
};

const RESERVED_NAMESPACES = [NAMESPACES.nonceV2, NAMESPACES.pubNonceV2, NAMESPACES.private_nonce, NAMESPACES.public_nonce];

const validateSetData = Joi.object({
  namespace: Joi.string().max(128),
  pub_key_X: Joi.string().max(64).hex().required(),
  pub_key_Y: Joi.string().max(64).hex().required(),
  set_data: Joi.object({
    data: Joi.string().required(),
    timestamp: Joi.string().hex().required(),
  }).required(),
  signature: Joi.string().max(88).required(),
  isSQL: Joi.bool().optional(),
});

router.post(
  "/get",
  celebrate(
    {
      [Segments.BODY]: Joi.object({
        namespace: Joi.string().max(128),
        pub_key_X: Joi.string().max(64).required(),
        pub_key_Y: Joi.string().max(64).required(),
      }),
    },
    { allowUnknown: true }
  ),
  validateNamespace,
  async (req: Request, res: Response) => {
    try {
      const {
        namespace = "",
        pub_key_X: pubKeyX,
        pub_key_Y: pubKeyY,
        tableName = "",
      }: { namespace?: string; pub_key_X: string; pub_key_Y: string; tableName?: DBTableName } = req.body;
      const key = constructKey(pubKeyX, pubKeyY, namespace);
      let value: string;
      // read from new cassandra tables

      // read from existing system redis + cassandra
      try {
        value = await redis.get(key);
      } catch (error) {
        log.warn("redis get failed", error);
      }

      if (!value) {
        value = await getMetadata(tableName, key, types.consistencies.localQuorum);
        log.info("newMetadata", value);
        if (!value) {
          const data = await knexRead(tableName).where({ key }).orderBy("created_at", "desc").orderBy("id", "desc").first();
          value = data?.value || "";
          log.info("oldMetadata", value);
          // dump it to cassandra
          // mark in cassandra as migrated in a new column in namespace table
          // column_data - data_type = enum(new or legacy)
        }
      }

      return res.json({ message: value });
    } catch (error) {
      log.error("get metadata failed", error);
      return res.status(500).json({ error: getError(error), success: false });
    }
  }
);

router.post(
  "/set",
  celebrate({
    [Segments.BODY]: validateSetData,
  }),
  validateNamespace,
  validateDataTimeStamp,
  validateSignature,
  async (req, res) => {
    // set data to cassandra server by default
    try {
      const {
        namespace = "",
        pub_key_X: pubKeyX,
        pub_key_Y: pubKeyY,
        set_data: { data },
        tableName = "",
        // todo: remove below variable
        isSQL = false,
      }: SetDataInput = req.body;

      if (RESERVED_NAMESPACES.includes(namespace)) {
        return res.status(400).json({ error: `${namespace} namespace is a reserved namespace`, success: false });
      }

      const key = constructKey(pubKeyX, pubKeyY, namespace);
      if (isSQL) {
        await knexWrite(tableName).insert({
          key,
          value: data,
        });
        log.info("successfully written to mysql");
        try {
          await redis.setEx(key, REDIS_TIMEOUT, data);
        } catch (error) {
          log.warn("redis set failed", error);
        }
      } else {
        log.info("successfully written to cassandra");
        await setMetadata(tableName, key, data, types.consistencies.localQuorum);
      }

      const ipfsResult = await getHashAndWriteAsync({ [tableName]: [{ key, value: data }] });
      return res.json({ message: ipfsResult });
    } catch (error) {
      log.error("set metadata failed", error);
      return res.status(500).json({ error: getError(error), success: false });
    }
  }
);

router.post(
  "/bulk_set",
  celebrate({
    [Segments.BODY]: Joi.object({
      shares: Joi.array().items(validateSetData).required(),
    }),
  }),
  validateMetadataLoopInput("shares"),
  validateLoopSignature("shares"),
  validateNamespaceLoop("shares"),
  async (req, res) => {
    try {
      const { shares }: { shares: SetDataInput[] } = req.body;
      const requiredData = shares.reduce((acc: Record<keyof DBTableName, DataInsertType[]>, x) => {
        const {
          namespace,
          pub_key_X: pubKeyX,
          pub_key_Y: pubKeyY,
          set_data: { data },
          tableName,
        } = x;
        if (acc[tableName]) acc[tableName].push({ key: constructKey(pubKeyX, pubKeyY, namespace), value: data });
        else acc[tableName] = [{ key: constructKey(pubKeyX, pubKeyY, namespace), value: data }];
        return acc;
      }, {} as Record<keyof DBTableName, DataInsertType[]>);

      await setMetadataInMultiTables(requiredData, types.consistencies.localQuorum);
      const redisData = shares.reduce((acc: Record<string, string>, x) => {
        const {
          namespace,
          pub_key_X: pubKeyX,
          pub_key_Y: pubKeyY,
          set_data: { data },
        } = x;
        const key = constructKey(pubKeyX, pubKeyY, namespace);
        acc[key] = data;
        return acc;
      }, {} as Record<string, string>);
      try {
        await Promise.all(Object.keys(redisData).map((x) => redis.setEx(x, REDIS_TIMEOUT, redisData[x])));
      } catch (error) {
        log.warn("redis bulk set failed", error);
      }

      const ipfsResult = await getHashAndWriteAsync(requiredData);
      return res.json({ message: ipfsResult });
    } catch (error) {
      log.error("bulk set metadata failed", error);
      return res.status(500).json({ error: getError(error), success: false });
    }
  }
);

router.post(
  "/bulk_set_stream",
  upload.none(),
  serializeStreamBody,
  celebrate(
    {
      [Segments.BODY]: Joi.object({
        shares: Joi.array().items(validateSetData),
      }),
    },
    { allowUnknown: true }
  ),
  validateMetadataLoopInput("shares"),
  validateLoopSignature("shares"),
  validateNamespaceLoop("shares"),
  async (req, res) => {
    try {
      const { shares }: { shares: SetDataInput[] } = req.body;

      const redisData = {};
      const totalBatchesPerTable: Partial<Record<DBTableName, DataInsertType[][]>> = {}; // Key table name, value array of batch data (max 60MB)
      const currentBatchSizePerTable: Partial<Record<DBTableName, number>> = {}; // Key table name, value size of current batch
      for (const share of shares) {
        const {
          namespace,
          pub_key_X: pubKeyX,
          pub_key_Y: pubKeyY,
          set_data: { data },
          tableName,
        } = share;
        const key = constructKey(pubKeyX, pubKeyY, namespace);
        redisData[key] = data;
        // Initialize
        totalBatchesPerTable[tableName] = totalBatchesPerTable[tableName] || [[{ key, value: data }]];
        currentBatchSizePerTable[tableName] = currentBatchSizePerTable[tableName] || 0;
        // get current values
        const allBatchesInCurrentTable = totalBatchesPerTable[tableName];
        const sizeInCurrentTable = currentBatchSizePerTable[tableName];
        const latestBatchInCurrentTable = allBatchesInCurrentTable[allBatchesInCurrentTable.length - 1];
        // do checks
        const currentDataLength = Buffer.byteLength(data);
        if (currentDataLength + sizeInCurrentTable <= MAX_BATCH_SIZE) {
          latestBatchInCurrentTable.push({ key, value: data });
          currentBatchSizePerTable[tableName] = currentDataLength + sizeInCurrentTable;
        } else {
          // create new batch
          allBatchesInCurrentTable.push([{ key, value: data }]);
          // reset values
          currentBatchSizePerTable[tableName] = currentDataLength;
        }
      }

      // await Promise.all(Object.keys(totalBatchesPerTable).map((x: DBTableName) => insertDataInBatchForTable(x, totalBatchesPerTable[x])));

      // write data in bulk to Cassandra with CL=LOCAL_QUORUM
      await Promise.all(
        Object.keys(totalBatchesPerTable).map((table: DBTableName) =>
          setMetadataInBulk(table, totalBatchesPerTable[table], types.consistencies.localQuorum)
        )
      );
      try {
        await Promise.all(Object.keys(redisData).map((x) => redis.setEx(x, REDIS_TIMEOUT, redisData[x])));
      } catch (error) {
        log.warn("redis bulk set failed", error);
      }

      const requiredData = Object.keys(totalBatchesPerTable).reduce((acc: Record<DBTableName, DataInsertType[]>, x: DBTableName) => {
        const batch = totalBatchesPerTable[x];
        acc[x] = batch.flatMap((y) => y);
        return acc;
      }, {} as Record<DBTableName, DataInsertType[]>);

      const ipfsResult = await getHashAndWriteAsync(requiredData);
      return res.json({ message: ipfsResult });
    } catch (error) {
      log.error("set stream metadata failed", error);
      return res.status(500).json({ error: getError(error), success: false });
    }
  }
);

if (process.env.METADATA_ENV === "development") {
  // API for dev env only to test if v1 continue to work after deploying v2
  router.post(
    "/set_nonce",
    celebrate({
      [Segments.BODY]: Joi.object({
        namespace: Joi.string().max(128),
        pub_key_X: Joi.string().max(64).required(),
        pub_key_Y: Joi.string().max(64).required(),
      }),
    }),
    validateNamespace,
    async (req, res) => {
      try {
        const { pub_key_X: pubKeyX, pub_key_Y: pubKeyY, tableName }: { pub_key_X: string; pub_key_Y: string; tableName: string } = req.body;

        const key = constructKey(pubKeyX, pubKeyY, NAMESPACES.nonceV2);

        await knexWrite(tableName).insert({
          key,
          value: "<v1>",
        });

        try {
          await redis.setEx(key, REDIS_TIMEOUT, "<v1>");
        } catch (error) {
          log.warn("redis set failed", error);
        }

        return res.json({});
      } catch (error) {
        log.error("set_nonce failed", error);
        return res.status(500).json({ error: getError(error), success: false });
      }
    }
  );
}

// todo change implementation
router.post(
  "/get_or_set_nonce",
  celebrate({
    [Segments.BODY]: Joi.object({
      pub_key_X: Joi.string().max(64).required(),
      pub_key_Y: Joi.string().max(64).required(),
      namespace: Joi.string().max(128),
      set_data: Joi.object({
        data: Joi.string(),
        timestamp: Joi.string().hex(),
      }),
      signature: Joi.string().max(88),
    }),
  }),
  validateGetOrSetNonceSetInput,
  validateGetOrSetNonceSignature,
  validateNamespace,
  async (req, res) => {
    try {
      const { pub_key_X: pubKeyX, pub_key_Y: pubKeyY, tableName, set_data }: SetDataInput = req.body;

      const key = constructKey(pubKeyX, pubKeyY, NAMESPACES.private_nonce);
      const keyForPubNonce = constructKey(pubKeyX, pubKeyY, NAMESPACES.public_nonce);

      let pubNonce: string | { x: string; y: string };
      let ipfs: string[];

      // read data from Cassandra with CL=LOCAL_QUORUM
      let nonce = await getMetadata(tableName, key, types.consistencies.localQuorum);

      // its existing user
      if (nonce) {
        // read data from Cassandra with CL=LOCAL_QUORUM
        pubNonce = await getMetadata(tableName, keyForPubNonce, types.consistencies.localQuorum);

        if (!pubNonce) throw new Error("pub nonce value is null");
        pubNonce = JSON.parse(pubNonce as string);
      }

      if (set_data.operation === "getNonce") {
        const returnResponse = {
          upgraded: nonce === "<deleted>",
          pubNonce,
          ipfs,
          nonce: undefined,
        };
        if (!returnResponse.upgraded) {
          // if account is 1/1 return nonce
          returnResponse.nonce = nonce;
        }
        log.info(`Returning response to request ${getTraceIdLogMsg(req)}`, JSON.stringify(returnResponse));
        return res.json(returnResponse);
      }

      // allow new nonce but only when user is authenticated.
      // this is required for import key scenarios when some nodes fails to respond
      // and user tries again.
      const newNonce = set_data.data;
      // its a new user or some old user trying to override nonce, lets set his nonce
      // allow override if user provides a valid auth sig
      if (!nonce || (newNonce && !res.locals.noValidSig)) {
        nonce = newNonce || generatePrivate().toString("hex");

        const unformattedPubNonce = elliptic.keyFromPrivate(nonce).getPublic();
        pubNonce = {
          x: unformattedPubNonce.getX().toString("hex"),
          y: unformattedPubNonce.getY().toString("hex"),
        };

        // We just created new nonce and pub nonce above, write to db
        const pubNonceStr = JSON.stringify(pubNonce);

        // write data in bulk to Cassandra with CL=LOCAL_QUORUM
        const batch: DataInsertType[][] = [
          [
            { key, value: nonce },
            { key: keyForPubNonce, value: pubNonceStr },
          ],
        ];
        await setMetadataInBulk(tableName, batch, types.consistencies.localQuorum);

        ipfs = await getHashAndWriteAsync({ [tableName]: [{ key, value: pubNonceStr }] });
      }

      const returnResponse = {
        upgraded: nonce === "<deleted>",
        pubNonce,
        ipfs,
        nonce: undefined,
      };
      if (!returnResponse.upgraded) {
        // if account is 1/1 return nonce
        returnResponse.nonce = nonce;
      }
      log.info(`Returning response to request ${getTraceIdLogMsg(req)}`, JSON.stringify(returnResponse));
      return res.json(returnResponse);
    } catch (error) {
      log.error("getOrSetNonce failed", error);
      return res.status(500).json({ error: getError(error), success: false });
    }
  }
);

export default router;
