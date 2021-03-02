const express = require("express");
const bodyParser = require("body-parser");
const helmet = require("helmet");

const cors = require("cors");
const morgan = require("morgan");
const log = require("loglevel");
const ResponseTime = require("response-time");
const { register, collectDefaultMetrics } = require("prom-client");
const client = require("prom-client");
// const heapdump = require("heapdump");

// heapdump.writeSnapshot(`${Date.now()}.heapsnapshot`);

// enable prom-client to expose default application metrics
collectDefaultMetrics({
  register,
  timeout: 10000,
});

const httpSummary = new client.Summary({
  name: "http_responses_summary",
  help: "Response time in millis",
  labelNames: ["method", "path", "status"],
});

const httpCounter = new client.Counter({
  name: "http_request_count",
  help: "Number of http requests",
  labelNames: ["method", "path", "status"],
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

app.use(
  ResponseTime((req, res, time) => {
    if (req.path !== "/metrics") {
      httpSummary.labels({ method: req.method, path: req.path, status: res.statusCode }).observe(time);
      httpCounter.inc({ method: req.method, path: req.path, status: res.statusCode });
    }
  })
);

app.get("/metrics", async (req, res) => {
  res.set("Content-Type", register.contentType);
  const met = await register.metrics();
  return res.send(met);
});
// bring all routes here
const routes = require("./routes");

// app.use(promMetrics);
app.use("/", routes);

const port = process.env.PORT || 5051;
app.listen(port, () => log.info(`Server running on port: ${port}`));
