/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable n/no-extraneous-import */
import { getPubKeyECC } from "@tkey/common-types";
import { TorusStorageLayer } from "@tkey/storage-layer-torus";
import { encrypt, generatePrivate } from "@toruslabs/eccrypto";
import { bytesToBigInt } from "@toruslabs/metadata-helpers";
import { ec as EC } from "elliptic";
import { keccak256 } from "js-sha3";
import jsonStableStringify from "json-stable-stringify";
import { stringify } from "querystring";
import { assert, beforeAll, beforeEach, describe, expect, it } from "vitest";

const port = 5051;
const host = process.env.HOST || "localhost";
const server = `http://${host}:${port}`;

function encodeMessageBytes(message: Record<string, string>): Uint8Array {
  return new TextEncoder().encode(stringify(message));
}
const randomID = () => `${Math.random().toString(36).substring(2, 9)}`;
describe("API-calls", function () {
  describe("/default", function () {
    it("should return a welcome message", async function () {
      const res = await fetch(`${server}/`);
      expect(res.status).toBe(200);
      expect(await res.text()).toBe("Welcome to Torus Metadata");
    });

    it("should return ok message", async function () {
      const res = await fetch(`${server}/health`);
      expect(res.status).toBe(200);
      expect(await res.text()).toBe("Ok!");
    });
  });

  describe("/set", function () {
    let PRIVATE_KEY: bigint;
    const storageLayer = new TorusStorageLayer({ hostUrl: server });

    beforeEach(function () {
      PRIVATE_KEY = bytesToBigInt(generatePrivate());
    });

    it("#it should reject if signature field is missing", async function () {
      const message = {
        test: Math.random().toString(36).substring(7),
      };

      const messageBytes = encodeMessageBytes(message);
      const encryptedDetails = await encrypt(getPubKeyECC(PRIVATE_KEY), messageBytes);
      // @ts-expect-error testing
      const serializedEncryptedDetails = globalThis.btoa(stringify(encryptedDetails));

      const metadataParams = storageLayer.generateMetadataParams(serializedEncryptedDetails, undefined, PRIVATE_KEY);
      metadataParams.signature = ""; // remove signature
      const res = await fetch(`${server}/set`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(metadataParams),
      });
      expect(res.status).toBe(400);
      const val = await res.json();
      expect(val.validation.body.message).toBe('"signature" is not allowed to be empty');
    });

    it("#it should reject if pubKeyX/pubKeyY field is missing", async function () {
      const message = {
        test: Math.random().toString(36).substring(7),
      };

      const messageBytes = encodeMessageBytes(message);
      const encryptedDetails = await encrypt(getPubKeyECC(PRIVATE_KEY), messageBytes);
      // @ts-expect-error testing
      const serializedEncryptedDetails = globalThis.btoa(stringify(encryptedDetails));

      const metadataParams = storageLayer.generateMetadataParams(serializedEncryptedDetails, undefined, PRIVATE_KEY);
      metadataParams.pub_key_X = ""; // remove signature
      const res = await fetch(`${server}/set`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(metadataParams),
      });
      expect(res.status).toBe(400);
      const val = await res.json();
      expect(val.validation.body.message).toBe('"pub_key_X" is not allowed to be empty');
    });

    it("#it should reject if the timestamp is missing", async function () {
      const message = {
        test: Math.random().toString(36).substring(7),
      };

      const messageBytes = encodeMessageBytes(message);
      const encryptedDetails = await encrypt(getPubKeyECC(PRIVATE_KEY), messageBytes);
      // @ts-expect-error testing
      const serializedEncryptedDetails = globalThis.btoa(stringify(encryptedDetails));

      const metadataParams = storageLayer.generateMetadataParams(serializedEncryptedDetails, undefined, PRIVATE_KEY);
      // @ts-expect-error testing
      metadataParams.set_data.timestamp = ""; // remove signature
      const res = await fetch(`${server}/set`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(metadataParams),
      });
      expect(res.status).toBe(400);
      const val = await res.json();
      expect(val.validation.body.message).toBe('"set_data.timestamp" is not allowed to be empty');
    });

    it("#it should reject if the timestamp is old", async function () {
      const message = {
        test: Math.random().toString(36).substring(7),
      };

      const messageBytes = encodeMessageBytes(message);
      const encryptedDetails = await encrypt(getPubKeyECC(PRIVATE_KEY), messageBytes);
      // @ts-expect-error testing
      const serializedEncryptedDetails = globalThis.btoa(stringify(encryptedDetails));

      const metadataParams = storageLayer.generateMetadataParams(serializedEncryptedDetails, undefined, PRIVATE_KEY);
      // @ts-expect-error testing
      metadataParams.set_data.timestamp = (BigInt(Math.floor(Date.now() / 1000)) - 605n).toString(16);
      const res = await fetch(`${server}/set`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(metadataParams),
      });
      expect(res.status).toBe(403);
      const val = await res.json();
      expect(val.error.timestamp).toBe("Message has been signed more than 600s ago"); // same goes for pubkeyY
    });

    it("#it should reject if signature is invalid", async function () {
      const message = {
        test: Math.random().toString(36).substring(7),
      };

      const messageBytes = encodeMessageBytes(message);
      const encryptedDetails = await encrypt(getPubKeyECC(PRIVATE_KEY), messageBytes);
      // @ts-expect-error testing
      const serializedEncryptedDetails = globalThis.btoa(stringify(encryptedDetails));

      const metadataParams = storageLayer.generateMetadataParams(serializedEncryptedDetails, undefined, PRIVATE_KEY);
      // @ts-expect-error testing
      metadataParams.set_data.timestamp = (BigInt(Math.floor(Date.now() / 1000)) - 10n).toString(16); // change timestamp, signature no longer valid
      const res = await fetch(`${server}/set`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(metadataParams),
      });
      expect(res.status).toBe(403);
      const val = await res.json();
      expect(val.error.signature).toBe("Invalid signature"); // same goes for pubkeyY
    });

    it("#it should be able to set/get metadata with correct validation", async function () {
      const message = {
        test: Math.random().toString(36).substring(7),
      };

      await storageLayer.setMetadata({ input: message, privKey: PRIVATE_KEY });
      const data = await storageLayer.getMetadata({ privKey: PRIVATE_KEY });
      // @ts-expect-error testing
      assert.strictEqual(data.test, message.test);
    });
  });

  describe("/bulk_set_stream", function () {
    const storageLayer = new TorusStorageLayer({ hostUrl: server });
    let messages = [];
    let privateKeys = [];
    let finalMetadataParams = [];

    beforeEach(async function () {
      messages = [];
      for (let i = 0; i < 4; i += 1) {
        // @ts-expect-error testing
        messages.push({
          test: Math.random().toString(36).substring(7),
        });
      }

      privateKeys = [];
      for (let i = 0; i < 4; i += 1) {
        // @ts-expect-error testing
        privateKeys.push(bytesToBigInt(generatePrivate()));
      }

      finalMetadataParams = [];
      // @ts-expect-error testing
      finalMetadataParams = await Promise.all(
        messages.map(async (el, i) => {
          const messageBytes = encodeMessageBytes(el);
          const encryptedDetails = await encrypt(getPubKeyECC(privateKeys[i]), messageBytes);
          // @ts-expect-error testing
          const serializedEncryptedDetails = globalThis.btoa(stringify(encryptedDetails));
          const metadataParams = storageLayer.generateMetadataParams(serializedEncryptedDetails, undefined, privateKeys[i]);
          return metadataParams;
        })
      );
    });

    it("#it should reject if data is not an array", async function () {
      const FD = new FormData();
      finalMetadataParams.forEach((_, index) => {
        FD.append(index.toString(), "");
      });

      const res = await fetch(`${server}/bulk_set_stream`, {
        method: "POST",
        body: FD,
      });
      expect(res.status).toBe(500);
      const val = await res.json();

      expect(val.error.message).toBe("Unexpected end of JSON input");
    });

    it("#it should reject if one of the shares has missing pubkey", async function () {
      // @ts-expect-error testing
      finalMetadataParams[0].pub_key_X = "";
      const FD = new FormData();
      finalMetadataParams.forEach((el, index) => {
        FD.append(index.toString(), JSON.stringify(el));
      });

      const res = await fetch(`${server}/bulk_set_stream`, {
        method: "POST",
        body: FD,
      });

      expect(res.status).toBe(400);
      const val = await res.json();
      expect(val.validation.body.message).toBe('"shares[0].pub_key_X" is not allowed to be empty'); // same goes for pubkeyY
    });

    it("#it should reject if one of the shares has an old timestamp", async function () {
      // @ts-expect-error testing
      finalMetadataParams[0].set_data.timestamp = (BigInt(Math.floor(Date.now() / 1000)) - 605n).toString(16);
      const FD = new FormData();
      finalMetadataParams.forEach((el, index) => {
        FD.append(index.toString(), JSON.stringify(el));
      });

      const res = await fetch(`${server}/bulk_set_stream`, {
        method: "POST",
        body: FD,
      });

      expect(res.status).toBe(403);
      const val = await res.json();
      expect(val.error.timestamp).toBe("Message has been signed more than 600s ago"); // same goes for pubkeyY
    });

    it("#it should reject if one of the shares has an invalid signature", async function () {
      // @ts-expect-error testing
      finalMetadataParams[0].set_data.timestamp = (BigInt(Math.floor(Date.now() / 1000)) - 10n).toString(16);
      const FD = new FormData();
      finalMetadataParams.forEach((el, index) => {
        FD.append(index.toString(), JSON.stringify(el));
      });

      const res = await fetch(`${server}/bulk_set_stream`, {
        method: "POST",
        body: FD,
      });

      expect(res.status).toBe(403);
      const val = await res.json();
      expect(val.error.signature).toBe("Invalid signature"); // same goes for pubkeyY
    });

    it("#it should be able get/set stream data correctly", async function () {
      await storageLayer.setMetadataStream({ input: messages, privKey: privateKeys });
      const resp = await storageLayer.getMetadata({ privKey: privateKeys[0] });
      const resp2 = await storageLayer.getMetadata({ privKey: privateKeys[1] });

      assert.deepStrictEqual(resp, messages[0], "set and get message should be equal");
      assert.deepStrictEqual(resp2, messages[1], "set and get message should be equal");
    });
  });

  describe("/lock", function () {
    const storageLayer = new TorusStorageLayer({ hostUrl: server });

    let privKey;
    let lockId;

    beforeAll(function () {
      privKey = bytesToBigInt(generatePrivate());
    });

    it("#can release empty lock", async function () {
      const { status: releaseStatus } = await storageLayer.releaseWriteLock({ id: randomID(), privKey });
      expect(releaseStatus).toBe(1);
    });

    it("#it should acquire lock correctly", async function () {
      const { id, status } = await storageLayer.acquireWriteLock({ privKey });
      expect(status).toBe(1);
      expect(id).toBeDefined();
      lockId = id;
    });

    it("#it should not re acquire lock correctly", async function () {
      const { status } = await storageLayer.acquireWriteLock({ privKey });
      expect(status).toBe(0);
    });

    it("#it should release lock correctly", async function () {
      const { status: releaseStatus } = await storageLayer.releaseWriteLock({ id: lockId, privKey });
      expect(releaseStatus).toBe(1);
    });

    it("#it should not release another lock of priv key", async function () {
      const { status } = await storageLayer.acquireWriteLock({ privKey });
      expect(status).toBe(1);
      const { status: releaseStatus } = await storageLayer.releaseWriteLock({ id: randomID(), privKey });
      expect(releaseStatus).toBe(2);
    });
  });

  describe("backward compat: old elliptic-signed payloads", function () {
    const ec = new EC("secp256k1");

    function createOldSetPayload(keyPair: EC.KeyPair, data: string) {
      const pub = keyPair.getPublic();
      const pubKeyX = pub.getX().toString("hex", 32);
      const pubKeyY = pub.getY().toString("hex", 32);

      const timestamp = Math.floor(Date.now() / 1000).toString(16);
      const setData = { data, timestamp };

      const hash = keccak256(jsonStableStringify(setData) as string);
      const sig = ec.sign(hash, keyPair, "hex", { canonical: false });

      const r = sig.r.toArrayLike(Buffer, "be", 32);
      const s = sig.s.toArrayLike(Buffer, "be", 32);
      const ethSig = Buffer.concat([r, s, Buffer.from([sig.recoveryParam || 0])]);

      const signatureBase64 = ethSig.toString("base64");

      return { pub_key_X: pubKeyX, pub_key_Y: pubKeyY, set_data: setData, signature: signatureBase64 };
    }

    function createOldLockPayload(keyPair: EC.KeyPair) {
      const pubKeyHex = keyPair.getPublic(false, "hex");

      const timestamp = Math.floor(Date.now() / 1000);
      const data = { timestamp };

      const hash = keccak256(jsonStableStringify(data) as string);
      const sig = ec.sign(hash, keyPair, "hex", { canonical: false });
      const signatureHex = sig.toDER("hex");

      return { key: pubKeyHex, data, signature: signatureHex };
    }

    it("#should set/get metadata with old elliptic-signed compact signature", async function () {
      const keyPair = ec.genKeyPair();
      const payload = createOldSetPayload(keyPair, "old-client-data");

      const setRes = await fetch(`${server}/set`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      expect(setRes.status).toBe(200);

      const getRes = await fetch(`${server}/get`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pub_key_X: payload.pub_key_X, pub_key_Y: payload.pub_key_Y }),
      });
      expect(getRes.status).toBe(200);
      const getData = (await getRes.json()) as { message: string };
      expect(getData.message).toBe("old-client-data");
    });

    it("#should bulk_set_stream with old elliptic-signed compact signatures", async function () {
      const keyPair1 = ec.genKeyPair();
      const keyPair2 = ec.genKeyPair();
      const payload1 = createOldSetPayload(keyPair1, "bulk-old-1");
      const payload2 = createOldSetPayload(keyPair2, "bulk-old-2");

      const FD = new FormData();
      FD.append("0", JSON.stringify(payload1));
      FD.append("1", JSON.stringify(payload2));

      const setRes = await fetch(`${server}/bulk_set_stream`, {
        method: "POST",
        body: FD,
      });
      expect(setRes.status).toBe(200);

      const getRes1 = await fetch(`${server}/get`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pub_key_X: payload1.pub_key_X, pub_key_Y: payload1.pub_key_Y }),
      });
      expect(getRes1.status).toBe(200);
      const data1 = (await getRes1.json()) as { message: string };
      expect(data1.message).toBe("bulk-old-1");

      const getRes2 = await fetch(`${server}/get`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pub_key_X: payload2.pub_key_X, pub_key_Y: payload2.pub_key_Y }),
      });
      expect(getRes2.status).toBe(200);
      const data2 = (await getRes2.json()) as { message: string };
      expect(data2.message).toBe("bulk-old-2");
    });

    it("#should acquire/release lock with old elliptic DER-signed payload", async function () {
      const keyPair = ec.genKeyPair();

      const acquirePayload = createOldLockPayload(keyPair);
      const acquireRes = await fetch(`${server}/acquireLock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(acquirePayload),
      });
      expect(acquireRes.status).toBe(200);
      const acquireData = (await acquireRes.json()) as { status: number; id: string };
      expect(acquireData.status).toBe(1);
      expect(acquireData.id).toBeDefined();

      const releasePayload = createOldLockPayload(keyPair);
      const releaseRes = await fetch(`${server}/releaseLock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...releasePayload, id: acquireData.id }),
      });
      expect(releaseRes.status).toBe(200);
      const releaseData = (await releaseRes.json()) as { status: number };
      expect(releaseData.status).toBe(1);
    });

    it("#should get_or_set_nonce with old elliptic-signed payload", async function () {
      const keyPair = ec.genKeyPair();
      const pub = keyPair.getPublic();
      const pubKeyX = pub.getX().toString("hex", 32);
      const pubKeyY = pub.getY().toString("hex", 32);

      const timestamp = Math.floor(Date.now() / 1000).toString(16);
      const setData = { data: "getOrSetNonce", timestamp };

      const hash = keccak256(jsonStableStringify(setData) as string);
      const sig = ec.sign(hash, keyPair, "hex", { canonical: false });

      const r = sig.r.toArrayLike(Buffer, "be", 32);
      const s = sig.s.toArrayLike(Buffer, "be", 32);
      const ethSig = Buffer.concat([r, s, Buffer.from([sig.recoveryParam || 0])]);

      const signatureBase64 = ethSig.toString("base64");

      const res = await fetch(`${server}/get_or_set_nonce`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pub_key_X: pubKeyX,
          pub_key_Y: pubKeyY,
          set_data: setData,
          signature: signatureBase64,
        }),
      });
      expect(res.status).toBe(200);
      const data = (await res.json()) as { typeOfUser: string; pubNonce: { x: string; y: string } };
      expect(data.typeOfUser).toBe("v2");
      expect(data.pubNonce).toBeDefined();
      expect(data.pubNonce.x).toBeDefined();
      expect(data.pubNonce.y).toBeDefined();
    });
  });
});
