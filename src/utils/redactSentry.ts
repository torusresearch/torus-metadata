import { ErrorEvent } from "@sentry/node";
import { redactEventData } from "@toruslabs/loglevel-sentry";

export default (event: ErrorEvent): ErrorEvent => {
  if (!event.request) return event;

  // Redact body for sentitive URLs. A get_or_set_nonce body can carry a secret imported nonce.
  if (event.request.url?.includes("/get_or_set_nonce")) event.request.data = "***";

  // Redact sensitive headers.
  event.request.headers = redactEventData(event.request.headers);

  return event;
};
