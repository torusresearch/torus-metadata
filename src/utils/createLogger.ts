import log from "loglevel";

export default (name: string): log.Logger => log.getLogger(name);
