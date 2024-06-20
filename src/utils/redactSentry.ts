import { ErrorEvent } from "@sentry/node";
import { redactEventData } from "@toruslabs/loglevel-sentry";

export default (event: ErrorEvent): ErrorEvent => {
  if (!event.request) return event;

  // Redact body for sentitive URLs.
  // event.request.data = "***";

  // Redact sensitive headers.
  event.request.headers = redactEventData(event.request.headers);

  return event;
};
