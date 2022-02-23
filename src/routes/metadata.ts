import { generatePrivate } from "@toruslabs/eccrypto";
import { ec as EC } from "elliptic";
import express, { Request, Response } from "express";
import log from "loglevel";

import { getHashAndWriteAsync } from "../database/ipfs";
import { knexRead, knexWrite } from "../database/knex";
import redis from "../database/redis";
import {
  validateGetOrSetNonceSetInput,
  validateGetOrSetNonceSignature,
  validateLoopSignature,
  validateMetadataInput,
  validateMetadataLoopInput,
  validateNamespace,
  validateNamespaceLoop,
  validateSignature,
  validationLoopMiddleware,
  validationMiddleware,
} from "../middleware";
import { constructKey, getError, REDIS_TIMEOUT } from "../utils";

const elliptic = new EC("secp256k1");

const router = express.Router();

const NAMESPACES = {
  nonceV2: "noncev2",
  pubNonceV2: "pub_noncev2",
};
const RESERVED_NAMESPACES = [NAMESPACES.nonceV2, NAMESPACES.pubNonceV2];

router.post("/get", validationMiddleware(["pub_key_X", "pub_key_Y"]), validateNamespace, async (req: Request, res: Response) => {
  try {
    const { namespace, pub_key_X: pubKeyX, pub_key_Y: pubKeyY, tableName } = req.body;
    const key = constructKey(pubKeyX, pubKeyY, namespace);
    let value: string;
    try {
      value = await redis.get(key);
    } catch (error) {
      log.warn("redis get failed", error);
    }

    if (!value) {
      const data = await knexRead(tableName).where({ key }).orderBy("created_at", "desc").orderBy("id", "desc").first();
      value = (data && data.value) || "";
    }
    return res.json({ message: value });
  } catch (error) {
    log.error("get metadata failed", error);
    return res.status(500).json({ error: getError(error), success: false });
  }
});

router.post(
  "/set",
  validationMiddleware(["pub_key_X", "pub_key_Y", "signature"]),
  validateMetadataInput,
  validateSignature,
  validateNamespace,
  async (req, res) => {
    try {
      const {
        namespace,
        pub_key_X: pubKeyX,
        pub_key_Y: pubKeyY,
        set_data: { data },
        tableName,
      } = req.body;

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

      const ipfsResult = await getHashAndWriteAsync([{ key, value: data }]);
      return res.json({ message: ipfsResult });
    } catch (error) {
      log.error("set metadata failed", error);
      return res.status(500).json({ error: getError(error), success: false });
    }
  }
);

// validationLoopMiddleware([("pub_key_X", "pub_key_Y", "signature")], "shares"),
router.post(
  "/bulk_set",
  validationLoopMiddleware(["pub_key_X", "pub_key_Y", "signature"], "shares"),
  validateMetadataLoopInput("shares"),
  validateLoopSignature("shares"),
  validateNamespaceLoop("shares"),
  async (req, res) => {
    try {
      const { shares } = req.body;
      const requiredData = shares.reduce((acc, x) => {
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
      }, {});

      await Promise.all(Object.keys(requiredData).map((x) => knexWrite(x).insert(requiredData[x])));

      const redisData = shares.reduce((acc, x) => {
        const {
          namespace,
          pub_key_X: pubKeyX,
          pub_key_Y: pubKeyY,
          set_data: { data },
        } = x;
        const key = constructKey(pubKeyX, pubKeyY, namespace);
        acc[key] = data;
        return acc;
      }, {});

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
async function insertDataInBatchForTable(tableName, data) {
  return knexWrite.transaction(async (trx) => {
    for (const batch of data) {
      await knexWrite(tableName).insert(batch).transacting(trx);
    }
  });
}

if (process.env.NODE_ENV === "development") {
  // API for dev env only to test if v1 continue to work after deploying v2
  router.post("/set_nonce", validationMiddleware(["pub_key_X", "pub_key_Y"]), validateNamespace, async (req, res) => {
    try {
      const { pub_key_X: pubKeyX, pub_key_Y: pubKeyY, tableName } = req.body;

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
  });
}

router.post(
  "/get_or_set_nonce",
  validationMiddleware(["pub_key_X", "pub_key_Y"]),
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
      } = req.body;

      const oldKey = constructKey(pubKeyX, pubKeyY, oldNamespace);

      // check if it already exists
      let oldValue;
      try {
        oldValue = await redis.get(oldKey);
      } catch (error) {
        log.warn("redis get failed", error);
      }

      if (!oldValue) {
        const oldRetrievedNonce = await knexRead(tableName).where({ key: oldKey }).orderBy("created_at", "desc").orderBy("id", "desc").first();
        // i want a nil value here
        oldValue = (oldRetrievedNonce && oldRetrievedNonce.value) || undefined;
      }

      if (oldValue) {
        return res.json({ typeOfUser: "v1", nonce: oldValue });
      }

      const key = constructKey(pubKeyX, pubKeyY, NAMESPACES.nonceV2);
      const keyForPubNonce = constructKey(pubKeyX, pubKeyY, NAMESPACES.pubNonceV2);

      // if not check if v2 has been created before
      let nonce;
      let pubNonce;
      let ipfs;

      try {
        nonce = await redis.get(key);
      } catch (error) {
        log.warn("redis get failed", error);
      }

      if (!nonce) {
        const newRetrievedNonce = await knexRead(tableName).where({ key }).orderBy("created_at", "desc").orderBy("id", "desc").first();
        nonce = (newRetrievedNonce && newRetrievedNonce.value) || undefined;
      }

      if (nonce === "<v1>" || (!nonce && data !== "getOrSetNonce")) return res.json({ typeOfUser: "v1" }); // This is a v1 user who didn't have a nonce before we rolled out v2, if he sets his nonce in the future, this value will be ignored

      if (nonce) {
        try {
          pubNonce = await redis.get(keyForPubNonce);
        } catch (error) {
          log.warn("redis get failed", error);
        }

        if (!pubNonce) {
          const retrievedPubNonce = await knexRead(tableName)
            .where({ key: keyForPubNonce })
            .orderBy("created_at", "desc")
            .orderBy("id", "desc")
            .first();
          pubNonce = retrievedPubNonce?.value;
        }

        if (!pubNonce) throw new Error("pub nonce value is null");
        pubNonce = JSON.parse(pubNonce);
      }

      // its a new v2 user, lets set his nonce
      if (!nonce) {
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
          getHashAndWriteAsync([{ key, value: pubNonce }]),
          redis.setEx(key, REDIS_TIMEOUT, nonce).catch((error) => log.warn("redis set failed", error)),
          redis.setEx(keyForPubNonce, REDIS_TIMEOUT, pubNonceStr).catch((error) => log.warn("redis set failed", error)),
        ]);
      }

      const returnResponse = {
        typeOfUser: "v2",
        upgraded: nonce === "<deleted>",
        pubNonce,
        ipfs,
      };
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
