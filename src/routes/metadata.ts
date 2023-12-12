/* eslint-disable security/detect-object-injection */
import { generatePrivate } from "@toruslabs/eccrypto";
import { celebrate, Joi, Segments } from "celebrate";
import { ec as EC } from "elliptic";
import express, { Request, Response } from "express";
import log from "loglevel";
import multer from "multer";

import { getHashAndWriteAsync } from "../database/ipfs";
import { knexRead, knexWrite } from "../database/knex";
import redis, { redlock } from "../database/redis";
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
import { constructKey, getError, MAX_BATCH_SIZE, REDIS_TIMEOUT } from "../utils";
import { DataInsertType, DBTableName, SetDataInput } from "../utils/interfaces";

const upload = multer({
  limits: { fieldSize: 30 * 1024 * 1024 },
});

const elliptic = new EC("secp256k1");

const router = express.Router();

const NAMESPACES = {
  nonceV2: "noncev2",
  pubNonceV2: "pub_noncev2",
};

const RESERVED_NAMESPACES = [NAMESPACES.nonceV2, NAMESPACES.pubNonceV2];

const validateSetData = Joi.object({
  namespace: Joi.string().max(128),
  pub_key_X: Joi.string().max(64).hex().required(),
  pub_key_Y: Joi.string().max(64).hex().required(),
  set_data: Joi.object({
    data: Joi.string().required(),
    timestamp: Joi.string().hex().required(),
  }).required(),
  signature: Joi.string().max(88).required(),
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
      try {
        value = await redis.get(key);
      } catch (error) {
        log.warn("redis get failed", error);
      }

      if (!value) {
        const data = await knexRead(tableName).where({ key }).orderBy("created_at", "desc").orderBy("id", "desc").first();
        value = data?.value || "";
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
    try {
      const {
        namespace = "",
        pub_key_X: pubKeyX,
        pub_key_Y: pubKeyY,
        set_data: { data },
        tableName = "",
      }: SetDataInput = req.body;

      if (RESERVED_NAMESPACES.includes(namespace)) {
        return res.status(400).json({ error: `${namespace} namespace is a reserved namespace`, success: false });
      }

      const key = constructKey(pubKeyX, pubKeyY, namespace);
      await knexWrite(tableName).insert({
        key,
        value: data,
      });

      try {
        await redis.setEx(key, REDIS_TIMEOUT, data);
      } catch (error) {
        log.warn("redis set failed", error);
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
      const requiredData = shares.reduce(
        (acc: Record<keyof DBTableName, DataInsertType[]>, x) => {
          const {
            namespace,
            pub_key_X: pubKeyX,
            pub_key_Y: pubKeyY,
            set_data: { data },
            tableName,
          } = x;
          if (acc[tableName as keyof DBTableName])
            acc[tableName as keyof DBTableName].push({ key: constructKey(pubKeyX, pubKeyY, namespace), value: data });
          else acc[tableName as keyof DBTableName] = [{ key: constructKey(pubKeyX, pubKeyY, namespace), value: data }];
          return acc;
        },
        {} as Record<keyof DBTableName, DataInsertType[]>
      );

      await Promise.all(Object.keys(requiredData).map((x) => knexWrite(x).insert(requiredData[x as keyof DBTableName])));

      const redisData = shares.reduce(
        (acc: Record<string, string>, x) => {
          const {
            namespace,
            pub_key_X: pubKeyX,
            pub_key_Y: pubKeyY,
            set_data: { data },
          } = x;
          const key = constructKey(pubKeyX, pubKeyY, namespace);
          acc[key] = data;
          return acc;
        },
        {} as Record<string, string>
      );

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

// data must be array of arrays with each array lesser than MAX_BATCH_SIZE
async function insertDataInBatchForTable(tableName: DBTableName, data: DataInsertType[][]) {
  return knexWrite.transaction(async (trx) => {
    for (const batch of data) {
      await knexWrite(tableName).insert(batch).transacting(trx);
    }
  });
}

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

      const redisData: Record<string, string> = {};
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

      await Promise.all(
        Object.keys(totalBatchesPerTable).map((x) => insertDataInBatchForTable(x as DBTableName, totalBatchesPerTable[x as DBTableName]))
      );

      try {
        await Promise.all(Object.keys(redisData).map((x) => redis.setEx(x, REDIS_TIMEOUT, redisData[x])));
      } catch (error) {
        log.warn("redis bulk set failed", error);
      }

      const requiredData = Object.keys(totalBatchesPerTable).reduce(
        (acc: Record<DBTableName, DataInsertType[]>, x) => {
          const batch = totalBatchesPerTable[x as DBTableName];
          acc[x as DBTableName] = batch.flatMap((y) => y);
          return acc;
        },
        {} as Record<DBTableName, DataInsertType[]>
      );

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
      const {
        pub_key_X: pubKeyX,
        pub_key_Y: pubKeyY,
        set_data: { data },
        namespace: oldNamespace,
        tableName,
      }: SetDataInput = req.body;

      const oldKey = constructKey(pubKeyX, pubKeyY, oldNamespace);

      // check if it already exists
      let oldValue: string;
      try {
        oldValue = await redis.get(oldKey);
      } catch (error) {
        log.warn("redis get failed", error);
      }

      if (!oldValue) {
        const oldRetrievedNonce = await knexRead(tableName).where({ key: oldKey }).orderBy("created_at", "desc").orderBy("id", "desc").first();
        // i want a nil value here
        oldValue = oldRetrievedNonce?.value || undefined;
      }

      if (oldValue) {
        return res.json({ typeOfUser: "v1", nonce: oldValue });
      }

      const key = constructKey(pubKeyX, pubKeyY, NAMESPACES.nonceV2);
      const keyForPubNonce = constructKey(pubKeyX, pubKeyY, NAMESPACES.pubNonceV2);

      // if not check if v2 has been created before
      let nonce: string;
      let pubNonce: string | { x: string; y: string };
      let ipfs: string[];

      const getNonce = async (strongConsistency = false): Promise<string | undefined> => {
        let nonceVal: string;
        try {
          nonceVal = await redis.get(key);
        } catch (error) {
          log.warn("redis get failed", error);
        }
        if (!nonceVal) {
          const knexClient = strongConsistency ? knexWrite : knexRead;
          const newRetrievedNonce = await knexClient(tableName).where({ key }).orderBy("created_at", "desc").orderBy("id", "desc").first();
          nonceVal = newRetrievedNonce?.value || undefined;
        }
        return nonceVal;
      };

      const getPubNonce = async (strongConsistency = false): Promise<string | undefined> => {
        let pubNonceVal: string;
        try {
          pubNonceVal = await redis.get(keyForPubNonce);
        } catch (error) {
          log.warn("redis get failed", error);
        }

        if (!pubNonceVal) {
          const knexClient = strongConsistency ? knexWrite : knexRead;
          const retrievedPubNonce = await knexClient(tableName)
            .where({ key: keyForPubNonce })
            .orderBy("created_at", "desc")
            .orderBy("id", "desc")
            .first();
          pubNonceVal = retrievedPubNonce?.value;
        }

        if (!pubNonceVal) throw new Error("pub nonce value is null");
        return JSON.parse(pubNonceVal as string);
      };

      nonce = await getNonce();

      if (nonce === "<v1>" || (!nonce && data !== "getOrSetNonce")) return res.json({ typeOfUser: "v1" }); // This is a v1 user who didn't have a nonce before we rolled out v2, if he sets his nonce in the future, this value will be ignored

      if (nonce) {
        pubNonce = await getPubNonce();
      }

      // its a new v2 user, lets set his nonce
      if (!nonce) {
        const lockKey = `metadata-lock-${key}`;
        const lock = await redlock.acquire([lockKey], 5000);
        try {
          // check if someone else has set it
          nonce = await getNonce(true);
          if (nonce) {
            pubNonce = await getPubNonce(true);
          } else {
            // create new nonce
            nonce = generatePrivate().toString("hex");

            const unformattedPubNonce = elliptic.keyFromPrivate(nonce).getPublic();
            pubNonce = {
              x: unformattedPubNonce.getX().toString("hex"),
              y: unformattedPubNonce.getY().toString("hex"),
            };

            // We just created new nonce and pub nonce above, write to db
            const pubNonceStr = JSON.stringify(pubNonce);
            await insertDataInBatchForTable(tableName, [
              [
                { key, value: nonce },
                { key: keyForPubNonce, value: pubNonceStr },
              ],
            ]);
            [ipfs] = await Promise.all([
              getHashAndWriteAsync({ [tableName]: [{ key, value: pubNonceStr }] }),
              redis.setEx(key, REDIS_TIMEOUT, nonce).catch((error) => log.warn("redis set failed", error)),
              redis.setEx(keyForPubNonce, REDIS_TIMEOUT, pubNonceStr).catch((error) => log.warn("redis set failed", error)),
            ]);
          }
        } finally {
          // Release the lock.
          await lock.release();
        }
      }

      const returnResponse = {
        typeOfUser: "v2",
        upgraded: nonce === "<deleted>",
        pubNonce,
        ipfs,
        nonce: undefined,
      } as { typeOfUser: "v1" | "v2"; upgraded: boolean; pubNonce: string | { x: string; y: string }; ipfs: string[]; nonce?: string };
      if (!returnResponse.upgraded && !res.locals.noValidSig) {
        // if account is 1/1 and there's a valid sig, return nonce
        returnResponse.nonce = nonce;
      }
      return res.json(returnResponse);
    } catch (error) {
      log.error("getOrSetNonce failed", error);
      return res.status(500).json({ error: getError(error), success: false });
    }
  }
);

export default router;
