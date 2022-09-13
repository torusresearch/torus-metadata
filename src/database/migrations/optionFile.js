// eslint-disable-next-line @typescript-eslint/no-var-requires
const cassandra = require("cassandra-driver");

const { CASSANDRA_HOSTS, CASSANDRA_KEYSPACE, CASSANDRA_USER, CASSANDRA_PASSWORD } = process.env;

const hosts = (CASSANDRA_HOSTS ?? "").split(",");
const keyspace = CASSANDRA_KEYSPACE ?? "metadata";
const user = CASSANDRA_USER ?? "cassandra";
const password = CASSANDRA_PASSWORD ?? "cassandra";

module.exports = {
  contactPoints: hosts,
  keyspace,
  authProvider: new cassandra.auth.PlainTextAuthProvider(user, password),
  protocolOptions: {
    port: "9042",
  },
};
