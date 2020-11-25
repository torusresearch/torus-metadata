const log = require("loglevel");
const express = require("express");
const pify = require("pify");

const { validateLockData } = require("../middleware");

const { getError, REDIS_LOCK_TIMEOUT, randomID } = require("../utils");
const { redisClient } = require("../database");

const router = express.Router();
const redis = pify(redisClient);

// status
// 0: no changes made to redis
// 1: acquire/release lock succeded
// 2: unable to release lock

router.post("/acquireLock", validateLockData, async (req, res) => {
  const { key: pubKey } = req.body;
  try {
    let value;
    try {
      value = await redis.get(pubKey);
    } catch (error) {
      log.warn("redis get failed", error);
    }

    if (!value) {
      try {
        const id = randomID();
        await redis.setex(pubKey, REDIS_LOCK_TIMEOUT, id);
        return res.json({ status: 1, id });
      } catch (error) {
        log.warn("redis set failed", error);
      }
    }
    return res.json({ status: 0 });
  } catch (error) {
    log.error("acquire lock failed", error);
    return res.status(500).json({ error: getError(error), success: false });
  }
});

router.post("/releaseLock", validateLockData, async (req, res) => {
  try {
    const { key, id } = req.body;

    let value;
    try {
      value = await redis.get(key);
    } catch (error) {
      log.warn("redis get failed", error);
    }

    if (!value) {
      // No lock exists
      // Redis_timeout autoclear or no lock was ever created
      return res.json({ status: 0 });
    }
    if (value === id) {
      try {
        await redis.del(key);
        return res.json({ status: 1 });
      } catch (error) {
        log.warn("redis delete failed", error);
      }
    }
    return res.json({ status: 2 });
  } catch (error) {
    log.error("release lock failed", error);
    return res.status(500).json({ error: getError(error), success: false });
  }
});

module.exports = router;
