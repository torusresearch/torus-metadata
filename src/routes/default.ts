import express from "express";

const router = express.Router();

router.get("/", (req, res) => {
  res.send("Welcome to Torus Metadata");
});

router.get("/health", (req, res) => {
  res.status(200).send("Ok!");
});

export default router;
