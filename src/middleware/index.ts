/* eslint-disable security/detect-object-injection */
import { secp256k1 } from "@toruslabs/metadata-helpers";
import { Joi } from "celebrate";
import { timingSafeEqual } from "crypto";
import { NextFunction, Request, Response } from "express";
import log from "loglevel";

import { getError, isValidLockSignature, isValidSignature } from "../utils";
import { getDBTableName, isPublicReadNamespace, isWritableNamespace, LockDataInput, SetDataInput } from "../utils/interfaces";

export const validateDataTimeStamp = async (req: Request, res: Response, next: NextFunction) => {
  const { set_data: setData }: SetDataInput = req.body;
  const { timestamp } = setData;
  const timeParsed = parseInt(timestamp, 16);
  if (~~(Date.now() / 1000) - timeParsed > 600) {
    log.error("[validateDataTimeStamp] Message has been signed more than 600s ago", { currentTime: ~~(Date.now() / 1000), timeParsed });
    res.status(403).json({ error: { timestamp: "Message has been signed more than 600s ago" }, success: false });
    return;
  }
  next();
  return;
};

export const validateMetadataLoopInput = (key: string) => (req: Request, res: Response, next: NextFunction) => {
  const paramsObject: { [key: string]: SetDataInput[] } = req.body;
  const mainParamToTest = paramsObject[key];
  for (const [index, param] of mainParamToTest.entries()) {
    const { set_data: setData } = param;
    const { timestamp } = setData;
    const timeParsed = parseInt(timestamp, 16);
    if (~~(Date.now() / 1000) - timeParsed > 600) {
      const errors = { index, timestamp: "Message has been signed more than 600s ago" };
      log.error("[validateMetadataLoopInput]", { currentTime: ~~(Date.now() / 1000), timeParsed, errors });
      res.status(403).json({ error: errors, success: false });
      return;
    }
  }
  next();
};

export const validateSignature = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const setDataInput: SetDataInput = req.body;
    const isValid = isValidSignature(setDataInput);

    if (!isValid) {
      log.error("Invalid signature", { setDataInput });
      res.status(403).json({ error: { signature: "Invalid signature" }, success: false });
      return;
    }
    next();
    return;
  } catch (error) {
    log.error("signature verification failed", error);
    res.status(500).json({ error: getError(error), success: false });
    return;
  }
};

export const validateLoopSignature = (key: string) => (req: Request, res: Response, next: NextFunction) => {
  const paramsObject: { [key: string]: SetDataInput[] } = req.body;
  const mainParamToTest = paramsObject[key];
  for (const [index, param] of mainParamToTest.entries()) {
    try {
      const isValid = isValidSignature(param);
      if (!isValid) {
        const errors = { index, signature: "Invalid signature" };
        log.error("Invalid signature", { index, param });
        res.status(403).json({ error: errors, success: false });
        return;
      }
    } catch (error: unknown) {
      (error as { index: number }).index = index;
      log.error("signature verification failed", error);
      res.status(500).json({ error: getError(error), success: false });
      return;
    }
  }
  next();
  return;
};

export const validateNamespace = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { namespace } = req.body;
    req.body.tableName = getDBTableName(namespace); // function will validate namespace too
    next();
    return;
  } catch (error) {
    log.error(error);
    res.status(500).json({ error: getError(error), success: false });
    return;
  }
};

// Guards both the unauthenticated /get route and the /set write route: only namespaces on
// the canonical public-read allowlist may be read or written. Reserved nonce namespaces
// (noncev2, pub_noncev2), every other private/recovery namespace, and unknown namespaces are
// rejected BEFORE a table is resolved or any cache/DB lookup/write happens. getDBTableName is
// not an authorization check.
export const validatePublicReadNamespace = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { namespace } = req.body;
    if (!isPublicReadNamespace(namespace)) {
      log.warn("[validatePublicReadNamespace] namespace is not publicly readable", { namespace });
      res.status(403).json({ error: { namespace: "namespace is not readable through this endpoint" }, success: false });
      return;
    }
    req.body.tableName = getDBTableName(namespace);
    next();
    return;
  } catch (error) {
    log.error(error);
    res.status(500).json({ error: getError(error), success: false });
    return;
  }
};

