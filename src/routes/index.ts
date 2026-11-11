import express from "express";

import defaultRoute from "./default";
import lockRoute from "./lock";
import metadataRoute from "./metadata";

const router = express.Router();
router.use("/", defaultRoute);
router.use("/", lockRoute);
router.use("/", metadataRoute);

export default router;
