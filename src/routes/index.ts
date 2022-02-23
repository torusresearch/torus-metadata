import express from "express";

import defaultRoute from "./default";
import emailAuthDataRoute from "./emailAuthData";
import lockRoute from "./lock";

const router = express.Router();
router.use("/", defaultRoute);
router.use("/", emailAuthDataRoute);
router.use("/", lockRoute);

export default router;
