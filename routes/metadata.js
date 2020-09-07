const log = require("loglevel");
const express = require("express");
const IpfsHttpClient = require("ipfs-http-client");

const client = IpfsHttpClient({ host: "localhost" });

const { getError, constructKey } = require("../utils");
const { validationMiddleware, validationLoopMiddleware, validateMetadataLoopInput, validateLoopSignature } = require("../middleware");
const { knexRead, knexWrite } = require("../database");
const { validateMetadataInput, validateSignature } = require("../middleware");

const router = express.Router();

router.post("/get", validationMiddleware(["pub_key_X", "pub_key_Y"]), async (req, res) => {
  try {
    const { namespace, pub_key_X: pubKeyX, pub_key_Y: pubKeyY } = req.body;
    const key = constructKey(pubKeyX, pubKeyY, namespace);
    const data = await knexRead("data").where({ key }).first();
    return res.json({ message: (data && data.value) || "" });
  } catch (error) {
    log.error("get metadata failed", error);
    return res.status(500).json({ error: getError(error), success: false });
  }
});

router.post("/set", validationMiddleware([("pub_key_X", "pub_key_Y", "signature")]), validateMetadataInput, validateSignature, async (req, res) => {
  try {
    const {
      namespace,
      pub_key_X: pubKeyX,
      pub_key_Y: pubKeyY,
      set_data: { data },
    } = req.body;
    const key = constructKey(pubKeyX, pubKeyY, namespace);
    await knexWrite("data")
      .insert({
        key,
        value: data,
      })
      .onDuplicateUpdate("value", { updated_at: new Date(Date.now()) });

    const ipfsResult = await client.add({ path: key, content: data });
    return res.json({ message: ipfsResult.cid.toBaseEncodedString() });
  } catch (error) {
    log.error("set metadata failed", error);
    return res.status(500).json({ error: getError(error), success: false });
  }
});

router.post(
  "/bulk_set",
  validationLoopMiddleware([("pub_key_X", "pub_key_Y", "signature")], "shares"),
  validateMetadataLoopInput("shares"),
  validateLoopSignature("shares"),
  async (req, res) => {
    try {
      const { shares } = req.body;
      const requiredData = shares.map((x) => {
        const {
          namespace,
          pub_key_X: pubKeyX,
          pub_key_Y: pubKeyY,
          set_data: { data },
        } = x;
        return { key: constructKey(pubKeyX, pubKeyY, namespace), value: data };
      });
      await knexWrite("data")
        .insert(requiredData)
        .onDuplicateUpdate("value", { updated_at: new Date(Date.now()) });

      const ipfsResultIterator = client.addAll(
        requiredData.map((x) => {
          return {
            path: x.key,
            content: x.value,
          };
        })
      );
      const ipfsResult = [];
      for await (const entry of ipfsResultIterator) {
        ipfsResult.push(entry);
      }
      return res.json({ message: ipfsResult.map((x) => x.cid.toBaseEncodedString()) });
    } catch (error) {
      log.error("bulk set metadata failed", error);
      return res.status(500).json({ error: getError(error), success: false });
    }
  }
);

module.exports = router;
