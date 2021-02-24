const express = require("express");
const bodyParser = require("body-parser");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const log = require("loglevel");

const { register, collectDefaultMetrics } = require("prom-client");
// enable prom-client to expose default application metrics
collectDefaultMetrics({
  timeout: 10000,
});

// setup app
const app = express();

// Setup environment
require("dotenv").config();

if (process.env.NODE_ENV === "development") {
  log.enableAll();
} else {
  log.setDefaultLevel("info");
}

// setup middleware
const corsOptions = {
  //   origin: ["https://localhost:3000", /\.tor\.us$/],
  origin: true,
  credentials: false,
  allowedHeaders: ["Content-Type", "x-api-key", "x-embed-host"],
  methods: "GET,POST",
  maxAge: 86400,
};

app.disable("x-powered-by");

if (process.env.NODE_ENV === "development") app.use(morgan("tiny")); // HTTP logging
app.use(cors(corsOptions)); // middleware to enables cors
app.use(helmet()); // middleware which adds http headers
app.use(bodyParser.urlencoded({ extended: false, limit: "10mb" })); // middleware which parses body
app.use(bodyParser.json({ limit: "10mb" })); // converts body to json
app.get("/metrics", async (req, res) => {
  try {
    res.set("Content-Type", register.contentType);
    const met = await register.metrics();
    res.send(met);
  } catch (error) {
    console.log("metrics route error", error);
  }
});

// bring all routes here
const routes = require("./routes");

// app.use(promMetrics);
app.use("/", routes);

const port = process.env.PORT || 5051;
app.listen(port, () => log.info(`Server running on port: ${port}`));
