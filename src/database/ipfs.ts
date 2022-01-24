import CID from "cids";
import multihashing from "multihashing-async";
import { TextEncoder } from "util";

export const getHashAndWriteAsync = async function (data) {
  // Get hash
  const hashes = await Promise.all(
    Object.values(data).map((x: string) => {
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
