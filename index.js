const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const socketRedis = require("socket.io-redis");
const log = require("loglevel");
const HttpServer = require("http");
const SocketIO = require("socket.io");
const compression = require("compression");
// Setup environment
require("dotenv").config();

const { registerSentry, registerSentryErrorHandler } = require("./utils/sentry");
// setup app
const app = express();
const http = HttpServer.Server(app);
registerSentry(app);

// for elb, https://shuheikagawa.com/blog/2019/04/25/keep-alive-timeout/
http.keepAliveTimeout = 301 * 1000;
http.headersTimeout = 305 * 1000;

const io = SocketIO(http, {
  transports: ["websocket"],
  cors: {
    credentials: true,
    origin: true,
    methods: ["GET", "POST"],
  },
});

io.adapter(socketRedis({ host: process.env.REDIS_HOSTNAME, port: process.env.REDIS_PORT }));

io.on("connection", () => {
  log.debug("connected");
});

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

if (process.env.NODE_ENV === "development") app.use(morgan("dev")); // HTTP logging
app.use(compression()); // Enable compression of body cause ALB doesn't do so
app.use(cors(corsOptions)); // middleware to enables cors
app.use(helmet()); // middleware which adds http headers
app.use(express.urlencoded({ extended: false, limit: "20mb" })); // middleware which parses body
app.use(express.json({ limit: "20mb" })); // converts body to json

// bring all routes here
const routes = require("./routes")(io);

app.use("/", routes);

registerSentryErrorHandler(app);

const port = process.env.PORT || 5051;
http.listen(port, () => log.info(`Server running on port: ${port}`));
