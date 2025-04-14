/* eslint-disable security/detect-object-injection */
import { Joi } from "celebrate";
import { NextFunction, Request, Response } from "express";
import log from "loglevel";

import { getError, isValidLockSignature, isValidSignature } from "../utils";
import { getDBTableName, LockDataInput, SetDataInput } from "../utils/interfaces";

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

export const validateNamespaceLoop = (key: string) => (req: Request, _: Response, next: NextFunction) => {
  const paramsObject: { [key: string]: SetDataInput[] } = req.body;
  const mainParamToTest = paramsObject[key];
  for (const param of mainParamToTest) {
    const { namespace } = param;
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

export const validateGetOrSetNonceSetInput = async (req: Request, res: Response, next: NextFunction) => {
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
