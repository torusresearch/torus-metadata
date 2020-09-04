const log = require("loglevel");
const express = require("express");
const IpfsHttpClient = require("ipfs-http-client");

const client = IpfsHttpClient({ host: "ipfs" });

const { getError, constructKey } = require("../utils");
const { validationMiddleware } = require("../middleware");
const { knexRead, knexWrite } = require("../database");
const { validateMetadataInput, validateSignature } = require("../middleware");

const router = express.Router();

router.post("/get", validationMiddleware(["pub_key_X", "pub_key_Y"]), async (req, res) => {
  try {
    const { namespace, pub_key_X: pubKeyX, pub_key_Y: pubKeyY } = req.body;
    const key = constructKey(pubKeyX, pubKeyY, namespace);
    const data = await knexRead("data").where({ key }).first();
    log.info(key, data);
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
    const result = await knexWrite("data").where({ key });
    if (result.length === 0) {
      await knexWrite("data").insert({
        key,
        value: data,
      });
    } else {
      await knexWrite("data")
        .where({ key })
        .update({
          value: data,
          updated_at: new Date(Date.now()),
        });
    }

    const ipfsResult = await client.add({ path: key, content: data });
    return res.json({ message: ipfsResult.cid.toBaseEncodedString() });
  } catch (error) {
    log.error("set metadata failed", error);
    return res.status(500).json({ error: getError(error), success: false });
  }
});

module.exports = router;
