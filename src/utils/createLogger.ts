import * as Sentry from "@sentry/node";
import { createLogger } from "@toruslabs/loglevel-sentry";
import log from "loglevel";

export default (name: string): log.Logger => createLogger(name, Sentry);
