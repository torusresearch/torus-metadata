const log = require("loglevel");
const express = require("express");
const { getError } = require("../utils");
const { validationMiddleware } = require("../middleware");
const { redisClient: redis } = require("../database");

const router = express.Router();
const REDIS_TIMEOUT = 300; // 5m
const REDIS_NAME_SPACE = "EMAIL_AUTH_DATA";
module.exports = (io) => {
  io.on("connection", (socket) => {
    socket.on("check_auth_status", async (channelId) => {
      if (channelId) {
        const instancePubKey = channelId;
        const key = `${REDIS_NAME_SPACE}_${instancePubKey}`;
        // check if data for pubKey already in db,
        // if data exists then emit data and so that client
        // will close the connection.
        const data = await redis.get(key);
        if (data) {
          const parsedData = JSON.parse(data || "{}");
          socket.emit("success", parsedData.encAuthData || {});
        } else {
          socket.join(instancePubKey);
        }
        // create a socket room , specific to instancePubKey
      } else {
        socket.emit("error", "Empty channel id id not allowed");
      }
    });
  });

  router.post("/updateAuthData", validationMiddleware([("encAuthData", "instancePubKey")]), async (req, res) => {
    try {
      const { encAuthData, instancePubKey } = req.body;
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
  });
  return router;
};
