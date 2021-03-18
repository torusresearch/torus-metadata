const log = require("loglevel");
const express = require("express");
const pify = require("pify");
const multer = require("multer");

const upload = multer({
  limits: { fieldSize: 25 * 1024 * 1024 },
});

const { getError, constructKey, REDIS_TIMEOUT } = require("../utils");
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
      const data = await knexRead(tableName).where({ key }).orderBy("id", "desc").first();
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
  validationMiddleware([("pub_key_X", "pub_key_Y", "signature")]),
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
      const requiredData = shares.map((x) => {
        const {
          namespace,
          pub_key_X: pubKeyX,
          pub_key_Y: pubKeyY,
          set_data: { data },
          tableName,
        } = x;
        return { key: constructKey(pubKeyX, pubKeyY, namespace), value: data, tableName };
      });
      // await knexWrite(tableName).insert(requiredData);
      await Promise.all(
        requiredData.map((x) => {
          const tempTableName = x.tableName;
          delete x.tableName;
          return knexWrite(tempTableName).insert(x);
        })
      );

      try {
        await Promise.all(requiredData.map((x) => redis.setex(x.key, REDIS_TIMEOUT, x.value)));
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
  validationLoopMiddleware([("pub_key_X", "pub_key_Y", "signature")], "shares"),
  validateMetadataLoopInput("shares"),
  validateLoopSignature("shares"),
  validateNamespaceLoop("shares"),
  async (req, res) => {
    try {
      const { shares } = req.body;
      const requiredData = shares.map((x) => {
        const {
          namespace,
          pub_key_X: pubKeyX,
          pub_key_Y: pubKeyY,
          set_data: { data },
          tableName,
        } = x;
        return { key: constructKey(pubKeyX, pubKeyY, namespace), value: data, tableName };
      });
      // await knexWrite(tableName).insert(requiredData);
      await Promise.all(
        requiredData.map((x) => {
          const tempTableName = x.tableName;
          delete x.tableName;
          return knexWrite(tempTableName).insert(x);
        })
      );

      try {
        await Promise.all(requiredData.map((x) => redis.setex(x.key, REDIS_TIMEOUT, x.value)));
      } catch (error) {
        log.warn("redis bulk set failed", error);
      }

      const ipfsResult = await getHashAndWriteAsync(requiredData);
      return res.json({ message: ipfsResult });
    } catch (error) {
      log.error("set stream metadata failed", error);
      return res.status(500).json({ error: getError(error), success: false });
    }
  }
);

module.exports = router;
