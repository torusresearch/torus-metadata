import { Client } from "cassandra-driver";
import log from "loglevel";

const { CASSANDRA_HOSTNAME, CASSANDRA_KEYSPACE, CASSANDRA_USER, CASSANDRA_PASSWORD } = process.env;

const client = new Client({
  contactPoints: [CASSANDRA_HOSTNAME],
  // localDataCenter: "datacenter1",
  keyspace: CASSANDRA_KEYSPACE,
  credentials: {
    username: CASSANDRA_USER,
    password: CASSANDRA_PASSWORD,
  },
});

client.on("log", (level, loggerName, message) => {
  log.info(`${level} - ${loggerName}:  ${message}`);
});

export default client;
