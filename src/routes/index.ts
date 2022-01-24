import express from "express";

import defaultRoute from "./default";
import emailAuthData from "./emailAuthData";
import lockRoute from "./lock";

const final = (io) => {
  const router = express.Router();
  const emailAuthDataRoute = emailAuthData(io);

  router.use("/", defaultRoute);
  router.use("/", emailAuthDataRoute);
  router.use("/", lockRoute);

  return router;
};

export default final;
