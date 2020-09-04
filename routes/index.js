const express = require("express");

const router = express.Router();

const defaultRoute = require("./default");
const metadataRoute = require("./metadata");

router.use("/", defaultRoute);
router.use("/", metadataRoute);

module.exports = router;
