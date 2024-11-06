import "./utils/sentry";

import * as Sentry from "@sentry/node";
import { errors } from "celebrate";
import compression from "compression";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import { createServer } from "http";
import log from "loglevel";
import morgan from "morgan";
import path from "path";

log.setLevel((process.env.LOG_LEVEL as log.LogLevelDesc) || log.levels.INFO);

const envPath = path.resolve(".", process.env.NODE_ENV !== "production" ? ".env.development" : ".env");
// setup environment
dotenv.config({
  path: envPath,
});

// bring all routes here
import { setupIoListeners, setupSocketIo, setupSocketMiddleware } from "./database/socket";
import routes from "./routes";
import { traceContextMiddleware } from "./utils/traceContext";

const app = express();
const http = createServer(app);

app.set("trust proxy", 1);

const io = setupSocketIo(http);
setupIoListeners(io);

http.keepAliveTimeout = 301 * 1000;
http.headersTimeout = 305 * 1000;

// setup middleware
const corsOptions = {
  //   origin: ["https://localhost:3000", /\.tor\.us$/],
  origin: true,
  credentials: true,
  allowedHeaders: [
    "Content-Type",
    "x-api-key",
    "x-embed-host",
    "sentry-trace",
    "baggage",
    "x-web3-correlation-id",
    "pubkeyx",
    "pubkeyy",
    "verifier",
    "verifier_id",
    "verifierId",
    "clientId",
    "network",
    "enable_gating",
    "enableGating",
    "authorization",
  ],
  methods: "GET,PUT,PATCH,POST,DELETE",
  maxAge: 86400,
};

app.disable("x-powered-by");

if (process.env.NODE_ENV === "development") app.use(morgan("dev")); // HTTP logging
app.use(compression()); // Enable compression of body cause ALB doesn't do so
app.use(cors(corsOptions)); // middleware to enables cors
app.use(helmet()); // middleware which adds http headers
app.use(express.urlencoded({ extended: false, limit: "20mb" })); // middleware which parses body
app.use(express.json({ limit: "20mb" })); // converts body to json

app.use(setupSocketMiddleware(io));
app.use(traceContextMiddleware);

app.use(["/metadata-service", "/"], routes);

// Add this after all routes,
// but before any and other error-handling middlewares are defined
Sentry.setupExpressErrorHandler(app);

app.use(errors());

const port = process.env.PORT || 5051;
http.listen(port, () => log.info(`Server running on port: ${port}`));
