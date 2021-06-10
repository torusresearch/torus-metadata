const express = require("express");

const router = express.Router();

const defaultRoute = require("./default");
const metadataRoute = require("./metadata");
const lockRoute = require("./lock");

router.use("/", defaultRoute);
router.use("/", metadataRoute);
router.use("/", lockRoute);

module.exports = router;
