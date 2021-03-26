const express = require("express");
const bodyParser = require("body-parser");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const log = require("loglevel");

// setup app
const app = express();
const http = require("http").Server(app);
const io = require("socket.io")(http, {
  cors: {
    credentials: true,
    origin: true,
    methods: ["GET", "POST"],
  },
});

io.on("connection", () => {
  log.debug("connected");
});
// Setup environment
require("dotenv").config();

log.enableAll();

// setup middleware
const corsOptions = {
  // origin: ["https://localhost:3000", /\.tor\.us$/],
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

// bring all routes here
const routes = require("./routes")(io);

app.use("/", routes);

const port = process.env.PORT || 5051;
http.listen(port, () => log.info(`Server running on port: ${port}`));
