const IpfsHttpClient = require("ipfs-http-client");

const ipfsClient = IpfsHttpClient({
  host: process.env.IPFS_HOSTNAME,
  port: process.env.IPFS_PORT,
  protocol: process.env.IPFS_PROTOCOL,
  headers: {
    authorization: `Bearer ${process.env.INFURA_IPFS_AUTH_TOKEN}`,
  },
});

module.exports = ipfsClient;
