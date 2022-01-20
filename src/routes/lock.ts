import express from "express";

const router = express.Router();

router.get("/acquireLock", (req, res) => {
  res.send("acquireLock");
});

router.get("/releaseLock", (req, res) => {
  res.send("releaseLock");
});

export default router;
