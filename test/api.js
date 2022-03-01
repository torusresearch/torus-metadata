/* eslint-disable import/no-extraneous-dependencies */
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
      metadataParams.set_data.timestamp = new BN(~~(Date.now() / 1000) - 65).toString(16);
      try {
        await post(`${server}/set`, metadataParams);
      } catch (err) {
        const val = await err.json();
        assert.deepStrictEqual(val.error.timestamp, "Message has been signed more than 60s ago"); // same goes for pubkeyY
      }
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
      finalMetadataParams[0].set_data.timestamp = new BN(~~(Date.now() / 1000) - 65).toString(16);
      const FD = new FormData();
      finalMetadataParams.forEach((el, index) => {
        FD.append(index.toString(), JSON.stringify(el));
      });

      try {
        await post(`${server}/bulk_set_stream`, FD, options, customOptions);
      } catch (err) {
        const { error } = await err.json();
        assert.deepStrictEqual(error.timestamp, "Message has been signed more than 60s ago"); // same goes for pubkeyY
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
});
