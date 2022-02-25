import express from "express";

import defaultRoute from "./default";
import emailAuthDataRoute from "./emailAuthData";
import lockRoute from "./lock";
import metadataRoute from "./metadata";

const router = express.Router();
router.use("/", defaultRoute);
router.use("/", emailAuthDataRoute);
router.use("/", lockRoute);
router.use("/", metadataRoute);

export default router;
