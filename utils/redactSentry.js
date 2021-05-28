const { redactData } = require("@toruslabs/loglevel-sentry");

module.exports = (event) => {
  if (!event.request) return event;

  // Redact body for sentitive URLs.
  event.request.data = "***";

  // Redact sensitive headers.
  event.request.headers = redactData(event.request.headers);

  return event;
};
