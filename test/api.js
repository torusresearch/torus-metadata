/* eslint-disable */
/* eslint-disable node/no-extraneous-require */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable node/no-unpublished-require */

const { TorusStorageLayer } = require("@tkey/storage-layer-torus");
const { encrypt, getPubKeyECC } = require("@tkey/common-types");
const stringify = require("json-stable-stringify");
const { post } = require("@toruslabs/http-helpers");

// During the test the env variable is set to test
// Require the dev-dependencies
const chai = require("chai");
const chaiHttp = require("chai-http");
const BN = require("bn.js");
const { generatePrivate } = require("@toruslabs/eccrypto");

const port = 5051;
const host = process.env.HOST || "localhost";
const server = `http://${host}:${port}`;
chai.use(chaiHttp);
const { assert, request } = chai;

const randomID = () => `${Math.random().toString(36).substring(2, 9)}`;
const { generateGetOrSetNonceParams } = require("./util");
/**
 * Testing API calls.
 */
describe("API-calls", function () {
  describe("/default", function () {
    it("it should return a welcome message", async function () {
      const res = await request(server).get("/");
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.text, "Welcome to Torus Metadata");
    });

    it("it should return ok message", async function () {
      const res = await request(server).get("/health");
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.text, "Ok!");
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
      const serializedEncryptedDetails = globalThis.btoa(stringify(encryptedDetails));

      const metadataParams = storageLayer.generateMetadataParams(serializedEncryptedDetails, undefined, PRIVATE_KEY);
      metadataParams.signature = ""; // remove signature
      try {
        await post(`${server}/set`, metadataParams);
      } catch (err) {
        const val = await err.json();
        assert.deepStrictEqual(val.validation.body.message, '"signature" is not allowed to be empty');
      }
    });

    it("#it should reject if pubKeyX/pubKeyY field is missing", async function () {
      const message = {
        test: Math.random().toString(36).substring(7),
      };

      const bufferMetadata = Buffer.from(stringify(message));
      const encryptedDetails = await encrypt(getPubKeyECC(PRIVATE_KEY), bufferMetadata);
      const serializedEncryptedDetails = globalThis.btoa(stringify(encryptedDetails));

      const metadataParams = storageLayer.generateMetadataParams(serializedEncryptedDetails, undefined, PRIVATE_KEY);
      metadataParams.pub_key_X = ""; // remove signature
      try {
        await post(`${server}/set`, metadataParams);
      } catch (err) {
        const val = await err.json();
        assert.deepStrictEqual(val.validation.body.message, '"pub_key_X" is not allowed to be empty');
      }
    });

    it("#it should reject if the timestamp is missing", async function () {
      const message = {
        test: Math.random().toString(36).substring(7),
      };

      const bufferMetadata = Buffer.from(stringify(message));
      const encryptedDetails = await encrypt(getPubKeyECC(PRIVATE_KEY), bufferMetadata);
      const serializedEncryptedDetails = globalThis.btoa(stringify(encryptedDetails));

      const metadataParams = storageLayer.generateMetadataParams(serializedEncryptedDetails, undefined, PRIVATE_KEY);
      metadataParams.set_data.timestamp = ""; // remove signature
      try {
        await post(`${server}/set`, metadataParams);
      } catch (err) {
        const val = await err.json();
        assert.deepStrictEqual(val.validation.body.message, '"set_data.timestamp" is not allowed to be empty');
      }
    });

    it("#it should reject if the timestamp is old", async function () {
      const message = {
        test: Math.random().toString(36).substring(7),
      };

      const bufferMetadata = Buffer.from(stringify(message));
      const encryptedDetails = await encrypt(getPubKeyECC(PRIVATE_KEY), bufferMetadata);
      const serializedEncryptedDetails = globalThis.btoa(stringify(encryptedDetails));

      const metadataParams = storageLayer.generateMetadataParams(serializedEncryptedDetails, undefined, PRIVATE_KEY);
      metadataParams.set_data.timestamp = new BN(~~(Date.now() / 1000) - 95).toString(16);
      try {
        await post(`${server}/set`, metadataParams);
      } catch (err) {
        const val = await err.json();
        assert.deepStrictEqual(val.error.timestamp, "Message has been signed more than 90s ago"); // same goes for pubkeyY
      }
    });

    it("#it should set new nonce for new user with ed25519 key, when validation is correct", async function () {
      const msg = "getOrSetNonce";
      const data = "getOrSetNonce";
      const privKeyNew = new BN(generatePrivate());
      const metadataParams = generateGetOrSetNonceParams(msg, data, privKeyNew, "ed25519");
      const val = await post(`${server}/get_or_set_nonce`, metadataParams);

      assert.isString(val.nonce);
    });

    it("#it should reject if signature is invalid", async function () {
      const message = {
        test: Math.random().toString(36).substring(7),
      };

      const bufferMetadata = Buffer.from(stringify(message));
      const encryptedDetails = await encrypt(getPubKeyECC(PRIVATE_KEY), bufferMetadata);
      const serializedEncryptedDetails = globalThis.btoa(stringify(encryptedDetails));

      const metadataParams = storageLayer.generateMetadataParams(serializedEncryptedDetails, undefined, PRIVATE_KEY);
      metadataParams.set_data.timestamp = new BN(~~(Date.now() / 1000) - 10).toString(16); // change timestamp, signature no longer valid
      try {
        await post(`${server}/set`, metadataParams);
      } catch (err) {
        const val = await err.json();
        assert.deepStrictEqual(val.error.signature, "Invalid signature"); // same goes for pubkeyY
      }
    });

    it("#it should be able to set/get metadata with correct validation", async function () {
      const message = {
        test: Math.random().toString(36).substring(7),
      };

      await storageLayer.setMetadata({ input: message, privKey: PRIVATE_KEY });
      const data = await storageLayer.getMetadata({ privKey: PRIVATE_KEY });
      assert.strictEqual(data.test, message.test);
    });
  });

  describe("/bulk_set_stream", function () {
    const storageLayer = new TorusStorageLayer({ hostUrl: server });
    let messages = [];
    let privateKeys = [];
    let finalMetadataParams = [];
    const options = {
      mode: "cors",
      method: "POST",
      headers: {
        "Content-Type": undefined,
      },
    };

    const customOptions = {
      isUrlEncodedData: true,
    };

    beforeEach(async function () {
      messages = [];
      for (let i = 0; i < 4; i += 1) {
        messages.push({
          test: Math.random().toString(36).substring(7),
        });
      }

      privateKeys = [];
      for (let i = 0; i < 4; i += 1) {
        privateKeys.push(generatePrivate().toString("hex"));
      }

      finalMetadataParams = [];
      finalMetadataParams = await Promise.all(
        messages.map(async (el, i) => {
          const bufferMetadata = Buffer.from(stringify(el));
          const encryptedDetails = await encrypt(getPubKeyECC(privateKeys[i]), bufferMetadata);
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

      try {
        await post(`${server}/bulk_set_stream`, FD, options, customOptions);
      } catch (err) {
        const { error } = await err.json();
        assert.deepStrictEqual(error.message, "Unexpected end of JSON input"); // same goes for pubkeyY
      }
    });

    it("#it should reject if one of the shares has missing pubkey", async function () {
      finalMetadataParams[0].pub_key_X = "";
      const FD = new FormData();
      finalMetadataParams.forEach((el, index) => {
        FD.append(index.toString(), JSON.stringify(el));
      });

      try {
        await post(`${server}/bulk_set_stream`, FD, options, customOptions);
      } catch (err) {
        const error = await err.json();
        assert.deepStrictEqual(error.validation.body.message, '"shares[0].pub_key_X" is not allowed to be empty'); // same goes for pubkeyY
      }
    });

    it("#it should reject if one of the shares has an old timestamp", async function () {
      finalMetadataParams[0].set_data.timestamp = new BN(~~(Date.now() / 1000) - 95).toString(16);
      const FD = new FormData();
      finalMetadataParams.forEach((el, index) => {
        FD.append(index.toString(), JSON.stringify(el));
      });

      try {
        await post(`${server}/bulk_set_stream`, FD, options, customOptions);
      } catch (err) {
        const { error } = await err.json();
        assert.deepStrictEqual(error.timestamp, "Message has been signed more than 90s ago"); // same goes for pubkeyY
      }
    });

    it("#it should reject if one of the shares has an invalid signature", async function () {
      finalMetadataParams[0].set_data.timestamp = new BN(~~(Date.now() / 1000) - 10).toString(16);
      const FD = new FormData();
      finalMetadataParams.forEach((el, index) => {
        FD.append(index.toString(), JSON.stringify(el));
      });

      try {
        await post(`${server}/bulk_set_stream`, FD, options, customOptions);
      } catch (err) {
        const { error } = await err.json();
        assert.deepStrictEqual(error.signature, "Invalid signature"); // same goes for pubkeyY
      }
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

    before(function () {
      privKey = new BN(generatePrivate());
    });

    it("#can release empty lock", async function () {
      const { status: releaseStatus } = await storageLayer.releaseWriteLock({ id: randomID(), privKey });
      assert.strictEqual(releaseStatus, 1);
    });

    it("#it should acquire lock correctly", async function () {
      const { id, status } = await storageLayer.acquireWriteLock({ privKey });
      assert.strictEqual(status, 1);
      assert.isNotEmpty(id);
      lockId = id;
    });

    it("#it should not re acquire lock correctly", async function () {
      const { status } = await storageLayer.acquireWriteLock({ privKey });
      assert.strictEqual(status, 0);
    });

    it("#it should release lock correctly", async function () {
      const { status: releaseStatus } = await storageLayer.releaseWriteLock({ id: lockId, privKey });
      assert.strictEqual(releaseStatus, 1);
    });

    it("#it should not release another lock of priv key", async function () {
      const { status } = await storageLayer.acquireWriteLock({ privKey });
      assert.strictEqual(status, 1);
      const { status: releaseStatus } = await storageLayer.releaseWriteLock({ id: randomID(), privKey });
      assert.strictEqual(releaseStatus, 2);
    });
  });
  describe("/get_or_set_nonce", function () {
    let privKey;
    before(function () {
      privKey = new BN(generatePrivate());
    });

    it("#it should reject if the pub_key_X/pub_key_Y is missing", async function () {
      const msg = "getOrSetNonce";
      const data = "";
      const metadataParams = generateGetOrSetNonceParams(msg, data, privKey);
      metadataParams.pub_key_X = ""; // remove pub_key_X
      try {
        await post(`${server}/get_or_set_nonce`, metadataParams);
      } catch (err) {
        const val = await err.json();
        assert.deepStrictEqual(val.validation.body.message, '"pub_key_X" is not allowed to be empty');
      }
    });

    it("#it should reject if the signature is missing", async function () {
      const msg = "getOrSetNonce";
      const data = "getOrSetNonce";
      const metadataParams = generateGetOrSetNonceParams(msg, data, privKey);
      metadataParams.signature = ""; // remove signature
      try {
        await post(`${server}/get_or_set_nonce`, metadataParams);
      } catch (err) {
        const val = await err.json();
        assert.deepStrictEqual(val.validation.body.message, '"signature" is not allowed to be empty');
      }
    });

    it("#it should set new nonce for new user with ed25519 key, when validation is correct", async function () {
      const msg = "getOrSetNonce";
      const data = "getOrSetNonce";
      const privKeyNew = new BN(generatePrivate());
      try {
        const metadataParams = generateGetOrSetNonceParams(msg, data, privKeyNew, "ed25519");
        const val = await post(`${server}/get_or_set_nonce`, metadataParams);
        assert.isString(val.nonce);
      } catch (err) {
        console.log({ err });
        const val = await err.json();
        console.log({ val });
      }
    });
  });
});
