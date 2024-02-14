import { ec as EC } from "elliptic";
import { keccak256 } from "js-sha3";
import stringify from "json-stable-stringify";

import { LockDataInput, SetDataInput } from "./interfaces";

const elliptic = new EC("secp256k1");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isErrorObj(err: any): boolean {
  return err && err.stack && err.message;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getError = (error: any) => {
  if (isErrorObj(error)) return { message: error.message };
  return error;
};

export const constructKey = (pubKeyX: string, pubKeyY: string, namespace?: string): string => {
  let key = `${pubKeyX}\x1c${pubKeyY}`;
  if (namespace) key += `\x1c${namespace}`;
  return key;
};

export const randomID = () => `${Math.random().toString(36).substring(2, 9)}`;

export const REDIS_TIMEOUT = 90; // seconds
export const REDIS_LOCK_TIMEOUT = 90;
export const MAX_BATCH_SIZE = 60 * 1024 * 1024; // 60MB

export const REDIS_NAME_SPACE = "EMAIL_AUTH_DATA";

export const isValidSignature = (data: SetDataInput): boolean => {
  const { pub_key_X: pubKeyX, pub_key_Y: pubKeyY, signature, set_data: setData } = data;
  const pubKey = elliptic.keyFromPublic({ x: pubKeyX, y: pubKeyY }, "hex");
  const decodedSignature = Buffer.from(signature, "base64").toString("hex");
  const ecSignature = {
    r: Buffer.from(decodedSignature.substring(0, 64), "hex"),
    s: Buffer.from(decodedSignature.substring(64, 128), "hex"),
  };
  // this is to ensure that the signature is valid for both JSON and stringified data
  // and for backward compatibility.
  const casesToCheck = [stringify(setData), JSON.stringify(setData), JSON.stringify({ timestamp: setData.timestamp, data: setData.data })];
  for (const dataCase of casesToCheck) {
    const result = elliptic.verify(keccak256(dataCase), ecSignature, pubKey);
    if (result) return result;
  }
  return false;
};

export const isValidLockSignature = (lockData: LockDataInput): boolean => {
  const { key, signature, data } = lockData;
  // this is to ensure that the signature is valid for both JSON and stringified data
  // and for backward compatibility.
  const casesToCheck = [stringify(data), JSON.stringify(data), JSON.stringify({ timestamp: data.timestamp, data: data.data })];
  for (const dataCase of casesToCheck) {
    const result = elliptic.verify(keccak256(Buffer.from(dataCase, "utf8")), signature, Buffer.from(key, "hex"));
    if (result) return result;
  }
  return false;
};
