import { createAdapter } from "@socket.io/redis-adapter";
import { NextFunction, Request, RequestHandler, Response } from "express";
import { Server as HttpServer } from "http";
import log from "loglevel";
import { Server } from "socket.io";

import { REDIS_NAME_SPACE } from "../utils";
import redis from "./redis";

export function setupSocketIo(http: HttpServer): Server {
  const io = new Server(http, {
    transports: ["websocket", "polling"],
    cors: {
      credentials: true,
      origin: true,
      methods: ["GET", "POST"],
    },
  });

  const subClient = redis.duplicate();

  Promise.all([redis.connect(), subClient.connect()])
    .then(() => {
      io.adapter(createAdapter(redis, subClient));
      log.debug("connected socket to redis");
      return null;
    })
    .catch((err) => {
      log.error(err, "unable to connect to redis");
    });

  return io;
}

export function setupSocketMiddleware(io: Server): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    req.io = io;
    next();
  };
}

export function setupIoListeners(io: Server): void {
  io.on("connection", (socket) => {
    log.debug("connected");
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
}
