import { celebrate, Joi, Segments } from "celebrate";
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

// Unix seconds are 10 digits; 16 still fits in Number.MAX_SAFE_INTEGER.
// Check length before any numeric pattern. Joi 17.13.3 number coercion runs /0+$/
// (number.js extractSignificantDigits), which is quadratic in a run of zeros and
// blocks the process for the whole body limit (20mb).
const MAX_LOCK_TIMESTAMP_DIGITS = 16;

const isShortDigitString = (value: string): boolean => {
  if (value.length < 1 || value.length > MAX_LOCK_TIMESTAMP_DIGITS) return false;
  for (const char of value) {
    if (char < "0" || char > "9") return false;
  }
  return true;
};

const lockTimestamp = Joi.custom((value, helpers) => {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) {
    return value;
  }
  // Short digit strings stay accepted and are coerced, matching previous Joi.number() behavior.
  if (typeof value === "string" && isShortDigitString(value)) {
    const parsed = Number(value);
    if (Number.isSafeInteger(parsed)) return parsed;
  }
  return helpers.error("any.invalid");
})
  .messages({ "any.invalid": "{{#label}} must be a safe integer" })
  .required();

const lockData = Joi.object({
  timestamp: lockTimestamp,
}).required();

router.post(
  "/acquireLock",
  celebrate({
    [Segments.BODY]: Joi.object({
      key: Joi.string().hex().max(130).required(),
      data: lockData,
      signature: Joi.string().max(144).required(),
    }),
  }),
  validateLockData,
  async (req: Request, res: Response) => {
    const { key: pubKey }: { key: string } = req.body;
    try {
      let value: string;
      try {
        value = (await redis.get(pubKey)) as string;
      } catch (error) {
        log.warn("redis get failed", error);
      }

      if (!value) {
        try {
          const id = randomID();
          await redis.setEx(pubKey, REDIS_LOCK_TIMEOUT, id);
          res.json({ status: 1, id });
          return;
        } catch (error) {
          log.warn("redis set failed", error);
        }
      }
      res.json({ status: 0 });
      return;
    } catch (error) {
      log.error("acquire lock failed", error);
      res.status(500).json({ error: getError(error), success: false });
      return;
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
      data: lockData,
    }),
  }),
  validateLockData,
  async (req: Request, res: Response) => {
    try {
      const { key, id }: { key: string; id: string } = req.body;

      let value: string;
      try {
        value = (await redis.get(key)) as string;
      } catch (error) {
        log.warn("redis get failed", error);
      }

      if (!value) {
        // No lock exists
        // Redis_timeout auto clear or no lock was ever created
        // this can happen when bulk_set operation after acquiring lock takes a lot of time.
        res.json({ status: 1 });
        return;
      }
      if (value === id) {
        try {
          await redis.del(key);
          res.json({ status: 1 });
          return;
        } catch (error) {
          log.warn("redis delete failed", error);
        }
      }
      res.json({ status: 2 });
      return;
    } catch (error) {
      log.error("release lock failed", error);
      res.status(500).json({ error: getError(error), success: false });
      return;
    }
  }
);

export default router;
