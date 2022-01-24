import express, { Request, Response } from "express";
import log from "loglevel";

import redis from "../database/redis";
import { validateLockData } from "../middleware";
import { getError, randomID, REDIS_LOCK_TIMEOUT } from "../utils";

const router = express.Router();

// status
// 0: no changes made to redis
// 1: acquire/release lock succeeded
// 2: unable to release lock

router.get("/acquireLock", validateLockData, async (req: Request, res: Response) => {
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
        await redis.setEx(pubKey, REDIS_LOCK_TIMEOUT, id);
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

router.get("/releaseLock", async (req: Request, res: Response) => {
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

export default router;