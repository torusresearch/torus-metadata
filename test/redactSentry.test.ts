import { ErrorEvent } from "@sentry/node";
import { describe, expect, it } from "vitest";

import redact from "../src/utils/redactSentry";

const eventFor = (url: string): ErrorEvent => ({ type: undefined, request: { url, data: { set_data: { data: "secret" } }, headers: {} } });

describe("redactSentry", function () {
  it("hides the get_or_set_nonce body, which can carry an imported nonce", function () {
    expect(redact(eventFor("https://metadata.tor.us/get_or_set_nonce")).request?.data).toBe("***");
  });

  it("keeps the body of other routes", function () {
    expect(redact(eventFor("https://metadata.tor.us/get")).request?.data).toEqual({ set_data: { data: "secret" } });
  });
});
