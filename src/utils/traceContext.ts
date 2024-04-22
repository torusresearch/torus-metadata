import * as Sentry from "@sentry/node";
import { NextFunction, Request, Response } from "express";

// Middleware to add trace-id to the response header
export const traceContextMiddleware = (_: Request, res: Response, next: NextFunction): void => {
  const { traceId } = Sentry.getActiveSpan()?.spanContext() || {};
  if (traceId) {
    res.setHeader("trace-id", traceId);
  }
  next(); // Proceed to the next middleware or route handler
};
