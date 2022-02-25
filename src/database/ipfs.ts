import CID from "cids";
import multihashing from "multihashing-async";
import { TextEncoder } from "util";

import { Data } from "../utils/interfaces";

export const getHashAndWriteAsync = async function (data: Record<string, Partial<Data>[]>): Promise<string[]> {
  // Get hash
  const hashes = await Promise.all(
    Object.values(data).map((x: Partial<Data>[]) => {
      const bytes = new TextEncoder().encode(JSON.stringify(x));
      return multihashing(bytes, "sha2-256");
    })
  );

  const ipfsResult = hashes.map((x) => {
    const cid = new CID(x);
    return cid.toString();
  });
  return ipfsResult;
};
