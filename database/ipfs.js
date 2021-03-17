const IpfsHttpClient = require("ipfs-http-client");

const ipfsClient = IpfsHttpClient({
  host: process.env.IPFS_HOSTNAME,
  port: process.env.IPFS_PORT,
  protocol: process.env.IPFS_PROTOCOL,
  headers: {
    authorization: `Bearer ${process.env.INFURA_IPFS_AUTH_TOKEN}`,
  },
});

ipfsClient.getHashAndWriteAsync = async function (data) {
  // Get hash
  const ipfsResultIterator = ipfsClient.addAll(
    data.map((x) => ({
      path: x.key,
      content: x.value,
      options: { onlyHash: true },
    }))
  );
  const ipfsResult = [];
  for await (const entry of ipfsResultIterator) {
    ipfsResult.push(entry);
  }

  // Write async
  ipfsClient.addAll(
    data.map((x) => ({
      path: x.key,
      content: x.value,
    }))
  );

  return ipfsResult;
};

module.exports = ipfsClient;
