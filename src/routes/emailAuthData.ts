import { celebrate, Joi, Segments } from "celebrate";
import express from "express";
import log from "loglevel";

import redis from "../database/redis";
import { getError, REDIS_NAME_SPACE } from "../utils";

const router = express.Router();
const REDIS_TIMEOUT = 300; // 5m

router.post(
  "/updateAuthData",
  celebrate({
    [Segments.BODY]: Joi.object({
      encAuthData: Joi.string().required(),
      instancePubKey: Joi.string().length(130).required(),
    }),
  }),
  async (req, res) => {
    try {
      const { encAuthData, instancePubKey } = req.body;
      const { io } = req;
      const key = `${REDIS_NAME_SPACE}_${instancePubKey}`;
      const dataExist = await redis.get(key);
      if (dataExist) {
        return res.status(400).json({ success: false, message: "Link has been used already" });
      }
      const data = {
        instancePubKey,
        encAuthData,
      };
      await redis.setEx(key, REDIS_TIMEOUT, JSON.stringify(data));

      io.to(instancePubKey).emit("success", JSON.parse(encAuthData));

      return res.json({ message: "Email auth data added successfully" });
    } catch (error) {
      log.error("set metadata failed", error);
      return res.status(500).json({ error: getError(error), success: false });
    }
  }
);

export default router;
