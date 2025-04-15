import { celebrate, Joi, Segments } from "celebrate";
import express, { Request, Response } from "express";
import log from "loglevel";

import redis from "../database/redis";
import { getError, REDIS_NAME_SPACE } from "../utils";

const router = express.Router();
const REDIS_TIMEOUT = 300; // 5m

// TODO: Add signature validation
router.post(
  "/updateAuthData",
  celebrate({
    [Segments.BODY]: Joi.object({
      encAuthData: Joi.string().required(),
      instancePubKey: Joi.string().length(130).required(),
    }),
  }),
  async (req: Request, res: Response) => {
    try {
      const { encAuthData, instancePubKey } = req.body;
      const { io } = req;
      const key = `${REDIS_NAME_SPACE}_${instancePubKey}`;
      const dataExist = await redis.get(key);
      if (dataExist) {
        res.status(400).json({ success: false, message: "Link has been used already" });
        return;
      }
      const data = {
        instancePubKey,
        encAuthData,
      };
      await redis.setEx(key, REDIS_TIMEOUT, JSON.stringify(data));

      io.to(instancePubKey).emit("success", JSON.parse(encAuthData));

      res.json({ message: "Email auth data added successfully" });
      return;
    } catch (error) {
      log.error("set metadata failed", error);
      res.status(500).json({ error: getError(error), success: false });
      return;
    }
  }
);

export default router;
