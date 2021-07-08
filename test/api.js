/* eslint-disable no-console */
/* eslint-disable node/no-unpublished-require */
/**
 * @fileOverview Unit test file for API-calls
 * @module
 * @author Shubham Rathi
 * @requires NPM:chai
 * @requires NPM:chai-http
 */

// setup for TorusStorageLayer
global.btoa = require("btoa");
global.atob = require("atob");
global.fetch = require("node-fetch");
global.FormData = require("form-data");

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
const { OnUnhandledRejection } = require("@sentry/node/dist/integrations");
require("dotenv").config();

const port = 5051;
const host = process.env.HOST || "localhost";
const server = `http://${host}:${port}`;
chai.use(chaiHttp);
const { assert, request } = chai;

// Comment in/out the following line to include/disclude comments in terminal
if (process.env.LOG_DEBUG === "no") {
  console.log = function () {};
}

/**
 * Testing API calls.
 */
describe("API-calls", function () {
  /**
   * DO NOT USE THIS PAIR ELSE WHERE. THIS IS STRICTLY FOR TESTING PURPOSES.
   */
  const publicAddress = "0xd682b1Db49c010BF03BafC4Cf7CC366D9b8A4a03";
  const privateKey = "9bc166bda58a5e189bf24f4faa1296c5fcf9b818ed23492d5a7239ce102e9301";

  /**
   * before() block is called before all the other tests are conducted
   * we are using this to generate a authentication token
   */
  before("One time execution for all tests", async function () {});

  /*
   * Test the /default route
   */
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
    let storageLayer = new TorusStorageLayer({ hostUrl: server });

    beforeEach(function () {
      PRIVATE_KEY = new BN(generatePrivate());
    });

    it("#it should not pass if signature field is missing", async function () {
      const message = {
        test: Math.random().toString(36).substring(7),
      };

      const bufferMetadata = Buffer.from(stringify(message));
      let encryptedDetails = await encrypt(getPubKeyECC(PRIVATE_KEY), bufferMetadata);
      const serializedEncryptedDetails = btoa(stringify(encryptedDetails));

      let metadataParams = storageLayer.generateMetadataParams(serializedEncryptedDetails, undefined, PRIVATE_KEY);
      metadataParams.signature = ""; // remove signature
      try {
        await post(`${server}/set`, metadataParams);
      } catch (err) {
        let { error } = await err.json();
        assert.deepStrictEqual(error.signature, "signature field is required");
      }
    });

    it("#it should not pass if pubKeyX/pubKeyY field is missing", async function () {
      const message = {
        test: Math.random().toString(36).substring(7),
      };

      const bufferMetadata = Buffer.from(stringify(message));
      let encryptedDetails = await encrypt(getPubKeyECC(PRIVATE_KEY), bufferMetadata);
      const serializedEncryptedDetails = btoa(stringify(encryptedDetails));

      let metadataParams = storageLayer.generateMetadataParams(serializedEncryptedDetails, undefined, PRIVATE_KEY);
      metadataParams.pub_key_X = ""; // remove signature
      try {
        await post(`${server}/set`, metadataParams);
      } catch (err) {
        let { error } = await err.json();
        assert.deepStrictEqual(error.pub_key_X, "pub_key_X field is required"); // same goes for pubkeyY
      }
    });

    it("#it should not pass if the timestamp is missing", async function () {
      const message = {
        test: Math.random().toString(36).substring(7),
      };

      const bufferMetadata = Buffer.from(stringify(message));
      let encryptedDetails = await encrypt(getPubKeyECC(PRIVATE_KEY), bufferMetadata);
      const serializedEncryptedDetails = btoa(stringify(encryptedDetails));

      let metadataParams = storageLayer.generateMetadataParams(serializedEncryptedDetails, undefined, PRIVATE_KEY);
      metadataParams.set_data.timestamp = ""; // remove signature
      try {
        await post(`${server}/set`, metadataParams);
      } catch (err) {
        let { error } = await err.json();
        assert.deepStrictEqual(error.timestamp, "timestamp field is required"); // same goes for pubkeyY
      }
    });

    it("#it should not pass if the timestamp is old", async function () {
      const message = {
        test: Math.random().toString(36).substring(7),
      };

      const bufferMetadata = Buffer.from(stringify(message));
      let encryptedDetails = await encrypt(getPubKeyECC(PRIVATE_KEY), bufferMetadata);
      const serializedEncryptedDetails = btoa(stringify(encryptedDetails));

      let metadataParams = storageLayer.generateMetadataParams(serializedEncryptedDetails, undefined, PRIVATE_KEY);
      metadataParams.set_data.timestamp = new BN(~~(Date.now() / 1000) - 65).toString(16);
      try {
        await post(`${server}/set`, metadataParams);
      } catch (err) {
        let { error } = await err.json();
        assert.deepStrictEqual(error.timestamp, "Message has been signed more than 60s ago"); // same goes for pubkeyY
      }
    });

    it("#it should not pass if signature is invalid", async function () {
      const message = {
        test: Math.random().toString(36).substring(7),
      };

      const bufferMetadata = Buffer.from(stringify(message));
      let encryptedDetails = await encrypt(getPubKeyECC(PRIVATE_KEY), bufferMetadata);
      const serializedEncryptedDetails = btoa(stringify(encryptedDetails));

      let metadataParams = storageLayer.generateMetadataParams(serializedEncryptedDetails, undefined, PRIVATE_KEY);
      metadataParams.set_data.timestamp = new BN(~~(Date.now() / 1000) - 10).toString(16); // change timestamp, signature no longer valid
      try {
        await post(`${server}/set`, metadataParams);
      } catch (err) {
        let { error } = await err.json();
        assert.deepStrictEqual(error.signature, "Invalid signature"); // same goes for pubkeyY
      }
    });

    it("#it should be able to set/get metadata with correct validation", async function () {
      const message = {
        test: Math.random().toString(36).substring(7),
      };

      await storageLayer.setMetadata({ input: message, privKey: PRIVATE_KEY });
      let data = await storageLayer.getMetadata({ privKey: PRIVATE_KEY });
      assert.strictEqual(data.test, message.test);
    });
  });

  describe("/bulk_set_stream", function () {
    let PRIVATE_KEY;
    let storageLayer = new TorusStorageLayer({ hostUrl: server });
    let messages = [];
    let privateKeys = [];
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

    beforeEach(function () {
      PRIVATE_KEY = new BN(generatePrivate());
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
    });

    it("#it should reject if data is not an array", async function () {
      const finalMetadataParams = await Promise.all(
        messages.map(async (el, i) => {
          const bufferMetadata = Buffer.from(stringify(el));
          let encryptedDetails = await encrypt(getPubKeyECC(privateKeys[i]), bufferMetadata);
          const serializedEncryptedDetails = btoa(stringify(encryptedDetails));
          const metadataParams = storageLayer.generateMetadataParams(serializedEncryptedDetails, undefined, privateKeys[i]);
          return metadataParams;
        })
      );

      const FD = new FormData();
      finalMetadataParams.forEach((_, index) => {
        FD.append(index.toString(), "");
      });

      try {
        await post(`${server}/bulk_set_stream`, FD, options, customOptions);
      } catch (err) {
        let { error } = await err.json();
        assert.deepStrictEqual(error.message, "Unexpected end of JSON input"); // same goes for pubkeyY
      }
    });

    it("#it should reject if one of the shares has missing pubkey", async function () {
      const finalMetadataParams = await Promise.all(
        messages.map(async (el, i) => {
          const bufferMetadata = Buffer.from(stringify(el));
          let encryptedDetails = await encrypt(getPubKeyECC(privateKeys[i]), bufferMetadata);
          const serializedEncryptedDetails = btoa(stringify(encryptedDetails));
          const metadataParams = storageLayer.generateMetadataParams(serializedEncryptedDetails, undefined, privateKeys[i]);
          return metadataParams;
        })
      );

      finalMetadataParams[0].pub_key_X = "";
      const FD = new FormData();
      finalMetadataParams.forEach((el, index) => {
        FD.append(index.toString(), JSON.stringify(el));
      });

      try {
        await post(`${server}/bulk_set_stream`, FD, options, customOptions);
      } catch (err) {
        let { error } = await err.json();
        assert.deepStrictEqual(error.pub_key_X, "pub_key_X field is required"); // same goes for pubkeyY
      }
    });

    it("#it should reject if one of the shares has an invalid signature", async function () {
      const finalMetadataParams = await Promise.all(
        messages.map(async (el, i) => {
          const bufferMetadata = Buffer.from(stringify(el));
          let encryptedDetails = await encrypt(getPubKeyECC(privateKeys[i]), bufferMetadata);
          const serializedEncryptedDetails = btoa(stringify(encryptedDetails));
          const metadataParams = storageLayer.generateMetadataParams(serializedEncryptedDetails, undefined, privateKeys[i]);
          return metadataParams;
        })
      );

      finalMetadataParams[0].set_data.timestamp = new BN(~~(Date.now() / 1000) - 65).toString(16);
      const FD = new FormData();
      finalMetadataParams.forEach((el, index) => {
        FD.append(index.toString(), JSON.stringify(el));
      });

      try {
        await post(`${server}/bulk_set_stream`, FD, options, customOptions);
      } catch (err) {
        let { error } = await err.json();
        assert.deepStrictEqual(error.timestamp, "Message has been signed more than 60s ago"); // same goes for pubkeyY
      }
    });

    it("#it should reject if one of the shares has incorrect timestamp", async function () {
      const finalMetadataParams = await Promise.all(
        messages.map(async (el, i) => {
          const bufferMetadata = Buffer.from(stringify(el));
          let encryptedDetails = await encrypt(getPubKeyECC(privateKeys[i]), bufferMetadata);
          const serializedEncryptedDetails = btoa(stringify(encryptedDetails));
          const metadataParams = storageLayer.generateMetadataParams(serializedEncryptedDetails, undefined, privateKeys[i]);
          return metadataParams;
        })
      );

      finalMetadataParams[0].set_data.timestamp = new BN(~~(Date.now() / 1000) - 10).toString(16);
      const FD = new FormData();
      finalMetadataParams.forEach((el, index) => {
        FD.append(index.toString(), JSON.stringify(el));
      });

      try {
        await post(`${server}/bulk_set_stream`, FD, options, customOptions);
      } catch (err) {
        let { error } = await err.json();
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
