import { ec as EC } from "elliptic";
import { keccak256 } from "js-sha3";
import stringify from "json-stable-stringify";

import { KeyType, LockDataInput, SetDataInput } from "./interfaces";

const ellipticSecp256k1 = new EC("secp256k1");
const ellipticEd25519 = new EC("ed25519");

export function getEllipticCurve(keyType: KeyType) {
  if (keyType === "ed25519") {
    return ellipticEd25519;
  }
  // default is secp256k1
  return ellipticSecp256k1;
}

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

export const isValidSignature = (data: SetDataInput) => {
  const { pub_key_X: pubKeyX, pub_key_Y: pubKeyY, signature, set_data: setData, key_type: keyType } = data;
  const elliptic = getEllipticCurve(keyType);

  const pubKey = elliptic.keyFromPublic({ x: pubKeyX, y: pubKeyY }, "hex");
  const decodedSignature = Buffer.from(signature, "base64").toString("hex");
  const ecSignature = {
    r: Buffer.from(decodedSignature.substring(0, 64), "hex"),
    s: Buffer.from(decodedSignature.substring(64, 128), "hex"),
  };
  return elliptic.verify(keccak256(stringify(setData)), ecSignature, pubKey);
};

export const isValidLockSignature = (lockData: LockDataInput) => {
  const { key, signature, data, key_type: keyType } = lockData;
  const elliptic = getEllipticCurve(keyType);
  return elliptic.verify(keccak256(stringify(data)), signature, Buffer.from(key, "hex"));
};
