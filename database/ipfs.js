const multihashing = require("multihashing-async");
const CID = require("cids");

exports.getHashAndWriteAsync = async function (data) {
  // Get hash
  const hashes = await Promise.all(
    Object.values(data).map((x) => {
      const bytes = new TextEncoder().encode(x);
      return multihashing(bytes, "sha2-256");
    })
  );

  const ipfsResult = hashes.map((x) => {
    const cid = new CID(x);
    return cid.toString();
  });
  return ipfsResult;
};
