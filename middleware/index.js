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

exports.validationLoopMiddleware = (items, key, isBody = true) => {
  return (req, res, next) => {
    try {
      const paramsObject = isBody ? req.body : req.query;
      const mainParamToTest = paramsObject[key];
      if (!Array.isArray(mainParamToTest)) {
        return res.status(400).json({ error: { message: `${key} must be an array` }, success: false });
      }
      for (const [index, param] of mainParamToTest.entries()) {
        const { errors, isValid } = validateInput(param, items);
        if (!isValid) {
          errors.index = index;
          return res.status(400).json({ error: errors, success: false });
        }
      }
      return next();
    } catch (error) {
      console.trace("validationLoopMiddleware internal error", error);
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
  if (~~(Date.now() / 1000) - timeParsed > 60) {
    errors.timestamp = "Message has been signed more than 60s ago";
    return res.status(403).json({ error: errors, success: false });
  }
  return next();
};

exports.validateMetadataLoopInput = (key, isBody = true) => {
  return (req, res, next) => {
    const paramsObject = isBody ? req.body : req.query;
    const mainParamToTest = paramsObject[key];
    // if (!Array.isArray(mainParamToTest)) {
    //   return res.status(400).json({ error: { message: `${key} must be an array` }, success: false });
    // }
    for (const [index, param] of mainParamToTest.entries()) {
      const { set_data: setData = {} } = param;
      const { errors, isValid } = validateInput(setData, ["data", "timestamp"]);
      if (!isValid) {
        errors.index = index;
        return res.status(400).json({ error: errors, success: false });
      }
      const { timestamp } = setData;
      const timeParsed = parseInt(timestamp, 16);
      if (~~(Date.now() / 1000) - timeParsed > 60) {
        errors.timestamp = "Message has been signed more than 60s ago";
        return res.status(403).json({ error: errors, success: false });
      }
    }
    return next();
  };
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

exports.validateLoopSignature = (key, isBody = true) => {
  return (req, res, next) => {
    const paramsObject = isBody ? req.body : req.query;
    const mainParamToTest = paramsObject[key];
    // if (!Array.isArray(mainParamToTest)) {
    //   return res.status(400).json({ error: { message: `${key} must be an array` }, success: false });
    // }
    for (const [index, param] of mainParamToTest.entries()) {
      try {
        const { pub_key_X: pubKeyX, pub_key_Y: pubKeyY, signature, set_data: setData } = param;
        const pubKey = elliptic.keyFromPublic({ x: pubKeyX, y: pubKeyY }, "hex");
        const decodedSignature = Buffer.from(signature, "base64").toString("hex");
        const ecSignature = {
          r: Buffer.from(decodedSignature.substring(0, 64), "hex"),
          s: Buffer.from(decodedSignature.substring(64, 128), "hex"),
        };
        const isValidSignature = elliptic.verify(keccak256(stringify(setData)), ecSignature, pubKey);
        if (!isValidSignature) {
          const errors = { index, signature: "Invalid signature" };
          return res.status(403).json({ error: errors, success: false });
        }
      } catch (error) {
        error.index = index;
        log.error("signature verification failed", error);
        return res.status(500).json({ error: getError(error), success: false });
      }
    }
    return next();
  };
};

exports.validateLockData = (req, res, next) => {
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
    console.error(error);
    return res.status(500).json({ error: getError(error), status: 0 });
  }
};
