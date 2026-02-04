import { secp256k1 } from "@noble/curves/secp256k1.js";
import { hexToBytes } from "@noble/curves/utils.js";
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
  // v1 format: r (32 bytes) + s (32 bytes) + recovery (1 byte)
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

// V2 signature format from @noble/curves: recovery (1 byte) + r (32 bytes) + s (32 bytes)
export const isValidSignatureV2 = (data: SetDataInput): boolean => {
  const { pub_key_X: pubKeyX, pub_key_Y: pubKeyY, signature, set_data: setData } = data;
  // Construct uncompressed public key: 04 + x + y
  const pubKey = hexToBytes("04" + pubKeyX.padStart(64, "0") + pubKeyY.padStart(64, "0"));
  const decodedSignature = Buffer.from(signature, "base64");
  // v2 format: recovery (1 byte) + r (32 bytes) + s (32 bytes)
  // Extract compact signature (r + s) for verification
  const compactSig = decodedSignature.subarray(1, 65);
  // this is to ensure that the signature is valid for both JSON and stringified data
  // and for backward compatibility.
  const casesToCheck = [stringify(setData), JSON.stringify(setData), JSON.stringify({ timestamp: setData.timestamp, data: setData.data })];
  for (const dataCase of casesToCheck) {
    const msgHash = hexToBytes(keccak256(dataCase as string));
    const result = secp256k1.verify(compactSig, msgHash, pubKey, { lowS: true, prehash: false });
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
