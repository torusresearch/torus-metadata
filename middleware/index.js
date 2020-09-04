const { ec: EC } = require("elliptic");
const log = require("loglevel");
const { keccak256 } = require("js-sha3");
const stringify = require("json-stable-stringify");

const { getError } = require("../utils");
const { validateInput } = require("../validations");

const elliptic = new EC("secp256k1");

exports.validationMiddleware = (items, isBody = true) => {
  return (req, res, next) => {
    try {
      const { errors, isValid } = validateInput(isBody ? req.body : req.query, items);
      if (!isValid) {
        return res.status(400).json({ error: errors, success: false });
      }
      return next();
    } catch (error) {
      console.trace("validationMiddleware internal error", error);
      return res.status(500).json({ error: getError(error), success: false });
    }
  };
};

exports.validateMetadataInput = async (req, res, next) => {
  const { set_data: setData = {} } = req.body;
  const { errors, isValid } = validateInput(setData, ["data", "timestamp"]);
  if (!isValid) {
    return res.status(400).json({ error: errors, success: false });
  }
  const { timestamp } = setData;
  const timeParsed = parseInt(timestamp, 16);
  if (~~(Date.now() / 1000) - timeParsed > 1) {
    errors.timestamp = "Message has been signed more than 60s ago";
    return res.status(403).json({ error: errors, success: false });
  }
  return next();
};

exports.validateSignature = async (req, res, next) => {
  try {
    const { pub_key_X: pubKeyX, pub_key_Y: pubKeyY, signature, set_data: setData } = req.body;
    const pubKey = elliptic.keyFromPublic({ x: pubKeyX, y: pubKeyY }, "hex");
    const decodedSignature = Buffer.from(signature, "base64").toString("hex");
    const ecSignature = {
      r: Buffer.from(decodedSignature.substring(0, 64), "hex"),
      s: Buffer.from(decodedSignature.substring(64, 128), "hex"),
    };
    const isValidSignature = elliptic.verify(keccak256(stringify(setData)), ecSignature, pubKey);
    if (!isValidSignature) {
      const errors = {};
      errors.signature = "Invalid signature";
      return res.status(403).json({ error: errors, success: false });
    }
    return next();
  } catch (error) {
    log.error("signature verification failed", error);
    return res.status(500).json({ error: getError(error), success: false });
  }
};
