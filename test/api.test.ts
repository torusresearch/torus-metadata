/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable n/no-extraneous-import */
/* eslint-disable n/no-unsupported-features/node-builtins */
import { getPubKeyECC } from "@tkey/common-types";
import { TorusStorageLayer } from "@tkey/storage-layer-torus";
import { encrypt, generatePrivate } from "@toruslabs/eccrypto";
import { BN } from "bn.js";
import { stringify } from "querystring";
import { assert, beforeAll, beforeEach, describe, expect, it } from "vitest";

const port = 5051;
const host = process.env.HOST || "localhost";
const server = `http://${host}:${port}`;
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
    let PRIVATE_KEY;
    const storageLayer = new TorusStorageLayer({ hostUrl: server });

    beforeEach(function () {
      PRIVATE_KEY = new BN(generatePrivate());
    });

    it("#it should reject if signature field is missing", async function () {
      const message = {
        test: Math.random().toString(36).substring(7),
      };

      const bufferMetadata = Buffer.from(stringify(message));
      const encryptedDetails = await encrypt(getPubKeyECC(PRIVATE_KEY), bufferMetadata);
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

      const bufferMetadata = Buffer.from(stringify(message));
      const encryptedDetails = await encrypt(getPubKeyECC(PRIVATE_KEY), bufferMetadata);
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

      const bufferMetadata = Buffer.from(stringify(message));
      const encryptedDetails = await encrypt(getPubKeyECC(PRIVATE_KEY), bufferMetadata);
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

      const bufferMetadata = Buffer.from(stringify(message));
      const encryptedDetails = await encrypt(getPubKeyECC(PRIVATE_KEY), bufferMetadata);
      // @ts-expect-error testing
      const serializedEncryptedDetails = globalThis.btoa(stringify(encryptedDetails));

      const metadataParams = storageLayer.generateMetadataParams(serializedEncryptedDetails, undefined, PRIVATE_KEY);
      // @ts-expect-error testing
      metadataParams.set_data.timestamp = new BN(~~(Date.now() / 1000) - 605).toString(16);
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

      const bufferMetadata = Buffer.from(stringify(message));
      const encryptedDetails = await encrypt(getPubKeyECC(PRIVATE_KEY), bufferMetadata);
      // @ts-expect-error testing
      const serializedEncryptedDetails = globalThis.btoa(stringify(encryptedDetails));

      const metadataParams = storageLayer.generateMetadataParams(serializedEncryptedDetails, undefined, PRIVATE_KEY);
      // @ts-expect-error testing
      metadataParams.set_data.timestamp = new BN(~~(Date.now() / 1000) - 10).toString(16); // change timestamp, signature no longer valid
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
        privateKeys.push(generatePrivate().toString("hex"));
      }

      finalMetadataParams = [];
      // @ts-expect-error testing
      finalMetadataParams = await Promise.all(
        messages.map(async (el, i) => {
          const bufferMetadata = Buffer.from(stringify(el));
          const encryptedDetails = await encrypt(getPubKeyECC(privateKeys[i]), bufferMetadata);
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
      finalMetadataParams[0].set_data.timestamp = new BN(~~(Date.now() / 1000) - 605).toString(16);
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
      finalMetadataParams[0].set_data.timestamp = new BN(~~(Date.now() / 1000) - 10).toString(16);
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
      privKey = new BN(generatePrivate());
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
});
