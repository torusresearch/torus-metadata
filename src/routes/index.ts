import express from "express";

import defaultRoute from "./default";
import lockRoute from "./lock";

const final = () => {
  const router = express.Router();

  router.use("/", defaultRoute);
  router.use("/", lockRoute);

  return router;
};

export default final;