export const validateNamespaceLoop = (key: string) => (req: Request, res: Response, next: NextFunction) => {
  const paramsObject: { [key: string]: SetDataInput[] } = req.body;
  const mainParamToTest = paramsObject[key];
  for (const param of mainParamToTest) {
    const { namespace } = param;
    // Reject unknown namespaces and pub_noncev2 before any DB write, so bulk writes cannot land
    // data that generic /get would then refuse to serve. noncev2 stays allowed here: the tKey SDK
    // writes noncev2 = "<deleted>" through this route during the OneKey -> tKey upgrade.
    if (!isWritableNamespace(namespace)) {
      log.warn("[validateNamespaceLoop] namespace is not writable through this endpoint", { namespace });
      res.status(403).json({ error: { namespace: "namespace is not writable through this endpoint" }, success: false });
      return;
    }
    param.tableName = getDBTableName(namespace);
  }
  next();
  return;
};

export const validateLockData = (req: Request, res: Response, next: NextFunction) => {
  try {
    const val: LockDataInput = req.body;
    const isValid = isValidLockSignature(val);
    if (!isValid) {
      const errors = { signature: "Invalid signature" };
      log.error("[validateLockData] Invalid signature", { val });
      res.status(403).json({ error: errors, success: false });
      return;
    }
    const { timestamp } = val.data;
    const timeParsed = parseInt(timestamp, 16);
    if (~~(Date.now() / 1000) - timeParsed > 600) {
      log.error("[validateLockData] Message has been signed more than 600s ago", { currentTime: ~~(Date.now() / 1000), timeParsed });
      res.status(403).json({ error: { message: "Message has been signed more than 600s ago" }, success: false });
      return;
    }
    next();
  } catch (error) {
    log.error(error);
    res.status(500).json({ error: getError(error), status: 0 });
    return;
  }
};

// V2 Validation Functions
function validV2InputWithSig(body: Record<string, unknown>) {
  if ("set_data" in body && "pub_key_X" in body && "pub_key_Y" in body && "signature" in body) {
    return true;
  }
  return false;
}

const NONCE_OPERATIONS = ["getOrSetNonce", "getNonce"];

// Current format (torus.js v16+ and torus nodes): set_data.operation is the command and
// set_data.data is an optional nonce to store, e.g. for imported keys.
const CURRENT_SIGNED_NONCE_DATA_SCHEMA = Joi.object({
  operation: Joi.string()
    .valid(...NONCE_OPERATIONS)
    .required(),
  data: Joi.string().hex().max(64).allow(""),
  timestamp: Joi.string().hex().required(),
  seed: Joi.string().valid(""),
});

// Unsigned lookups can not carry a caller-chosen nonce.
const CURRENT_UNSIGNED_NONCE_DATA_SCHEMA = Joi.object({
  operation: Joi.string()
    .valid(...NONCE_OPERATIONS)
    .required(),
  data: Joi.any().valid(""),
  timestamp: Joi.any().valid(""),
  seed: Joi.any().valid(""),
});

const validateCurrentNonceInput = (req: Request, res: Response, next: NextFunction) => {
  const { set_data: setData, key_type: keyType } = req.body;
  if (keyType && keyType !== "secp256k1") {
    res.status(400).json({ error: { key_type: "Only secp256k1 keys are supported" }, success: false });
    return;
  }
  const signed = validV2InputWithSig(req.body);
  const { error } = (signed ? CURRENT_SIGNED_NONCE_DATA_SCHEMA : CURRENT_UNSIGNED_NONCE_DATA_SCHEMA).validate(setData);
  if (error) {
    res.status(400).json({ error, success: false });
    return;
  }
  if (signed && ~~(Date.now() / 1000) - parseInt(setData.timestamp, 16) > 600) {
    log.error("[validateGetOrSetNonceSetInput] Message has been signed more than 600s ago");
    res.status(403).json({ error: { timestamp: "Message has been signed more than 600s ago" }, success: false });
    return;
  }
  if (setData.data) {
    const nonce = BigInt(`0x${setData.data}`);
    if (nonce === 0n || nonce >= secp256k1.Point.CURVE().n) {
      res.status(400).json({ error: { data: "Nonce must be a valid secp256k1 scalar" }, success: false });
      return;
    }
  }
  if (!signed) res.locals.noValidSig = true;
  res.locals.nonceCommand = { operation: setData.operation, newNonce: setData.data || "" };
  next();
};

