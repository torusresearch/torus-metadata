import express from "express";

import defaultRoute from "./default";
import emailAuthDataRoute from "./emailAuthData";
import lockRoute from "./lock";
import metadataRoute from "./metadata";
import metadataV2Route from "./metadataV2";

const router = express.Router();
router.use("/", defaultRoute);
router.use("/auth", emailAuthDataRoute);
router.use("/", lockRoute);
router.use("/", metadataRoute);
router.use("/v2", metadataV2Route);

export default router;
