/* eslint-disable import/first */
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

log.enableAll();

const envPath = path.resolve(".", process.env.NODE_ENV !== "production" ? ".env.development" : ".env");
// setup environment
dotenv.config({
  path: envPath,
});

// bring all routes here
import { setupIoListeners, setupSocketIo, setupSocketMiddleware } from "./database/socket";
import routes from "./routes";
import { registerSentry, registerSentryErrorHandler } from "./utils/sentry";

const app = express();
const http = createServer(app);

app.set("trust proxy", 1);

registerSentry(app);
const io = setupSocketIo(http);
setupIoListeners(io);

http.keepAliveTimeout = 301 * 1000;
http.headersTimeout = 305 * 1000;

// setup middleware
const corsOptions = {
  //   origin: ["https://localhost:3000", /\.tor\.us$/],
  origin: true,
  credentials: false,
  allowedHeaders: ["Content-Type", "x-api-key", "x-embed-host", "sentry-trace", "baggage"],
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

app.use(setupSocketMiddleware(io));
app.use("/", routes);
app.use(errors());

registerSentryErrorHandler(app);

const port = process.env.PORT || 5051;
http.listen(port, () => log.info(`Server running on port: ${port}`));
