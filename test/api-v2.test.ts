/* eslint-disable n/no-unsupported-features/node-builtins */
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { bytesToHex, hexToBytes } from "@noble/curves/utils.js";
import { generatePrivate } from "@toruslabs/eccrypto";
import { keccak256 } from "js-sha3";
import stringify from "json-stable-stringify";
import { assert, beforeEach, describe, expect, it } from "vitest";

const port = 5051;
const host = process.env.HOST || "localhost";
const server = `http://${host}:${port}`;

// Helper to get public key coordinates from private key using noble-curves
function getPublicKeyCoordinates(privateKeyHex: string): { x: string; y: string } {
  const pubKey = secp256k1.getPublicKey(hexToBytes(privateKeyHex.padStart(64, "0")), false);
  return {
    x: bytesToHex(pubKey.slice(1, 33)),
    y: bytesToHex(pubKey.slice(33, 65)),
  };
}

// Helper to sign with recovery using noble-curves (v2 format: recovery + r + s)
function signWithRecoveryV2(privateKeyHex: string, msgHash: Uint8Array): Uint8Array {
  // format: 'recovered' returns [recovery(1 byte), r(32 bytes), s(32 bytes)]
  // prehash: false because msgHash is already a keccak256 hash
  return secp256k1.sign(msgHash, hexToBytes(privateKeyHex.padStart(64, "0")), {
    lowS: true,
    prehash: false,
    format: "recovered",
  });
}

// Helper to convert Uint8Array to base64
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return globalThis.btoa(binary);
}

// Helper to generate metadata params using noble-curves (v2 signature format)
function generateMetadataParamsV2(data: string, privateKeyHex: string) {
  const setData = {
    data,
    timestamp: Math.floor(Date.now() / 1000).toString(16),
  };

  const msgHash = hexToBytes(keccak256(stringify(setData) as string));
  const sig = signWithRecoveryV2(privateKeyHex, msgHash);
  const { x: pub_key_X, y: pub_key_Y } = getPublicKeyCoordinates(privateKeyHex);

  return {
    pub_key_X,
    pub_key_Y,
    set_data: setData,
    signature: uint8ArrayToBase64(sig),
  };
}

