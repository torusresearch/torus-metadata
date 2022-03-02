import * as Sentry from "@sentry/node";
import { Express } from "express";

import redact from "./redactSentry";

export const registerSentry = (app: Express): void => {
  const sentryDsn = process.env.SENTRY_DSN;
  if (sentryDsn) {
    Sentry.init({
      dsn: sentryDsn,
      environment: process.env.NODE_ENV,
      integrations: [
        // enable HTTP calls
        new Sentry.Integrations.Http({ breadcrumbs: true }),
      ],
      sampleRate: 0.2,
      beforeSend(event) {
        return redact(event);
      },
    });
    app.use(
      Sentry.Handlers.requestHandler({
        request: ["public_address", "data", "headers", "method", "query_string", "url"],
      })
    );
  }
};

export const registerSentryErrorHandler = (app: Express): void => {
  const sentryDsn = process.env.SENTRY_DSN;
  if (sentryDsn) {
    app.use(
      Sentry.Handlers.errorHandler({
        shouldHandleError(error) {
          // Capture all 404 and 500 errors
          return error.status >= 400;
        },
      })
    );
  }
};
