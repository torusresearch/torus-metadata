import * as Sentry from "@sentry/node";
import { LoglevelSentry } from "@toruslabs/loglevel-sentry";
import log from "loglevel";

import redact from "./redactSentry";

const sentryDsn = process.env.SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: process.env.NODE_ENV,
    integrations: [
      // enable HTTP calls
      Sentry.httpIntegration({ breadcrumbs: true }),

      // enable Express.js middleware tracing
      Sentry.expressIntegration(),
      Sentry.mysql2Integration(), // Add this integration
      Sentry.anrIntegration(),
    ],
    tracesSampleRate: process.env.SENTRY_TRACES_SAMPLE_RATE ? Number(process.env.SENTRY_TRACES_SAMPLE_RATE) : 0.001,
    sampleRate: process.env.SENTRY_SAMPLE_RATE ? Number(process.env.SENTRY_SAMPLE_RATE) : 0.1,
    beforeSend(event) {
      return redact(event);
    },
  });
  const plugin = new LoglevelSentry(Sentry);
  plugin.install(log);
}