describe("API-v2-calls", function () {
  describe("/v2/set", function () {
    let privateKeyHex: string;

    beforeEach(function () {
      privateKeyHex = bytesToHex(generatePrivate());
    });

    it("#it should reject if signature field is missing", async function () {
      const message = {
        test: Math.random().toString(36).substring(7),
      };

      const metadataParams = generateMetadataParamsV2(JSON.stringify(message), privateKeyHex);
      metadataParams.signature = ""; // remove signature

      const res = await fetch(`${server}/v2/set`, {
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

      const metadataParams = generateMetadataParamsV2(JSON.stringify(message), privateKeyHex);
      metadataParams.pub_key_X = ""; // remove pubKeyX

      const res = await fetch(`${server}/v2/set`, {
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

      const metadataParams = generateMetadataParamsV2(JSON.stringify(message), privateKeyHex);
      metadataParams.set_data.timestamp = ""; // remove timestamp

      const res = await fetch(`${server}/v2/set`, {
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

      const metadataParams = generateMetadataParamsV2(JSON.stringify(message), privateKeyHex);
      // Set timestamp to 605 seconds ago
      metadataParams.set_data.timestamp = (Math.floor(Date.now() / 1000) - 605).toString(16);

      // Re-sign with the old timestamp
      const msgHash = hexToBytes(keccak256(stringify(metadataParams.set_data) as string));
      metadataParams.signature = uint8ArrayToBase64(signWithRecoveryV2(privateKeyHex, msgHash));

      const res = await fetch(`${server}/v2/set`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(metadataParams),
      });
      expect(res.status).toBe(403);
      const val = await res.json();
      expect(val.error.timestamp).toBe("Message has been signed more than 600s ago");
    });

    it("#it should reject if signature is invalid", async function () {
      const message = {
        test: Math.random().toString(36).substring(7),
      };

      const metadataParams = generateMetadataParamsV2(JSON.stringify(message), privateKeyHex);
      // Change timestamp without re-signing, making signature invalid
      metadataParams.set_data.timestamp = (Math.floor(Date.now() / 1000) - 10).toString(16);

      const res = await fetch(`${server}/v2/set`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(metadataParams),
      });
      expect(res.status).toBe(403);
      const val = await res.json();
      expect(val.error.signature).toBe("Invalid signature");
    });

    it("#it should be able to set/get metadata with correct validation", async function () {
      const message = {
        test: Math.random().toString(36).substring(7),
      };

      const metadataParams = generateMetadataParamsV2(JSON.stringify(message), privateKeyHex);

      // Set metadata
      const setRes = await fetch(`${server}/v2/set`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(metadataParams),
      });
      expect(setRes.status).toBe(200);

      // Get metadata (using v1 endpoint which shares the same data store)
      const { pub_key_X, pub_key_Y } = metadataParams;
      const getRes = await fetch(`${server}/get`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pub_key_X, pub_key_Y }),
      });
      expect(getRes.status).toBe(200);
      const data = await getRes.json();
      assert.strictEqual(data.message, JSON.stringify(message));
    });
  });

  describe("/v2/bulk_set", function () {
    let messages: { test: string }[] = [];
    let privateKeys: string[] = [];

    beforeEach(async function () {
      messages = [];
      for (let i = 0; i < 4; i += 1) {
        messages.push({
          test: Math.random().toString(36).substring(7),
        });
      }

      privateKeys = [];
      for (let i = 0; i < 4; i += 1) {
        privateKeys.push(bytesToHex(generatePrivate()));
      }
    });

    it("#it should reject if one of the shares has missing pubkey", async function () {
      const shares = messages.map((el, i) => generateMetadataParamsV2(JSON.stringify(el), privateKeys[i]));
      shares[0].pub_key_X = "";

      const res = await fetch(`${server}/v2/bulk_set`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ shares }),
      });

      expect(res.status).toBe(400);
      const val = await res.json();
      expect(val.validation.body.message).toBe('"shares[0].pub_key_X" is not allowed to be empty');
    });

    it("#it should reject if one of the shares has an old timestamp", async function () {
      const shares = messages.map((el, i) => generateMetadataParamsV2(JSON.stringify(el), privateKeys[i]));

      // Set old timestamp and re-sign
      shares[0].set_data.timestamp = (Math.floor(Date.now() / 1000) - 605).toString(16);
      const msgHash = hexToBytes(keccak256(stringify(shares[0].set_data) as string));
      shares[0].signature = uint8ArrayToBase64(signWithRecoveryV2(privateKeys[0], msgHash));

      const res = await fetch(`${server}/v2/bulk_set`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ shares }),
      });

      expect(res.status).toBe(403);
      const val = await res.json();
      expect(val.error.timestamp).toBe("Message has been signed more than 600s ago");
    });

    it("#it should reject if one of the shares has an invalid signature", async function () {
      const shares = messages.map((el, i) => generateMetadataParamsV2(JSON.stringify(el), privateKeys[i]));

      // Change timestamp without re-signing
      shares[0].set_data.timestamp = (Math.floor(Date.now() / 1000) - 10).toString(16);

      const res = await fetch(`${server}/v2/bulk_set`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ shares }),
      });

      expect(res.status).toBe(403);
      const val = await res.json();
      expect(val.error.signature).toBe("Invalid signature");
    });

    it("#it should be able to bulk set/get data correctly", async function () {
      const shares = messages.map((el, i) => generateMetadataParamsV2(JSON.stringify(el), privateKeys[i]));

      // Bulk set
      const setRes = await fetch(`${server}/v2/bulk_set`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ shares }),
      });
      expect(setRes.status).toBe(200);

      // Verify each share was stored
      for (let i = 0; i < shares.length; i++) {
        const { pub_key_X, pub_key_Y } = shares[i];
        const getRes = await fetch(`${server}/get`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ pub_key_X, pub_key_Y }),
        });
        expect(getRes.status).toBe(200);
        const data = await getRes.json();
        assert.strictEqual(data.message, JSON.stringify(messages[i]));
      }
    });
  });
});
