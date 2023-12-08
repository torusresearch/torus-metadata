import { Knex } from "knex";
import log from "loglevel";

log.info({
  host: process.env.RDS_HOSTNAME_WRITE,
  database: process.env.RDS_DB_NAME,
  port: process.env.RDS_PORT,
  user: process.env.RDS_USERNAME,
  password: process.env.RDS_PASSWORD,
  devUser: process.env.MYSQL_USER,
  devPassword: process.env.MYSQL_PASSWORD,
  devDatabase: process.env.MYSQL_DATABASE,
});

function afterCreate(conn: Knex.Client, done: (err: Error, connection: unknown) => void): void {
  if (process.env.IS_AURORA_READ_REPLICA === "true") {
    conn.query("SET aurora_replica_read_consistency='SESSION';", (err: Error) => {
      if (err) {
        // first query failed, return error and don't try to make next query
        done(err, conn);
        log.error("db connection failed", err);
      } else {
        log.debug("db connection success");
        done(err, conn);
      }
    });
  } else {
    log.debug("db connection success");
    done(null, conn);
  }
}

export default {
  development: {
    client: "mysql",
    connection: {
      host: process.env.RDS_HOSTNAME_WRITE,
      database: process.env.MYSQL_DATABASE,
      port: process.env.RDS_PORT,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      supportBigNumbers: true,
      bigNumberStrings: true,
    },
    pool: {
      min: 2,
      max: 10,
      createTimeoutMillis: 3000,
      acquireTimeoutMillis: 30000,
      idleTimeoutMillis: 30000,
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 100,
      propagateCreateError: false,
    },
    migrations: {
      tableName: "knex_migrations",
    },
  } as Knex.Config,

  stagingRead: {
    client: "mysql",
    connection: {
      host: process.env.RDS_HOSTNAME_READ,
      database: process.env.RDS_DB_NAME,
      port: process.env.RDS_PORT,
      user: process.env.RDS_USERNAME,
      password: process.env.RDS_PASSWORD,
      supportBigNumbers: true,
      bigNumberStrings: true,
    },
    pool: {
      min: 2,
      max: 10,
      createTimeoutMillis: 3000,
      acquireTimeoutMillis: 30000,
      idleTimeoutMillis: 30000,
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 100,
      propagateCreateError: false,
      afterCreate,
    },
    migrations: {
      tableName: "knex_migrations",
    },
  } as Knex.Config,

  productionRead: {
    client: "mysql",
    connection: {
      host: process.env.RDS_HOSTNAME_READ,
      database: process.env.RDS_DB_NAME,
      port: process.env.RDS_PORT,
      user: process.env.RDS_USERNAME,
      password: process.env.RDS_PASSWORD,
      supportBigNumbers: true,
      bigNumberStrings: true,
    },
    pool: {
      min: 2,
      max: 10,
      createTimeoutMillis: 3000,
      acquireTimeoutMillis: 30000,
      idleTimeoutMillis: 30000,
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 100,
      propagateCreateError: false,
      afterCreate,
    },
    migrations: {
      tableName: "knex_migrations",
    },
  } as Knex.Config,

  stagingWrite: {
    client: "mysql",
    connection: {
      host: process.env.RDS_HOSTNAME_WRITE,
      database: process.env.RDS_DB_NAME,
      port: process.env.RDS_PORT,
      user: process.env.RDS_USERNAME,
      password: process.env.RDS_PASSWORD,
      supportBigNumbers: true,
      bigNumberStrings: true,
    },
    pool: {
      min: 2,
      max: 10,
      createTimeoutMillis: 3000,
      acquireTimeoutMillis: 30000,
      idleTimeoutMillis: 30000,
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 100,
      propagateCreateError: false,
      afterCreate,
    },
    migrations: {
      tableName: "knex_migrations",
    },
  } as Knex.Config,

  productionWrite: {
    client: "mysql",
    connection: {
      host: process.env.RDS_HOSTNAME_WRITE,
      database: process.env.RDS_DB_NAME,
      port: process.env.RDS_PORT,
      user: process.env.RDS_USERNAME,
      password: process.env.RDS_PASSWORD,
      supportBigNumbers: true,
      bigNumberStrings: true,
    },
    pool: {
      min: 2,
      max: 10,
      createTimeoutMillis: 3000,
      acquireTimeoutMillis: 30000,
      idleTimeoutMillis: 30000,
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 100,
      propagateCreateError: false,
      afterCreate,
    },
    migrations: {
      tableName: "knex_migrations",
    },
  } as Knex.Config,
};
