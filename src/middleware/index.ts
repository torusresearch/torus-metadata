import { ec as EC } from "elliptic";
import { keccak256 } from "js-sha3";
import stringify from "json-stable-stringify";
import log from "loglevel";

import { getError } from "../utils";

const elliptic = new EC("secp256k1");

export const validateLockData = (req, res, next) => {
  try {
    const { key: pubKey, signature, data } = req.body;
    // verify signature here
    const isValidSignature = elliptic.verify(keccak256(stringify(data)), signature, Buffer.from(pubKey, "hex"));
    if (!isValidSignature) return res.status(403).json({ error: "Invalid Signature", status: 0 });
    // protection against old signature
    const { timeStamp } = data;
    if (~~(Date.now() / 1000) - timeStamp > 60) {
      return res.status(403).json({ error: "Message has been signed more than 60s ago", status: 0 });
    }
    return next();
  } catch (error) {
    log.error(error);
    return res.status(500).json({ error: getError(error), status: 0 });
  }
};
