/* eslint-disable n/no-extraneous-require */
/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable @typescript-eslint/no-var-requires */
const { keccak256 } = require("ethereum-cryptography/keccak");
const BN = require("bn.js");
const stringify = require("json-stable-stringify");

const { ec: EC } = require("elliptic");

function generateGetOrSetNonceParams(operation, data, privateKey, keyType) {
  const curve = keyType === "ed25519" ? "ed25519" : "secp256k1";
  const ec = new EC(curve);
  const key = ec.keyFromPrivate(privateKey.toString("hex", 64));
  const setData = {
    data,
    timestamp: new BN(~~(Date.now() / 1000)).toString(16),
  };
  const sig = key.sign(keccak256(Buffer.from(stringify(setData), "utf8")));
  return {
    pub_key_X: key.getPublic().getX().toString("hex"),
    pub_key_Y: key.getPublic().getY().toString("hex"),
    set_data: setData,
    key_type: keyType,
    signature: Buffer.from(sig.r.toString(16, 64) + sig.s.toString(16, 64) + new BN("").toString(16, 2), "hex").toString("base64"),
  };
}

module.exports = { generateGetOrSetNonceParams };
