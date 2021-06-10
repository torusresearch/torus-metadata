const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const socketIO = require("socket.io");
const socketRedis = require("socket.io-redis");
const log = require("loglevel");
const Sentry = require("@sentry/node");
const Tracing = require("@sentry/tracing");

// setup environment
require("dotenv").config();

const awsIdleTimeout = 60 * 1000; // AWS ALB idle timeout

// setup Express app
const app = express();
const server = require("http").createServer(app);

// setup Sentry
const redact = require("./utils/redactSentry");

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
app.use(express.urlencoded({ extended: false, limit: "10mb" })); // middleware which parses body
app.use(express.json({ limit: "10mb" })); // converts body to json

// bring all routes here
const routes = require("./routes");

app.use("/", routes);

// setup socket.io
const io = socketIO(server, {
  transports: ["websocket"],
  cors: {
    credentials: true,
    origin: true,
    methods: ["GET", "POST"],
  },
  // let AWS ALB drop connections
  connectTimeout: awsIdleTimeout + 5 * 1000,
  pingTimeout: awsIdleTimeout + 5 * 1000,
  upgradeTimeout: awsIdleTimeout + 5 * 1000,
});

io.adapter(socketRedis({ host: process.env.REDIS_HOSTNAME, port: process.env.REDIS_PORT }));
io.on("connection", () => {
  log.debug("connected");
});

// bring routes that require socket.io
const emailAuthDataRoute = require("./routes/emailAuthData")(io);

app.use("/auth", emailAuthDataRoute);

// start server
const port = process.env.PORT || 5051;
server.listen(port, () => log.info(`Server running on port: ${port}`));

// let AWS ALB drop connections (ref https://shuheikagawa.com/blog/2019/04/25/keep-alive-timeout)
server.keepAliveTimeout = awsIdleTimeout + 5 * 1000;
server.headersTimeout = awsIdleTimeout + 10 * 1000;
