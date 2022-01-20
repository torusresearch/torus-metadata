import { errors } from "celebrate";
import compression from "compression";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import { Server } from "http";
import log from "loglevel";
import morgan from "morgan";
import path from "path";

// bring all routes here
import routes from "./routes";
const envPath = path.resolve(".", process.env.NODE_ENV !== "production" ? ".env.development" : ".env");

// setup environment
dotenv.config({
  path: envPath,
});

const app = express();
const http = new Server(app);

http.keepAliveTimeout = 301 * 1000;
http.headersTimeout = 305 * 1000;

log.enableAll();

// setup middleware
const corsOptions = {
  //   origin: ["https://localhost:3000", /\.tor\.us$/],
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

app.use("/", routes());
app.use(errors());

const port = process.env.PORT || 5051;
http.listen(port, () => log.info(`Server running on port: ${port}`));
