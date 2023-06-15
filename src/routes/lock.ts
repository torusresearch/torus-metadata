import { types } from "cassandra-driver";
import { celebrate, Joi, Segments } from "celebrate";
import express, { Request, Response } from "express";
import log from "loglevel";

import { deleteKeyValue, getKeyValue, setKeyValue } from "../database/cassandra/cassandra";
import redis from "../database/mysql/redis";
import { validateLockData } from "../middleware";
import { getError, getTraceIdLogMsg, randomID, REDIS_LOCK_TIMEOUT } from "../utils";

const KEYVALUE_LOCK_TIMEOUT = 60;

const router = express.Router();

// status
// 0: no changes made to redis
// 1: acquire/release lock succeeded
// 2: unable to release lock

router.post(
  "/acquireLock",
  celebrate({
    [Segments.BODY]: Joi.object({
      key: Joi.string().hex().max(130).required(),
      data: Joi.object({
        timestamp: Joi.number().required(),
      }).required(),
      signature: Joi.string().max(144).required(),
    }),
  }),
  validateLockData,
  async (req: Request, res: Response) => {
    const { key: pubKey }: { key: string } = req.body;
    try {
      // need to change this to cassandra
      let value: string;
      let valueFromCassandra: string;
      try {
        value = await redis.get(pubKey);
        valueFromCassandra = await getKeyValue(pubKey, types.consistencies.localQuorum);
      } catch (error) {
        log.warn("redis or cassandra get failed", error);
      }

      if (value || valueFromCassandra) {
        // Lock already exists in either cassandra or rad
        return res.json({ status: 2 });
      }

      if (!value && !valueFromCassandra) {
        // set lock with TTL using CL=LOCAL_QUORUM
        try {
          const id = randomID();
          await redis.setEx(pubKey, REDIS_LOCK_TIMEOUT, id);
          await setKeyValue(pubKey, id, KEYVALUE_LOCK_TIMEOUT, types.consistencies.localQuorum);
          return res.json({ status: 1, id });
        } catch (error) {
          log.warn("redis or cassandra set failed", error);
        }
      }
      return res.json({ status: 0 });
    } catch (error) {
      log.error("acquire lock failed", error);
      return res.status(500).json({ error: getError(error), success: false });
    }
  }
);

router.post(
  "/releaseLock",
  celebrate({
    [Segments.BODY]: Joi.object({
      id: Joi.string().max(7).required(),
      key: Joi.string().hex().max(130).required(),
      signature: Joi.string().max(144).required(),
      data: Joi.object({
        timestamp: Joi.number().required(),
      }).required(),
    }),
  }),
  validateLockData,
  async (req: Request, res: Response) => {
    try {
      const { key, id }: { key: string; id: string } = req.body;

      let value: string;
      let valueFromCassandra: string;
      let successfullyDeletedFromRedis = false;
      let successfullyDeletedFromCassandra = false;

      try {
        value = await redis.get(key);
        valueFromCassandra = await getKeyValue(key, types.consistencies.localQuorum);
      } catch (error) {
        log.warn("redis or cassandra get failed", error);
      }

      if (!value && !valueFromCassandra) {
        // No lock exists
        // Redis_timeout auto clear or no lock was ever created
        return res.json({ status: 0 });
      }

      try {
        if (value === id) {
          await redis.del(key);
          successfullyDeletedFromRedis = true;
        } else {
          successfullyDeletedFromRedis = true;
        }
      } catch (error) {
        log.warn("redis delete failed", error);
      }

      try {
        if (valueFromCassandra === id) {
          await deleteKeyValue(key, types.consistencies.localQuorum);
          successfullyDeletedFromCassandra = true;
        } else {
          successfullyDeletedFromCassandra = true;
        }
      } catch (error) {
        log.warn("cassandra delete failed", error, getTraceIdLogMsg(req));
      }

      if (successfullyDeletedFromCassandra && successfullyDeletedFromRedis) {
        return res.json({ status: 1 });
      }

      return res.json({ status: 2 });
    } catch (error) {
      log.error("release lock failed", error);
      return res.status(500).json({ error: getError(error), success: false });
    }
  }
);

export default router;
