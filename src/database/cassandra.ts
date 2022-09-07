import { Client } from "cassandra-driver";
import log from "loglevel";

const { CASSANDRA_HOSTNAME } = process.env;

const client = new Client({
  contactPoints: [CASSANDRA_HOSTNAME],
  localDataCenter: "datacenter1",
  keyspace: "ks",
});

client.on("log", (level, loggerName, message) => {
  log.info(`${level} - ${loggerName}:  ${message}`);
});

export default client;
