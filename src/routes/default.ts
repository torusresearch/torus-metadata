import express, { Request, Response } from "express";

const router = express.Router();

router.get("/", (_: Request, res: Response) => {
  res.send("Welcome to Torus Metadata");
});

router.get("/health", (_: Request, res: Response) => {
  res.status(200).send("Ok!");
});

export default router;
