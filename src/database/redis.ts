import Client from "ioredis";
import log from "loglevel";
import { createClient } from "redis";
import Redlock, { ResourceLockedError } from "redlock";

const { REDIS_PORT, REDIS_HOSTNAME } = process.env;
const client = createClient({ socket: { host: REDIS_HOSTNAME, port: Number(REDIS_PORT) } });

client.on("error", (error) => {
  log.error(error);
});

client.on("ready", () => {
  log.info("Connected to redis");
});

export const redlock = new Redlock([new Client({ host: REDIS_HOSTNAME, port: Number(REDIS_PORT) })], {
  driftFactor: 0.01, // multiplied by lock ttl to determine drift time
  retryCount: 10,
  retryDelay: 200, // time in ms
  retryJitter: 200, // time in ms
  automaticExtensionThreshold: 500, // time in ms
});

redlock.on("error", (error) => {
  // Ignore cases where a resource is explicitly marked as locked on a client.
  if (error instanceof ResourceLockedError) {
    return;
  }
  log.error(error);
});

export default client;
