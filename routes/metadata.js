const log = require("loglevel");
const express = require("express");
const pify = require("pify");
const multer = require("multer");

const upload = multer({
  limits: { fieldSize: 30 * 1024 * 1024 },
});

const { getError, constructKey, REDIS_TIMEOUT, MAX_BATCH_SIZE } = require("../utils");
const {
  validationMiddleware,
  validationLoopMiddleware,
  validateMetadataLoopInput,
  validateLoopSignature,
  serializeStreamBody,
  validateNamespace,
  validateNamespaceLoop,
} = require("../middleware");
const { knexRead, knexWrite, redisClient, getHashAndWriteAsync } = require("../database");
const { validateMetadataInput, validateSignature } = require("../middleware");

const router = express.Router();
const redis = pify(redisClient);
// 10 sec

router.post("/get", validationMiddleware(["pub_key_X", "pub_key_Y"]), validateNamespace, async (req, res) => {
  try {
    const { namespace, pub_key_X: pubKeyX, pub_key_Y: pubKeyY, tableName } = req.body;
    const key = constructKey(pubKeyX, pubKeyY, namespace);
    let value;
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
      const key = constructKey(pubKeyX, pubKeyY, namespace);
      await knexWrite(tableName).insert({
        key,
        value: data,
      });

      try {
        await redis.setex(key, REDIS_TIMEOUT, data);
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

router.post(
  "/bulk_set",
  validationLoopMiddleware([("pub_key_X", "pub_key_Y", "signature")], "shares"),
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
        await Promise.all(Object.keys(redisData).map((x) => redis.setex(x, REDIS_TIMEOUT, redisData[x])));
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
  validationLoopMiddleware(["pub_key_X", "pub_key_Y", "signature"], "shares"),
  validateMetadataLoopInput("shares"),
  validateLoopSignature("shares"),
  validateNamespaceLoop("shares"),
  async (req, res) => {
    try {
      const { shares } = req.body;

      const redisData = {};
      const totalBatchesPerTable = {}; // Key table name, value array of batch data (max 60MB)
      const currentBatchSizePerTable = {}; // Key table name, value size of current batch
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

      await Promise.all(Object.keys(totalBatchesPerTable).map((x) => insertDataInBatchForTable(x, totalBatchesPerTable[x])));

      try {
        await Promise.all(Object.keys(redisData).map((x) => redis.setex(x, REDIS_TIMEOUT, redisData[x])));
      } catch (error) {
        log.warn("redis bulk set failed", error);
      }

      const requiredData = Object.keys(totalBatchesPerTable).reduce((acc, x) => {
        const batch = totalBatchesPerTable[x];
        acc[x] = batch.flatMap((y) => y);
        return acc;
      });

      const ipfsResult = await getHashAndWriteAsync(requiredData);
      return res.json({ message: ipfsResult });
    } catch (error) {
      log.error("set stream metadata failed", error);
      return res.status(500).json({ error: getError(error), success: false });
    }
  }
);

// data must be array of arrays with each array lesser than MAX_BATCH_SIZE
async function insertDataInBatchForTable(tableName, data) {
  return knexWrite.transaction(async (trx) => {
    for (const batch of data) {
      // eslint-disable-next-line no-await-in-loop
      await knexWrite(tableName).insert(batch).transacting(trx);
    }
  });
}

// new API for v2
router.post("/get_or_set_nonce", validationMiddleware(["pub_key_X", "pub_key_Y"]), async (req, res) => {
  try {
    const { pub_key_X: pubKeyX, pub_key_Y: pubKeyY, set_data: suggestedNonce } = req.body;
    const key = constructKey(pubKeyX, pubKeyY, "noncev2");
    const oldKey = constructKey(pubKeyX, pubKeyY, "");

    // TODO: Do not hard code this, potentially use a different table for v2 keys
    const tableName = "data";

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
      return res.json({ typeOfUser: "v1" });
    }

    // if not check if v2 has been created before
    let value;
    try {
      value = await redis.get(key);
    } catch (error) {
      log.warn("redis get failed", error);
    }

    if (!value) {
      const newRetrievedNonce = await knexRead(tableName).where({ key }).orderBy("created_at", "desc").orderBy("id", "desc").first();
      value = (newRetrievedNonce && newRetrievedNonce.value) || undefined;
    }

    if (value) {
      return res.json({ nonce: value, typeOfUser: "v2", newUser: false });
    }

    // its a new v2 user, lets set his nonce
    // TODO: allow random creation of nonce here
    await knexWrite(tableName).insert({
      key,
      value: suggestedNonce,
    });

    try {
      await redis.setex(key, REDIS_TIMEOUT, suggestedNonce);
    } catch (error) {
      log.warn("redis set failed", error);
    }

    // TODO: Handle when frontend has unexpected error and can't handle the first API result with newUser=true, all subsequent calls will always return newUser=false
    const ipfsResult = await getHashAndWriteAsync([{ key, value: suggestedNonce }]);
    return res.json({ nonce: suggestedNonce, typeOfUser: "v2", ipfs: ipfsResult, newUser: true });
  } catch (error) {
    log.error("getOrSetNonce failed", error);
    return res.status(500).json({ error: getError(error), success: false });
  }
});

module.exports = router;
