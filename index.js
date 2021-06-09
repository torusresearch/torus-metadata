const express = require("express");
const bodyParser = require("body-parser");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const socketRedis = require("socket.io-redis");
const log = require("loglevel");
const Sentry = require("@sentry/node");
const Tracing = require("@sentry/tracing");

// setup app
const app = express();
const server = require("http").createServer(app);

const awsIdleTimeout = 60 * 1000; // AWS ALB idle timeout
const io = require("socket.io")(server, {
  transports: ["websocket"],
  cors: {
    credentials: true,
    origin: true,
    methods: ["GET", "POST"],
  },
  // Let AWS ALB drop connections
  connectTimeout: awsIdleTimeout + 5 * 1000,
  pingTimeout: awsIdleTimeout + 5 * 1000,
  upgradeTimeout: awsIdleTimeout + 5 * 1000,
});
const redact = require("./utils/redactSentry");

io.adapter(socketRedis({ host: process.env.REDIS_HOSTNAME, port: process.env.REDIS_PORT }));

io.on("connection", () => {
  log.debug("connected");
});
// Setup environment
require("dotenv").config();

// setup Sentry
const isSentryConfigured = process.env.SENTRY_DSN && process.env.SENTRY_DSN.length > 0;
if (isSentryConfigured) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    integrations: [new Sentry.Integrations.Http({ tracing: true }), new Tracing.Integrations.Express({ app })],
    sampleRate: 0.2,
    tracesSampleRate: 0.2,
    beforeSend(event) {
      return redact(event);
    },
  });
  app.use(
    Sentry.Handlers.requestHandler({
      request: ["public_address", "data", "headers", "method", "query_string", "url"],
    })
  );
  app.use(Sentry.Handlers.tracingHandler());
}

log.enableAll();

// setup middleware
const corsOptions = {
  // origin: ["https://localhost:3000", /\.tor\.us$/],
  origin: true,
  credentials: false,
  allowedHeaders: ["Content-Type", "x-api-key", "x-embed-host", "sentry-trace"],
  methods: "GET,POST",
  maxAge: 86400,
};

app.disable("x-powered-by");

if (process.env.NODE_ENV === "development") app.use(morgan("tiny")); // HTTP logging
app.use(cors(corsOptions)); // middleware to enables cors
app.use(helmet()); // middleware which adds http headers
app.use(bodyParser.urlencoded({ extended: false, limit: "10mb" })); // middleware which parses body
app.use(bodyParser.json({ limit: "10mb" })); // converts body to json

// bring all routes here
const routes = require("./routes")(io);

app.use("/", routes);

const port = process.env.PORT || 5051;
server.listen(port, () => log.info(`Server running on port: ${port}`));

// for elb, https://shuheikagawa.com/blog/2019/04/25/keep-alive-timeout/
server.keepAliveTimeout = awsIdleTimeout + 5 * 1000;
server.headersTimeout = awsIdleTimeout + 10 * 1000;
