/* eslint-disable security/detect-object-injection */
import { celebrate, Joi, Segments } from "celebrate";
import express, { Request, Response } from "express";
import log from "loglevel";

import { getHashAndWriteAsync } from "../database/ipfs";
import { knexWrite } from "../database/knex";
import redis from "../database/redis";
import {
  validateDataTimeStamp,
  validateLoopSignatureV2,
  validateMetadataLoopInput,
  validateNamespace,
  validateNamespaceLoop,
  validateSignatureV2,
} from "../middleware";
import { constructKey, getError, REDIS_TIMEOUT } from "../utils";
import { DataInsertType, DBTableName, SetDataInput } from "../utils/interfaces";
import { RESERVED_NAMESPACES, validateSetData } from "./constants";

const router = express.Router();

// V2 routes accept signatures in @noble/curves format: recovery (1 byte) + r (32 bytes) + s (32 bytes)
// This is different from v1 which expects: r (32 bytes) + s (32 bytes) + recovery (1 byte)

router.post(
  "/set",
  celebrate({
    [Segments.BODY]: validateSetData,
  }),
  validateNamespace,
  validateDataTimeStamp,
  validateSignatureV2,
  async (req: Request, res: Response) => {
    try {
      const {
        namespace = "",
        pub_key_X: pubKeyX,
        pub_key_Y: pubKeyY,
        set_data: { data },
        tableName = "",
      }: SetDataInput = req.body;

      if (RESERVED_NAMESPACES.includes(namespace)) {
        res.status(400).json({ error: `${namespace} namespace is a reserved namespace`, success: false });
        return;
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
      res.json({ message: ipfsResult });
      return;
    } catch (error) {
      log.error("set metadata failed (v2)", error);
      res.status(500).json({ error: getError(error), success: false });
      return;
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
  validateLoopSignatureV2("shares"),
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
      res.json({ message: ipfsResult });
      return;
    } catch (error) {
      log.error("bulk set metadata failed (v2)", error);
      res.status(500).json({ error: getError(error), success: false });
      return;
    }
  }
);

export default router;
