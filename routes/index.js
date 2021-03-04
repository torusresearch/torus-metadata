const express = require("express");

const router = express.Router();

module.exports = (io) => {
  const defaultRoute = require("./default");
  const metadataRoute = require("./metadata");
  const lockRoute = require("./lock");
  const emailAuthDataRoute = require("./emailAuthData")(io);

  router.use("/", defaultRoute);
  router.use("/", metadataRoute);
  router.use("/", lockRoute);
  router.use("/auth", emailAuthDataRoute);
  return router;
};