export const validateGetOrSetNonceSetInput = async (req: Request, res: Response, next: NextFunction) => {
  if (req.body.set_data?.operation !== undefined) return validateCurrentNonceInput(req, res, next);
  // torus.js v15 format: set_data.data is the command
  res.locals.nonceCommand = { operation: req.body.set_data?.data, newNonce: "" };
  if (!validV2InputWithSig(req.body)) {
    res.locals.noValidSig = true;
    return next();
  }
  const { set_data: setData = {} } = req.body;
  const { error } = Joi.object({
    data: Joi.string().required(),
    timestamp: Joi.string().hex().required(),
  }).validate(setData);
  if (error) {
    res.status(400).json({ error, success: false });
    return;
  }
  const { timestamp, data } = setData;

  if (!["getOrSetNonce", "getNonce"].includes(data)) {
    log.error("Should be equal to 'getOrSetNonce' or 'getNonce'", { data });
    res.status(403).json({ error: { data: "Should be equal to 'getOrSetNonce' or 'getNonce'" }, success: false });
    return;
  }
  const timeParsed = parseInt(timestamp, 16);
  if (~~(Date.now() / 1000) - timeParsed > 600) {
    log.error("[validateGetOrSetNonceSetInput] Message has been signed more than 600s ago", { currentTime: ~~(Date.now() / 1000), timeParsed });
    res.status(403).json({ error: { timestamp: "Message has been signed more than 600s ago" }, success: false });
    return;
  }
  next();
};

const isValidTorusNodeApiKey = (apiKey?: string): boolean => {
  if (!apiKey) return false;
  const expected = Buffer.from(process.env.TORUS_NODE_API_KEY || "", "utf8");
  const provided = Buffer.from(apiKey, "utf8");
  // timingSafeEqual throws on length mismatch; the early return only reveals the key length
  return expected.length === provided.length && timingSafeEqual(expected, provided);
};

// Torus nodes look up nonces without the user's key, so they authenticate with an API key to read the private nonce.
export const checkTorusNodeApiKey = (req: Request, res: Response, next: NextFunction) => {
  res.locals.isTorusNode = isValidTorusNodeApiKey(req.get("x-web3-api-key"));
  next();
};

export const validateGetOrSetNonceSignature = async (req: Request, res: Response, next: NextFunction) => {
  if (!validV2InputWithSig(req.body)) {
    res.locals.noValidSig = true;
    return next();
  }
  try {
    const { body }: { body: SetDataInput } = req;
    const isValid = isValidSignature(body);
    if (!isValid) {
      log.error("[validateGetOrSetNonceSignature] Invalid signature", { body });
      res.status(403).json({ error: { signature: "Invalid Signature" }, success: false });
      return;
    }
    next();
    return;
  } catch (error) {
    log.error("signature verification failed", error);
    res.status(500).json({ error: getError(error), success: false });
    return;
  }
};

export const serializeStreamBody = (req: Request, res: Response, next: NextFunction) => {
  try {
    const stream = req.body;
    const shares: SetDataInput[] = Object.values(stream).map((el) => JSON.parse(el as string) as SetDataInput);
    req.body = { shares };
    next();
    return;
  } catch (error) {
    log.error("serializeStreamBody internal error", error);
    res.status(500).json({ error: getError(error), status: 0 });
    return;
  }
};
